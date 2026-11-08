// ========================================================
// REAL ESTATE CRM - AUDIT LOGS REPOSITORY
// Bảng kiểm toán Append-Only & Hash Chain Chống Gian Lận (P1.2)
// ========================================================

import { AuditLog } from '@/domain/types';
import { computePhoneHash } from '@/lib/masking';
import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';

const STORAGE_KEY_AUDIT = 'crm_audit_logs';
const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export class AuditRepository {
  async getAuditLogs(): Promise<AuditLog[]> {
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    }

    const raw = localStorage.getItem(STORAGE_KEY_AUDIT);
    if (!raw) return [];
    return JSON.parse(raw);
  }

  computeHash(log: {
    prev_hash: string;
    user_id?: string;
    actor_id?: string;
    action: string;
    table_name?: string;
    record_id?: string;
    created_at: string;
  }): string {
    const payload = `${log.prev_hash}|${log.user_id || ''}|${log.actor_id || ''}|${log.action}|${log.table_name || ''}|${log.record_id || ''}|${log.created_at}`;
    return computePhoneHash(payload);
  }

  async logAction(
    userId: string, 
    userName: string, 
    action: string, 
    details?: Record<string, unknown>,
    extra?: Partial<AuditLog>
  ): Promise<AuditLog> {
    const logs = await this.getAuditLogs();
    const prevHash = logs.length > 0 && logs[0].current_hash ? logs[0].current_hash : GENESIS_HASH;
    const createdAt = new Date().toISOString();

    const newLog: AuditLog = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `audit-${Date.now()}`,
      user_id: userId,
      actor_id: extra?.actor_id || userId,
      user_name: userName,
      effective_role: extra?.effective_role,
      action,
      table_name: extra?.table_name,
      record_id: extra?.record_id,
      details,
      new_data: extra?.new_data,
      ip_address: extra?.ip_address || '127.0.0.1',
      created_at: createdAt,
      prev_hash: prevHash,
      current_hash: '',
    };

    newLog.current_hash = this.computeHash(newLog as any);

    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase
        .from('audit_logs')
        .insert(newLog)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }

    logs.unshift(newLog);
    localStorage.setItem(STORAGE_KEY_AUDIT, JSON.stringify(logs.slice(0, 1000)));
    return newLog;
  }

  // Xác minh tính toàn vẹn của chuỗi băm (Hash Chain Verification)
  async verifyAuditLogChain(): Promise<{ isValid: boolean; brokenAtId?: string; totalLogs: number }> {
    const logs = await this.getAuditLogs();
    if (logs.length === 0) return { isValid: true, totalLogs: 0 };

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      if (!log.current_hash || !log.prev_hash) {
        continue;
      }

      // 1. Kiểm tra hash hiện tại của log
      const expectedHash = this.computeHash(log as any);
      if (log.current_hash !== expectedHash) {
        return { isValid: false, brokenAtId: log.id, totalLogs: logs.length };
      }

      // 2. Kiểm tra liên kết với log trước đó theo thứ tự thời gian (i + 1)
      if (i < logs.length - 1) {
        const olderLog = logs[i + 1];
        if (olderLog.current_hash && log.prev_hash !== olderLog.current_hash) {
          return { isValid: false, brokenAtId: log.id, totalLogs: logs.length };
        }
      }
    }

    return { isValid: true, totalLogs: logs.length };
  }

  // Chặn UPDATE/DELETE
  async updateLog(): Promise<void> {
    throw new Error('Bảo mật kiểm toán nghiêm ngặt: Bảng audit_logs là append-only, nghiêm cấm mọi hành vi UPDATE hoặc DELETE.');
  }

  async deleteLog(): Promise<void> {
    throw new Error('Bảo mật kiểm toán nghiêm ngặt: Bảng audit_logs là append-only, nghiêm cấm mọi hành vi UPDATE hoặc DELETE.');
  }
}

export const auditRepository = new AuditRepository();
