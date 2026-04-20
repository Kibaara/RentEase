import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase')
    ? { rejectUnauthorized: false }
    : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false)
});

// Initialize tables
export const initDb = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        "passwordHash" TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('LANDLORD', 'AGENT', 'TENANT')),
        "unitNumber" TEXT,
        "rentAmount" DOUBLE PRECISION DEFAULT 0,
        "garbageFee" DOUBLE PRECISION DEFAULT 0,
        "waterReading" DOUBLE PRECISION DEFAULT 0,
        "waterBill" DOUBLE PRECISION DEFAULT 0,
        "totalBalance" DOUBLE PRECISION DEFAULT 0,
        "depositAmount" DOUBLE PRECISION DEFAULT 0,
        status TEXT DEFAULT 'ACTIVE',
        "moveOutStatus" TEXT,
        "pendingRepairCosts" DOUBLE PRECISION DEFAULT 0,
        "pendingRefundAmount" DOUBLE PRECISION DEFAULT 0,
        "finalRefundAmount" DOUBLE PRECISION DEFAULT 0,
        "finalRepairCosts" DOUBLE PRECISION DEFAULT 0,
        "moveOutDate" TEXT,
        phone TEXT,
        "isPasswordSet" BOOLEAN DEFAULT FALSE,
        "registeredBy" TEXT,
        "isMovedIn" BOOLEAN DEFAULT FALSE,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS units (
        id TEXT PRIMARY KEY,
        "unitNumber" TEXT UNIQUE NOT NULL,
        "rentAmount" DOUBLE PRECISION DEFAULT 0,
        status TEXT DEFAULT 'VACANT' CHECK(status IN ('VACANT', 'OCCUPIED')),
        "currentTenantId" TEXT REFERENCES users(id),
        "waterReading" DOUBLE PRECISION DEFAULT 0,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Ensure waterReading exists on units if migrating
      ALTER TABLE units ADD COLUMN IF NOT EXISTS "waterReading" DOUBLE PRECISION DEFAULT 0;

      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        "tenantId" TEXT NOT NULL REFERENCES users(id),
        amount DOUBLE PRECISION NOT NULL,
        "paymentType" TEXT NOT NULL,
        "referenceCode" TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
        notes TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS service_requests (
        id TEXT PRIMARY KEY,
        "tenantId" TEXT NOT NULL REFERENCES users(id),
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        "repairCosts" DOUBLE PRECISION DEFAULT 0,
        "repairNotes" TEXT,
        "excessPayment" DOUBLE PRECISION DEFAULT 0,
        "refundAmount" DOUBLE PRECISION DEFAULT 0,
        "agentResolvedAt" TIMESTAMP,
        "landlordApprovedAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        description TEXT,
        amount DOUBLE PRECISION NOT NULL,
        "unitNumber" TEXT,
        "requestId" TEXT,
        tokens DOUBLE PRECISION,
        reading DOUBLE PRECISION,
        "prevReading" DOUBLE PRECISION,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        "tenantId" TEXT NOT NULL REFERENCES users(id),
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        "totalAmount" DOUBLE PRECISION NOT NULL,
        status TEXT DEFAULT 'UNPAID' CHECK(status IN ('UNPAID', 'PARTIAL', 'PAID')),
        "dueDate" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS invoice_items (
        id TEXT PRIMARY KEY,
        "invoiceId" TEXT NOT NULL REFERENCES invoices(id),
        description TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('RENT', 'WATER', 'GARBAGE', 'LATE_FEE', 'OTHER')),
        amount DOUBLE PRECISION NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS meter_readings (
        id TEXT PRIMARY KEY,
        "tenantId" TEXT REFERENCES users(id),
        "unitNumber" TEXT,
        type TEXT NOT NULL CHECK(type IN ('TENANT', 'COMMUNAL')),
        "previousReading" DOUBLE PRECISION NOT NULL,
        "presentReading" DOUBLE PRECISION NOT NULL,
        consumption DOUBLE PRECISION NOT NULL,
        rate DOUBLE PRECISION NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS config (
        id TEXT PRIMARY KEY,
        "garbageFee" DOUBLE PRECISION DEFAULT 0,
        "waterRate" DOUBLE PRECISION DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_unit ON users("unitNumber");
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
      CREATE INDEX IF NOT EXISTS idx_units_status ON units(status);
      CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments("tenantId");
      CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
      CREATE INDEX IF NOT EXISTS idx_payments_type ON payments("paymentType");
      CREATE INDEX IF NOT EXISTS idx_payments_created ON payments("createdAt");
      CREATE INDEX IF NOT EXISTS idx_service_requests_tenant ON service_requests("tenantId");
      CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
      CREATE INDEX IF NOT EXISTS idx_service_requests_type ON service_requests(type);
      CREATE INDEX IF NOT EXISTS idx_expenses_unit ON expenses("unitNumber");
      CREATE INDEX IF NOT EXISTS idx_expenses_created ON expenses("createdAt");

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        "userId" TEXT REFERENCES users(id),
        "userEmail" TEXT,
        action TEXT NOT NULL,
        "entityType" TEXT,
        "entityId" TEXT,
        details TEXT,
        "ipAddress" TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs("createdAt");
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs("userId");
    `);
    
    await client.query('COMMIT');
    console.log('[Database] PostgreSQL initialized successfully.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Database] Failed to initialize PostgreSQL:', e);
  } finally {
    client.release();
  }
};

// Database abstraction layer to minimize changes elsewhere
export const db = {
  query: (text: string, params?: any[]) => pool.query(text, params),
  // Compat helpers for simpler porting
  exec: (text: string) => pool.query(text),
  prepare: (text: string) => {
    // Convert ? to $1, $2, etc.
    let index = 1;
    const postgresText = text.replace(/\?/g, () => `$${index++}`);
    
    return {
      run: (...params: any[]) => pool.query(postgresText, params),
      get: async (...params: any[]) => {
        const res = await pool.query(postgresText, params);
        return res.rows[0];
      },
      all: async (...params: any[]) => {
        const res = await pool.query(postgresText, params);
        return res.rows;
      }
    };
  },
  transaction: async (callback: (client: pg.PoolClient) => Promise<void>) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await callback(client);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
};

export default db;
