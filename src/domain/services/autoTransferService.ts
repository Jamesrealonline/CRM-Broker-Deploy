// ========================================================
// REAL ESTATE CRM - LEAD AUTO-TRANSFER SERVICE (MODULE 7)
// Hạn 24 giờ liên tục (Wall-clock), kiểm tra trạng thái dừng đồng hồ,
// chống vòng lặp (previous_assigned_sales), chuyển kho chung & dry-run
// ========================================================

import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';
import { 
  Lead, 
  UserProfile, 
  LeadStatus, 
  AutoTransferConfig, 
  AutoTransferScanResult,
  LeadAssignmentHistory,
  AssignmentReason,
  LeadAppointment,
  JobRun,
  DeadLetterMessage
} from '@/domain/types';
import { notificationService } from './notificationService';

const STORAGE_KEY_CONFIG = 'crm_lead_auto_transfer_config';
const STORAGE_KEY_LEADS = 'crm_leads';
const STORAGE_KEY_HISTORY = 'crm_lead_assignment_history';
const STORAGE_KEY_OUTBOX = 'crm_outbox';
const STORAGE_KEY_APPOINTMENTS = 'crm_lead_appointments';
const STORAGE_KEY_ACTIVITIES = 'crm_activities';
const STORAGE_KEY_JOB_RUNS = 'crm_job_runs';
const STORAGE_KEY_DEAD_LETTER = 'crm_dead_letter_queue';

export const DEFAULT_AUTO_TRANSFER_CONFIG: AutoTransferConfig = {
  enabled: true,
  deadline_hours: 24,       // 24 giờ liên tục (Wall-clock real time)
  pre_warning_hours: 20,    // Nhắc trước ở mốc 20 giờ (tức còn 4 giờ)
  max_transfer_count: 3,    // Tối đa 3 lần chuyển trước khi vào Kho chung
  stop_clock_statuses: [
    'appointment_set',
    'consulted',
    'site_visit',
    'considering',
    'booking',
    'deposit',
    'contract',
    'after_sales',
  ],
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',
  priority_same_team: true,
  cc_manager: true,
};

export class AutoTransferService {
  // Concurrency lock simulation (mô phỏng SELECT FOR UPDATE SKIP LOCKED phía DB)
  private static lockedLeadIds: Set<string> = new Set();

  /**
   * Lấy danh sách thông báo outbox (Transactional Outbox)
   */
  async getOutboxMessages(): Promise<any[]> {
    if (isLiveSupabaseConfigured) {
      const { data } = await supabase.from('outbox').select('*').order('created_at', { ascending: false });
      return data || [];
    }
    return JSON.parse(localStorage.getItem(STORAGE_KEY_OUTBOX) || '[]');
  }

  /**
   * Lưu tin nhắn outbox trong cùng transaction điều chuyển
   */
  async saveOutboxMessage(message: {
    eventType: string;
    leadId?: string;
    recipientId?: string;
    recipientEmail?: string;
    recipientName?: string;
    payload: any;
  }): Promise<void> {
    if (isLiveSupabaseConfigured) {
      await supabase.from('outbox').insert({
        event_type: message.eventType,
        lead_id: message.leadId,
        recipient_id: message.recipientId,
        recipient_email: message.recipientEmail,
        recipient_name: message.recipientName,
        payload: message.payload,
        status: 'pending',
      });
      return;
    }

    const all = JSON.parse(localStorage.getItem(STORAGE_KEY_OUTBOX) || '[]');
    all.unshift({
      id: crypto.randomUUID(),
      event_type: message.eventType,
      lead_id: message.leadId,
      recipient_id: message.recipientId,
      recipient_email: message.recipientEmail,
      recipient_name: message.recipientName,
      payload: message.payload,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
    localStorage.setItem(STORAGE_KEY_OUTBOX, JSON.stringify(all));
  }

  /**
   * 1. LẤY CẤU HÌNH AUTO-TRANSFER
   */
  async getConfig(): Promise<AutoTransferConfig> {
    if (isLiveSupabaseConfigured) {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'lead_auto_transfer_config')
        .maybeSingle();

      if (data && data.value) {
        return { ...DEFAULT_AUTO_TRANSFER_CONFIG, ...data.value };
      }
    }

    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    return raw ? { ...DEFAULT_AUTO_TRANSFER_CONFIG, ...JSON.parse(raw) } : DEFAULT_AUTO_TRANSFER_CONFIG;
  }

  /**
   * 2. LƯU CẤU HÌNH AUTO-TRANSFER
   */
  async saveConfig(config: Partial<AutoTransferConfig>): Promise<AutoTransferConfig> {
    const current = await this.getConfig();
    const updated = { ...current, ...config };

    if (isLiveSupabaseConfigured) {
      await supabase
        .from('system_settings')
        .upsert({
          key: 'lead_auto_transfer_config',
          value: updated,
          description: 'Cấu hình tự động chuyển lead quá hạn 24 giờ liên tục',
        });
    }

    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(updated));
    return updated;
  }

  /**
   * 3. TÍNH TOÁN DEADLINE 24H LIÊN TỤC (WALL-CLOCK)
   */
  computeCareDeadline(startTime?: string, durationHours: number = 24): string {
    const baseTime = startTime ? new Date(startTime).getTime() : Date.now();
    return new Date(baseTime + durationHours * 3600000).toISOString();
  }

