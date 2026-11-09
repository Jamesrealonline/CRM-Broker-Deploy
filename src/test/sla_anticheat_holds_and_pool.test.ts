import { describe, it, expect, beforeEach } from 'vitest';
import { autoTransferService } from '@/domain/services/autoTransferService';
import { holdRepository } from '@/data/repositories/holdRepository';
import { leadRepository } from '@/data/repositories/leadRepository';
import { Lead, UserProfile } from '@/domain/types';

describe('Giai đoạn 2: SLA Chống Gian Lận, Lead Pool, Giữ Căn & Giám Sát Job Nền', () => {
  const saleUser1: UserProfile = {
    id: 'sale-001',
    full_name: 'Nguyễn Văn Sale 1',
    email: 'sale1@diaocvang.vn',
    phone: '0901234567',
    role: 'sale_agent',
    agency_id: 'agency-1',
    team_id: 'team-1',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const saleUser2: UserProfile = {
    id: 'sale-002',
    full_name: 'Trần Thị Sale 2',
    email: 'sale2@diaocvang.vn',
    phone: '0901234568',
    role: 'sale_agent',
    agency_id: 'agency-1',
    team_id: 'team-1',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const managerUser: UserProfile = {
    id: 'mgr-001',
    full_name: 'Trưởng Phòng Kinh Doanh',
    email: 'manager@diaocvang.vn',
    phone: '0901234569',
    role: 'sales_manager',
    agency_id: 'agency-1',
    team_id: 'team-1',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. Chống Lịch Hẹn Ảo & Tự Động Kích Hoạt Lại SLA', () => {
    it('Chặn đặt lịch hẹn vượt quá 7 ngày trong tương lai', async () => {
      const future8Days = new Date(Date.now() + 8 * 86400000).toISOString();
      await expect(
        autoTransferService.scheduleAppointment({
          leadId: 'lead-test-1',
          scheduledAt: future8Days,
          purpose: 'Tư vấn dự án Grand Park',
          currentUser: saleUser1,
        })
      ).rejects.toThrow('invalid_appointment_date: Lịch hẹn không được vượt quá 7 ngày trong tương lai!');
    });

    it('Chặn tạo quá 2 lịch hẹn mở (chưa hoàn thành) cho cùng 1 lead', async () => {
      const validDate1 = new Date(Date.now() + 86400000).toISOString();
      const validDate2 = new Date(Date.now() + 2 * 86400000).toISOString();
      const validDate3 = new Date(Date.now() + 3 * 86400000).toISOString();

      await autoTransferService.scheduleAppointment({
        leadId: 'lead-test-1',
        scheduledAt: validDate1,
        purpose: 'Hẹn lần 1',
        currentUser: saleUser1,
      });

      await autoTransferService.scheduleAppointment({
        leadId: 'lead-test-1',
        scheduledAt: validDate2,
        purpose: 'Hẹn lần 2',
        currentUser: saleUser1,
      });

      await expect(
        autoTransferService.scheduleAppointment({
          leadId: 'lead-test-1',
          scheduledAt: validDate3,
          purpose: 'Hẹn lần 3',
          currentUser: saleUser1,
        })
      ).rejects.toThrow('limit_exceeded: Mỗi lead chỉ được tạo tối đa 2 lịch hẹn chưa hoàn thành!');
    });

    it('Lịch hẹn quá hạn >4h không có kết quả bị gắn cờ no_result_overdue và kích hoạt lại SLA', async () => {
      // Mock một lead đang có hẹn
      const lead: Lead = {
        id: 'lead-overdue-appt',
        customer_id: 'cust-1',
        project_id: 'proj-1',
        lead_score: 80,
        purpose: 'investment',
        customer_name: 'Khách Lịch Hẹn Quá Hạn',
        status: 'appointment_set',
        assigned_to: saleUser1.id,
        assigned_name: saleUser1.full_name,
        created_at: new Date(Date.now() - 48 * 3600000).toISOString(),
        care_deadline_at: new Date(Date.now() + 24 * 3600000).toISOString(),
      };
      localStorage.setItem('crm_leads', JSON.stringify([lead]));

      // Tạo lịch hẹn xảy ra cách đây 5 tiếng
      const past5Hours = new Date(Date.now() - 5 * 3600000).toISOString();
      const appts = [
        {
          id: 'appt-past-1',
          lead_id: lead.id,
          sale_id: saleUser1.id,
          scheduled_at: past5Hours,
          status: 'scheduled',
          created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
        },
      ];
      localStorage.setItem('crm_lead_appointments', JSON.stringify(appts));

      // Quét lịch hẹn quá hạn
      const scanRes = await autoTransferService.checkOverdueAppointments();
      expect(scanRes.flaggedCount).toBe(1);

      // Kiểm tra trạng thái appointment và cờ lead
      const updatedAppts = await autoTransferService.getAppointments(lead.id);
      expect(updatedAppts[0].status).toBe('no_result_overdue');

      const rawLeads: Lead[] = JSON.parse(localStorage.getItem('crm_leads') || '[]');
      const updatedLead = rawLeads.find(l => l.id === lead.id)!;
      expect(updatedLead.sla_flags).toContain('no_result_overdue');

      // SLA clock không còn bị tạm dừng mặc dù status vẫn là appointment_set!
      const remaining = autoTransferService.getCareRemainingHours(updatedLead);
      expect(remaining.isPaused).toBe(false);
    });

    it('Hoàn thành lịch hẹn yêu cầu tối thiểu 10 ký tự kết quả và xóa cờ quá hạn', async () => {
      const appts = [
        {
          id: 'appt-123',
          lead_id: 'lead-test',
          sale_id: saleUser1.id,
          scheduled_at: new Date().toISOString(),
          status: 'no_result_overdue',
          created_at: new Date().toISOString(),
        },
      ];
      localStorage.setItem('crm_lead_appointments', JSON.stringify(appts));

      // Thử nhập quá ngắn
      await expect(
        autoTransferService.completeAppointment({
          appointmentId: 'appt-123',
          resultSummary: 'Ngắn',
          currentUser: saleUser1,
        })
      ).rejects.toThrow('invalid_result: Báo cáo kết quả lịch hẹn phải có ít nhất 10 ký tự!');

      // Nhập đủ kết quả
      const res = await autoTransferService.completeAppointment({
        appointmentId: 'appt-123',
        resultSummary: 'Khách hàng rất quan tâm căn 2PN tầng trung, hẹn chốt cọc thứ 7.',
        currentUser: saleUser1,
      });

      expect(res.status).toBe('completed');
      expect(res.result_summary).toContain('quan tâm căn 2PN');
    });
  });

  describe('2. Chống Gian Lận Tương Tác & Lạm Dụng Reset SLA', () => {
    it('Chặn ghi nhận chăm sóc dưới 20 ký tự hoặc trùng lặp liên tiếp', async () => {
      const lead: Lead = {
        id: 'lead-interaction-1',
        customer_id: 'cust-2',
        project_id: 'proj-1',
        lead_score: 80,
        purpose: 'residence',
        customer_name: 'Khách Chăm Sóc Test',
        status: 'contacted',
        assigned_to: saleUser1.id,
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('crm_leads', JSON.stringify([lead]));

      // 1. Thử ghi < 20 ký tự
      await expect(
        autoTransferService.recordInteraction({
          leadId: lead.id,
          content: 'Gọi điện ngắn',
          currentUser: saleUser1,
        })
      ).rejects.toThrow('invalid_interaction_length: Nội dung chăm sóc phải có ít nhất 20 ký tự');

      // 2. Ghi hợp lệ lần 1
      const validNote = 'Đã gọi điện tư vấn chính sách thanh toán 2026, khách quan tâm phân khu Zenpark.';
      const res1 = await autoTransferService.recordInteraction({
        leadId: lead.id,
        content: validNote,
        currentUser: saleUser1,
      });
      expect(res1.success).toBe(true);

      // 3. Thử ghi trùng lặp y hệt lần 1
      await expect(
        autoTransferService.recordInteraction({
          leadId: lead.id,
          content: validNote,
          currentUser: saleUser1,
        })
      ).rejects.toThrow('duplicate_interaction: Nội dung chăm sóc bị trùng lặp với lần ghi nhận gần nhất!');
    });

    it('Quá 3 lần reset SLA liên tiếp không đổi trạng thái -> Gắn cờ suspicious_sla_reset và KHÔNG reset hạn chót', async () => {
      const originalDeadline = new Date(Date.now() + 10 * 3600000).toISOString();
      const lead: Lead = {
        id: 'lead-spam-reset',
        customer_id: 'cust-3',
        project_id: 'proj-1',
        lead_score: 80,
        purpose: 'investment',
        customer_name: 'Khách Gian Lận Reset',
        status: 'contacted',
        assigned_to: saleUser1.id,
        care_deadline_at: originalDeadline,
        sla_reset_count: 3, // Đã reset 3 lần trước đó
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('crm_leads', JSON.stringify([lead]));

      // Ghi nhận lần thứ 4
      const res = await autoTransferService.recordInteraction({
        leadId: lead.id,
        content: 'Khách hẹn gọi lại vào đầu tuần sau để bàn lại với gia đình về tài chính vay.',
        currentUser: saleUser1,
      });

      expect(res.flaggedSuspicious).toBe(true);
      expect(res.careDeadline).toBe(originalDeadline); // Không gia hạn thêm 24h

      const rawLeads: Lead[] = JSON.parse(localStorage.getItem('crm_leads') || '[]');
      const savedLead = rawLeads.find(l => l.id === lead.id)!;
      expect(savedLead.sla_flags).toContain('suspicious_sla_reset');
    });
  });

  describe('3. Tiếp Nhận Lead Từ Kho Chung (Lead Pool) Có Kiểm Soát', () => {
    it('Chặn nhận lead khi đã có người phụ trách', async () => {
      const lead: Lead = {
        id: 'lead-claimed-already',
        customer_id: 'cust-4',
        project_id: 'proj-1',
        lead_score: 80,
        purpose: 'investment',
        customer_name: 'Khách Đã Giao',
        status: 'new',
        assigned_to: saleUser2.id,
        assigned_name: saleUser2.full_name,
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('crm_leads', JSON.stringify([lead]));

      await expect(
        autoTransferService.claimPoolLead(lead.id, saleUser1)
      ).rejects.toThrow('already_claimed: Lead này đã có nhân viên khác tiếp nhận!');
    });

    it('Cưỡng chế hạn mức nhận tối đa 5 lead/ngày từ Kho chung', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const fakeHistory = Array.from({ length: 5 }).map((_, i) => ({
        id: `hist-${i}`,
        lead_id: `lead-prev-${i}`,
        to_sale_id: saleUser1.id,
        reason: 'pool_claimed' as const,
        created_at: `${today}T10:00:00.000Z`,
      }));
      localStorage.setItem('crm_lead_assignment_history', JSON.stringify(fakeHistory));

      const poolLead: Lead = {
        id: 'lead-pool-new',
        customer_id: 'cust-5',
        project_id: 'proj-1',
        lead_score: 80,
        purpose: 'investment',
        customer_name: 'Khách Kho Chung',
        status: 'new',
        assigned_name: 'Kho lead chung',
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('crm_leads', JSON.stringify([poolLead]));

      await expect(
        autoTransferService.claimPoolLead(poolLead.id, saleUser1)
      ).rejects.toThrow('daily_claim_limit: Bạn đã đạt hạn mức nhận tối đa 5 lead/ngày từ Kho chung!');
    });

    it('Tiếp nhận lead từ Pool thành công gán 24h chăm sóc và ghi lịch sử pool_claimed', async () => {
      const poolLead: Lead = {
        id: 'lead-pool-success',
        customer_id: 'cust-6',
        project_id: 'proj-1',
        lead_score: 80,
        purpose: 'investment',
        customer_name: 'Khách Pool Hợp Lệ',
        status: 'new',
        assigned_name: 'Kho lead chung',
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('crm_leads', JSON.stringify([poolLead]));

      const res = await autoTransferService.claimPoolLead(poolLead.id, saleUser1);
      expect(res.success).toBe(true);
      expect(res.lead.assigned_to).toBe(saleUser1.id);
      expect(res.lead.assigned_name).toBe(saleUser1.full_name);
      expect(res.lead.auto_transfer_count).toBe(0);
      expect(res.lead.care_deadline_at).toBeDefined();

      const history = await autoTransferService.getLeadAssignmentHistory(poolLead.id);
      expect(history.length).toBe(1);
      expect(history[0].reason).toBe('pool_claimed');
    });
  });

  describe('4. Giữ Căn Có Thời Hạn (Unit Holds) & Danh Sách Chờ (Waitlist)', () => {
    it('Chống giữ trùng một căn hộ trong cùng dự án khi đang có hold active', async () => {
      await holdRepository.createUnitHold({
        projectId: 'proj-ocean',
        projectName: 'Vinhomes Ocean Park',
        unitCode: 'OP1-12.08',
        customerName: 'Khách Giữ Căn 1',
        currentUser: saleUser1,
      });

      // Sale 2 cố tình giữ cùng căn
      await expect(
        holdRepository.createUnitHold({
          projectId: 'proj-ocean',
          projectName: 'Vinhomes Ocean Park',
          unitCode: 'op1-12.08', // lowercase kiểm tra case-insensitive
          customerName: 'Khách Giữ Căn 2',
          currentUser: saleUser2,
        })
      ).rejects.toThrow('duplicate_unit_hold');
    });

    it('Cưỡng chế hạn mức giữ tối đa 3 căn đồng thời trên một Sale', async () => {
      await holdRepository.createUnitHold({
        projectId: 'proj-ocean',
        unitCode: 'CAN-01',
        currentUser: saleUser1,
      });
      await holdRepository.createUnitHold({
        projectId: 'proj-ocean',
        unitCode: 'CAN-02',
        currentUser: saleUser1,
      });
      await holdRepository.createUnitHold({
        projectId: 'proj-ocean',
        unitCode: 'CAN-03',
        currentUser: saleUser1,
      });

      // Giữ căn thứ 4
      await expect(
        holdRepository.createUnitHold({
          projectId: 'proj-ocean',
          unitCode: 'CAN-04',
          currentUser: saleUser1,
        })
      ).rejects.toThrow('limit_exceeded: Mỗi chuyên viên chỉ được phép giữ tối đa 3 căn cùng lúc!');
    });

    it('Chỉ Quản lý mới được phép gia hạn giữ căn', async () => {
      const hold = await holdRepository.createUnitHold({
        projectId: 'proj-ocean',
        unitCode: 'CAN-EXTEND',
        currentUser: saleUser1,
      });

      // Sale cố tình tự gia hạn
      await expect(
        holdRepository.extendUnitHold(hold.id, 24, 'Khách cần thêm thời gian', saleUser1)
      ).rejects.toThrow('forbidden: Chỉ Quản lý sàn hoặc Trưởng nhóm mới có quyền gia hạn giữ căn!');

      // Quản lý gia hạn hợp lệ
      const extended = await holdRepository.extendUnitHold(hold.id, 24, 'Duyệt gia hạn', managerUser);
      expect(extended.extension_count).toBe(1);
    });

    it('Tự động giải phóng căn hết hạn và kích hoạt người kế tiếp trong Waitlist', async () => {
      // 1. Tạo một hold đã hết hạn từ 1 tiếng trước
      const expiredHold = {
        id: 'hold-expired-1',
        project_id: 'proj-ocean',
        unit_code: 'CAN-WAITLIST',
        sale_id: saleUser1.id,
        sale_name: saleUser1.full_name,
        hold_start_at: new Date(Date.now() - 25 * 3600000).toISOString(),
        hold_expires_at: new Date(Date.now() - 1 * 3600000).toISOString(), // Đã hết hạn
        status: 'active',
        created_at: new Date(Date.now() - 25 * 3600000).toISOString(),
      };
      localStorage.setItem('crm_unit_holds', JSON.stringify([expiredHold]));

      // 2. Thêm Sale 2 vào Waitlist
      await holdRepository.addToWaitlist({
        projectId: 'proj-ocean',
        unitCode: 'CAN-WAITLIST',
        leadId: 'lead-wait-2',
        customerName: 'Khách Đang Chờ Can-Waitlist',
        currentUser: saleUser2,
      });

      // 3. Chạy hàm giải phóng căn
      const releaseRes = await holdRepository.releaseExpiredHolds();
      expect(releaseRes.releasedCount).toBe(1);

      // 4. Kiểm tra căn đã chuyển expired và waitlist chuyển sang notified
      const holds = await holdRepository.getUnitHolds('proj-ocean');
      expect(holds[0].status).toBe('expired');

      const waitlist = await holdRepository.getWaitlist('proj-ocean', 'CAN-WAITLIST');
      expect(waitlist[0].status).toBe('notified');
      expect(waitlist[0].notified_at).toBeDefined();
    });
  });

  describe('5. Lý Do Mất Khách (Lead Loss Reasons) & Giám Sát Job Nền', () => {
    it('Chặn đóng lead sang lost/invalid nếu không có lý do chuẩn hóa', async () => {
      const lead: Lead = {
        id: 'lead-close-check',
        customer_id: 'cust-7',
        project_id: 'proj-1',
        lead_score: 80,
        purpose: 'investment',
        customer_name: 'Khách Cần Đóng',
        status: 'contacted',
        assigned_to: saleUser1.id,
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('crm_leads', JSON.stringify([lead]));

      // Sale đóng lead mà không chọn lý do
      const res = await leadRepository.updateLeadStageWithTransaction({
        leadId: lead.id,
        newStatus: 'lost',
        currentUser: saleUser1,
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Bắt buộc chọn lý do mất khách / không hợp lệ');

      // Đóng kèm lý do hợp lệ
      const resValid = await leadRepository.updateLeadStageWithTransaction({
        leadId: lead.id,
        newStatus: 'lost',
        lossReasonCode: 'price_too_high',
        lossReasonDetail: 'Khách chê giá cao hơn 15% so với thị trường lân cận',
        currentUser: saleUser1,
      });
      expect(resValid.success).toBe(true);

      const rawLeads: Lead[] = JSON.parse(localStorage.getItem('crm_leads') || '[]');
      const savedLead = rawLeads.find(l => l.id === lead.id)!;
      expect(savedLead.status).toBe('lost');
      expect(savedLead.loss_reason_code).toBe('price_too_high');
      expect(savedLead.loss_reason_detail).toContain('cao hơn 15%');
    });

    it('Ghi nhận và truy vấn nhật ký Job Runs & Dead Letter Queue', async () => {
      // 1. Ghi nhận job run
      const job = await autoTransferService.recordJobRun({
        job_name: 'cron_sla_scanner',
        started_at: new Date(Date.now() - 30000).toISOString(),
        finished_at: new Date().toISOString(),
        status: 'success',
        rows_affected: 12,
        server_host: 'vercel-sgp1',
      });
      expect(job.status).toBe('success');

      const runs = await autoTransferService.getJobRuns('cron_sla_scanner');
      expect(runs.length).toBeGreaterThanOrEqual(1);

      // 2. Ghi nhận dead letter message
      const dlq = await autoTransferService.enqueueDeadLetter({
        source_table: 'outbox',
        record_id: 'outbox-fail-1',
        error_type: 'SMTP_TIMEOUT',
        error_message: 'Connection timed out after 3 retries',
        payload: { recipient: 'bad-email@domain-invalid.org' },
      });
      expect(dlq.status).toBe('dead');

      const allDlq = await autoTransferService.getDeadLetterMessages();
      expect(allDlq.length).toBeGreaterThanOrEqual(1);
      expect(allDlq[0].error_type).toBe('SMTP_TIMEOUT');
    });
  });
});
