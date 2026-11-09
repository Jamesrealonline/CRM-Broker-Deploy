// ========================================================
// REAL ESTATE CRM - UNIT HOLDS & WAITLIST REPOSITORY
// Quản lý giữ căn có thời hạn (24h/48h), chống giữ trùng căn,
// tự động giải phóng khi hết hạn và kích hoạt danh sách chờ Waitlist
// ========================================================

import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';
import { UnitHold, UnitWaitlist, UserProfile } from '@/domain/types';
import { assertRateLimit } from '@/lib/rateLimiter';
import { auditRepository } from './auditRepository';
import { autoTransferService } from '@/domain/services/autoTransferService';

const STORAGE_KEY_UNIT_HOLDS = 'crm_unit_holds';
const STORAGE_KEY_UNIT_WAITLIST = 'crm_unit_waitlist';

export class HoldRepository {
  private ensureInitialized() {
    if (!localStorage.getItem(STORAGE_KEY_UNIT_HOLDS)) {
      localStorage.setItem(STORAGE_KEY_UNIT_HOLDS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEY_UNIT_WAITLIST)) {
      localStorage.setItem(STORAGE_KEY_UNIT_WAITLIST, JSON.stringify([]));
    }
  }

  // 1. TẠO YÊU CẦU GIỮ CĂN (UNIT HOLD)
  async createUnitHold(payload: {
    projectId: string;
    projectName?: string;
    unitCode: string;
    leadId?: string;
    customerName?: string;
    holdHours?: number; // Mặc định 24h
    notes?: string;
    currentUser: UserProfile;
  }): Promise<UnitHold> {
    assertRateLimit(payload.currentUser.id, 'holds/create', 20);
    this.ensureInitialized();

    const normalizedCode = payload.unitCode.trim().toLowerCase();
    const holds: UnitHold[] = JSON.parse(localStorage.getItem(STORAGE_KEY_UNIT_HOLDS) || '[]');

    // 1. Kiểm tra căn đã có ai giữ active chưa (chống giữ trùng)
    const activeHold = holds.find(h => 
      h.project_id === payload.projectId && 
      h.unit_code.trim().toLowerCase() === normalizedCode && 
      h.status === 'active' &&
      new Date(h.hold_expires_at).getTime() > Date.now()
    );

    if (activeHold) {
      throw new Error(`duplicate_unit_hold: Căn "${payload.unitCode}" đang được giữ chỗ bởi chuyên viên ${activeHold.sale_name || 'khác'} đến ${new Date(activeHold.hold_expires_at).toLocaleTimeString('vi-VN')}!`);
    }

    // 2. Kiểm tra hạn mức giữ căn của sale (Tối đa 3 căn đồng thời)
    const saleActiveHolds = holds.filter(h => 
      h.sale_id === payload.currentUser.id && 
      h.status === 'active' &&
      new Date(h.hold_expires_at).getTime() > Date.now()
    );

    if (saleActiveHolds.length >= 3) {
      throw new Error('limit_exceeded: Mỗi chuyên viên chỉ được phép giữ tối đa 3 căn cùng lúc!');
    }

    const holdDurationHours = payload.holdHours || 24;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + holdDurationHours * 3600000);

    const newHold: UnitHold = {
      id: crypto.randomUUID(),
      project_id: payload.projectId,
      project_name: payload.projectName,
      unit_code: payload.unitCode.trim().toUpperCase(),
      lead_id: payload.leadId,
      customer_name: payload.customerName,
      sale_id: payload.currentUser.id,
      sale_name: payload.currentUser.full_name,
      hold_start_at: now.toISOString(),
      hold_expires_at: expiresAt.toISOString(),
      status: 'active',
      extension_count: 0,
      notes: payload.notes,
      created_at: now.toISOString(),
    };

    holds.unshift(newHold);
    localStorage.setItem(STORAGE_KEY_UNIT_HOLDS, JSON.stringify(holds));