  /**
   * 4. KIỂM TRA THỜI GIAN CÒN LẠI & TRẠNG THÁI DỪNG ĐỒNG HỒ
   */
  getCareRemainingHours(
    lead: Lead,
    config: AutoTransferConfig = DEFAULT_AUTO_TRANSFER_CONFIG
  ): {
    hoursRemaining: number;
    isOverdue: boolean;
    isWarning: boolean;
    isPaused: boolean;
    pauseReason?: string;
    badgeColor: 'green' | 'yellow' | 'red' | 'gray';
    badgeLabel: string;
  } {
    // A. Lead đã đóng hoặc không hợp lệ -> dừng
    if (['lost', 'invalid', 'unreachable'].includes(lead.status)) {
      return {
        hoursRemaining: 999,
        isOverdue: false,
        isWarning: false,
        isPaused: true,
        pauseReason: 'Lead đã đóng / Không tiềm năng',
        badgeColor: 'gray',
        badgeLabel: 'Đã đóng',
      };
    }

    // B. Lead chưa được giao cho Sale nào (Kho chung)
    if (!lead.assigned_to || lead.assigned_name === 'Kho lead chung' || lead.assigned_name === 'Chưa phân bổ') {
      return {
        hoursRemaining: 0,
        isOverdue: false,
        isWarning: false,
        isPaused: true,
        pauseReason: 'Chưa có Sale phụ trách (Kho chung)',
        badgeColor: 'gray',
        badgeLabel: 'Kho chung',
      };
    }

    // C. Lead được miễn chuyển tự động
    if (lead.is_exempt_auto_transfer) {
      return {
        hoursRemaining: 999,
        isOverdue: false,
        isWarning: false,
        isPaused: true,
        pauseReason: lead.extension_reason || 'Được quản lý miễn chuyển tự động',
        badgeColor: 'gray',
        badgeLabel: 'Miễn chuyển',
      };
    }

    // C2. Lead có cờ vi phạm lịch hẹn quá hạn không có kết quả -> CƯỠNG CHẾ ĐẾM GIỜ (không được dừng)
    const hasDelinquentAppointment = lead.sla_flags?.includes('no_result_overdue');

    // D. Lead đang ở các trạng thái Dừng Đồng Hồ (Đặt cọc, Ký HĐMB, Hẹn gặp, v.v...)
    // Chú ý: Nếu có vi phạm no_result_overdue thì KHÔNG cho phép dừng ở appointment_set
    if (config.stop_clock_statuses.includes(lead.status)) {
      if (!hasDelinquentAppointment || lead.status !== 'appointment_set') {
        return {
          hoursRemaining: 999,
          isOverdue: false,
          isWarning: false,
          isPaused: true,
          pauseReason: `Tạm dừng đồng hồ ở trạng thái "${lead.status}"`,
          badgeColor: 'gray',
          badgeLabel: 'Tạm dừng đồng hồ',
        };
      }
    }

    // E. Lead đang trong giai đoạn nuôi dưỡng định kỳ (nurture)
    if (!hasDelinquentAppointment && lead.nurture_reminder_date) {
      const nurtureTime = new Date(lead.nurture_reminder_date).getTime();
      if (nurtureTime > Date.now()) {
        const untilDate = new Date(lead.nurture_reminder_date).toLocaleDateString('vi-VN');
        return {
          hoursRemaining: 999,
          isOverdue: false,
          isWarning: false,
          isPaused: true,
          pauseReason: `Đang nuôi dưỡng định kỳ đến ngày ${untilDate}`,
          badgeColor: 'gray',
          badgeLabel: `Nuôi dưỡng đến ${untilDate}`,
        };
      }
    }

    // F. Lead có lịch hẹn tương lai hợp lệ
    if (!hasDelinquentAppointment && lead.next_follow_up) {
      const followUpTime = new Date(lead.next_follow_up).getTime();
      if (followUpTime > Date.now()) {
        const untilDate = new Date(lead.next_follow_up).toLocaleDateString('vi-VN');
        return {
          hoursRemaining: 999,
          isOverdue: false,
          isWarning: false,
          isPaused: true,
          pauseReason: `Có lịch hẹn chăm sóc đến ngày ${untilDate}`,
          badgeColor: 'gray',
          badgeLabel: `Hẹn đến ${untilDate}`,
        };
      }
    }

    // G. Tính toán theo Deadline 24h liên tục
    const deadlineStr = lead.extended_until || lead.care_deadline_at || this.computeCareDeadline(lead.created_at, config.deadline_hours);
    const deadlineTime = new Date(deadlineStr).getTime();
    const diffMs = deadlineTime - Date.now();
    const hoursRemaining = Math.round((diffMs / 3600000) * 10) / 10;

    const isOverdue = hoursRemaining <= 0;
    const isWarning = hoursRemaining > 0 && hoursRemaining <= (config.deadline_hours - config.pre_warning_hours);

    let badgeColor: 'green' | 'yellow' | 'red' | 'gray' = 'green';
    let badgeLabel = '';

    if (isOverdue) {
      badgeColor = 'red';
      badgeLabel = `Quá hạn ${Math.abs(hoursRemaining)}h`;
    } else if (hoursRemaining < 4) {
      badgeColor = 'red';
      badgeLabel = `Còn ${hoursRemaining}h (Gấp)`;
    } else if (hoursRemaining <= 8) {
      badgeColor = 'yellow';
      badgeLabel = `Còn ${hoursRemaining}h`;
    } else {
      badgeColor = 'green';
      badgeLabel = `Còn ${hoursRemaining}h`;
    }

    return {
      hoursRemaining,
      isOverdue,
      isWarning,
      isPaused: false,
      badgeColor,
      badgeLabel,
    };
  }

