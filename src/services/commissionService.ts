import db from '../lib/db';

const DEFAULT_COMMISSION_RATE = 0.06;

type Payment = {
  id: string;
  tenantId: string;
  amount: number;
  paymentType: string;
  status: string;
  createdAt: string;
};

type Tenant = {
  id: string;
  name: string;
  unitNumber: string | null;
  status: string;
  rentAmount: number;
  garbageFee: number | null;
  waterBill: number | null;
  totalBalance: number;
  depositAmount: number | null;
  moveInDate: string | null;
  createdAt: string;
};

export interface CommissionLineItem {
  paymentId: string;
  tenantId: string | null;
  tenantName: string;
  unitNumber: string | null;
  rentPortion: number;
  commission: number;
  date: string;
  note?: string;
}

export interface CommissionResult {
  month: number; // 1-indexed
  year: number;
  rate: number;
  totalRentCollected: number;
  totalCommission: number;
  breakdown: CommissionLineItem[];
}

/**
 * Portion of a payment that counts as "rent" for commission purposes.
 * MOVE_IN payments are treated as half rent / half deposit.
 * Utility, deposit, and repair-deduction payments never count as rent.
 * Everything else (lumpsum/general/cash/bank) is treated as rent.
 *
 * Shared by both the per-tenant loop and the deleted-tenant fallback below
 * so the two can never drift out of sync with each other.
 */
function getRentPortionOfPayment(payment: Payment): number {
  if (payment.paymentType === 'RENT') return payment.amount;
  if (payment.paymentType === 'MOVE_IN') return payment.amount / 2;
  if (['WATER', 'GARBAGE', 'DEPOSIT', 'REPAIR_DEDUCTION'].includes(payment.paymentType)) return 0;
  return payment.amount;
}

function isLumpsumPaymentType(paymentType: string): boolean {
  return !['RENT', 'MOVE_IN', 'WATER', 'GARBAGE', 'DEPOSIT', 'REPAIR_DEDUCTION'].includes(paymentType);
}

