import { describe, it, expect, beforeEach } from 'vitest';
import { knowledgeAndScriptService } from '@/domain/services/knowledgeAndScriptService';
import { UserProfile, Customer } from '@/domain/types';

describe('Phase 8: Project Knowledge, Context-Aware Scripts & Care Playbooks', () => {
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

  const saleAgent: UserProfile = {
    id: 'user-sale-01',
    email: 'sale@agency1.vn',
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
  // 1. KHO TRI THỨC DỰ ÁN & QUY TẮC TIN CẬY
  // ========================================================
  describe('Project Knowledge & Trust Verification', () => {
    it('chỉ Quản lý mới có quyền tạo và xác minh tri thức; chặn Sale Agent', () => {
      expect(() => {
        knowledgeAndScriptService.createKnowledgeItem({
          project_id: 'proj-01',
          category: 'price_policy',
          title: 'Chính sách chiết khấu 8%',
          content: 'Chiết khấu 8% cho khách thanh toán sớm 95%',
          status: 'draft'
        }, saleAgent);
      }).toThrow('Chỉ Admin, Giám đốc Sàn hoặc Marketing Manager');

      const item = knowledgeAndScriptService.createKnowledgeItem({
        project_id: 'proj-01',
        category: 'price_policy',
        title: 'Chính sách chiết khấu 8%',
        content: 'Chiết khấu 8% cho khách thanh toán sớm 95%',
        status: 'draft'
      }, marketingManager);

      expect(item.id).toBeDefined();
      expect(item.status).toBe('draft');

      // Sale agent không được xác minh
      expect(() => {
        knowledgeAndScriptService.verifyKnowledgeItem(item.id, saleAgent);
      }).toThrow('Chỉ cấp Quản lý mới có thẩm quyền');

      // Marketing Manager xác minh thành công
      const verified = knowledgeAndScriptService.verifyKnowledgeItem(item.id, marketingManager, 60);
      expect(verified.status).toBe('published');
      expect(verified.verified_by).toBe(marketingManager.id);
      expect(verified.expires_at).toBeDefined();
    });

    it('gắn nhãn "cần xác nhận với Chủ đầu tư" nếu thông tin giá/pháp lý chưa xác minh hoặc hết hạn', () => {
      // 1 mục chưa xác minh (unverified)
      knowledgeAndScriptService.createKnowledgeItem({
        project_id: 'proj-demo',
        category: 'legal',
        title: 'Quyết định 1/500 và Giấy phép xây dựng',
        content: 'Dự án đã có phê duyệt 1/500 năm 2024',
        status: 'published' // Chưa qua verifyKnowledgeItem
      }, marketingManager);

      const itemsForSales = knowledgeAndScriptService.getKnowledgeForSales('proj-demo');
      expect(itemsForSales.length).toBe(1);
      expect(itemsForSales[0].needs_confirmation).toBe(true);
      expect(itemsForSales[0].warning?.toLowerCase()).toContain('cần xác nhận lại với chủ đầu tư');
    });
  });

  // ========================================================
  // 2. THƯ VIỆN SCRIPT 9 NGỮ CẢNH & THAY THẾ BIẾN
  // ========================================================
  describe('Context-Aware Scripts & Variable Substitution', () => {
    it('seed đầy đủ 9 nhóm ngữ cảnh kịch bản bán hàng chuẩn', () => {
      const approachScripts = knowledgeAndScriptService.getScriptsByContext('approach');
      const qualifyingScripts = knowledgeAndScriptService.getScriptsByContext('qualifying');
      const introScripts = knowledgeAndScriptService.getScriptsByContext('introduction');
      const apptScripts = knowledgeAndScriptService.getScriptsByContext('appointment');
      const objectionScripts = knowledgeAndScriptService.getScriptsByContext('objection');
      const closingScripts = knowledgeAndScriptService.getScriptsByContext('closing');
      const postContractScripts = knowledgeAndScriptService.getScriptsByContext('post_contract');
      const reEngageScripts = knowledgeAndScriptService.getScriptsByContext('re_engage');
      const specialScripts = knowledgeAndScriptService.getScriptsByContext('special');

      expect(approachScripts.length).toBeGreaterThanOrEqual(1);
      expect(qualifyingScripts.length).toBeGreaterThanOrEqual(1);
      expect(introScripts.length).toBeGreaterThanOrEqual(1);
      expect(apptScripts.length).toBeGreaterThanOrEqual(1);
      expect(objectionScripts.length).toBeGreaterThanOrEqual(1);
      expect(closingScripts.length).toBeGreaterThanOrEqual(1);
      expect(postContractScripts.length).toBeGreaterThanOrEqual(1);
      expect(reEngageScripts.length).toBeGreaterThanOrEqual(1);
      expect(specialScripts.length).toBeGreaterThanOrEqual(1);
    });

    it('thay thế biến an toàn và không để sót bất kỳ biến {{...}} nào trong văn bản gửi khách', () => {
      const script = knowledgeAndScriptService.getScriptsByContext('approach')[0];
      const rendered = knowledgeAndScriptService.renderScript(script, {
        ten_khach: 'Chị Mai',
        ten_du_an: 'Grand Marina Saigon',
        ten_sale: 'Tuấn',
        gia_tu: '18 tỷ'
      });

      expect(rendered.opening).toContain('Chị Mai');
      expect(rendered.opening).toContain('Grand Marina Saigon');
      expect(rendered.opening).toContain('Tuấn');
      expect(rendered.main_content).toContain('18 tỷ');

      // Kiểm tra tuyệt đối không còn cú pháp biến còn sót
      expect(rendered.opening).not.toMatch(/\{\{.*\}\}/);
      expect(rendered.main_content).not.toMatch(/\{\{.*\}\}/);
      expect(rendered.cta).not.toMatch(/\{\{.*\}\}/);
    });
  });

  // ========================================================
  // 3. BỘ LỌC TUÂN THỦ (COMPLIANCE LINTER)
  // ========================================================
  describe('Compliance Linter (Bộ Lọc Tuân Thủ BĐS)', () => {
    it('phát hiện các từ khóa cấm và vi phạm luật kinh doanh BĐS', () => {
      const badContent = 'Dự án cam kết lợi nhuận 15%/năm và chắc chắn tăng giá gấp đôi trong 2 năm, bao pháp lý 100%.';
      const result = knowledgeAndScriptService.lintCompliance(badContent);

      expect(result.isCompliant).toBe(false);
      expect(result.violations.length).toBe(3);
      expect(result.violations.map(v => v.term)).toEqual(
        expect.arrayContaining(['cam kết lợi nhuận', 'chắc chắn tăng giá', 'bao pháp lý 100%'])
      );
    });

    it('chặn xuất bản kịch bản nếu vi phạm bộ lọc tuân thủ', () => {
      expect(() => {
        knowledgeAndScriptService.createScriptTemplate({
          context_code: 'closing',
          channel: 'call',
          tone: 'professional',
          title: 'Kịch bản cam kết lời',
          objective: 'Chốt khách',
          opening: 'Chào anh',
          main_content: 'Đầu tư căn này không thể lỗ và được cam kết lợi nhuận 12% mỗi năm.',
          cta: 'Cọc ngay đi anh',
          status: 'published'
        }, marketingManager);
      }).toThrow('vi phạm quy định tuân thủ tư vấn BĐS và bị chặn xuất bản');
    });
  });

  // ========================================================
  // 4. THEO DÕI SỬ DỤNG SCRIPT & CARE PLAYBOOKS
  // ========================================================
  describe('Script Usage Tracking & Care Playbooks', () => {
    it('đo lường chính xác tỷ lệ chuyển đổi và điểm đánh giá trung bình của script', () => {
      const scriptId = 'seed-objection-01';

      knowledgeAndScriptService.recordScriptUsage(scriptId, 'lead-1', 'sale-1', 'call', 'stage_advanced', 5);
      knowledgeAndScriptService.recordScriptUsage(scriptId, 'lead-2', 'sale-1', 'call', 'appointment_set', 4);
      knowledgeAndScriptService.recordScriptUsage(scriptId, 'lead-3', 'sale-2', 'call', 'rejected', 3);
      knowledgeAndScriptService.recordScriptUsage(scriptId, 'lead-4', 'sale-2', 'call', 'no_answer', 4);

      const stats = knowledgeAndScriptService.getScriptEffectiveness(scriptId);
      expect(stats.totalUsages).toBe(4);
      expect(stats.advancedStagesCount).toBe(2);
      expect(stats.conversionRate).toBe(50); // 2/4 = 50%
      expect(stats.averageRating).toBe(4); // (5+4+3+4)/4 = 4.0
    });

    it('chặn tạo care task nếu khách hàng đã yêu cầu Không làm phiền (Do Not Contact)', () => {
      const doNotContactCustomer: Customer = {
        id: 'cust-dnc-1',
        organization_id: 'org-01',
        full_name: 'Khách Đã Chặn Tiếp Thị',
        phone: '0999999999',
        phone_normalized: '0999999999',
        consent_obtained: false,
        do_not_contact: true
      };
      localStorage.setItem('crm_customers', JSON.stringify([doNotContactCustomer]));

      expect(() => {
        knowledgeAndScriptService.createCareTask(
          'lead-dnc-1',
          doNotContactCustomer.id,
          'sale-1',
          'Gọi điện chăm sóc tái kích hoạt',
          '2026-11-15T09:00:00Z'
        );
      }).toThrow('Khách hàng đã yêu cầu Không làm phiền (Do Not Contact)');
    });

    it('tự động chuyển giao care tasks khi lead được bàn giao sang Sale mới', () => {
      const sampleCustomer: Customer = {
        id: 'cust-ok-1',
        organization_id: 'org-01',
        full_name: 'Khách Hàng Bình Thường',
        phone: '0911223344',
        phone_normalized: '0911223344',
        consent_obtained: true
      };
      localStorage.setItem('crm_customers', JSON.stringify([sampleCustomer]));

      // Tạo task cho sale-1
      knowledgeAndScriptService.createCareTask('lead-transfer-1', sampleCustomer.id, 'sale-1', 'Nhắc hẹn xem nhà mẫu', '2026-11-10T10:00:00Z');

      // Điều chuyển sang sale-2
      knowledgeAndScriptService.reassignCareTasks('lead-transfer-1', 'sale-2');

      const sale1Tasks = knowledgeAndScriptService.getCareTasks('sale-1');
      const sale2Tasks = knowledgeAndScriptService.getCareTasks('sale-2');

      expect(sale1Tasks.length).toBe(0);
      expect(sale2Tasks.length).toBe(1);
      expect(sale2Tasks[0].title).toBe('Nhắc hẹn xem nhà mẫu');
    });
  });
});