  /**
   * 5. THUẬT TOÁN CHỌN "SALE TIẾP THEO" (ROUND-ROBIN, TRÁNH VÒNG LẶP A -> B -> A)
   */
  selectNextSale(
    lead: Lead,
    candidates: UserProfile[],
    config: AutoTransferConfig = DEFAULT_AUTO_TRANSFER_CONFIG
  ): UserProfile | null {
    // Lấy danh sách sale đã từng giữ lead này
    const previousSales: string[] = Array.isArray(lead.previous_assigned_sales) 
      ? lead.previous_assigned_sales 
      : [];
    if (lead.assigned_to && !previousSales.includes(lead.assigned_to)) {
      previousSales.push(lead.assigned_to);
    }

    // 1. Lọc điều kiện bắt buộc:
    // - status === 'active'
    // - on_leave !== true (không nghỉ phép)
    // - accepts_leads !== false (đang nhận lead)
    // - role === 'sale_agent' hoặc 'team_leader'
    // - KHÔNG nằm trong danh sách đã từng giữ lead (tránh A -> B -> A)
    // - KHÔNG phải là sale hiện tại
    const eligibleSales = candidates.filter(sale => {
      if (sale.status !== 'active') return false;
      if (sale.on_leave) return false;
      if (sale.accepts_leads === false) return false;
      if (sale.role !== 'sale_agent' && sale.role !== 'team_leader') return false;
      if (sale.id === lead.assigned_to) return false;
      if (previousSales.includes(sale.id)) return false;
      return true;
    });

    if (eligibleSales.length === 0) {
      return null; // Không còn Sale hợp lệ -> chuyển về Kho chung
    }

    // 2. Ưu tiên:
    // Cùng team trước, nếu hết thì mới sang team khác trong sàn
    let filtered = eligibleSales;
    if (config.priority_same_team && lead.team_id) {
      const sameTeam = eligibleSales.filter(s => s.team_id === lead.team_id);
      if (sameTeam.length > 0) {
        filtered = sameTeam;
      } else if (lead.agency_id) {
        const sameAgency = eligibleSales.filter(s => s.agency_id === lead.agency_id);
        if (sameAgency.length > 0) {
          filtered = sameAgency;
        }
      }
    }

    // 3. Chọn theo Round-robin (chọn ngẫu nhiên hoặc sale lâu nhất chưa nhận)
    const selected = filtered[Math.floor(Math.random() * filtered.length)];
    return selected || null;
  }

  /**
   * 6. THỰC HIỆN ĐIỀU CHUYỂN LEAD (TRANSACTIONAL & NOTIFICATION TRIGGER)
   */
  async transferLead(
    lead: Lead,
    nextSale: UserProfile | null,
    reason: AssignmentReason,
    performedBy: string = 'Hệ thống tự động',
    notes?: string,
    candidates?: UserProfile[]
  ): Promise<{ success: boolean; lead: Lead; historyId?: string; isPool?: boolean; error?: string }> {
    const config = await this.getConfig();
    const currentAssigneeId = lead.assigned_to;
    const currentAssigneeName = lead.assigned_name;
    const transferCount = (lead.auto_transfer_count || 0) + 1;

    // Chuẩn bị danh sách previous_assigned_sales
    const previousSales: string[] = Array.isArray(lead.previous_assigned_sales)
      ? [...lead.previous_assigned_sales]
      : [];
    if (currentAssigneeId && !previousSales.includes(currentAssigneeId)) {
      previousSales.push(currentAssigneeId);
    }

    // Kiểm tra xem có chuyển về Kho chung không:
    // - Không tìm thấy nextSale hợp lệ
    // - Hoặc đã vượt quá số lần chuyển tối đa (mặc định 3 lần)
    const shouldMoveToPool = !nextSale || (reason === 'auto_overdue' && transferCount > config.max_transfer_count);

    let updatedLead: Lead;

    if (shouldMoveToPool) {
      // ĐƯA VỀ KHO LEAD CHUNG
      updatedLead = {
        ...lead,
        assigned_to: undefined,
        assigned_name: 'Kho lead chung',
        auto_transfer_count: transferCount,
        previous_assigned_sales: previousSales,
        notes: `${lead.notes || ''}\n[${new Date().toLocaleDateString('vi-VN')}] Đưa về Kho lead chung do quá ${config.max_transfer_count} lần chuyển không có chăm sóc.`.trim(),
        updated_at: new Date().toISOString(),
      };

      // Gửi cảnh báo Quản lý về Kho chung
      await notificationService.sendNotification({
        leadId: lead.id,
        recipientEmail: 'manager@crm-broker.vn',
        recipientName: 'Trưởng Phòng Kinh Doanh',
        eventType: 'pool_alert',
        channel: 'both',
        variables: {
          ten_khach_hang: lead.customer_name || 'Khách hàng',
          du_an: lead.project_name || 'Dự án',
          transfer_count: String(transferCount - 1),
        },
      });

      await this.saveOutboxMessage({
        eventType: 'pool_alert',
        leadId: lead.id,
        recipientEmail: 'manager@crm-broker.vn',
        recipientName: 'Trưởng Phòng Kinh Doanh',
        payload: {
          ten_khach_hang: lead.customer_name,
          du_an: lead.project_name,
          transfer_count: transferCount,
        },
      });
    } else {
      // CHUYỂN CHO SALE TIẾP THEO
      const newDeadline = this.computeCareDeadline(new Date().toISOString(), config.deadline_hours);

      updatedLead = {
        ...lead,
        assigned_to: nextSale.id,
        assigned_name: nextSale.full_name,
        team_id: nextSale.team_id || lead.team_id,
        agency_id: nextSale.agency_id || lead.agency_id,
        auto_transfer_count: transferCount,
        previous_assigned_sales: previousSales,
        last_care_updated_at: new Date().toISOString(),
        care_deadline_at: newDeadline,
        notes: `${lead.notes || ''}\n[${new Date().toLocaleDateString('vi-VN')}] Điều chuyển từ ${currentAssigneeName || 'cũ'} sang ${nextSale.full_name} (${reason === 'auto_overdue' ? 'quá hạn 24h' : 'thủ công'}).`.trim(),
        updated_at: new Date().toISOString(),
      };

      // 1. Gửi email cho Sale mới (nhận lead)
      if (nextSale.email) {
        const persona = notificationService.buildLeadPersonaAndScript(lead);

        await notificationService.sendNotification({
          leadId: lead.id,
          recipientId: nextSale.id,
          recipientEmail: nextSale.email,
          recipientName: nextSale.full_name,
          eventType: reason === 'auto_overdue' ? 'auto_transferred_new' : 'lead_transferred',
          channel: 'both',
          variables: {
            ten_sale: nextSale.full_name,
            ten_khach_hang: lead.customer_name || 'Khách hàng',
            so_dien_thoai: lead.customer_phone || '',
            du_an: lead.project_name || 'Dự án',
            muc_dich: persona.mucDich,
            ngan_sach: persona.nganSach,
            loai_bds: persona.loaiBds,
            ghi_chu: persona.ghiChu,
            buoc_kich_ban: persona.buocKichBan,
            ai_script: persona.aiScript,
            thoi_gian: new Date().toLocaleString('vi-VN'),
            han_cham_soc: new Date(newDeadline).toLocaleString('vi-VN'),
            lead_id: lead.id,
          },
        });

        await this.saveOutboxMessage({
          eventType: reason === 'auto_overdue' ? 'auto_transferred_new' : 'lead_transferred',
          leadId: lead.id,
          recipientId: nextSale.id,
          recipientEmail: nextSale.email,
          recipientName: nextSale.full_name,
          payload: {
            ten_sale: nextSale.full_name,
            ten_khach_hang: lead.customer_name,
            so_dien_thoai: lead.customer_phone,
            du_an: lead.project_name,
            han_cham_soc: newDeadline,
          },
        });
      }

      // 2. Gửi thông báo cho Sale cũ (bị thu hồi)
      if (currentAssigneeId) {
        const oldSale = candidates?.find(c => c.id === currentAssigneeId);
        if (oldSale && oldSale.email) {
          await notificationService.sendNotification({
            leadId: lead.id,
            recipientId: oldSale.id,
            recipientEmail: oldSale.email,
            recipientName: oldSale.full_name,
            eventType: reason === 'auto_overdue' ? 'auto_transferred_old' : 'lead_revoked',
            channel: 'both',
            variables: {
              ten_sale: oldSale.full_name,
              ten_khach_hang: lead.customer_name || 'Khách hàng',
              du_an: lead.project_name || '',
              thoi_gian: new Date().toLocaleString('vi-VN'),
              lead_id: lead.id,
            },
          });

          await this.saveOutboxMessage({
            eventType: reason === 'auto_overdue' ? 'auto_transferred_old' : 'lead_revoked',
            leadId: lead.id,
            recipientId: oldSale.id,
            recipientEmail: oldSale.email,
            recipientName: oldSale.full_name,
            payload: {
              ten_khach_hang: lead.customer_name,
              du_an: lead.project_name,
            },
          });
        }
      }
    }

    // 3. Ghi nhận vào Lead Assignment History
    const historyItem: LeadAssignmentHistory = {
      id: crypto.randomUUID(),
      lead_id: lead.id,
      from_sale_id: currentAssigneeId,
      from_sale_name: currentAssigneeName || 'Chưa phân bổ',
      to_sale_id: shouldMoveToPool ? undefined : nextSale?.id,
      to_sale_name: shouldMoveToPool ? 'Kho lead chung' : nextSale?.full_name,
      reason: shouldMoveToPool ? 'pool_reclaim' : reason,
      transfer_count: transferCount,
      notes: notes || (shouldMoveToPool ? 'Chuyển về Kho chung do quá 3 lần quá hạn' : 'Tự động chuyển quá hạn 24 giờ liên tục'),
      created_by: performedBy,
      created_at: new Date().toISOString(),
    };

    await this.saveAssignmentHistory(historyItem);
    await this.saveUpdatedLead(updatedLead);

    return {
      success: true,
      lead: updatedLead,
      historyId: historyItem.id,
      isPool: shouldMoveToPool,
    };
  }

