import { describe, it, expect, beforeEach } from 'vitest';
import { marketingService } from '@/domain/services/marketingService';
import { privacyService } from '@/domain/services/privacyService';
import { featureFlags } from '@/lib/featureFlags';
import { i18n } from '@/lib/i18n';
import { UserProfile, Customer, Lead, Transaction } from '@/domain/types';

describe('Phase 6: Marketing Analytics, Privacy Center & Operations', () => {
  const adminUser: UserProfile = {
    id: 'user-admin-01',
    email: 'admin@broker.vn',
    full_name: 'Admin Tổng',
    phone: '0901111111',
    role: 'admin',
    status: 'active',
    must_change_password: false,
    totp_enabled: true
  };

  const marketingManager: UserProfile = {
    id: 'user-mkt-01',
    email: 'marketing@broker.vn',
    full_name: 'MKT Manager',
    phone: '0902222222',
    role: 'marketing_manager',
    status: 'active',
    must_change_password: false,
    totp_enabled: true
  };

  const saleUser: UserProfile = {
    id: 'user-sale-01',
    email: 'sale@broker.vn',
    full_name: 'Sale Agent 1',
    phone: '0903333333',
    role: 'sale_agent',
    status: 'active',
    must_change_password: false,
    totp_enabled: true
  };

  beforeEach(() => {
    localStorage.clear();
  });

  // ========================================================
  // 1. MARKETING CAMPAIGNS & METRICS (CPL, CAC, ROI)
  // ========================================================
  describe('Marketing Campaigns & Metrics', () => {
    it('chỉ cho phép Marketing Manager/Admin tạo chiến dịch và từ chối Sale Agent', () => {
      expect(() => {
        marketingService.createCampaign({
          name: 'Chiến dịch Q4 Vinhomes Grand Park',
          channel: 'facebook',
          budget: 50000000,
          start_date: '2026-11-01',
          status: 'active'
        }, saleUser);
      }).toThrow('Chỉ Marketing Manager, Director hoặc Admin');

      const campaign = marketingService.createCampaign({
        name: 'Chiến dịch Q4 Vinhomes Grand Park',
        channel: 'facebook',
        budget: 50000000,
        start_date: '2026-11-01',
        utm_campaign: 'vhgp_q4',
        status: 'active'
      }, marketingManager);

      expect(campaign.id).toBeDefined();
      expect(campaign.name).toBe('Chiến dịch Q4 Vinhomes Grand Park');
      expect(marketingService.getCampaigns().length).toBe(1);
    });

    it('ghi nhận chi phí hàng ngày và cập nhật nếu trùng ngày', () => {
      const campaign = marketingService.createCampaign({
        name: 'Google Ads Masterise',
        channel: 'google',
        budget: 20000000,
        start_date: '2026-11-01',
        status: 'active'
      }, marketingManager);

      const cost1 = marketingService.recordDailyCost(campaign.id, '2026-11-02', 2000000, 'Chi phí ngày 2/11', marketingManager);
      expect(cost1.amount).toBe(2000000);

      // Cập nhật lại ngày đó
      const costUpdated = marketingService.recordDailyCost(campaign.id, '2026-11-02', 2500000, 'Điều chỉnh ngân sách', marketingManager);
      expect(costUpdated.amount).toBe(2500000);

      const allCosts = marketingService.getCampaignDailyCosts(campaign.id);
      expect(allCosts.length).toBe(1);
      expect(allCosts[0].amount).toBe(2500000);
    });

    it('tính toán chính xác chỉ số CPL, CAC, Contact Rate, Deposit Rate và ROI', () => {
      const campaign = marketingService.createCampaign({
        name: 'Facebook Lead Gen Aqua City',
        channel: 'facebook',
        budget: 30000000,
        start_date: '2026-11-01',
        utm_campaign: 'aqua_fb_lead',
        status: 'active'
      }, marketingManager);

      marketingService.recordDailyCost(campaign.id, '2026-11-01', 5000000, undefined, marketingManager);
      marketingService.recordDailyCost(campaign.id, '2026-11-02', 5000000, undefined, marketingManager);
      // Tổng chi = 10,000,000 VND

      // Mock 5 leads
      const mockLeads: Partial<Lead>[] = [
        { id: 'lead-1', customer_id: 'cust-1', status: 'new', budget_min: 3000000000, source_detail: 'aqua_fb_lead' },
        { id: 'lead-2', customer_id: 'cust-2', status: 'contacted', budget_min: 3000000000, source_detail: 'aqua_fb_lead' },
        { id: 'lead-3', customer_id: 'cust-3', status: 'site_visit', budget_min: 3500000000, source_detail: 'aqua_fb_lead' },
        { id: 'lead-4', customer_id: 'cust-4', status: 'deposit', budget_min: 4000000000, source_detail: 'aqua_fb_lead' },
        { id: 'lead-5', customer_id: 'cust-5', status: 'contract', budget_min: 5000000000, source_detail: 'aqua_fb_lead' }
      ];
      localStorage.setItem('crm_leads', JSON.stringify(mockLeads));

      // Mock 1 contract từ lead-5: GTGD = 5 tỷ
      const mockContracts: Partial<Transaction>[] = [
        { id: 'ct-1', lead_id: 'lead-5', customer_id: 'cust-5', deal_value: 5000000000, status: 'confirmed', sign_date: '2026-11-05' }
      ];
      localStorage.setItem('crm_contracts', JSON.stringify(mockContracts));

      const metrics = marketingService.calculateMarketingMetrics(campaign.id);

      expect(metrics.totalSpent).toBe(10000000);
      expect(metrics.leadsCount).toBe(5);
      // CPL = 10,000,000 / 5 = 2,000,000 VND
      expect(metrics.cpl).toBe(2000000);
      // Contacts: contacted, site_visit, deposit, contract = 4
      expect(metrics.contactsCount).toBe(4);
      expect(metrics.contactRate).toBe(80); // 4/5 * 100%
      // Deposits: deposit, contract = 2
      expect(metrics.depositsCount).toBe(2);
      // CAC = 10,000,000 / 2 = 5,000,000 VND
      expect(metrics.cac).toBe(5000000);
      expect(metrics.depositRate).toBe(40); // 2/5 * 100%
      // Gross floor revenue = 5 tỷ * 3% = 150 triệu VND
      // ROI = ((150tr - 10tr) / 10tr) * 100 = 1400%
      expect(metrics.roi).toBe(1400);
    });

    it('bảo vệ PII: tự động ẩn số điện thoại và email khách hàng đối với báo cáo Marketing', () => {
      const mockLeads: Partial<Lead>[] = [
        {
          id: 'lead-mkt-1',
          notes: 'Khách VIP',
          customer_name: 'Nguyễn Văn A',
          customer_phone: '0912345678',
          customer_email: 'nguyenvana@gmail.com',
          status: 'contacted'
        }
      ];
      localStorage.setItem('crm_leads', JSON.stringify(mockLeads));

      const maskedList = marketingService.getMaskedLeadsForMarketing();
      expect(maskedList[0].customer_name).toBe('N***');
      expect(maskedList[0].customer_phone).not.toBe('0912345678');
      expect(maskedList[0].customer_phone).toContain('***');
      expect(maskedList[0].customer_email).not.toBe('nguyenvana@gmail.com');
      expect(maskedList[0].customer_email).toContain('***');
    });
  });

  // ========================================================
  // 2. TRUNG TÂM QUYỀN RIÊNG TƯ (PRIVACY CENTER & NĐ 13)
  // ========================================================
  describe('Privacy Center (Nghị định 13/2023/NĐ-CP & GDPR)', () => {
    const sampleCustomer: Customer = {
      id: 'cust-priv-101',
      organization_id: 'org-01',
      full_name: 'Phạm Minh Chính',
      phone: '0987654321',
      phone_normalized: '0987654321',
      email: 'minhchinh@example.com',
      identity_card: '001088001234',
      address: 'Quận 1, TP. Hồ Chí Minh',
      consent_obtained: true,
      created_at: '2026-10-01T08:00:00Z'
    };

    beforeEach(() => {
      localStorage.setItem('crm_customers', JSON.stringify([sampleCustomer]));
    });

    it('xuất toàn bộ dữ liệu cá nhân theo NĐ 13 và chặn sale agent trái thẩm quyền', async () => {
      // Sale agent không có quyền xuất
      await expect(privacyService.requestDataExport(sampleCustomer.id, saleUser))
        .rejects.toThrow('Chỉ Quản lý, Giám đốc hoặc Admin');

      // Admin xuất thành công
      const exportPkg = await privacyService.requestDataExport(sampleCustomer.id, adminUser);
      expect(exportPkg.legalBasis).toContain('Nghị định 13/2023/NĐ-CP');
      expect(exportPkg.customer.full_name).toBe(sampleCustomer.full_name);
      expect(exportPkg.customer.identity_card).toBe(sampleCustomer.identity_card);

      const requests = privacyService.getPrivacyRequests(sampleCustomer.id);
      expect(requests.length).toBe(1);
      expect(requests[0].request_type).toBe('export');
    });

    it('ẩn danh hóa dữ liệu khách hàng nhưng BẢO TOÀN hợp đồng và sổ cái hoa hồng', async () => {
      // Gắn mock lead và contract
      const mockLead: Partial<Lead> = {
        id: 'lead-priv-1',
        customer_id: sampleCustomer.id,
        customer_name: sampleCustomer.full_name,
        customer_phone: sampleCustomer.phone,
        status: 'contract'
      };
      localStorage.setItem('crm_leads', JSON.stringify([mockLead]));

      const mockContract: Partial<Transaction> = {
        id: 'ct-priv-1',
        customer_id: sampleCustomer.id,
        customer_name: sampleCustomer.full_name,
        deal_value: 8000000000,
        status: 'confirmed',
        contract_code: 'HDMB-TEST-001'
      };
      localStorage.setItem('crm_contracts', JSON.stringify([mockContract]));

      const result = await privacyService.requestAnonymization(
        sampleCustomer.id, 
        'Khách hàng yêu cầu xóa dữ liệu cá nhân theo điều 14 NĐ 13', 
        adminUser
      );

      expect(result.success).toBe(true);

      // Kiểm tra bảng Customers: thông tin cá nhân đã bị ẩn danh
      const customers: Customer[] = JSON.parse(localStorage.getItem('crm_customers') || '[]');
      const anonymizedCustomer = customers.find(c => c.id === sampleCustomer.id)!;
      expect(anonymizedCustomer.full_name).toContain('Khách hàng ẩn danh');
      expect(anonymizedCustomer.phone).toBe('0000000000');
      expect(anonymizedCustomer.identity_card).toBeUndefined();
      expect(anonymizedCustomer.address).toBeUndefined();
      expect(anonymizedCustomer.anonymized_at).toBeDefined();
      expect(anonymizedCustomer.do_not_contact).toBe(true);

      // Kiểm tra bảng crm_contracts: HỢP ĐỒNG KHÔNG BỊ XÓA!
      const contracts: Transaction[] = JSON.parse(localStorage.getItem('crm_contracts') || '[]');
      expect(contracts.length).toBe(1);
      expect(contracts[0].id).toBe('ct-priv-1');
      expect(contracts[0].deal_value).toBe(8000000000);
      expect(contracts[0].contract_code).toBe('HDMB-TEST-001');
    });

    it('quản lý sự đồng thuận và cập nhật cờ do_not_contact khi rút quyền tiếp thị', () => {
      const consent = privacyService.updateConsent(
        sampleCustomer.id,
        'marketing',
        'phone',
        true, // Revoked
        'Khách hàng không muốn nhận cuộc gọi tiếp thị'
      );

      expect(consent.is_revoked).toBe(true);

      const customers: Customer[] = JSON.parse(localStorage.getItem('crm_customers') || '[]');
      const updatedCust = customers.find(c => c.id === sampleCustomer.id)!;
      expect(updatedCust.do_not_contact).toBe(true);
    });
  });

  // ========================================================
  // 3. FEATURE FLAGS & i18n
  // ========================================================
  describe('Feature Flags & Internationalization (i18n)', () => {
    it('quản lý cờ tính năng và runtime overrides', () => {
      expect(featureFlags.isEnabled('ai_advisor')).toBe(true);
      expect(featureFlags.isEnabled('sms_integration')).toBe(false);

      // Override bật sms_integration
      featureFlags.setOverride('sms_integration', true);
      expect(featureFlags.isEnabled('sms_integration')).toBe(true);

      // Xóa override
      featureFlags.clearOverride('sms_integration');
      expect(featureFlags.isEnabled('sms_integration')).toBe(false);
    });

    it('hỗ trợ từ điển đa ngôn ngữ song ngữ Tiếng Việt và Tiếng Anh', () => {
      i18n.setLocale('vi');
      expect(i18n.t('common.save')).toBe('Lưu');
      expect(i18n.t('financial.dealValue')).toBe('Giá trị giao dịch (GTGD)');
      expect(i18n.t('privacy.exportData')).toBe('Xuất dữ liệu cá nhân (NĐ 13)');

      i18n.setLocale('en');
      expect(i18n.t('common.save')).toBe('Save');
      expect(i18n.t('financial.dealValue')).toBe('Gross Deal Value (GDV)');
      expect(i18n.t('privacy.exportData')).toBe('Export Personal Data (Decree 13)');

      // Trở lại vi
      i18n.setLocale('vi');
    });
  });
});
