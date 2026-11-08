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
  AssignmentReason 
} from '@/domain/types';
import { notificationService } from './notificationService';

const STORAGE_KEY_CONFIG = 'crm_lead_auto_transfer_config';
const STORAGE_KEY_LEADS = 'crm_leads';
const STORAGE_KEY_HISTORY = 'crm_lead_assignment_history';

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

    // D. Lead đang ở các trạng thái Dừng Đồng Hồ (Đặt cọc, Ký HĐMB, Hẹn gặp, v.v...)
    if (config.stop_clock_statuses.includes(lead.status)) {
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

    // E. Lead có lịch hẹn tương lai hợp lệ
    if (lead.next_follow_up) {
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

    // F. Tính toán theo Deadline 24h liên tục
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
          }
        }
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
}

export const autoTransferService = new AutoTransferService();
