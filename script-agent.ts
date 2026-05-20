import pg from 'pg';
import dotenv from 'dotenv';
import { parseISO, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const usersRes = await pool.query('SELECT * FROM users');
  const paymentsRes = await pool.query('SELECT * FROM payments');
  const configRes = await pool.query('SELECT * FROM config');
  
  const tenants = usersRes.rows.filter(u => ['TENANT', 'AGENT'].includes(u.role) || true);
  const payments = paymentsRes.rows;
  const config = configRes.rows[0] || {};
  const billingStatus = { isInvoiced: false };
  
  const start = startOfMonth(new Date());
  const end = endOfMonth(new Date());

  let total = 0;
  
  tenants.forEach((tenant: any) => {
      const tenantPayments = payments.filter((p: any) => p.tenantId === tenant.id && p.status === 'APPROVED');
      const paymentsThisMonth = tenantPayments.filter((p: any) => isWithinInterval(p.createdAt, { start, end }));
      
      let paidThisMonth = 0;
      let rawPaymentsThisMonth = 0;

      paymentsThisMonth.forEach((p: any) => {
        rawPaymentsThisMonth += p.amount;
        if (p.paymentType === 'RENT') paidThisMonth += p.amount;
        else if (p.paymentType === 'ALL') {
          const tWater = tenant.waterBill || 0;
          const tGarbage = tenant.garbageFee || config?.garbageFee || 0;
          paidThisMonth += Math.max(0, p.amount - tWater - tGarbage);
        }
        else if (p.paymentType === 'MOVE_IN') paidThisMonth += p.amount / 2;
        // MPESA?
        if (p.paymentType === 'MPESA') paidThisMonth += Math.max(0, p.amount - (tenant.waterBill || 0) - (tenant.garbageFee || config?.garbageFee || 0));
      });

      const currentBalance = tenant.totalBalance || 0;
      const estimatedInvoiceAmount = tenant.status === 'ACTIVE' ? ((tenant.rentAmount || 0) + (tenant.waterBill || 0) + (tenant.garbageFee || config?.garbageFee || 0)) : 0;
      const startBalance = currentBalance - (billingStatus?.isInvoiced ? estimatedInvoiceAmount : 0) + rawPaymentsThisMonth;

      let carryOverCredit = startBalance < 0 ? Math.abs(startBalance) : 0;
      let pastArrears = startBalance > 0 ? startBalance : 0;
      let rentDue = tenant.status === 'ACTIVE' ? (tenant.rentAmount || 0) : 0;
      let rentCollectedThisMonth = 0;

      if (carryOverCredit > 0) {
        let appliedCredit = Math.min(carryOverCredit, rentDue);
        rentCollectedThisMonth += appliedCredit;
        rentDue -= appliedCredit;
      }

      if (paidThisMonth > 0) {
        let paymentApplied = Math.min(paidThisMonth, pastArrears + rentDue);
        rentCollectedThisMonth += paymentApplied;
      }

      if (rentCollectedThisMonth > 0) {
        total += rentCollectedThisMonth;
        console.log(`Tenant ${tenant.name}: rentCollected=${rentCollectedThisMonth}, paidThisMonth=${paidThisMonth}, rawPayments=${rawPaymentsThisMonth}, startBalance=${startBalance}`);
      }
  });
  
  console.log('TOTAL:', total);
  process.exit();
}
run();
