import { describe, it, expect, beforeEach } from 'vitest';
import { LeadRepository } from '@/data/repositories/leadRepository';
import { UserProfile, Lead } from '@/domain/types';
import { maskPhone, maskName, computePhoneHash } from '@/lib/masking';
import { assertNoMockPIIInProduction } from '@/lib/storageGuard';

describe('P0.4 Dữ Liệu Nhạy Cảm, Che PII (Masking), CCCD Vault & Consent', () => {
  let leadRepo: LeadRepository;

  const mockAdminUser: UserProfile = {
    id: 'user-admin-01',
    organization_id: 'org-01',
    email: 'admin@crm-broker.vn',
    full_name: 'Quản Trị Viên Hệ Thống',
    phone: '0901111222',
    role: 'admin',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
    created_at: new Date().toISOString(),
  };

  const mockMarketingUser: UserProfile = {
    id: 'user-mkt-01',
    organization_id: 'org-01',
    email: 'marketing@crm-broker.vn',
    full_name: 'Trần Tiếp Thị',
    phone: '0902222333',
    role: 'marketing_manager',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
    created_at: new Date().toISOString(),
  };

  const mockSaleUser: UserProfile = {
    id: 'user-sale-01',
    organization_id: 'org-01',
    email: 'sale@crm-broker.vn',
    full_name: 'Lê Chuyên Viên Sale',
    phone: '0903333444',
    role: 'sale_agent',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
    created_at: new Date().toISOString(),
  };

  const mockDirectorUser: UserProfile = {
    id: 'user-director-01',
    organization_id: 'org-01',
    email: 'director@crm-broker.vn',
    full_name: 'Giám Đốc Dự Án',
    phone: '0904444555',
    role: 'director',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    localStorage.clear();
    leadRepo = new LeadRepository();
  });

  it('1. Masking Helper: Che SĐT đúng chuẩn (giữ 2 số đầu, 3 số cuối) và che tên', () => {
    const rawPhone = '0987654321';
    const maskedPhone = maskPhone(rawPhone);
    expect(maskedPhone).toBe('09xx xxx 321');

    const fullName = 'Nguyễn Văn An';
    const maskedFullName = maskName(fullName);
    expect(maskedFullName).toBe('N*** An');

    const singleName = 'Dung';
    expect(maskName(singleName)).toBe('D***');
  });

  it('2. Phone Hash: Tạo mã băm SHA-256 đồng bộ và ổn định cho deduplication', () => {
    const phone = '0912345678';
    const hash1 = computePhoneHash(phone);
    const hash2 = computePhoneHash(phone);

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // Chuẩn độ dài hex SHA-256
    expect(hash1).not.toBe(computePhoneHash('0987654321'));
  });

  it('3. Che SĐT và họ tên cho Marketing Manager khi truy vấn danh sách Leads', async () => {
    const testLead: Lead = {
      id: 'lead-mkt-test-1',
      customer_id: 'cust-mkt-1',
      customer_name: 'Hoàng Hải Nam',
      customer_phone: '0905123789',
      customer_email: 'nam.hoang@example.com',
      project_id: 'proj-01',
      project_name: 'Vinhomes Grand Park',
      status: 'new',
      lead_score: 80,
      purpose: 'investment',
      created_at: new Date().toISOString(),
    };

    localStorage.setItem('crm_leads', JSON.stringify([testLead]));

    // Truy vấn bằng tài khoản Marketing Manager
    const result = await leadRepo.getLeads({}, mockMarketingUser);

    expect(result.leads.length).toBe(1);
    const fetched = result.leads[0];
    // SĐT phải được che dạng 09xx xxx 789
    expect(fetched.customer_phone).toBe('09xx xxx 789');
    expect(fetched.customer_phone).not.toBe('0905123789');
    // Họ tên phải được che
    expect(fetched.customer_name).toBe('H*** Nam');
    // Email không được trả về cho Marketing
    expect(fetched.customer_email).toBeUndefined();
  });

  it('4. Che SĐT và họ tên cho Marketing Manager khi xem chi tiết Lead bằng ID', async () => {
    const testLead: Lead = {
      id: 'lead-mkt-detail-1',
      customer_id: 'cust-mkt-2',
      customer_name: 'Phạm Quỳnh Nga',
      customer_phone: '0977888999',
      project_id: 'proj-01',
      status: 'contacted',
      lead_score: 75,
      purpose: 'residence',
      created_at: new Date().toISOString(),
    };

    localStorage.setItem('crm_leads', JSON.stringify([testLead]));

    const leadForMkt = await leadRepo.getLeadById('lead-mkt-detail-1', mockMarketingUser);
    expect(leadForMkt).not.toBeNull();
    expect(leadForMkt?.customer_phone).toBe('09xx xxx 999');
    expect(leadForMkt?.customer_name).toBe('P*** Nga');

    // Trong khi đó Admin xem được đầy đủ
    const leadForAdmin = await leadRepo.getLeadById('lead-mkt-detail-1', mockAdminUser);
    expect(leadForAdmin?.customer_phone).toBe('0977888999');
    expect(leadForAdmin?.customer_name).toBe('Phạm Quỳnh Nga');
  });

  it('5. Deduplicate kiểm tra trùng SĐT qua phone_hash & phone_normalized', async () => {
    const phone = '0934567890';
    const phoneHash = computePhoneHash(phone);

    const existingLead: Lead = {
      id: 'lead-existing-1',
      customer_id: 'cust-existing-1',
      customer_name: 'Lê Trùng Lặp',
      customer_phone: phone,
      customer_phone_hash: phoneHash,
      project_id: 'proj-01',
      status: 'new',
      lead_score: 70,
      purpose: 'investment',
      created_at: new Date().toISOString(),
    };

    localStorage.setItem('crm_leads', JSON.stringify([existingLead]));

    // Kiểm tra trùng lặp với số chuẩn
    const check1 = await leadRepo.checkDuplicatePhone('0934567890');
    expect(check1.isDuplicate).toBe(true);
    expect(check1.existingLead?.id).toBe('lead-existing-1');

    // Kiểm tra trùng lặp với định dạng đầu số +84
    const check2 = await leadRepo.checkDuplicatePhone('+84934567890');
    expect(check2.isDuplicate).toBe(true);

    // Số khác không bị coi là trùng
    const check3 = await leadRepo.checkDuplicatePhone('0911222333');
    expect(check3.isDuplicate).toBe(false);
  });

  it('6. revealCCCD: Chỉ Admin, Director, Sales Manager được phép xem CCCD; tự động ghi Audit Log', async () => {
    const customerId = 'cust-uuid-1234';

    // 1. Admin gọi giải mã CCCD -> Thành công
    const resultAdmin = await leadRepo.revealCCCD(customerId, mockAdminUser);
    expect(resultAdmin.cccd).toBeTruthy();

    // 2. Kiểm tra Audit Log đã được ghi nhận tự động
    const auditLogs = JSON.parse(localStorage.getItem('crm_audit_logs') || '[]');
    expect(auditLogs.length).toBeGreaterThan(0);
    const lastLog = auditLogs[0];
    expect(lastLog.action).toBe('reveal_cccd');
    expect(lastLog.record_id).toBe(customerId);
    expect(lastLog.user_id).toBe(mockAdminUser.id);
    expect(lastLog.new_data.accessed_by_role).toBe('admin');

    // 3. Director gọi giải mã CCCD -> Thành công
    const resultDirector = await leadRepo.revealCCCD(customerId, mockDirectorUser);
    expect(resultDirector.cccd).toBeTruthy();

    // 4. Sale Agent hoặc Marketing Manager gọi giải mã -> Bị từ chối nghiêm ngặt
    await expect(leadRepo.revealCCCD(customerId, mockSaleUser)).rejects.toThrow(
      'Từ chối thao tác: Vai trò "sale_agent" không có quyền giải mã và xem số CCCD/CMND'
    );

    await expect(leadRepo.revealCCCD(customerId, mockMarketingUser)).rejects.toThrow(
      'Từ chối thao tác: Vai trò "marketing_manager" không có quyền giải mã và xem số CCCD/CMND'
    );
  });

  it('7. Quản lý đồng thuận (Consent): Lưu bản ghi và cập nhật cờ do_not_contact khi thu hồi', async () => {
    const customerId = 'cust-consent-99';

    const testLead: Lead = {
      id: 'lead-consent-1',
      customer_id: customerId,
      customer_name: 'Vũ Thị Hòa',
      customer_phone: '0918765432',
      project_id: 'proj-01',
      status: 'new',
      lead_score: 65,
      purpose: 'residence',
      do_not_contact: false,
      created_at: new Date().toISOString(),
    };

    localStorage.setItem('crm_leads', JSON.stringify([testLead]));

    // Ghi nhận đồng thuận (Consent)
    const consent = await leadRepo.recordConsent({
      customer_id: customerId,
      purpose: 'marketing',
      channel: 'phone',
      source: 'web_form',
      obtained_at: new Date().toISOString(),
      is_revoked: false,
    });

    expect(consent.id).toBeDefined();
    expect(consent.purpose).toBe('marketing');

    // Lấy danh sách consent của khách hàng
    const consents = await leadRepo.getConsentsByCustomer(customerId);
    expect(consents.length).toBe(1);
    expect(consents[0].is_revoked).toBe(false);

    // Thu hồi consent (Khách hàng từ chối nhận cuộc gọi tiếp thị)
    await leadRepo.revokeConsent(consent.id, 'Khách hàng yêu cầu hủy đăng ký tư vấn qua điện thoại', mockAdminUser);

    // Kiểm tra consent đã chuyển is_revoked = true
    const updatedConsents = await leadRepo.getConsentsByCustomer(customerId);
    expect(updatedConsents[0].is_revoked).toBe(true);
    expect(updatedConsents[0].revoked_reason).toContain('hủy đăng ký tư vấn');

    // Kiểm tra cờ do_not_contact trên Lead đã được tự động bật thành true
    const leadsAfter = await leadRepo.getLeadById('lead-consent-1', mockAdminUser);
    expect(leadsAfter?.do_not_contact).toBe(true);
  });

  it('8. Production Build Flag Guard: Chặn hoàn toàn fallback LocalStorage PII ở Production', () => {
    // Giả lập môi trường Production không có Supabase Live
    const originalProd = import.meta.env.PROD;
    try {
      (import.meta.env as any).PROD = true;

      // Khi PROD = true và không có live Supabase, assertNoMockPIIInProduction phải chặn đứng
      expect(() => {
        assertNoMockPIIInProduction('lấy danh sách leads');
      }).toThrow('Bảo mật nghiêm ngặt: Chế độ Production không được phép sử dụng LocalStorage mock chứa PII khách hàng');
    } finally {
      (import.meta.env as any).PROD = originalProd;
    }
  });
});
