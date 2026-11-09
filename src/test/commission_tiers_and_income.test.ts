// ========================================================
// TEST SUITE: 5-TIER COMMISSION ALLOCATION & INCOME LEDGER
// Kiểm thử phân bổ hoa hồng 5 tầng (Sale, Nhóm, GĐ Sàn, GĐ Vùng, CEO),
// Thu nhập & Sổ cái, Largest Remainder Method, Scope Matrix, Audit
// ========================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { commissionService } from '@/domain/services/commissionService';
import { contractRepository } from '@/data/repositories/contractRepository';
import { authRepository } from '@/data/repositories/authRepository';
import { UserProfile, CommissionEntry } from '@/domain/types';

describe('Module Hoa Hồng 5 Tầng & Sổ Cái Thu Nhập', () => {
  const adminUser: UserProfile = {
    id: 'admin-001',
    email: 'admin@crm-broker.vn',
    full_name: 'Quản Trị Viên Hệ Thống',
    role: 'admin',
    status: 'active',
    phone: '0901234567',
    must_change_password: false,
    totp_enabled: false,
  };

  const ceoUser: UserProfile = {
    id: 'ceo-001',
    email: 'ceo@diaocvang.vn',
    full_name: 'Trần Văn CEO',
    role: 'ceo',
    organization_id: 'org-001',
    status: 'active',
    phone: '0901234568',
    must_change_password: false,
    totp_enabled: false,
  };

  const regionalDirectorUser: UserProfile = {
    id: 'rd-001',
    email: 'gdvung.mn@diaocvang.vn',
    full_name: 'Lê Giám Đốc Vùng Nam',
    role: 'regional_director',
    region_id: 'reg-south',
    status: 'active',
    phone: '0901234569',
    must_change_password: false,
    totp_enabled: false,
  };

  const directorUser: UserProfile = {
    id: 'dir-001',
    email: 'gdsan.q1@diaocvang.vn',
    full_name: 'Phạm Giám Đốc Sàn Q1',
    role: 'director',
    agency_id: 'agency-q1',
    region_id: 'reg-south',
    status: 'active',
    phone: '0901234570',
    must_change_password: false,
    totp_enabled: false,
  };

  const teamLeaderUser: UserProfile = {
    id: 'tl-001',
    email: 'truongnhom@diaocvang.vn',
    full_name: 'Nguyễn Trưởng Nhóm Alpha',
    role: 'team_leader',
    team_id: 'team-alpha',
    agency_id: 'agency-q1',
    status: 'active',
    phone: '0901234571',
    must_change_password: false,
    totp_enabled: false,
  };

  const saleUser: UserProfile = {
    id: 'sale-001',
    email: 'sale1@diaocvang.vn',
    full_name: 'Trần Sale Chiến Thần',
    role: 'sale_agent',
    team_id: 'team-alpha',
    agency_id: 'agency-q1',
    status: 'active',
    phone: '0901234572',
    must_change_password: false,
    totp_enabled: false,
  };

  const marketingUser: UserProfile = {
    id: 'mkt-001',
    email: 'mkt.lead@diaocvang.vn',
    full_name: 'Hoàng Marketing Trưởng',
    role: 'marketing_manager',
    status: 'active',
    phone: '0901234573',
    must_change_password: false,
    totp_enabled: false,
  };

  const hrUser: UserProfile = {
    id: 'hr-001',
    email: 'hr.admin@diaocvang.vn',
    full_name: 'Đặng HR Quản Trị',
    role: 'hr_admin',
    status: 'active',
    phone: '0901234574',
    must_change_password: false,
    totp_enabled: false,
  };

  beforeEach(() => {
    localStorage.clear();
  });

  // ========================================================
  // 1. VÍ DỤ KIỂM CHỨNG CHUẨN (VERIFICATION EXAMPLE)
  // ========================================================
  describe('1. Ví Dụ Kiểm Chứng Chuẩn Tuyệt Đối (3.65 Tỷ VNĐ)', () => {
    it('Tính toán chính xác 100% từng tầng hoa hồng và Công ty giữ lại', () => {
      const dealValue = 3650000000; // 3,65 tỷ
      const result = commissionService.calculateCommission({
        dealValue,
        projectCommissionRate: 3.5,
        tiers: {
          sale: 1.5,
          team: 0.3,
          agency_director: 0.2,
          regional_director: 0.1,
          ceo: 0.05,
        },
        baseMode: 'contract_value',
        chain: {
          sale: { id: saleUser.id, name: saleUser.full_name },
          team: { id: teamLeaderUser.team_id, name: 'Nhóm Alpha', leaderId: teamLeaderUser.id, leaderName: teamLeaderUser.full_name },
          agencyDirector: { id: directorUser.id, name: directorUser.full_name },
          regionalDirector: { id: regionalDirectorUser.id, name: regionalDirectorUser.full_name },
          ceo: { id: ceoUser.id, name: ceoUser.full_name },
        },
      });

      // Sàn 3,5% = 127.750.000 đ
      expect(result.agencyCommissionAmount).toBe(127750000);
      expect(result.agencyCommissionRate).toBe(3.5);

      // Sale 1,5% = 54.750.000 đ
      const saleItem = result.items.find(i => i.tier === 'sale');
      expect(saleItem).toBeDefined();
      expect(saleItem?.amount).toBe(54750000);

      // Nhóm 0,3% = 10.950.000 đ
      const teamItem = result.items.find(i => i.tier === 'team');
      expect(teamItem).toBeDefined();
      expect(teamItem?.amount).toBe(10950000);

      // GĐ Sàn 0,2% = 7.300.000 đ
      const dirItem = result.items.find(i => i.tier === 'agency_director');
      expect(dirItem).toBeDefined();
      expect(dirItem?.amount).toBe(7300000);

      // GĐ Vùng 0,1% = 3.650.000 đ
      const regItem = result.items.find(i => i.tier === 'regional_director');
      expect(regItem).toBeDefined();
      expect(regItem?.amount).toBe(3650000);

      // CEO 0,05% = 1.825.000 đ
      const ceoItem = result.items.find(i => i.tier === 'ceo');
      expect(ceoItem).toBeDefined();
      expect(ceoItem?.amount).toBe(1825000);

      // Tổng chia = 78.475.000 đ (2,15%)
      expect(result.totalDistributedAmount).toBe(78475000);
      expect(result.totalDistributedRate).toBe(2.15);

      // Công ty giữ lại = 49.275.000 đ (1,35%)
      expect(result.companyRetainedAmount).toBe(49275000);
      expect(result.companyRetainedRate).toBe(1.35);

      // Kiểm tra bảo toàn tuyệt đối: Tổng chia + Công ty giữ lại = Quỹ Sàn
      expect(result.totalDistributedAmount + result.companyRetainedAmount).toBe(result.agencyCommissionAmount);
    });
  });

  // ========================================================
  // 2. PHƯƠNG PHÁP PHẦN DƯ LỚN NHẤT (LARGEST REMAINDER METHOD)
  // ========================================================
  describe('2. Phương Pháp Phần Dư Lớn Nhất (Largest Remainder Method)', () => {
    it('Số tiền giao dịch cực kỳ lẻ vẫn đảm bảo tổng các tầng + công ty giữ lại đúng 100% không lệch 1 đồng', () => {
      const oddDealValue = 1234567891; // Số nguyên tố lẻ
      const result = commissionService.calculateCommission({
        dealValue: oddDealValue,
        projectCommissionRate: 3.33,
        tiers: {
          sale: 1.333,
          team: 0.333,
          agency_director: 0.222,
          regional_director: 0.111,
          ceo: 0.055,
        },
      });

      // Tổng các tầng integer VND
      const sumItems = result.items.reduce((sum, item) => sum + item.amount, 0);
      expect(sumItems).toBe(result.totalDistributedAmount);

      // Tổng chia + Công ty giữ lại = Quỹ Sàn
      expect(result.totalDistributedAmount + result.companyRetainedAmount).toBe(result.agencyCommissionAmount);
      expect(Number.isInteger(result.companyRetainedAmount)).toBe(true);
      expect(Number.isInteger(result.totalDistributedAmount)).toBe(true);
    });
  });

  // ========================================================
  // 3. CƠ SỞ TÍNH (BASE_MODE)
  // ========================================================
  describe('3. Cơ Sở Tính Toán (base_mode)', () => {
    it('base_mode = company_commission: Tỷ lệ các tầng được tính trên tổng hoa hồng Sàn', () => {
      const dealValue = 2000000000; // 2 tỷ
      const agencyRate = 3.0; // Sàn = 60.000.000 đ
      const result = commissionService.calculateCommission({
        dealValue,
        projectCommissionRate: agencyRate,
        tiers: {
          sale: 50.0, // 50% của hoa hồng sàn = 30.000.000 đ
          team: 10.0, // 10% của hoa hồng sàn = 6.000.000 đ
          agency_director: 5.0, // 5% = 3.000.000 đ
          regional_director: 3.0, // 3% = 1.800.000 đ
          ceo: 2.0, // 2% = 1.200.000 đ
        },
        baseMode: 'company_commission',
      });

      expect(result.agencyCommissionAmount).toBe(60000000);
      const sale = result.items.find(i => i.tier === 'sale');
      expect(sale?.amount).toBe(30000000);

      const team = result.items.find(i => i.tier === 'team');
      expect(team?.amount).toBe(6000000);

      // Tổng chia = 70% của 60M = 42.000.000 đ
      expect(result.totalDistributedAmount).toBe(42000000);
      // Công ty giữ lại = 30% của 60M = 18.000.000 đ
      expect(result.companyRetainedAmount).toBe(18000000);
    });
  });

  // ========================================================
  // 4. CHIA NHÓM (TEAM_SPLIT_MODE)
  // ========================================================
  describe('4. Chế Độ Phân Chia Tầng Nhóm (team_split_mode)', () => {
    it('team_split_mode = leader_only (mặc định): Trưởng nhóm nhận trọn phần nhóm', () => {
      const result = commissionService.calculateCommission({
        dealValue: 1000000000,
        projectCommissionRate: 3.5,
        tiers: { team: 0.3 },
        teamSplitMode: 'leader_only',
        chain: {
          team: { id: 'team-1', name: 'Nhóm 1', leaderId: 'leader-1', leaderName: 'Trưởng Nhóm' },
        },
      });

      const teamItems = result.items.filter(i => i.tier === 'team');
      expect(teamItems.length).toBe(1);
      expect(teamItems[0].recipient_id).toBe('leader-1');
      expect(teamItems[0].amount).toBe(3000000);
    });

    it('team_split_mode = equal: Chia đều phần nhóm cho các thành viên', () => {
      const result = commissionService.calculateCommission({
        dealValue: 1000000000,
        projectCommissionRate: 3.5,
        tiers: { team: 0.3 }, // 3.000.000 đ
        teamSplitMode: 'equal',
        teamMembers: [
          { id: 'm1', name: 'Thành viên 1' },
          { id: 'm2', name: 'Thành viên 2' },
          { id: 'm3', name: 'Thành viên 3' },
        ],
      });

      const teamItems = result.items.filter(i => i.tier === 'team');
      expect(teamItems.length).toBe(3);
      expect(teamItems[0].amount).toBe(1000000);
      expect(teamItems[1].amount).toBe(1000000);
      expect(teamItems[2].amount).toBe(1000000);
      expect(teamItems.reduce((s, i) => s + i.amount, 0)).toBe(3000000);
    });

    it('team_split_mode = by_ratio: Chia theo tỷ lệ đóng góp', () => {
      const result = commissionService.calculateCommission({
        dealValue: 1000000000,
        projectCommissionRate: 3.5,
        tiers: { team: 0.3 }, // 3.000.000 đ
        teamSplitMode: 'by_ratio',
        teamMembers: [
          { id: 'm1', name: 'Sale 1', ratio: 60 },
          { id: 'm2', name: 'Sale 2', ratio: 40 },
        ],
      });

      const teamItems = result.items.filter(i => i.tier === 'team');
      expect(teamItems.length).toBe(2);
      expect(teamItems[0].amount).toBe(1800000); // 60%
      expect(teamItems[1].amount).toBe(1200000); // 40%
    });
  });

  // ========================================================
  // 5. THUẾ TNCN TẠM TÍNH (WITHHOLDING_RATE)
  // ========================================================
  describe('5. Khấu Trừ Thuế TNCN Tạm Tính (withholding_rate)', () => {
    it('withholding_rate = 10%: Tự động tính PIT tax và net_payable_amount cho từng tầng', () => {
      const result = commissionService.calculateCommission({
        dealValue: 1000000000,
        projectCommissionRate: 3.5,
        tiers: { sale: 1.5 }, // 15.000.000 đ
        withholdingRate: 10,
      });

      const sale = result.items.find(i => i.tier === 'sale');
      expect(sale?.amount).toBe(15000000);
      expect(sale?.pit_tax_amount).toBe(1500000);
      expect(sale?.net_payable_amount).toBe(13500000);
    });
  });

  // ========================================================
  // 6. RÀNG BUỘC VƯỢT QUỸ (COMMISSION_EXCEEDS_POOL)
  // ========================================================
  describe('6. Kiểm Soát Ràng Buộc Vượt Quỹ (Pool Exceed)', () => {
    it('Từ chối khi tổng tỷ lệ các tầng vượt quá % hoa hồng Sàn', () => {
      const result = commissionService.calculateCommission({
        dealValue: 1000000000,
        projectCommissionRate: 3.0,
        tiers: {
          sale: 2.5,
          team: 0.5,
          agency_director: 0.5, // Tổng = 3.5% > 3.0%
        },
      });

      expect(result.isExceedsPool).toBe(true);
      expect(result.totalDistributedRate).toBeGreaterThan(result.agencyCommissionRate);
    });
  });

  // ========================================================
  // 7. XỬ LÝ TẦNG KHUYẾT (UNASSIGNED) & GÁN NGƯỜI NHẬN VỚI AUDIT
  // ========================================================
  describe('7. Tầng Khuyết Nhân Sự (Unassigned) & Gán Người Nhận', () => {
    it('Đánh dấu is_unassigned khi chuỗi thiếu nhân sự phụ trách', () => {
      const result = commissionService.calculateCommission({
        dealValue: 1000000000,
        projectCommissionRate: 3.5,
        tiers: {
          sale: 1.5,
          agency_director: 0.2,
        },
        chain: {
          sale: { id: saleUser.id, name: saleUser.full_name },
          // Giám đốc Sàn bị khuyết (không truyền)
        },
      });

      const dirItem = result.items.find(i => i.tier === 'agency_director');
      expect(dirItem).toBeDefined();
      expect(dirItem?.is_unassigned).toBe(true);
      expect(dirItem?.recipient_id).toBe('unassigned');
    });

    it('Gán người nhận cho tầng khuyết yêu cầu lý do >= 10 ký tự và ghi Audit log', async () => {
      // 1. Tạo hợp đồng mẫu có tầng unassigned
      const contract = await contractRepository.createContractWithCustomer({
        projectId: 'prj-test-1',
        dealValue: 1000000000,
        unitCode: 'C-999',
        customerName: 'Nguyễn Khách Hàng Test',
        customerPhone: '0901234567',
        consentObtained: true,
        commissionRate: 3.5,
        saleCommissionRate: 1.5,
        agencyDirectorRate: 0.2,
        // Khuyết agency_director
        currentUser: adminUser,
        requestId: 'req-unassigned-test',
      });

      const entries = await contractRepository.getCommissionEntries({ contractId: contract.transaction_id });
      const unassignedEntry = entries.find(e => e.tier === 'agency_director');
      expect(unassignedEntry).toBeDefined();

      // 2. Thử gán với lý do quá ngắn (< 10 ký tự) -> ném lỗi
      await expect(
        contractRepository.assignCommissionRecipient(
          unassignedEntry!.id,
          directorUser.id,
          directorUser.full_name,
          'Lý do',
          adminUser
        )
      ).rejects.toThrow('invalid_reason');

      // 3. Gán hợp lệ với lý do >= 10 ký tự
      const updated = await contractRepository.assignCommissionRecipient(
        unassignedEntry!.id,
        directorUser.id,
        directorUser.full_name,
        'Bổ nhiệm Giám đốc Sàn mới tiếp quản hợp đồng',
        adminUser
      );

      expect(updated.recipient_id).toBe(directorUser.id);
      expect(updated.recipient_name).toBe(directorUser.full_name);
      expect(['pending_eligibility', 'expected']).toContain(updated.status);

      // Kiểm tra audit log
      const auditLogs = JSON.parse(localStorage.getItem('crm_audit_logs') || '[]');
      const assignAudit = auditLogs.find((a: any) => a.action === 'commission_recipient_assigned');
      expect(assignAudit).toBeDefined();
      expect(assignAudit.actor_id).toBe(adminUser.id);
    });
  });

  // ========================================================
  // 8. MA TRẬN PHÂN QUYỀN TRUY CẬP THU NHẬP (SCOPE MATRIX)
  // ========================================================
  describe('8. Ma Trận Phân Quyền Truy Cập Sổ Cái & Thu Nhập', () => {
    const sampleEntries: CommissionEntry[] = [
      {
        id: 'entry-sale-1',
        contract_id: 'c-1',
        recipient_id: saleUser.id,
        recipient_name: saleUser.full_name,
        recipient_role: 'sale_agent',
        tier: 'sale',
        rate_percent: 1.5,
        amount: 15000000,
        status: 'expected',
        agency_id: 'agency-q1',
        region_id: 'reg-south',
        created_at: new Date().toISOString(),
      },
      {
        id: 'entry-team-1',
        contract_id: 'c-1',
        recipient_id: teamLeaderUser.id,
        recipient_name: teamLeaderUser.full_name,
        recipient_role: 'team_leader',
        tier: 'team',
        rate_percent: 0.3,
        amount: 3000000,
        status: 'expected',
        agency_id: 'agency-q1',
        region_id: 'reg-south',
        created_at: new Date().toISOString(),
      },
      {
        id: 'entry-dir-1',
        contract_id: 'c-1',
        recipient_id: directorUser.id,
        recipient_name: directorUser.full_name,
        recipient_role: 'director',
        tier: 'agency_director',
        rate_percent: 0.2,
        amount: 2000000,
        status: 'expected',
        agency_id: 'agency-q1',
        region_id: 'reg-south',
        created_at: new Date().toISOString(),
      },
      {
        id: 'entry-reg-1',
        contract_id: 'c-1',
        recipient_id: regionalDirectorUser.id,
        recipient_name: regionalDirectorUser.full_name,
        recipient_role: 'regional_director',
        tier: 'regional_director',
        rate_percent: 0.1,
        amount: 1000000,
        status: 'expected',
        agency_id: 'agency-q1',
        region_id: 'reg-south',
        created_at: new Date().toISOString(),
      },
      {
        id: 'entry-ceo-1',
        contract_id: 'c-1',
        recipient_id: ceoUser.id,
        recipient_name: ceoUser.full_name,
        recipient_role: 'ceo',
        tier: 'ceo',
        rate_percent: 0.05,
        amount: 500000,
        status: 'expected',
        agency_id: 'agency-q1',
        region_id: 'reg-south',
        created_at: new Date().toISOString(),
      },
      // Một bút toán ở sàn khác (agency-q7)
      {
        id: 'entry-dir-other',
        contract_id: 'c-2',
        recipient_id: 'dir-other',
        recipient_name: 'GĐ Sàn Khác',
        recipient_role: 'director',
        tier: 'agency_director',
        rate_percent: 0.2,
        amount: 2000000,
        status: 'expected',
        agency_id: 'agency-q7',
        region_id: 'reg-south',
        created_at: new Date().toISOString(),
      },
    ];

    it('Sale Agent CHỈ xem được bút toán của chính mình', () => {
      const scoped = commissionService.filterCommissionEntriesByScope(sampleEntries, saleUser);
      expect(scoped.length).toBe(1);
      expect(scoped[0].recipient_id).toBe(saleUser.id);
    });

    it('Marketing Manager và HR Admin bị CHẶN 100% không xem được hoa hồng', () => {
      const mktScoped = commissionService.filterCommissionEntriesByScope(sampleEntries, marketingUser);
      expect(mktScoped.length).toBe(0);

      const hrScoped = commissionService.filterCommissionEntriesByScope(sampleEntries, hrUser);
      expect(hrScoped.length).toBe(0);
    });

    it('Giám đốc Sàn xem được các bút toán trong Sàn của mình', () => {
      const scoped = commissionService.filterCommissionEntriesByScope(sampleEntries, directorUser);
      // agency-q1 có 5 bút toán, agency-q7 có 1 bút toán
      expect(scoped.length).toBe(5);
      expect(scoped.every(e => e.agency_id === 'agency-q1')).toBe(true);
    });

    it('Giám đốc Vùng xem được các bút toán thuộc các Sàn trong Vùng của mình', () => {
      const scoped = commissionService.filterCommissionEntriesByScope(sampleEntries, regionalDirectorUser);
      // Cả 6 bút toán đều ở reg-south
      expect(scoped.length).toBe(6);
      expect(scoped.every(e => e.region_id === 'reg-south')).toBe(true);
    });

    it('Admin và CEO xem được toàn bộ sổ cái hoa hồng hệ thống', () => {
      const adminScoped = commissionService.filterCommissionEntriesByScope(sampleEntries, adminUser);
      expect(adminScoped.length).toBe(6);

      const ceoScoped = commissionService.filterCommissionEntriesByScope(sampleEntries, ceoUser);
      expect(ceoScoped.length).toBe(6);
    });
  });

  // ========================================================
  // 9. CHẾ ĐỘ ĐÓNG VAI (IMPERSONATION) CHẶN XUẤT CSV
  // ========================================================
  describe('9. Chế Độ Đóng Vai (Impersonation)', () => {
    it('Chặn xuất file CSV khi đang trong chế độ impersonate', async () => {
      // Đăng nhập admin và kích hoạt impersonation
      await authRepository.login('admin@diaocvang.vn', 'password123');
      await authRepository.impersonateRole('sale_agent', 45, 'Kiểm tra quyền xuất CSV');
      expect(authRepository.isImpersonating()).toBe(true);

      await expect(
        contractRepository.exportIncomeCsv([], adminUser)
      ).rejects.toThrow('impersonation_readonly');

      await authRepository.impersonateRole(null);
    });

    it('Admin xuất file CSV bình thường khi không đóng vai và ghi audit log', async () => {
      const entries: CommissionEntry[] = [
        {
          id: 'e-1',
          contract_id: 'c-1',
          recipient_id: 'u-1',
          recipient_name: 'Trần Văn A',
          recipient_role: 'sale_agent',
          tier: 'sale',
          rate_percent: 1.5,
          amount: 15000000,
          status: 'paid',
          created_at: new Date().toISOString(),
        },
      ];

      const csv = await contractRepository.exportIncomeCsv(entries, adminUser);
      expect(csv).toContain('Mã Bút Toán,Mã Hợp Đồng');
      expect(csv).toContain('Trần Văn A');

      // Kiểm tra audit log
      const auditLogs = JSON.parse(localStorage.getItem('crm_audit_logs') || '[]');
      const exportLog = auditLogs.find((a: any) => a.action === 'income_report_exported');
      expect(exportLog).toBeDefined();
    });
  });

  // ========================================================
  // 10. TỔNG HỢP THU NHẬP (GET_INCOME_SUMMARY)
  // ========================================================
  describe('10. Báo Cáo Tổng Hợp Thu Nhập (getIncomeSummary)', () => {
    it('Tổng hợp chuẩn xác theo trạng thái (paid, eligible, expected, clawback)', async () => {
      const entries: CommissionEntry[] = [
        {
          id: 'e-1',
          contract_id: 'c-1',
          recipient_id: adminUser.id,
          recipient_role: 'admin',
          tier: 'sale',
          rate_percent: 1.5,
          amount: 10000000,
          pit_tax_amount: 1000000,
          net_payable_amount: 9000000,
          status: 'paid',
          created_at: '2026-05-10T10:00:00Z',
        },
        {
          id: 'e-2',
          contract_id: 'c-2',
          recipient_id: adminUser.id,
          recipient_role: 'admin',
          tier: 'sale',
          rate_percent: 1.5,
          amount: 20000000,
          pit_tax_amount: 2000000,
          net_payable_amount: 18000000,
          status: 'eligible',
          created_at: '2026-05-15T10:00:00Z',
        },
      ];

      localStorage.setItem('crm_commission_entries', JSON.stringify(entries));

      const summary = await contractRepository.getIncomeSummary({}, adminUser);
      expect(summary.overall.totalGrossIncome).toBe(30000000);
      expect(summary.overall.totalTaxAmount).toBe(3000000);
      expect(summary.overall.totalNetIncome).toBe(27000000);
      expect(summary.overall.paidIncome).toBe(10000000);
      expect(summary.overall.eligibleIncome).toBe(20000000);
    });
  });

  // ========================================================
  // 11. THU HỒI HOA HỒNG (CLAWBACK)
  // ========================================================
  describe('11. Cập Nhật Trạng Thái & Thu Hồi Hoa Hồng (Clawback)', () => {
    it('Chuyển trạng thái sang clawback khi hợp đồng bị hủy', async () => {
      const entry: CommissionEntry = {
        id: 'e-clawback-test',
        contract_id: 'c-claw',
        recipient_id: saleUser.id,
        recipient_role: 'sale_agent',
        tier: 'sale',
        rate_percent: 1.5,
        amount: 10000000,
        status: 'eligible',
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('crm_commission_entries', JSON.stringify([entry]));

      const updated = await contractRepository.updateCommissionEntryStatus(
        entry.id,
        'clawback',
        'Khách hàng hủy cọc do không được duyệt hồ sơ vay',
        adminUser
      );

      expect(updated.status).toBe('clawback');

      // Kiểm tra audit log
      const auditLogs = JSON.parse(localStorage.getItem('crm_audit_logs') || '[]');
      const statusLog = auditLogs.find((a: any) => a.action === 'commission_status_updated');
      expect(statusLog).toBeDefined();
    });
  });
});