  /**
   * 7. SCANNER ĐỊNH KỲ QUÉT LEAD QUÁ HẠN & DRY-RUN
   */
  async runAutoTransferScan(options: {
    isDryRun?: boolean;
    allLeads: Lead[];
    allSales: UserProfile[];
    performedBy?: string;
  }): Promise<AutoTransferScanResult> {
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.rpc('scan_and_transfer_overdue_leads', {
        p_is_dry_run: options.isDryRun ?? false,
      });
      if (error) throw new Error(error.message);
      return {
        scannedCount: data.scanned_count || 0,
        transferredCount: data.transferred_count || 0,
        warnedCount: data.warned_count || 0,
        poolReclaimedCount: data.pool_reclaimed_count || 0,
        exemptSkippedCount: 0,
        stopClockSkippedCount: 0,
        details: (data.details || []).map((d: any) => ({
          leadId: d.lead_id,
          customerName: d.customer_name,
          action: d.action,
          fromSale: d.from_sale,
          toSale: d.to_sale,
          reason: d.reason,
        })),
      };
    }

    const config = await this.getConfig();
    if (!config.enabled && !options.isDryRun) {
      return {
        scannedCount: 0,
        transferredCount: 0,
        warnedCount: 0,
        poolReclaimedCount: 0,
        exemptSkippedCount: 0,
        stopClockSkippedCount: 0,
        details: [],
      };
    }

    const details: AutoTransferScanResult['details'] = [];
    let transferredCount = 0;
    let warnedCount = 0;
    let poolReclaimedCount = 0;
    let exemptSkippedCount = 0;
    let stopClockSkippedCount = 0;

    const leadsWithAssignee = options.allLeads.filter(l => l.assigned_to && l.assigned_name !== 'Kho lead chung');

