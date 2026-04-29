import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import cookieParser from "cookie-parser";
import db, { initDb } from "./src/lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { invoicingService } from "./src/services/invoicingService";
import { auditService } from "./src/services/auditService";

// const auditService = { log: (e: any) => console.log("Audit log stub:", e.action), getLogs: (l=10, o=0) => [] };
// const invoicingService = { initScheduledJobs: () => {}, generateMonthlyInvoices: () => ({}) };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

async function startServer() {
  await initDb();
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // Request logger
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // Basic health check
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  const COOKIE_OPTIONS: any = { 
    httpOnly: true, 
    secure: true, 
    sameSite: 'none', 
    path: '/' 
  };

  // --- AUTH MIDDLEWARE ---
  // "soft" authenticate: populates req.user if token valid, but doesn't block
  app.use(async (req: any, res, next) => {
    const token = req.cookies.token;
    if (!token) return next();
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const user = await db.prepare("SELECT id, email, role FROM users WHERE id = ?").get(decoded.id);
      if (user) {
        req.user = decoded;
      } else {
        res.clearCookie("token", COOKIE_OPTIONS);
      }
    } catch (e) {
      res.clearCookie("token", COOKIE_OPTIONS);
    }
    next();
  });

  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized. Please log in." });
    next();
  };

  const isStaff = (req: any, res: any, next: any) => {
    if (!req.user || (req.user.role !== 'LANDLORD' && req.user.role !== 'AGENT')) {
      return res.status(403).json({ error: "Forbidden: Staff only" });
    }
    next();
  };

  const isLandlord = (req: any, res: any, next: any) => {
    if (!req.user || req.user.role !== 'LANDLORD') {
      return res.status(403).json({ error: "Forbidden: Landlord only" });
    }
    next();
  };

  // --- API ROUTES ---
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
      if (!user || !user.passwordHash || !bcrypt.compareSync(password, user.passwordHash)) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "1d" });
      res.cookie("token", token, COOKIE_OPTIONS);
      
      await auditService.log({ userId: user.id, userEmail: user.email, action: 'LOGIN', ipAddress: req.ip });
      res.json(user);
    } catch (e: any) {
      console.error("Login error:", e);
      res.status(500).json({ error: e.message || "Internal server error" });
    }
  });

  app.get("/api/auth/status", async (req: any, res) => {
    try {
      const landlord = await db.prepare("SELECT id FROM users WHERE role = 'LANDLORD'").get();
      const isConfigured = !!landlord;
      res.json({ authenticated: !!req.user, user: req.user || null, isConfigured });
    } catch (e: any) {
      res.status(500).json({ error: "Service unavailable" });
    }
  });

  app.post("/api/auth/register", async (req: any, res) => {
    const { name, email, role, unitNumber, rentAmount, garbageFee, phone, password, totalBalance, waterReading } = req.body;
    
    // Check if any landlord exists
    const landlord = await db.prepare("SELECT id FROM users WHERE role = 'LANDLORD'").get();
    
    // If system is configured, require staff auth
    if (landlord && (!req.user || (req.user.role !== 'LANDLORD' && req.user.role !== 'AGENT'))) {
      return res.status(403).json({ error: "Forbidden: Only staff can register new users." });
    }

    const id = crypto.randomUUID();
    const hash = password ? bcrypt.hashSync(password, 10) : bcrypt.hashSync(Math.random().toString(36), 10);
    
    try {
      await db.prepare(`
        INSERT INTO users (id, name, email, "passwordHash", role, "unitNumber", "rentAmount", "garbageFee", phone, "registeredBy", "totalBalance", "waterReading")
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, name, email, hash, role || 'TENANT', unitNumber || null, rentAmount || 0, garbageFee || 0, phone || null, req.user?.id || id, totalBalance || 0, waterReading || 0);
      
      await auditService.log({
        userId: req.user?.id || id,
        userEmail: req.user?.email || email,
        action: 'CREATE_USER',
        entityType: 'USER',
        entityId: id,
        details: { name, email, role },
        ipAddress: req.ip
      });

      const newUser = { id, name, email, role };
      if (!landlord) {
        // Log in the first landlord immediately
        const token = jwt.sign(newUser, JWT_SECRET, { expiresIn: "1d" });
        res.cookie("token", token, COOKIE_OPTIONS);
      }

      res.json(newUser);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    try {
      res.clearCookie("token", COOKIE_OPTIONS);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "Logout failed" });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req: any, res) => {
    try {
      const user = await db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
      res.json(user);
    } catch (e: any) {
      res.status(500).json({ error: "Failed to fetch user data" });
    }
  });

  app.post("/api/auth/setup-password", async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    try {
      const user = await db.prepare("SELECT * FROM users WHERE email = ?").get(email);
      if (!user) {
        return res.status(404).json({ error: "No account found with this email. Please contact your property manager." });
      }

      if (user.isPasswordSet) {
        return res.status(400).json({ error: "Password has already been set for this account. Please sign in instead." });
      }

      const hash = bcrypt.hashSync(password, 10);
      await db.prepare('UPDATE users SET "passwordHash" = ?, "isPasswordSet" = TRUE WHERE id = ?').run(hash, user.id);
      
      await auditService.log({
        userId: user.id,
        userEmail: user.email,
        action: 'SETUP_PASSWORD',
        ipAddress: req.ip
      });

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/payments", requireAuth, async (req: any, res) => {
    try {
      let payments;
      if (req.user.role === 'TENANT') {
        payments = await db.prepare('SELECT * FROM payments WHERE "tenantId" = ?').all(req.user.id);
      } else {
        payments = await db.prepare("SELECT * FROM payments").all();
      }
      res.json(payments);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/payments", requireAuth, async (req: any, res) => {
    try {
      const { amount, paymentType, referenceCode, status, tenantId, notes } = req.body;
      const id = crypto.randomUUID();
      const tId = req.user.role === 'TENANT' ? req.user.id : tenantId;
      
      await db.prepare('INSERT INTO payments (id, "tenantId", amount, "paymentType", "referenceCode", status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, tId, amount, paymentType, referenceCode, status || 'PENDING', notes);
      
      await auditService.log({
        userId: req.user.id,
        userEmail: req.user.email,
        action: 'SUBMIT_PAYMENT',
        entityType: 'PAYMENT',
        entityId: id,
        details: { amount, paymentType, referenceCode, status: status || 'PENDING' },
        ipAddress: req.ip
      });

      res.json({ success: true, id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/payments/:id", requireAuth, isStaff, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      const payment = await db.prepare("SELECT * FROM payments WHERE id = ?").get(id) as any;
      if (!payment) return res.status(404).json({ error: "Payment not found" });

      if (status === 'APPROVED' && payment.status !== 'APPROVED') {
        const tenant = await db.prepare("SELECT * FROM users WHERE id = ?").get(payment.tenantId) as any;
        if (tenant) {
          if (payment.paymentType === 'MOVE_IN') {
            const depositPortion = payment.amount / 2;
            const rentPortion = payment.amount / 2;
            await db.prepare('UPDATE users SET "totalBalance" = "totalBalance" - ?, "depositAmount" = "depositAmount" + ?, "isMovedIn" = TRUE WHERE id = ?')
              .run(payment.amount, depositPortion, tenant.id);
          } else {
            await db.prepare('UPDATE users SET "totalBalance" = "totalBalance" - ? WHERE id = ?')
              .run(payment.amount, tenant.id);
          }
        }
      }

      await db.prepare("UPDATE payments SET status = ? WHERE id = ?").run(status, id);
      
      await auditService.log({
        userId: req.user.id,
        userEmail: req.user.email,
        action: 'UPDATE_PAYMENT_STATUS',
        entityType: 'PAYMENT',
        entityId: id,
        details: { newStatus: status },
        ipAddress: req.ip
      });

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/financials/stats", requireAuth, isStaff, async (req: any, res) => {
    try {
      const stats = await db.prepare(`
        SELECT 
          SUM("depositAmount") as "totalDeposits",
          SUM("totalBalance") as "totalBalance",
          (SELECT SUM(amount) FROM payments WHERE status = 'APPROVED') as "totalRevenue",
          (SELECT SUM(amount) FROM expenses) as "totalExpenses"
        FROM users 
        WHERE role = 'TENANT'
      `).get();
      res.json(stats);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/service-requests", requireAuth, async (req: any, res) => {
    try {
      let requests;
      if (req.user.role === 'TENANT') {
        requests = await db.prepare('SELECT * FROM service_requests WHERE "tenantId" = ?').all(req.user.id);
      } else {
        requests = await db.prepare("SELECT * FROM service_requests").all();
      }
      res.json(requests);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/service-requests", requireAuth, async (req: any, res) => {
    try {
      const { type, description } = req.body;
      const id = crypto.randomUUID();
      await db.prepare('INSERT INTO service_requests (id, "tenantId", type, description) VALUES (?, ?, ?, ?)')
        .run(id, req.user.id, type, description);
      
      await auditService.log({
        userId: req.user.id,
        userEmail: req.user.email,
        action: 'SUBMIT_SERVICE_REQUEST',
        entityType: 'SERVICE_REQUEST',
        entityId: id,
        details: { type, description },
        ipAddress: req.ip
      });

      res.json({ success: true, id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/service-requests/:id", requireAuth, isStaff, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const keys = Object.keys(updates);
      
      if (keys.length === 0) return res.json({ success: true });
      
      // Proper quoting for Postgres camelCase columns
      const setClause = keys.map((k, index) => `"${k}" = $${index + 1}`).join(", ");
      const values = Object.values(updates).map(v => typeof v === 'boolean' ? v : (v === undefined ? null : v));
      
      await db.query(`UPDATE service_requests SET ${setClause} WHERE id = $${keys.length + 1}`, [...values, id]);
      
      await auditService.log({
        userId: req.user.id,
        userEmail: req.user.email,
        action: 'UPDATE_SERVICE_REQUEST',
        entityType: 'SERVICE_REQUEST',
        entityId: id,
        details: updates,
        ipAddress: req.ip
      });

      res.json({ success: true });
    } catch (e: any) {
      console.error("Error updating service request:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/expenses", requireAuth, isStaff, async (req: any, res) => {
    const expenses = await db.prepare("SELECT * FROM expenses").all();
    res.json(expenses);
  });

  app.post("/api/expenses", requireAuth, isStaff, async (req: any, res) => {
    try {
      const { type, description, amount, unitNumber, requestId, tokens, reading, status, metadata } = req.body;
      const id = crypto.randomUUID();
      await db.prepare('INSERT INTO expenses (id, type, description, amount, "unitNumber", "requestId", tokens, reading, status, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, type, description, amount, unitNumber, requestId || null, tokens || null, reading || null, status || 'APPROVED', metadata ? JSON.stringify(metadata) : null);
      
      await auditService.log({
        userId: req.user.id,
        userEmail: req.user.email,
        action: 'CREATE_EXPENSE',
        entityType: 'EXPENSE',
        entityId: id,
        details: { type, amount, unitNumber, status },
        ipAddress: req.ip
      });

      res.json({ success: true, id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/expenses/:id", requireAuth, isLandlord, async (req: any, res) => {
    try {
      const { status } = req.body;
      const id = req.params.id;
      await db.prepare('UPDATE expenses SET status = ? WHERE id = ?').run(status, id);
      
      await auditService.log({
        userId: req.user.id,
        userEmail: req.user.email,
        action: 'UPDATE_EXPENSE',
        entityType: 'EXPENSE',
        entityId: id,
        details: { status },
        ipAddress: req.ip
      });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/config", requireAuth, async (req, res) => {
    const config = await db.prepare("SELECT * FROM config WHERE id = 'property'").get();
    res.json(config || { garbageFee: 0, waterRate: 0 });
  });

  app.post("/api/config", requireAuth, isStaff, async (req: any, res) => {
    const { garbageFee, waterRate } = req.body;
    await db.query(`
      INSERT INTO config (id, "garbageFee", "waterRate") 
      VALUES ('property', $1, $2)
      ON CONFLICT (id) DO UPDATE SET "garbageFee" = EXCLUDED."garbageFee", "waterRate" = EXCLUDED."waterRate"
    `, [garbageFee, waterRate]);
    
    await auditService.log({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'UPDATE_CONFIG',
      entityType: 'CONFIG',
      details: { garbageFee, waterRate },
      ipAddress: req.ip
    });

    res.json({ success: true });
  });

  app.get("/api/water-readings", requireAuth, async (req: any, res) => {
    let readings;
    if (req.user.role === 'TENANT') {
      readings = await db.prepare('SELECT * FROM meter_readings WHERE "tenantId" = ? ORDER BY "createdAt" DESC').all(req.user.id);
    } else {
      readings = await db.prepare('SELECT * FROM meter_readings ORDER BY "createdAt" DESC').all();
    }
    res.json(readings);
  });

  app.post("/api/water-readings", requireAuth, isStaff, async (req: any, res) => {
    const { tenantId, unitNumber, type, previousReading, presentReading, consumption, rate, amount } = req.body;
    const id = crypto.randomUUID();
    
    await db.transaction(async (client) => {
      await client.query(`
        INSERT INTO meter_readings (id, "tenantId", "unitNumber", type, "previousReading", "presentReading", consumption, rate, amount)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [id, tenantId || null, unitNumber || null, type, previousReading, presentReading, consumption, rate, amount]);

      if (type === 'TENANT' && tenantId) {
        await client.query('UPDATE users SET "waterReading" = $1, "waterBill" = $2 WHERE id = $3', [presentReading, amount, tenantId]);
      }
      
      if (unitNumber) {
        await client.query('UPDATE units SET "waterReading" = $1 WHERE "unitNumber" = $2', [presentReading, unitNumber]);
      }
    });

    await auditService.log({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'RECORD_WATER_READING',
      entityType: 'WATER_READING',
      entityId: id,
      details: { type, tenantId, unitNumber, presentReading, amount },
      ipAddress: req.ip
    });

    if (type === 'TENANT') {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      const [allReadings, activeTenants, invoices] = await Promise.all([
        db.prepare("SELECT * FROM meter_readings WHERE type = 'TENANT'").all(),
        db.prepare("SELECT id FROM users WHERE role = 'TENANT' AND status = 'ACTIVE'").all(),
        db.prepare('SELECT id FROM invoices WHERE month = ? AND year = ? LIMIT 1').all(currentMonth + 1, currentYear)
      ]);

      if (invoices.length === 0) {
        const readingsThisMonth = allReadings.filter((r: any) => {
          const d = new Date(r.createdAt);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });
        
        const tenantIdsWithReadings = new Set(readingsThisMonth.map((r: any) => r.tenantId));
        const allReadingsDone = activeTenants.length > 0 && activeTenants.every((t: any) => tenantIdsWithReadings.has(t.id));

        if (allReadingsDone) {
          console.log("[WaterReadings API] All readings complete for month. Generating invoices...");
          await invoicingService.generateMonthlyInvoices(currentMonth + 1, currentYear);
        }
      }
    }

    res.json({ success: true, id });
  });

  app.get("/api/invoices", requireAuth, async (req: any, res) => {
    let invoices;
    if (req.user.role === 'TENANT') {
      invoices = await db.prepare('SELECT * FROM invoices WHERE "tenantId" = ? ORDER BY year DESC, month DESC').all(req.user.id);
    } else {
      invoices = await db.prepare("SELECT * FROM invoices ORDER BY year DESC, month DESC").all();
    }
    res.json(invoices);
  });

  app.get("/api/invoices/:id", requireAuth, async (req, res) => {
    const invoice = await db.prepare("SELECT * FROM invoices WHERE id = ?").get(req.params.id) as any;
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    const items = await db.prepare('SELECT * FROM invoice_items WHERE "invoiceId" = ?').all(invoice.id);
    res.json({ ...invoice, items });
  });

  app.post("/api/admin/generate-invoices", requireAuth, isStaff, async (req: any, res) => {
    const { month, year } = req.body;
    const result = await invoicingService.generateMonthlyInvoices(month, year);
    
    await auditService.log({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'GENERATE_INVOICES',
      details: { month, year, ...result },
      ipAddress: req.ip
    });
    
    res.json(result);
  });

  app.get("/api/admin/audit-logs", requireAuth, isStaff, async (req: any, res) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const logs = await auditService.getLogs(limit, offset);
    res.json(logs);
  });

  app.get("/api/dashboard/summary", requireAuth, isStaff, async (req, res) => {
    try {
      const [users, units, payments, requests, expenses, config, meterReadings, invoices] = await Promise.all([
        db.prepare("SELECT * FROM users").all(),
        db.prepare("SELECT * FROM units").all(),
        db.prepare("SELECT * FROM payments").all(),
        db.prepare("SELECT * FROM service_requests").all(),
        db.prepare("SELECT * FROM expenses").all(),
        db.prepare("SELECT * FROM config WHERE id = 'property'").get(),
        db.prepare("SELECT * FROM meter_readings WHERE type = 'TENANT'").all(),
        db.prepare("SELECT * FROM invoices").all()
      ]);

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const readingsThisMonth = meterReadings.filter((r: any) => {
        const d = new Date(r.createdAt);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
      const tenantsWithReadingsThisMonth = new Set(readingsThisMonth.map((r: any) => r.tenantId));

      const activeTenants = users.filter((u: any) => u.role === 'TENANT' && u.status === 'ACTIVE');
      const missingReadings = activeTenants.filter((u: any) => !tenantsWithReadingsThisMonth.has(u.id)).length;

      const invoicesThisMonth = invoices.filter((inv: any) => inv.month === currentMonth + 1 && inv.year === currentYear);
      const isInvoiced = invoicesThisMonth.length > 0;

      res.json({
        users,
        units,
        payments,
        requests,
        expenses,
        stats: {
          totalDeposits: users.filter(u => u.role === 'TENANT' && u.status === 'ACTIVE').reduce((sum, u) => sum + (Number(u.depositAmount) || 0), 0),
          totalBalance: users.filter(u => u.role === 'TENANT' && u.status === 'ACTIVE').reduce((sum, u) => sum + (Number(u.totalBalance) || 0), 0)
        },
        billingStatus: {
          currentMonth: currentMonth + 1,
          currentYear,
          missingReadings,
          isInvoiced
        },
        config: config || { garbageFee: 0, waterRate: 0 }
      });
    } catch (e: any) {
      console.error("Dashboard summary error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/units", requireAuth, async (req, res) => {
    try {
      const units = await db.prepare("SELECT * FROM units").all();
      res.json(units);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/units", requireAuth, isLandlord, async (req: any, res) => {
    try {
      const { unitNumber, rentAmount, waterReading } = req.body;
      const id = crypto.randomUUID();
      await db.prepare('INSERT INTO units (id, "unitNumber", "rentAmount", "waterReading") VALUES (?, ?, ?, ?)')
        .run(id, unitNumber, rentAmount, waterReading || 0);
      
      await auditService.log({
        userId: req.user.id,
        userEmail: req.user.email,
        action: 'CREATE_UNIT',
        entityType: 'UNIT',
        entityId: id,
        details: { unitNumber, rentAmount, waterReading },
        ipAddress: req.ip
      });

      res.json({ success: true, id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/units/:id", requireAuth, isStaff, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const keys = Object.keys(updates);
      if (keys.length === 0) return res.json({ success: true });
      
      const setClause = keys.map((k, index) => `"${k}" = $${index + 1}`).join(", ");
      await db.query(`UPDATE units SET ${setClause} WHERE id = $${keys.length + 1}`, [...Object.values(updates), id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/users", requireAuth, isStaff, async (req, res) => {
    try {
      const users = await db.prepare('SELECT id, name, email, role, phone, "unitNumber", "rentAmount", "garbageFee", "waterReading", "waterBill", "totalBalance", "depositAmount", status, "moveOutStatus", "pendingRepairCosts", "pendingRefundAmount", "finalRefundAmount", "finalRepairCosts", "moveOutDate", "isMovedIn", "isPasswordSet", "registeredBy" FROM users').all();
      res.json(users);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/users/:id", requireAuth, isStaff, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const keys = Object.keys(updates);
      if (keys.length === 0) return res.json({ success: true });
      
      const setClause = keys.map((k, index) => `"${k}" = $${index + 1}`).join(", ");
      const values = Object.values(updates).map(v => typeof v === 'boolean' ? v : (v === undefined ? null : v));
      
      await db.query(`UPDATE users SET ${setClause} WHERE id = $${keys.length + 1}`, [...values, id]);
      
      await auditService.log({
        userId: req.user.id,
        userEmail: req.user.email,
        action: 'UPDATE_USER',
        entityType: 'USER',
        entityId: id,
        details: updates,
        ipAddress: req.ip
      });

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Vite middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("CRITICAL Startup Error:", err);
});
