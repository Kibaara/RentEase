import db from '../lib/db';
import crypto from 'crypto';

export interface AuditEntry {
  userId?: string;
  userEmail?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: any;
  ipAddress?: string;
}

export const auditService = {
  log: async (entry: AuditEntry) => {
    const id = crypto.randomUUID();
    const sql = `
      INSERT INTO audit_logs (id, "userId", "userEmail", action, "entityType", "entityId", details, "ipAddress")
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    try {
      const stmt = db.prepare(sql);
      await stmt.run(
        id,
        entry.userId || null,
        entry.userEmail || null,
        entry.action,
        entry.entityType || null,
        entry.entityId || null,
        entry.details ? JSON.stringify(entry.details) : null,
        entry.ipAddress || null
      );
    } catch (error: any) {
      // If foreign key constraint fails (e.g. user was deleted or session is stale from migration)
      // we log again with userId = null to ensure we still have a record of the event.
      if (error.code === '23503' && entry.userId) {
        try {
          const stmt = db.prepare(sql);
          await stmt.run(
            id,
            null,
            entry.userEmail || null,
            entry.action,
            entry.entityType || null,
            entry.entityId || null,
            entry.details ? JSON.stringify(entry.details) : null,
            entry.ipAddress || null
          );
          return;
        } catch (retryError) {
          console.error('Failed to save audit log on retry:', retryError);
        }
      }
      console.error('Failed to save audit log:', error);
    }
  },

  getLogs: async (limit = 100, offset = 0) => {
    const stmt = db.prepare(`
      SELECT * FROM audit_logs 
      ORDER BY "createdAt" DESC 
      LIMIT ? OFFSET ?
    `);
    return await stmt.all(limit, offset);
  }
};