    return newHold;
  }

  // 2. LẤY DANH SÁCH GIỮ CĂN
  async getUnitHolds(projectId?: string, status?: string): Promise<UnitHold[]> {
    this.ensureInitialized();
    let holds: UnitHold[] = JSON.parse(localStorage.getItem(STORAGE_KEY_UNIT_HOLDS) || '[]');
    
    // Tự động kiểm tra và đánh dấu hết hạn
    const now = Date.now();
    let changed = false;
    holds = holds.map(h => {
      if (h.status === 'active' && new Date(h.hold_expires_at).getTime() <= now) {
        changed = true;
        return { ...h, status: 'expired' };
      }
      return h;
    });

    if (changed) {
      localStorage.setItem(STORAGE_KEY_UNIT_HOLDS, JSON.stringify(holds));
    }

    if (projectId && projectId !== 'all') {
      holds = holds.filter(h => h.project_id === projectId);
    }
    if (status && status !== 'all') {
      holds = holds.filter(h => h.status === status);
    }

    return holds;
  }

  // 3. GIẢI PHÓNG CĂN HẾT HẠN & KÍCH HOẠT WAITLIST
  async releaseExpiredHolds(): Promise<{ releasedCount: number }> {
    this.ensureInitialized();
    const holds: UnitHold[] = JSON.parse(localStorage.getItem(STORAGE_KEY_UNIT_HOLDS) || '[]');
    const waitlist: UnitWaitlist[] = JSON.parse(localStorage.getItem(STORAGE_KEY_UNIT_WAITLIST) || '[]');
    const now = Date.now();
    let releasedCount = 0;

    for (const hold of holds) {
      if (hold.status === 'active' && new Date(hold.hold_expires_at).getTime() <= now) {
        hold.status = 'expired';
        hold.updated_at = new Date().toISOString();
        releasedCount++;

        // Tìm người tiếp theo trong danh sách chờ Waitlist
        const nextInWaitlist = waitlist
          .filter(w => w.project_id === hold.project_id && w.unit_code.toLowerCase() === hold.unit_code.toLowerCase() && w.status === 'waiting')
          .sort((a, b) => a.priority_order - b.priority_order)[0];

        if (nextInWaitlist) {
          nextInWaitlist.status = 'notified';
          nextInWaitlist.notified_at = new Date().toISOString();

          // Lưu thông báo Outbox
          await autoTransferService.saveOutboxMessage({
            eventType: 'waitlist_unit_available',
            leadId: nextInWaitlist.lead_id,
            recipientId: nextInWaitlist.sale_id,
            payload: {
              unit_code: hold.unit_code,
              project_id: hold.project_id,
              message: `Căn ${hold.unit_code} vừa được giải phóng! Bạn có 12 giờ để kích hoạt giữ căn cho khách.`,
            },
          });
        }
      }
    }

    if (releasedCount > 0) {
      localStorage.setItem(STORAGE_KEY_UNIT_HOLDS, JSON.stringify(holds));
      localStorage.setItem(STORAGE_KEY_UNIT_WAITLIST, JSON.stringify(waitlist));
    }

    return { releasedCount };
  }

  // 4. GIA HẠN THỜI GIAN GIỮ CĂN (CHỈ DÀNH CHO QUẢN LÝ)
  async extendUnitHold(
    holdId: string, 
    extensionHours: number, 
    reason: string, 
    currentUser: UserProfile
  ): Promise<UnitHold> {
    const isManager = ['admin', 'director', 'sales_manager', 'team_leader'].includes(currentUser.role);
    if (!isManager) {
      throw new Error('forbidden: Chỉ Quản lý sàn hoặc Trưởng nhóm mới có quyền gia hạn giữ căn!');
    }

    this.ensureInitialized();
    const holds: UnitHold[] = JSON.parse(localStorage.getItem(STORAGE_KEY_UNIT_HOLDS) || '[]');
    const hold = holds.find(h => h.id === holdId);
    if (!hold) throw new Error('Không tìm thấy yêu cầu giữ căn!');
    if (hold.status !== 'active') throw new Error(`Căn này không ở trạng thái giữ active (trạng thái: ${hold.status})!`);

    const currentExpire = new Date(hold.hold_expires_at).getTime();
    const newExpire = new Date(Math.max(Date.now(), currentExpire) + extensionHours * 3600000);

    hold.hold_expires_at = newExpire.toISOString();
    hold.extension_count = (hold.extension_count || 0) + 1;
    hold.notes = `${hold.notes || ''} [Gia hạn +${extensionHours}h bởi ${currentUser.full_name}: ${reason}]`.trim();
    hold.updated_at = new Date().toISOString();

    localStorage.setItem(STORAGE_KEY_UNIT_HOLDS, JSON.stringify(holds));
    return hold;
  }

  // 5. THÊM VÀO DANH SÁCH CHỜ (WAITLIST)
  async addToWaitlist(payload: {
    projectId: string;
    unitCode: string;
    leadId: string;
    customerName?: string;
    currentUser: UserProfile;
  }): Promise<UnitWaitlist> {
    this.ensureInitialized();
    const waitlist: UnitWaitlist[] = JSON.parse(localStorage.getItem(STORAGE_KEY_UNIT_WAITLIST) || '[]');
    const existing = waitlist.filter(w => 
      w.project_id === payload.projectId && 
      w.unit_code.toLowerCase() === payload.unitCode.toLowerCase() && 
      w.status === 'waiting'
    );

    const newWait: UnitWaitlist = {
      id: crypto.randomUUID(),
      project_id: payload.projectId,
      unit_code: payload.unitCode.trim().toUpperCase(),
      lead_id: payload.leadId,
      customer_name: payload.customerName,
      sale_id: payload.currentUser.id,
      sale_name: payload.currentUser.full_name,
      priority_order: existing.length + 1,
      status: 'waiting',
      created_at: new Date().toISOString(),
    };

    waitlist.push(newWait);
    localStorage.setItem(STORAGE_KEY_UNIT_WAITLIST, JSON.stringify(waitlist));
    return newWait;
  }

  async getWaitlist(projectId?: string, unitCode?: string): Promise<UnitWaitlist[]> {
    this.ensureInitialized();
    let waitlist: UnitWaitlist[] = JSON.parse(localStorage.getItem(STORAGE_KEY_UNIT_WAITLIST) || '[]');
    if (projectId) waitlist = waitlist.filter(w => w.project_id === projectId);
    if (unitCode) waitlist = waitlist.filter(w => w.unit_code.toLowerCase() === unitCode.toLowerCase());
    return waitlist.sort((a, b) => a.priority_order - b.priority_order);
  }
}

export const holdRepository = new HoldRepository();
