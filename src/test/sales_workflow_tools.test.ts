import { describe, it, expect, beforeEach } from 'vitest';
import { salesWorkflowService } from '@/domain/services/salesWorkflowService';
import { UserProfile, LeadAppointment } from '@/domain/types';

describe('Giai đoạn 4: Quy Trình Bán Hàng, Lịch Hẹn GPS/QR, Tính Vay, Báo Giá & Merge Khách', () => {
  const saleUser: UserProfile = {
    id: 'sale-001',
    full_name: 'Nguyễn Văn Sale',
    email: 'sale@diaocvang.vn',
    phone: '0901234567',
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

  describe('1. Máy Tính Vay & Lịch Trả Nợ (Mortgage Calculator)', () => {
    it('Tính toán chính xác lịch trả nợ vay ngân hàng có ân hạn nợ gốc', () => {
      const loanAmount = 2400000000; // 2.4 tỷ
      const loanTermMonths = 240; // 20 năm
      const gracePeriodMonths = 12; // Ân hạn 12 tháng đầu

      const result = salesWorkflowService.calculateMortgageSchedule({
        loanAmount,
        loanTermMonths,
        preferentialRateYear: 6.5,
        preferentialMonths: 12,
        floatingRateYear: 10.5,
        gracePeriodMonths,
      });

      expect(result.schedule.length).toBe(240);

      // 12 tháng đầu là ân hạn gốc -> gốc = 0
      for (let i = 0; i < 12; i++) {
        expect(result.schedule[i].isGracePeriod).toBe(true);
        expect(result.schedule[i].principalPayment).toBe(0);
        expect(result.schedule[i].interestPayment).toBeGreaterThan(0);
      }

      // Tháng 13 bắt đầu trả gốc
      expect(result.schedule[12].isGracePeriod).toBe(false);
      expect(result.schedule[12].principalPayment).toBeGreaterThan(0);

      // Tổng gốc hoàn trả khớp chính xác số tiền vay ban đầu
      const totalPrincipalPaid = result.schedule.reduce((acc, row) => acc + row.principalPayment, 0);
      expect(totalPrincipalPaid).toBe(loanAmount);
    });
  });

  describe('2. Phiếu Báo Giá Snapshot (Tuyệt Đối Không Chứa Hoa Hồng)', () => {
    it('Tạo báo giá snapshot độc lập, tính đúng giá sau chiết khấu và KHÔNG lộ hoa hồng', async () => {
      const dealValue = 3500000000; // 3.5 tỷ
      const discountAmount = 150000000; // Chiết khấu 150 triệu

      const quotation = await salesWorkflowService.createQuotation({
        projectId: 'proj-ocean',
        projectName: 'Vinhomes Ocean Park',
        unitCode: 'OP-24.08',
        dealValue,
        discountAmount,
        validDays: 5,
        currentUser: saleUser,
      });

      expect(quotation.code).toMatch(/^BG-2026-\d{6}$/);
      expect(quotation.final_price).toBe(3350000000);
      expect(quotation.status).toBe('sent');

      // Đảm bảo không có bất kỳ thuộc tính nào liên quan đến hoa hồng sàn hoặc sale
      expect((quotation as any).commission_rate).toBeUndefined();
      expect((quotation as any).sale_commission_amount).toBeUndefined();
      expect((quotation as any).commission_amount).toBeUndefined();
    });
  });

  describe('3. Check-in Lịch Hẹn Bằng GPS Geofence & QR Code', () => {
    it('Check-in tại dự án: Ngoài bán kính 500m bị gắn cờ outside_geofence', async () => {
      const appt: LeadAppointment = {
        id: 'appt-gps-1',
        lead_id: 'lead-1',
        sale_id: saleUser.id,
        scheduled_at: new Date().toISOString(),
        status: 'scheduled',
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('crm_lead_appointments', JSON.stringify([appt]));

      // Tọa độ dự án: Vincom Mega Mall (10.8415, 106.8400)
      const projectCoords = { lat: 10.8415, lng: 106.8400 };

      // 1. Sale check-in ở cách đó 5km (10.8800, 106.8400)
      const resFar = await salesWorkflowService.checkInAppointment({
        appointmentId: appt.id,
        projectCoords,
        userCoords: { lat: 10.8800, lng: 106.8400 },
        currentUser: saleUser,
      });

      expect(resFar.isWithinGeofence).toBe(false);
      expect(resFar.flaggedOutside).toBe(true);
      expect(resFar.appointment.flags).toContain('outside_geofence');

      // 2. Sale check-in ngay tại dự án (cách 50m)
      const resNear = await salesWorkflowService.checkInAppointment({
        appointmentId: appt.id,
        projectCoords,
        userCoords: { lat: 10.8417, lng: 106.8401 },
        currentUser: saleUser,
      });

      expect(resNear.isWithinGeofence).toBe(true);
      expect(resNear.flaggedOutside).toBe(false);
    });

    it('Xác thực check-in thành công bằng mã QR dự án', async () => {
      const appt: LeadAppointment = {
        id: 'appt-qr-1',
        lead_id: 'lead-2',
        sale_id: saleUser.id,
        scheduled_at: new Date().toISOString(),
        status: 'scheduled',
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('crm_lead_appointments', JSON.stringify([appt]));

      const res = await salesWorkflowService.checkInAppointment({
        appointmentId: appt.id,
        qrCode: 'PROJECT_QR_OCEAN_PARK_2026',
        expectedQrCode: 'PROJECT_QR_OCEAN_PARK_2026',
        currentUser: saleUser,
      });

      expect(res.qrVerified).toBe(true);
      expect(res.appointment.flags).toContain('qr_verified');
    });
  });

  describe('4. Webhook Nhận Lead Tự Động & Chống Trùng Lặp', () => {
    it('Chặn Webhook có chữ ký sai (HMAC Verification)', async () => {
      await expect(
        salesWorkflowService.processLeadWebhook({
          source: 'facebook_lead_ads',
          body: {
            customer_name: 'Khách FB Fake',
            phone: '0987654321',
            project_id: 'proj-1',
          },
          signature: 'wrong_sig',
          secretKey: 'top_secret_key_123',
        })
      ).rejects.toThrow('invalid_signature: Chữ ký số Webhook không hợp lệ!');
    });

    it('Webhook hợp lệ tạo lead mới; khách gửi lại form lần 2 không tạo lead trùng', async () => {
      const validSig = 'sig_my_facebook_secret';

      // 1. Lần 1: Tạo lead mới
      const res1 = await salesWorkflowService.processLeadWebhook({
        source: 'facebook_lead_ads',
        body: {
          customer_name: 'Nguyễn Văn Facebook',
          phone: '0987654321',
          project_id: 'proj-1',
          utm_source: 'fb_ads',
          utm_campaign: 'xuan_2026',
        },
        signature: validSig,
        secretKey: 'my_facebook_secret',
      });

      expect(res1.success).toBe(true);
      expect(res1.isDuplicatePrevented).toBe(false);

      // 2. Lần 2: Khách bấm gửi lại form cùng SĐT và dự án -> Không nhân bản lead
      const res2 = await salesWorkflowService.processLeadWebhook({
        source: 'facebook_lead_ads',
        body: {
          customer_name: 'Nguyễn Văn Facebook',
          phone: '0987654321',
          project_id: 'proj-1',
          utm_source: 'fb_ads',
          utm_campaign: 'xuan_2026_retarget',
        },
        signature: validSig,
        secretKey: 'my_facebook_secret',
      });

      expect(res2.success).toBe(true);
      expect(res2.isDuplicatePrevented).toBe(true);
      expect(res2.leadId).toBe(res1.leadId); // Dùng lại đúng lead id cũ
    });
  });

  describe('5. Nhập CSV Theo Lô & Hoàn Tác (Batch Import & Revert)', () => {
    it('Nhập danh sách lead từ CSV và hỗ trợ hoàn tác sạch sẽ theo batch_id', async () => {
      const rows = [
        { name: 'Khách Lô 1', phone: '0911111111' },
        { name: 'Khách Lô 2', phone: '0922222222' },
        { name: 'Khách Lỗi SĐT', phone: '123' }, // SĐT sai -> bỏ qua
      ];

      // 1. Nhập lô
      const importRes = await salesWorkflowService.importLeadsBatch({
        fileName: 'danh_sach_khach_hang_q1.csv',
        projectId: 'proj-batch',
        rows,
        currentUser: saleUser,
      });

      expect(importRes.importedCount).toBe(2);
      expect(importRes.errorCount).toBe(1);
      expect(importRes.batch.status).toBe('imported');

      // 2. Hoàn tác lô
      const revertRes = await salesWorkflowService.revertImportBatch(importRes.batch.id, saleUser);
      expect(revertRes.success).toBe(true);
      expect(revertRes.revertedCount).toBe(2);
    });
  });

  describe('6. Hợp Nhất Khách Hàng (Customer Merge & Unmerge)', () => {
    it('Chỉ Quản lý mới có quyền hợp nhất khách hàng trùng lặp và có thể hoàn tác', async () => {
      // Chuẩn bị 2 khách và lead tương ứng
      const leads = [
        {
          id: 'lead-c1',
          customer_id: 'cust-primary',
          customer_name: 'Lê Văn A (Chuẩn)',
          project_id: 'proj-1',
          status: 'contacted',
          created_at: new Date().toISOString(),
        },
        {
          id: 'lead-c2',
          customer_id: 'cust-duplicate',
          customer_name: 'Lê Văn A (Trùng)',
          project_id: 'proj-2',
          status: 'site_visit',
          created_at: new Date().toISOString(),
        },
      ];
      localStorage.setItem('crm_leads', JSON.stringify(leads));

      // 1. Chuyên viên cố tình merge -> Bị từ chối
      await expect(
        salesWorkflowService.mergeCustomers({
          primaryCustomerId: 'cust-primary',
          mergedCustomerId: 'cust-duplicate',
          currentUser: saleUser,
        })
      ).rejects.toThrow('forbidden: Chỉ Quản lý sàn hoặc Admin mới có quyền hợp nhất khách hàng!');

      // 2. Quản lý merge thành công
      const mergeRecord = await salesWorkflowService.mergeCustomers({
        primaryCustomerId: 'cust-primary',
        mergedCustomerId: 'cust-duplicate',
        currentUser: managerUser,
      });

      expect(mergeRecord.status).toBe('active');

      // Kiểm tra lead của cust-duplicate đã được chuyển sang cust-primary
      const updatedLeads = JSON.parse(localStorage.getItem('crm_leads') || '[]');
      const transferredLead = updatedLeads.find((l: any) => l.id === 'lead-c2');
      expect(transferredLead.customer_id).toBe('cust-primary');

      // 3. Quản lý hoàn tác merge (Unmerge)
      const unmergeRes = await salesWorkflowService.unmergeCustomer(mergeRecord.id, managerUser);
      expect(unmergeRes.success).toBe(true);

      // Phục hồi lại customer_id cũ
      const restoredLeads = JSON.parse(localStorage.getItem('crm_leads') || '[]');
      const restoredLead = restoredLeads.find((l: any) => l.id === 'lead-c2');
      expect(restoredLead.customer_id).toBe('cust-duplicate');
    });
  });
});