function isInPeriod(dateStr: string, month: number, year: number): boolean {
  const d = new Date(dateStr);
  return d.getMonth() === month - 1 && d.getFullYear() === year;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Server-side, authoritative agent commission calculation for a given month/year
 * (defaults to the current month). This is the ONLY place the commission amount
 * should ever be computed — never trust a client-submitted amount.
 *
 * Business logic mirrors what used to live in AgentDashboard's useMemo:
 * - Overpayment carried over from a prior month is credited against this
 *   month's rent and counted as commissionable.
 *   - This month's rent payments are applied against past arrears + this
 *   month's rent and counted as commissionable, up to what's actually owed.
 */
export async function calculateAgentCommission(month?: number, year?: number): Promise<CommissionResult> {
  const now = new Date();
  const targetMonth = month ?? now.getMonth() + 1;
  const targetYear = year ?? now.getFullYear();

  const [config, tenants, approvedPayments, invoicesThisPeriod] = await Promise.all([
    db.prepare("SELECT * FROM config WHERE id = 'property'").get() as Promise<any>,
    db.prepare("SELECT * FROM users WHERE role = 'TENANT'").all() as Promise<Tenant[]>,
    db.prepare("SELECT * FROM payments WHERE status = 'APPROVED'").all() as Promise<Payment[]>,
    db.prepare("SELECT id FROM invoices WHERE month = ? AND year = ? LIMIT 1").all(targetMonth, targetYear)
  ]);

  // Commission rate now lives in config (add a `commissionRate` column to the
  // `config` table) instead of being hardcoded in three separate places.
  const rate = Number(config?.commissionRate) > 0 ? Number(config.commissionRate) : DEFAULT_COMMISSION_RATE;
  const isInvoiced = invoicesThisPeriod.length > 0;
  const periodStart = new Date(targetYear, targetMonth - 1, 1);

  const paymentsThisPeriod = approvedPayments.filter(p => isInPeriod(p.createdAt, targetMonth, targetYear));

  let totalRentCollected = 0;
  const breakdown: CommissionLineItem[] = [];
  const knownTenantIds = new Set(tenants.map(t => t.id));

  for (const tenant of tenants) {
    const tenantPaymentsThisPeriod = paymentsThisPeriod.filter(p => p.tenantId === tenant.id);

    let rawPaymentsThisMonth = 0;
    let pureRentPaidThisMonth = 0;

    const isMovedInThisPeriod = tenant.moveInDate
      ? new Date(tenant.moveInDate) >= periodStart
      : new Date(tenant.createdAt) >= periodStart;

    tenantPaymentsThisPeriod.forEach(p => {
      rawPaymentsThisMonth += p.amount;
      pureRentPaidThisMonth += getRentPortionOfPayment(p);
    });

    // Deduct this period's utilities/deposit from a lumpsum payment, once,
    // since a lumpsum wasn't broken out by type at payment time.
    const hasLumpsum = tenantPaymentsThisPeriod.some(p => isLumpsumPaymentType(p.paymentType));
    if (hasLumpsum) {
      const utilities = isMovedInThisPeriod ? 0 : ((tenant.waterBill || 0) + (tenant.garbageFee || config?.garbageFee || 0));
      pureRentPaidThisMonth = Math.max(0, pureRentPaidThisMonth - utilities);
      if (isMovedInThisPeriod) {
        pureRentPaidThisMonth = Math.max(0, pureRentPaidThisMonth - (tenant.depositAmount || 0));
      }
    }

    const currentBalance = tenant.totalBalance || 0;
    const estimatedInvoiceAmount = tenant.status === 'ACTIVE'
      ? ((tenant.rentAmount || 0) + (isMovedInThisPeriod ? 0 : ((tenant.waterBill || 0) + (tenant.garbageFee || config?.garbageFee || 0))))
      : 0;

    // Reconstruct what the tenant's balance was at the start of the period.
    const startBalance = currentBalance - (isInvoiced ? estimatedInvoiceAmount : 0) + rawPaymentsThisMonth;

    let carryOverCredit = startBalance < 0 ? Math.abs(startBalance) : 0;
    let pastArrears = startBalance > 0 ? startBalance : 0;

    // A positive start balance for a tenant who moved in this period includes
    // their deposit — that portion isn't rent arrears.
    if (isMovedInThisPeriod && startBalance > 0) {
      pastArrears = Math.max(0, pastArrears - (tenant.depositAmount || 0));
    }

    let rentDueThisMonth = tenant.status === 'ACTIVE' ? (tenant.rentAmount || 0) : 0;
    let rentToCommission = 0;

    // 1. Commission on prior-month overpayment applied to this month's rent.
    if (carryOverCredit > 0) {
      const appliedCredit = Math.min(carryOverCredit, rentDueThisMonth);
      rentToCommission += appliedCredit;
      rentDueThisMonth -= appliedCredit;
    }

    // 2. Commission on this period's rent payments applied to arrears + current rent.
    if (pureRentPaidThisMonth > 0) {
      const paymentApplied = Math.min(pureRentPaidThisMonth, pastArrears + rentDueThisMonth);
      rentToCommission += paymentApplied;
    }

    if (rentToCommission > 0) {
      totalRentCollected += rentToCommission;
      breakdown.push({
        paymentId: tenantPaymentsThisPeriod.length > 0 ? tenantPaymentsThisPeriod[0].id : `carry-over-${tenant.id}`,
        tenantId: tenant.id,
        tenantName: tenant.name,
        unitNumber: tenant.unitNumber,
        rentPortion: round2(rentToCommission),
        commission: round2(rentToCommission * rate),
        date: tenantPaymentsThisPeriod.length > 0 ? tenantPaymentsThisPeriod[0].createdAt : new Date().toISOString(),
        note: tenantPaymentsThisPeriod.length === 0 ? 'From Overpayment' : undefined
      });
    }
  }

  // Payments belonging to tenants that have since been deleted still count
  // towards commission for the period they were paid in.
  paymentsThisPeriod
    .filter(p => !knownTenantIds.has(p.tenantId))
    .forEach(p => {
      const rentPart = getRentPortionOfPayment(p);
      if (rentPart > 0) {
        totalRentCollected += rentPart;
        breakdown.push({
          paymentId: p.id,
          tenantId: null,
          tenantName: 'Unknown/Deleted Tenant',
          unitNumber: null,
          rentPortion: round2(rentPart),
          commission: round2(rentPart * rate),
          date: p.createdAt
        });
      }
    });

  return {
    month: targetMonth,
    year: targetYear,
    rate,
    totalRentCollected: round2(totalRentCollected),
    totalCommission: round2(totalRentCollected * rate),
    breakdown
  };
}

/**
 * Has a commission request already been created for this period?
 * Matches on the numeric month/year stored in the expense's metadata,
 * rather than string-matching a human-readable description.
 *
 * NOTE: this check-then-insert has a race window without a DB-level
 * constraint. Recommend adding a unique index once schema access is
 * available, e.g. (Postgres):
 *   CREATE UNIQUE INDEX commission_period_unique
 *   ON expenses (((metadata->>'month')::int), ((metadata->>'year')::int))
 *   WHERE type = 'COMMISSION';
 */
export async function hasExistingCommissionRequest(month: number, year: number): Promise<boolean> {
  const rows = await db.prepare("SELECT metadata FROM expenses WHERE type = 'COMMISSION'").all() as any[];
  return rows.some(r => {
    if (!r.metadata) return false;
    try {
      const meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
      return meta?.month === month && meta?.year === year;
    } catch {
      return false;
    }
  });
}
