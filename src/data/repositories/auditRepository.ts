// ========================================================
// REAL ESTATE CRM - AUDIT LOGS REPOSITORY
// ========================================================

import { AuditLog } from '@/domain/types';

const STORAGE_KEY_AUDIT = 'crm_audit_logs';

export class AuditRepository {
  async getAuditLogs(): Promise<AuditLog[]> {
    const raw = localStorage.getItem(STORAGE_KEY_AUDIT);
    if (!raw) return [];
    return JSON.parse(raw);
  }

  async logAction(userId: string, userName: string, action: string, details?: Record<string, unknown>): Promise<void> {
    const logs = await this.getAuditLogs();
    logs.unshift({
      id: crypto.randomUUID(),
      user_id: userId,
      user_name: userName,
      action,
      details,
      created_at: new Date().toISOString(),
    });
    localStorage.setItem(STORAGE_KEY_AUDIT, JSON.stringify(logs.slice(0, 1000)));
  }
}

export const auditRepository = new AuditRepository();