    for (const lead of leadsWithAssignee) {
      // Mô phỏng cơ chế DB: SELECT ... FOR UPDATE SKIP LOCKED
      if (AutoTransferService.lockedLeadIds.has(lead.id)) {
        continue; // Bỏ qua nếu lead đang bị worker khác khóa
      }
      AutoTransferService.lockedLeadIds.add(lead.id);

      try {
        const remaining = this.getCareRemainingHours(lead, config);

        if (remaining.isPaused) {
          if (lead.is_exempt_auto_transfer) {
            exemptSkippedCount++;
            details.push({
              leadId: lead.id,
              customerName: lead.customer_name || 'Khách hàng',
              action: 'exempt_skipped',
              reason: remaining.pauseReason,
            });
          } else {
            stopClockSkippedCount++;
            details.push({
              leadId: lead.id,
              customerName: lead.customer_name || 'Khách hàng',
              action: 'stop_clock_skipped',
              reason: remaining.pauseReason,
            });
          }
          continue;
        }

        // TH1: QUÁ HẠN 24H -> TỰ ĐỘNG CHUYỂN
        if (remaining.isOverdue) {
          const nextSale = this.selectNextSale(lead, options.allSales, config);

          if (!options.isDryRun) {
            const res = await this.transferLead(
              lead,
              nextSale,
              'auto_overdue',
              options.performedBy || 'Cron Job Quét Quá Hạn',
              'Tự động chuyển do quá 24 giờ liên tục không có cập nhật chăm sóc',
              options.allSales
            );
            if (res.isPool) {
              poolReclaimedCount++;
            } else {
              transferredCount++;
            }
          } else {
            if (!nextSale || (lead.auto_transfer_count || 0) >= config.max_transfer_count) {
              poolReclaimedCount++;
            } else {
              transferredCount++;
            }
          }

          details.push({
            leadId: lead.id,
            customerName: lead.customer_name || 'Khách hàng',
            action: (!nextSale || (lead.auto_transfer_count || 0) >= config.max_transfer_count) ? 'pool_reclaimed' : 'transferred',
            fromSale: lead.assigned_name,
            toSale: nextSale ? nextSale.full_name : 'Kho lead chung',
            remainingHours: remaining.hoursRemaining,
            reason: `Quá hạn ${Math.abs(remaining.hoursRemaining)} giờ liên tục`,
          });
        }
        // TH2: SẮP HẾT HẠN (MỐC 20H - CÒN DƯỚI 4H) -> GỬI CẢNH BÁO
        else if (remaining.isWarning) {
          warnedCount++;
          details.push({
            leadId: lead.id,
            customerName: lead.customer_name || 'Khách hàng',
            action: 'warned',
            fromSale: lead.assigned_name,
            remainingHours: remaining.hoursRemaining,
            reason: `Sắp hết hạn: Còn ${remaining.hoursRemaining} giờ`,
          });

          if (!options.isDryRun && lead.assigned_to) {
            const currentSale = options.allSales.find(s => s.id === lead.assigned_to);
            if (currentSale && currentSale.email) {
              await notificationService.sendNotification({
                leadId: lead.id,
                recipientId: currentSale.id,
                recipientEmail: currentSale.email,
                recipientName: currentSale.full_name,
                eventType: 'overdue_warning',
                channel: 'both',
                variables: {
                  ten_sale: currentSale.full_name,
                  ten_khach_hang: lead.customer_name || 'Khách hàng',
                  du_an: lead.project_name || '',
                  han_cham_soc: new Date(lead.care_deadline_at || '').toLocaleString('vi-VN'),
                  lead_id: lead.id,
                },
              });

              // Bổ sung leo thang (Escalation): Cảnh báo mốc 20h gửi đồng thời tới Trưởng nhóm (Team Leader)
              const teamLeader = options.allSales.find(s => 
                (currentSale.reporting_to && s.id === currentSale.reporting_to) || 
                (s.team_id === currentSale.team_id && s.role === 'team_leader' && s.id !== currentSale.id)
              );
              if (teamLeader && teamLeader.email) {
                await notificationService.sendNotification({
                  leadId: lead.id,
                  recipientId: teamLeader.id,
                  recipientEmail: teamLeader.email,
                  recipientName: teamLeader.full_name,
                  eventType: 'overdue_warning',
                  channel: 'both',
                  variables: {
                    ten_sale: `${currentSale.full_name} (Thành viên nhóm)`,
                    ten_khach_hang: lead.customer_name || 'Khách hàng',
                    du_an: lead.project_name || '',
                    han_cham_soc: new Date(lead.care_deadline_at || '').toLocaleString('vi-VN'),
                    lead_id: lead.id,
                  },
                });
              }
            }
          }
        }
      } finally {
        AutoTransferService.lockedLeadIds.delete(lead.id);
      }
    }

