import db from '../lib/db';
import crypto from 'crypto';

export const invoicingService = {
  /**
   * Generates monthly invoices for all active tenants.
   * This should be idempotent for a given month/year.
   */
  generateMonthlyInvoices: async (month?: number, year?: number) => {
    const now = new Date();
    const targetMonth = month ?? (now.getMonth() + 1);
    const targetYear = year ?? now.getFullYear();

    console.log(`[InvoicingService] Starting monthly invoice generation for ${targetMonth}/${targetYear}...`);

    // 1. Get all active tenants
    const tenants = await db.prepare("SELECT * FROM users WHERE role = 'TENANT' AND status = 'ACTIVE'").all() as any[];

    let createdCount = 0;
    let skippedCount = 0;

    for (const tenant of tenants) {
      // 2. Check if invoice already exists for this month/year for this tenant
      const existingInvoice = await db.prepare('SELECT id FROM invoices WHERE "tenantId" = ? AND month = ? AND year = ?')
        .get(tenant.id, targetMonth, targetYear);

      if (existingInvoice) {
        skippedCount++;
        continue;
      }

      // 3. Calculate total
      const rent = tenant.rentAmount || 0;
      const garbage = tenant.garbageFee || 0;
      const water = tenant.waterBill || 0;
      const total = rent + garbage + water;

      if (total === 0) {
        skippedCount++;
        continue;
      }

      // 4. Create invoice
      const invoiceId = crypto.randomUUID();
      const dueDate = new Date(targetYear, targetMonth - 1, 5).toISOString(); // Due on 5th of the month

      await db.transaction(async (client) => {
        await client.query(`
          INSERT INTO invoices (id, "tenantId", month, year, "totalAmount", status, "dueDate")
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [invoiceId, tenant.id, targetMonth, targetYear, total, 'UNPAID', dueDate]);

        // 5. Create invoice items
        if (rent > 0) {
          await client.query(`
            INSERT INTO invoice_items (id, "invoiceId", description, type, amount)
            VALUES ($1, $2, $3, $4, $5)
          `, [crypto.randomUUID(), invoiceId, 'Monthly Rent', 'RENT', rent]);
        }

        if (garbage > 0) {
          await client.query(`
            INSERT INTO invoice_items (id, "invoiceId", description, type, amount)
            VALUES ($1, $2, $3, $4, $5)
          `, [crypto.randomUUID(), invoiceId, 'Garbage Fee', 'GARBAGE', garbage]);
        }

        if (water > 0) {
          await client.query(`
            INSERT INTO invoice_items (id, "invoiceId", description, type, amount)
            VALUES ($1, $2, $3, $4, $5)
          `, [crypto.randomUUID(), invoiceId, 'Water Bill', 'WATER', water]);
        }

        // 6. Update tenant's total balance
        await client.query('UPDATE users SET "totalBalance" = "totalBalance" + $1 WHERE id = $2', [total, tenant.id]);

        // Optional: Reset monthly water bill after invoicing
        await client.query('UPDATE users SET "waterBill" = 0 WHERE id = $1', [tenant.id]);
      });

      createdCount++;
    }

    console.log(`[InvoicingService] Finished. Created: ${createdCount}, Skipped: ${skippedCount}`);
    return { createdCount, skippedCount };
  },

  /**
   * Schedules the monthly cron job.
   */
  initScheduledJobs: () => {
    // Disabled blind cron tab to enforce meter-reading-driven invoicing.
    // Invoices are now automagically generated when the last active tenant's meter reading is entered for the month.
    console.log('[InvoicingService] Scheduled cron job disabled in favor of reading-driven invoicing.');
  }
};
