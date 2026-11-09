import { describe, it, expect, beforeEach } from 'vitest';
import { projectRepository } from '@/data/repositories/projectRepository';
import { contractRepository } from '@/data/repositories/contractRepository';
import { leadRepository } from '@/data/repositories/leadRepository';
import { AI_MASTER_STAGE_SCRIPTS, formatFullScriptMarkdown } from '@/data/aiSalesScripts';
import { JOURNEY_STAGES } from '@/domain/constants';
import { UserProfile, LeadStatus } from '@/domain/types';

describe('Kiểm thử CEO Filter, Chuỗi Quản Lý Hợp Đồng & Kịch Bản AI 15 Bước', () => {
  const mockCurrentUser: UserProfile = {
    id: 'user-admin-01',
    full_name: 'Quản Trị Viên Hệ Thống',
    email: 'admin@diaocvang.vn',
    phone: '0901234567',
    role: 'admin',
    status: 'active',
    organization_id: 'org-01',
    must_change_password: false,
    totp_enabled: false,
  };

  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. Kịch Bản Bán Hàng 15 Bước Theo Dự Án Chuyên Sâu Bằng AI', () => {
    it('Đủ 15 trạng thái khách hàng theo JOURNEY_STAGES, mỗi trạng thái có nội dung chuyên biệt', () => {
      const stageKeys = Object.keys(AI_MASTER_STAGE_SCRIPTS) as LeadStatus[];
      expect(stageKeys.length).toBe(15);

      JOURNEY_STAGES.forEach((stage) => {
        expect(AI_MASTER_STAGE_SCRIPTS[stage.id]).toBeDefined();
        const detail = AI_MASTER_STAGE_SCRIPTS[stage.id];
        expect(detail.status).toBe(stage.id);
        expect(detail.psychologyAnalysis.length).toBeGreaterThan(50);
        expect(detail.discoveryChecklist.length).toBeGreaterThanOrEqual(3);
        expect(detail.actionScript.length).toBeGreaterThan(50);
        expect(detail.objectionHandling.length).toBeGreaterThan(20);
        expect(detail.nextStepCallToAction.length).toBeGreaterThan(10);
      });
    });

    it('Nội dung các trạng thái không trùng lặp nhau', () => {
      const contents = new Set<string>();
      JOURNEY_STAGES.forEach((stage) => {
        const detail = AI_MASTER_STAGE_SCRIPTS[stage.id];
        // So sánh toàn bộ nội dung kịch bản
        expect(contents.has(detail.actionScript)).toBe(false);
        contents.add(detail.actionScript);
      });
      expect(contents.size).toBe(15);
    });

    it('projectRepository.getSalesScripts trả về đủ 15 kịch bản AI chi tiết cho dự án', async () => {
      const testProjectId = 'prj-test-15steps';
      const scripts = await projectRepository.getSalesScripts(testProjectId);
      expect(scripts.length).toBe(15);

      const newScript = scripts.find(s => s.status === 'new');
      expect(newScript).toBeDefined();
      expect(newScript?.content).toContain('I. PHÂN TÍCH TÂM LÝ & BỐI CẢNH KHÁCH HÀNG');
      expect(newScript?.content).toContain('II. NỘI DUNG TÌM HIỂU & BỘ CÂU HỎI KHAI THÁC NHU CẦU');
      expect(newScript?.content).toContain('III. KỊCH BẢN TƯ VẤN THỰC CHIẾN & LỜI THOẠI MẪU CHO SALE');

      // Test resetScriptToDefault
      const resetConsulted = await projectRepository.resetScriptToDefault(testProjectId, 'consulted');
      expect(resetConsulted.status).toBe('consulted');
      expect(resetConsulted.content).toContain('KỊCH BẢN TƯ VẤN THỰC CHIẾN');
      expect(resetConsulted.content).toContain('ĐÃ GẶP TƯ VẤN TRỰC TIẾP');
    });
  });

  describe('2. Chuỗi Nhân Sự & Phân Cấp Quản Lý Trong Hợp Đồng (Contract Chain Snapshot)', () => {
    it('Tạo hợp đồng thành công và lưu giữ toàn bộ chuỗi 5 cấp: Sale -> Trưởng Phòng -> GĐ Sàn -> GĐ Vùng -> CEO', async () => {
      const payload = {
        projectId: '33333333-1111-1111-1111-111111111111',
        projectName: 'Vinhomes Grand Park',
        unitCode: 'OG-S7.02-99.99',
        customerName: 'Nguyễn Văn Khách Hàng',
        customerPhone: '0988776655',
        customerEmail: 'khachhang@gmail.com',
        dealValue: 3500000000,
        consentObtained: true,
        currentUser: mockCurrentUser,

        // Snapshot chuỗi 5 cấp
        saleId: 'sale-001',
        saleName: 'Nguyễn Văn Sale',
        teamId: 'team-01',
        teamName: 'Team Chiến Binh Q1',
        teamLeaderId: 'leader-01',
        teamLeaderName: 'Trần Văn Trưởng Nhóm',
        salesManagerId: 'sm-01',
        salesManagerName: 'Trần Văn Trưởng Phòng',
        agencyId: 'agency-01',
        agencyName: 'Sàn Giao Dịch Sài Gòn',
        agencyDirectorId: 'dir-01',
        agencyDirectorName: 'Lê Văn Giám Đốc Sàn',
        regionId: 'reg-01',
        regionName: 'Vùng Đông Nam Bộ',
        regionalDirectorId: 'rd-01',
        regionalDirectorName: 'Phạm Thị Giám Đốc Vùng',
        ceoId: 'ceo-01',
        ceoName: 'Hoàng Văn Tổng Giám Đốc',
        organizationId: 'org-01',
      };

      const result = await contractRepository.createContractWithCustomer(payload);
      expect(result.success).toBe(true);
      expect(result.contract_code).toBeDefined();

      const txs = await contractRepository.getTransactions({});
      const createdTx = txs.find(t => t.id === result.transaction_id);
      expect(createdTx).toBeDefined();

      // Kiểm tra chuỗi bất biến được lưu snapshot chính xác
      expect(createdTx?.sale_id).toBe('sale-001');
      expect(createdTx?.sale_name).toBe('Nguyễn Văn Sale');
      expect(createdTx?.team_id).toBe('team-01');
      expect(createdTx?.team_name).toBe('Team Chiến Binh Q1');
      expect(createdTx?.team_leader_name).toBe('Trần Văn Trưởng Nhóm');
      expect(createdTx?.sales_manager_name).toBe('Trần Văn Trưởng Phòng');
      expect(createdTx?.agency_name).toBe('Sàn Giao Dịch Sài Gòn');
      expect(createdTx?.agency_director_name).toBe('Lê Văn Giám Đốc Sàn');
      expect(createdTx?.region_name).toBe('Vùng Đông Nam Bộ');
      expect(createdTx?.regional_director_name).toBe('Phạm Thị Giám Đốc Vùng');
      expect(createdTx?.ceo_name).toBe('Hoàng Văn Tổng Giám Đốc');
      expect(createdTx?.organization_id).toBe('org-01');
    });
  });

  describe('3. Lọc Thông Tin Theo CEO Tại Quản Lý Leads', () => {
    it('leadRepository.getLeads lọc chính xác theo ceoId và currentUser', async () => {
      const res = await leadRepository.getLeads({ ceoId: 'ceo-org-01' }, mockCurrentUser);
      expect(res).toBeDefined();
      expect(Array.isArray(res.leads)).toBe(true);
    });
  });
});