    return {
      scannedCount: leadsWithAssignee.length,
      transferredCount,
      warnedCount,
      poolReclaimedCount,
      exemptSkippedCount,
      stopClockSkippedCount,
      details,
    };
  }

  /**
   * 8. QUẢN LÝ GIA HẠN THỜI GIAN HOẶC MIỄN CHUYỂN
   */
  async extendDeadline(
    leadId: string,
    additionalHours: number,
    reason: string,
    managerName: string
  ): Promise<boolean> {
    const leads = this.getLocalLeads();
    const idx = leads.findIndex(l => l.id === leadId);
    if (idx === -1) return false;

    const lead = leads[idx];
    const currentDeadline = lead.extended_until || lead.care_deadline_at || new Date().toISOString();
    const newDeadline = new Date(new Date(currentDeadline).getTime() + additionalHours * 3600000).toISOString();

    lead.extended_until = newDeadline;
    lead.care_deadline_at = newDeadline;
    lead.extension_reason = `Gia hạn +${additionalHours}h bởi ${managerName}: ${reason}`;
    lead.updated_at = new Date().toISOString();

    await this.saveUpdatedLead(lead);

    // Ghi lịch sử
    await this.saveAssignmentHistory({
      id: crypto.randomUUID(),
      lead_id: leadId,
      from_sale_id: lead.assigned_to,
      from_sale_name: lead.assigned_name,
      to_sale_id: lead.assigned_to,
      to_sale_name: lead.assigned_name,
      reason: 'manual_transfer',
      transfer_count: lead.auto_transfer_count || 0,
      notes: `Gia hạn thời hạn chăm sóc thêm ${additionalHours} giờ. Lý do: ${reason}`,
      created_by: managerName,
      created_at: new Date().toISOString(),
    });

    return true;
  }

  async setExemptStatus(
    leadId: string,
    isExempt: boolean,
    reason: string,
    managerName: string
  ): Promise<boolean> {
    const leads = this.getLocalLeads();
    const idx = leads.findIndex(l => l.id === leadId);
    if (idx === -1) return false;

    const lead = leads[idx];
    lead.is_exempt_auto_transfer = isExempt;
    lead.extension_reason = isExempt ? `Miễn chuyển bởi ${managerName}: ${reason}` : undefined;
    lead.updated_at = new Date().toISOString();

    await this.saveUpdatedLead(lead);

    // Ghi lịch sử
    await this.saveAssignmentHistory({
      id: crypto.randomUUID(),
      lead_id: leadId,
      from_sale_id: lead.assigned_to,
      from_sale_name: lead.assigned_name,
      to_sale_id: lead.assigned_to,
      to_sale_name: lead.assigned_name,
      reason: 'manual_transfer',
      transfer_count: lead.auto_transfer_count || 0,
      notes: isExempt ? `Đánh dấu miễn chuyển tự động. Lý do: ${reason}` : `Hủy trạng thái miễn chuyển tự động`,
      created_by: managerName,
      created_at: new Date().toISOString(),
    });

    return true;
  }

  /**
   * 9. LẤY LỊCH SỬ ĐIỀU CHUYỂN CỦA LEAD
   */
  async getLeadAssignmentHistory(leadId: string): Promise<LeadAssignmentHistory[]> {
    if (isLiveSupabaseConfigured) {
      const { data } = await supabase
        .from('lead_assignment_history')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      return (data || []) as LeadAssignmentHistory[];
    }

    const all = this.getLocalHistory();
    return all.filter(h => h.lead_id === leadId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  // ========================================================
  // PHASE 2: CHỐNG GIAN LẬN SLA, LỊCH HẸN, KHO CHUNG & JOB RUNS
  // ========================================================

  /**
   * 10. TẠO LỊCH HẸN VỚI LEAD (CHỐNG LỊCH HẸN ẢO)
   * - Hạn chế tối đa 7 ngày trong tương lai
   * - Không quá 2 lịch hẹn chưa hoàn thành cùng lúc
   * - Tạm dừng đồng hồ SLA
   */
  async scheduleAppointment(payload: {
    leadId: string;
    scheduledAt: string;
    location?: string;
    purpose?: string;
    currentUser: UserProfile;
  }): Promise<LeadAppointment> {
    const leadScheduledTime = new Date(payload.scheduledAt).getTime();
    const now = Date.now();
    const maxFutureMs = 7 * 24 * 3600 * 1000 + 60000;

    if (leadScheduledTime > now + maxFutureMs) {
      throw new Error('invalid_appointment_date: Lịch hẹn không được vượt quá 7 ngày trong tương lai!');
    }
    if (leadScheduledTime < now - 300000) {
      throw new Error('invalid_appointment_date: Thời gian lịch hẹn không thể ở trong quá khứ!');
    }

    const appointments: LeadAppointment[] = this.getLocalAppointments();
    const openCount = appointments.filter(a => a.lead_id === payload.leadId && a.status === 'scheduled').length;
    if (openCount >= 2) {
      throw new Error('limit_exceeded: Mỗi lead chỉ được tạo tối đa 2 lịch hẹn chưa hoàn thành!');
    }

    const newAppt: LeadAppointment = {
      id: crypto.randomUUID(),
      lead_id: payload.leadId,
      sale_id: payload.currentUser.id,
      scheduled_at: new Date(payload.scheduledAt).toISOString(),
      location: payload.location,
      purpose: payload.purpose,
      status: 'scheduled',
      created_at: new Date().toISOString(),
    };

    appointments.unshift(newAppt);
    this.saveLocalAppointments(appointments);

    // Cập nhật trạng thái lead -> appointment_set (tạm dừng đồng hồ) và gán next_follow_up
    const leads = this.getLocalLeads();
    const leadIdx = leads.findIndex(l => l.id === payload.leadId);
    if (leadIdx !== -1) {
      leads[leadIdx].status = 'appointment_set';
      leads[leadIdx].next_follow_up = newAppt.scheduled_at;
      leads[leadIdx].updated_at = new Date().toISOString();
      if (leads[leadIdx].sla_flags) {
        leads[leadIdx].sla_flags = leads[leadIdx].sla_flags?.filter(f => f !== 'no_result_overdue');
      }
      await this.saveUpdatedLead(leads[leadIdx]);
    }

    return newAppt;
  }

  /**
   * 11. BÁO CÁO KẾT QUẢ LỊCH HẸN
   */
  async completeAppointment(payload: {
    appointmentId: string;
    resultSummary: string;
    currentUser: UserProfile;
  }): Promise<LeadAppointment> {
    if (!payload.resultSummary || payload.resultSummary.trim().length < 10) {
      throw new Error('invalid_result: Báo cáo kết quả lịch hẹn phải có ít nhất 10 ký tự!');
    }

    const appointments = this.getLocalAppointments();
    const appt = appointments.find(a => a.id === payload.appointmentId);
    if (!appt) throw new Error('Không tìm thấy lịch hẹn!');

    appt.status = 'completed';
    appt.result_summary = payload.resultSummary.trim();
    appt.completed_at = new Date().toISOString();
    this.saveLocalAppointments(appointments);

    const remainingDelinquent = appointments.some(a => a.lead_id === appt.lead_id && a.status === 'no_result_overdue');
    if (!remainingDelinquent) {
      const leads = this.getLocalLeads();
      const l = leads.find(item => item.id === appt.lead_id);
      if (l && l.sla_flags) {
        l.sla_flags = l.sla_flags.filter(f => f !== 'no_result_overdue');
        await this.saveUpdatedLead(l);
      }
    }

    return appt;
  }

  /**
   * 12. QUÉT VÀ PHÁT HIỆN LỊCH HẸN QUÁ HẠN >4H KHÔNG CÓ KẾT QUẢ
   * Đánh dấu cờ no_result_overdue và kích hoạt lại đồng hồ SLA
   */
  async checkOverdueAppointments(): Promise<{ flaggedCount: number }> {
    const appointments = this.getLocalAppointments();
    const leads = this.getLocalLeads();
    const now = Date.now();
    let flaggedCount = 0;

    for (const appt of appointments) {
      if (appt.status === 'scheduled') {
        const scheduledTime = new Date(appt.scheduled_at).getTime();
        // Quá hạn lịch hẹn > 4 giờ mà không có kết quả
        if (now - scheduledTime > 4 * 3600 * 1000) {
          appt.status = 'no_result_overdue';
          flaggedCount++;

          const lead = leads.find(l => l.id === appt.lead_id);
          if (lead) {
            const flags = new Set(lead.sla_flags || []);
            flags.add('no_result_overdue');
            lead.sla_flags = Array.from(flags);
            // Kích hoạt lại đồng hồ SLA: gán deadline trong 1 giờ tới hoặc ngay lập tức
            lead.care_deadline_at = new Date(now + 3600000).toISOString();
            lead.updated_at = new Date().toISOString();
          }
        }
      }
    }

    if (flaggedCount > 0) {
      this.saveLocalAppointments(appointments);
      localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));
    }

    return { flaggedCount };
  }

  /**
   * Lấy danh sách lịch hẹn
   */
  async getAppointments(leadId?: string): Promise<LeadAppointment[]> {
    const appointments = this.getLocalAppointments();
    return leadId ? appointments.filter(a => a.lead_id === leadId) : appointments;
  }

  /**
   * 13. GHI NHẬN TƯƠNG TÁC / CHĂM SÓC CHỐNG GIAN LẬN SLA
   * - Bắt buộc >= 20 ký tự
   * - Không được trùng lặp nội dung với lần gần nhất
   * - Tối đa 3 lần liên tiếp reset 24h mà không đổi trạng thái; lần 4 gắn cờ nghi vấn và KHÔNG reset hạn
   */
  async recordInteraction(payload: {
    leadId: string;
    content: string;
    currentUser: UserProfile;
  }): Promise<{ success: boolean; flaggedSuspicious?: boolean; careDeadline?: string }> {
    const trimmed = payload.content.trim();
    if (trimmed.length < 20) {
      throw new Error('invalid_interaction_length: Nội dung chăm sóc phải có ít nhất 20 ký tự mô tả cụ thể!');
    }

    const activities = this.getLocalActivities();
    const leadActivities = activities.filter(a => a.lead_id === payload.leadId);
    const lastInteraction = leadActivities[0];
    if (lastInteraction && lastInteraction.description?.trim().toLowerCase() === trimmed.toLowerCase()) {
      throw new Error('duplicate_interaction: Nội dung chăm sóc bị trùng lặp với lần ghi nhận gần nhất!');
    }

    const leads = this.getLocalLeads();
    const leadIdx = leads.findIndex(l => l.id === payload.leadId);
    if (leadIdx === -1) throw new Error('Không tìm thấy Lead!');

    const lead = leads[leadIdx];
    const resetCount = lead.sla_reset_count || 0;
    let flaggedSuspicious = false;
    let newDeadline = lead.care_deadline_at;
    const nowIso = new Date().toISOString();

    if (resetCount >= 3) {
      flaggedSuspicious = true;
      const flags = new Set(lead.sla_flags || []);
      flags.add('suspicious_sla_reset');
      lead.sla_flags = Array.from(flags);
      lead.notes = `${lead.notes || ''}\n[Cảnh báo SLA] Ghi nhận chăm sóc lần thứ ${resetCount + 1} liên tiếp không đổi trạng thái; giữ nguyên hạn chót để chống gian lận.`.trim();

      await notificationService.sendNotification({
        leadId: lead.id,
        recipientEmail: 'manager@crm-broker.vn',
        recipientName: 'Quản Lý Sàn',
        eventType: 'overdue_warning',
        channel: 'both',
        variables: {
          ten_sale: payload.currentUser.full_name,
          ten_khach_hang: lead.customer_name || 'Khách hàng',
          du_an: lead.project_name || '',
          han_cham_soc: 'Nghi vấn gian lận SLA: Reset quá 3 lần liên tiếp không đổi trạng thái',
          lead_id: lead.id,
        },
      });
    } else {
      lead.sla_reset_count = resetCount + 1;
      newDeadline = this.computeCareDeadline(nowIso, 24);
      lead.care_deadline_at = newDeadline;
      lead.last_care_updated_at = nowIso;
    }

    lead.updated_at = nowIso;
    await this.saveUpdatedLead(lead);

    activities.unshift({
      id: crypto.randomUUID(),
      lead_id: payload.leadId,
      type: 'note',
      description: trimmed,
      user_id: payload.currentUser.id,
      user_name: payload.currentUser.full_name,
      created_at: nowIso,
    });
    localStorage.setItem(STORAGE_KEY_ACTIVITIES, JSON.stringify(activities));

    return { success: true, flaggedSuspicious, careDeadline: newDeadline };
  }

  /**
   * 14. TIẾP NHẬN LEAD TỪ KHO CHUNG (POOL CLAIM) CÓ KIỂM SOÁT
   * - Tối đa 5 lead/ngày mỗi sale
   * - Tối đa 20 lead mở đồng thời
   * - Concurrency check: Không cho phép 2 sale nhận cùng lúc
   */
  async claimPoolLead(leadId: string, currentUser: UserProfile): Promise<{ success: boolean; lead: Lead }> {
    if (AutoTransferService.lockedLeadIds.has(leadId)) {
      throw new Error('concurrency_error: Lead đang được hệ thống hoặc nhân viên khác tiếp nhận!');
    }
    AutoTransferService.lockedLeadIds.add(leadId);

    try {
      const leads = this.getLocalLeads();
      const lead = leads.find(l => l.id === leadId);
      if (!lead) throw new Error('Không tìm thấy Lead!');

      if (lead.assigned_to && lead.assigned_name !== 'Kho lead chung' && lead.assigned_name !== 'Chưa phân bổ') {
        throw new Error('already_claimed: Lead này đã có nhân viên khác tiếp nhận!');
      }

      const history = this.getLocalHistory();
      const today = new Date().toISOString().slice(0, 10);
      const claimsToday = history.filter(h => 
        h.to_sale_id === currentUser.id && 
        h.reason === 'pool_claimed' && 
        h.created_at.startsWith(today)
      ).length;

      if (claimsToday >= 5) {
        throw new Error('daily_claim_limit: Bạn đã đạt hạn mức nhận tối đa 5 lead/ngày từ Kho chung!');
      }

      const openLeadsCount = leads.filter(l => 
        l.assigned_to === currentUser.id && 
        !['lost', 'invalid', 'contract', 'after_sales'].includes(l.status)
      ).length;

      if (openLeadsCount >= 20) {
        throw new Error('max_open_leads_limit: Bạn đang phụ trách tối đa 20 lead mở, không thể nhận thêm!');
      }

      const nowIso = new Date().toISOString();
      const newDeadline = this.computeCareDeadline(nowIso, 24);

      lead.assigned_to = currentUser.id;
      lead.assigned_name = currentUser.full_name;
      lead.team_id = currentUser.team_id || lead.team_id;
      lead.agency_id = currentUser.agency_id || lead.agency_id;
      lead.auto_transfer_count = 0;
      lead.sla_reset_count = 0;
      lead.last_care_updated_at = nowIso;
      lead.care_deadline_at = newDeadline;
      lead.updated_at = nowIso;

      await this.saveAssignmentHistory({
        id: crypto.randomUUID(),
        lead_id: lead.id,
        from_sale_id: undefined,
        from_sale_name: 'Kho lead chung',
        to_sale_id: currentUser.id,
        to_sale_name: currentUser.full_name,
        reason: 'pool_claimed',
        transfer_count: 0,
        notes: `Nhân viên ${currentUser.full_name} chủ động nhận lead từ Kho chung`,
        created_by: currentUser.full_name,
        created_at: nowIso,
      });

      await this.saveUpdatedLead(lead);

      return { success: true, lead };
    } finally {
      AutoTransferService.lockedLeadIds.delete(leadId);
    }
  }

  /**
   * 15. GIÁM SÁT TIẾN TRÌNH NỀN (JOB RUNS & DEAD LETTER QUEUE)
   */
  async recordJobRun(payload: {
    job_name: string;
    started_at: string;
    finished_at: string;
    status: 'running' | 'success' | 'failed' | 'timeout';
    rows_affected?: number;
    error_detail?: string;
    server_host?: string;
  }): Promise<JobRun> {
    const item: JobRun = {
      id: crypto.randomUUID(),
      ...payload,
      created_at: new Date().toISOString(),
    };

    const runs: JobRun[] = JSON.parse(localStorage.getItem(STORAGE_KEY_JOB_RUNS) || '[]');
    runs.unshift(item);
    localStorage.setItem(STORAGE_KEY_JOB_RUNS, JSON.stringify(runs));
    return item;
  }

  async getJobRuns(jobName?: string): Promise<JobRun[]> {
    const runs: JobRun[] = JSON.parse(localStorage.getItem(STORAGE_KEY_JOB_RUNS) || '[]');
    return jobName ? runs.filter(r => r.job_name === jobName) : runs;
  }

  async enqueueDeadLetter(payload: {
    source_table: string;
    record_id?: string;
    error_type: string;
    error_message: string;
    payload: any;
  }): Promise<DeadLetterMessage> {
    const msg: DeadLetterMessage = {
      id: crypto.randomUUID(),
      ...payload,
      retry_count: 0,
      status: 'dead',
      created_at: new Date().toISOString(),
    };

    const dlq: DeadLetterMessage[] = JSON.parse(localStorage.getItem(STORAGE_KEY_DEAD_LETTER) || '[]');
    dlq.unshift(msg);
    localStorage.setItem(STORAGE_KEY_DEAD_LETTER, JSON.stringify(dlq));
    return msg;
  }

  async getDeadLetterMessages(): Promise<DeadLetterMessage[]> {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_DEAD_LETTER) || '[]');
  }

  // Helper lưu dữ liệu
  private async saveUpdatedLead(lead: Lead): Promise<void> {
    if (isLiveSupabaseConfigured) {
      await supabase
        .from('leads')
        .update({
          assigned_to: lead.assigned_to,
          team_id: lead.team_id,
          agency_id: lead.agency_id,
          auto_transfer_count: lead.auto_transfer_count,
          previous_assigned_sales: lead.previous_assigned_sales,
          last_care_updated_at: lead.last_care_updated_at,
          care_deadline_at: lead.care_deadline_at,
          extended_until: lead.extended_until,
          extension_reason: lead.extension_reason,
          is_exempt_auto_transfer: lead.is_exempt_auto_transfer,
          notes: lead.notes,
          sla_flags: lead.sla_flags,
          sla_reset_count: lead.sla_reset_count,
          loss_reason_code: lead.loss_reason_code,
          loss_reason_detail: lead.loss_reason_detail,
          nurture_reminder_date: lead.nurture_reminder_date,
          updated_at: lead.updated_at,
        })
        .eq('id', lead.id);
    }

    const leads = this.getLocalLeads();
    const idx = leads.findIndex(l => l.id === lead.id);
    if (idx !== -1) {
      leads[idx] = lead;
      localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));
    }
  }

  private async saveAssignmentHistory(history: LeadAssignmentHistory): Promise<void> {
    if (isLiveSupabaseConfigured) {
      await supabase.from('lead_assignment_history').insert(history);
    }

    const histList = this.getLocalHistory();
    histList.unshift(history);
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(histList));
  }

  private getLocalLeads(): Lead[] {
    const raw = localStorage.getItem(STORAGE_KEY_LEADS);
    return raw ? JSON.parse(raw) : [];
  }

  private getLocalHistory(): LeadAssignmentHistory[] {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
    return raw ? JSON.parse(raw) : [];
  }

  private getLocalAppointments(): LeadAppointment[] {
    const raw = localStorage.getItem(STORAGE_KEY_APPOINTMENTS);
    return raw ? JSON.parse(raw) : [];
  }

  private saveLocalAppointments(list: LeadAppointment[]): void {
    localStorage.setItem(STORAGE_KEY_APPOINTMENTS, JSON.stringify(list));
  }

  private getLocalActivities(): any[] {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVITIES);
    return raw ? JSON.parse(raw) : [];
  }
}

export const autoTransferService = new AutoTransferService();
