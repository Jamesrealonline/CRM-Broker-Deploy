// ========================================================
// TEST SUITE: CEO, REGIONAL DIRECTORS, DIVISIONS & ORG RESTRUCTURE
// Kiểm thử phân quyền, cơ cấu 3 khối, maker-checker đa tầng và bảo vệ dữ liệu
// ========================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { teamRepository } from '@/data/repositories/teamRepository';
import { contractRepository } from '@/data/repositories/contractRepository';
import { hrRepository } from '@/data/repositories/hrRepository';
import { leadRepository } from '@/data/repositories/leadRepository';
import { branchHierarchyService } from '@/domain/services/branchHierarchyService';
import { controlledDataService } from '@/domain/services/controlledDataService';
import { canViewFullPII } from '@/lib/masking';
import { UserProfile, Agency, Team, Region, Transaction, Lead, LeaderboardItem } from '@/domain/types';

describe('CEO, Regional Directors, Divisions & Org Restructure Suite', () => {
  // Người dùng mẫu cho 9 vai trò
  const userAdmin: UserProfile = {
    id: 'user-admin-01',
    email: 'admin@diaocvang.vn',
    full_name: 'Quản Trị Viên Kỹ Thuật',
    phone: '0901000001',
    role: 'admin',
    status: 'active',
    must_change_password: false,
    totp_enabled: true,
  };

  const userCeo: UserProfile = {
    id: 'user-ceo-01',
    email: 'ceo@diaocvang.vn',
    full_name: 'Trần Hải Nam (Tổng Giám Đốc)',
    phone: '0901000002',
    role: 'ceo',
    status: 'active',
    must_change_password: false,
    totp_enabled: true,
  };

  const userRegDirNorth: UserProfile = {
    id: 'user-rd-north',
    email: 'rd.north@diaocvang.vn',
    full_name: 'Nguyễn Văn Bắc (GĐ Vùng Miền Bắc)',
    phone: '0901000003',
    role: 'regional_director',
    region_id: 'reg-north',
    status: 'active',
    must_change_password: false,
    totp_enabled: true,
  };

  const userRegDirSouth: UserProfile = {
    id: 'user-rd-south',
    email: 'rd.south@diaocvang.vn',
    full_name: 'Lê Văn Nam (GĐ Vùng Miền Nam)',
    phone: '0901000004',
    role: 'regional_director',
    region_id: 'reg-south',
    status: 'active',
    must_change_password: false,
    totp_enabled: true,
  };

  const userDirectorAgency1: UserProfile = {
    id: 'user-dir-ag1',
    email: 'dir.ag1@diaocvang.vn',
    full_name: 'Hoàng GĐ Sàn 1 (Miền Bắc)',
    phone: '0901000005',
    role: 'director',
    region_id: 'reg-north',
    agency_id: 'agency-01',
    status: 'active',
    must_change_password: false,
    totp_enabled: true,
  };

  const userSalesManager1: UserProfile = {
    id: 'user-sm-01',
    email: 'sm1@diaocvang.vn',
    full_name: 'Phạm Trưởng Phòng 1',
    phone: '0901000006',
    role: 'sales_manager',
    region_id: 'reg-north',
    agency_id: 'agency-01',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const userTeamLeader1: UserProfile = {
    id: 'user-tl-01',
    email: 'tl1@diaocvang.vn',
    full_name: 'Đặng Trưởng Nhóm 1',
    phone: '0901000007',
    role: 'team_leader',
    region_id: 'reg-north',
    agency_id: 'agency-01',
    team_id: 'team-01',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const userSaleAgent1: UserProfile = {
    id: 'user-sale-01',
    email: 'sale1@diaocvang.vn',
    full_name: 'Vũ Chuyên Viên 1',
    phone: '0901000008',
    role: 'sale_agent',
    region_id: 'reg-north',
    agency_id: 'agency-01',
    team_id: 'team-01',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const userMarketingHead: UserProfile = {
    id: 'user-mkt-head',
    email: 'mkt.head@diaocvang.vn',
    full_name: 'Lê Thu Hà (Giám Đốc Marketing)',
    phone: '0901000009',
    role: 'marketing_manager',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const userHrHead: UserProfile = {
    id: 'user-hr-head',
    email: 'hr.head@diaocvang.vn',
    full_name: 'Nguyễn Thị HR (Giám Đốc HR)',
    phone: '0901000010',
    role: 'hr_admin',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const sampleAgencies: Agency[] = [
    {
      id: 'agency-01',
      organization_id: 'org-01',
      name: 'Sàn Hà Nội (Miền Bắc)',
      code: 'SAN-HN',
      region_id: 'reg-north',
      director_id: 'user-dir-ag1',
      status: 'active',
    },
    {
      id: 'agency-02',
      organization_id: 'org-01',
      name: 'Sàn Hải Phòng (Miền Bắc)',
      code: 'SAN-HP',
      region_id: 'reg-north',
      director_id: undefined, // Chưa có GĐ sàn
      status: 'active',
    },
    {
      id: 'agency-03',
      organization_id: 'org-01',
      name: 'Sàn Sài Gòn (Miền Nam)',
      code: 'SAN-SG',
      region_id: 'reg-south',
      director_id: 'user-dir-ag3',
      status: 'active',
    },
    {
      id: 'agency-04',
      organization_id: 'org-01',
      name: 'Sàn Đà Nẵng (Chưa phân vùng)',
      code: 'SAN-DN',
      region_id: undefined, // Chưa có vùng
      status: 'active',
    },
  ];

  const sampleRegions: Region[] = [
    {
      id: 'reg-north',
      name: 'Vùng Kinh Doanh Miền Bắc',
      code: 'REG-NORTH',
      regional_director_id: 'user-rd-north',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'reg-south',
      name: 'Vùng Kinh Doanh Miền Nam',
      code: 'REG-SOUTH',
      regional_director_id: 'user-rd-south',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'reg-central',
      name: 'Vùng Kinh Doanh Miền Trung (Khuyết GĐ Vùng)',
      code: 'REG-CENTRAL',
      regional_director_id: undefined,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('crm_profiles', JSON.stringify([
      userAdmin, userCeo, userRegDirNorth, userRegDirSouth,
      userDirectorAgency1, userSalesManager1, userTeamLeader1, userSaleAgent1,
      userMarketingHead, userHrHead
    ]));
    localStorage.setItem('crm_agencies', JSON.stringify(sampleAgencies));
    localStorage.setItem('crm_regions', JSON.stringify(sampleRegions));
    localStorage.setItem('crm_director_global_scope', 'false');
  });

  describe('1. Ma Trận Vai Trò & Phạm Vi Xem Dữ Liệu (Role Scoping)', () => {
    it('Quản Trị Viên (admin) có quyền xem toàn hệ thống (isGlobalViewer = true) bao gồm tất cả các ceo; CEO chỉ xem hệ thống bên dưới mình (isGlobalViewer = false)', () => {
      expect(branchHierarchyService.isGlobalViewer(userAdmin)).toBe(true);
      expect(branchHierarchyService.isGlobalViewer(userCeo)).toBe(false);
    });

    it('CEO chỉ xem được giám đốc vùng và nhân sự bên dưới, các CEO khác nhau không xem được hệ thống của nhau', () => {
      const userCeo2: UserProfile = {
        ...userCeo,
        id: 'user-ceo-2',
        email: 'ceo2@system.vn',
        organization_id: 'org-competitor',
      };
      // Admin xem được cả 2 CEO
      expect(branchHierarchyService.canAccessUser(userAdmin, userCeo)).toBe(true);
      expect(branchHierarchyService.canAccessUser(userAdmin, userCeo2)).toBe(true);

      // CEO 1 không xem được CEO 2 và ngược lại
      expect(branchHierarchyService.canAccessUser(userCeo, userCeo2)).toBe(false);
      expect(branchHierarchyService.canAccessUser(userCeo2, userCeo)).toBe(false);

      // CEO 1 xem được nhân sự thuộc hệ thống mình
      expect(branchHierarchyService.canAccessUser(userCeo, userRegDirNorth)).toBe(true);
    });

    it('Giám đốc Vùng chỉ xem được dữ liệu trong vùng của mình', () => {
      expect(branchHierarchyService.canAccessRegion(userRegDirNorth, 'reg-north')).toBe(true);
      expect(branchHierarchyService.canAccessRegion(userRegDirNorth, 'reg-south')).toBe(false);

      expect(branchHierarchyService.canAccessAgency(userRegDirNorth, 'agency-01')).toBe(true);
      expect(branchHierarchyService.canAccessAgency(userRegDirNorth, 'agency-03')).toBe(false);
    });

    it('Marketing và HR trực thuộc CEO, xem được dữ liệu tổng quan các sàn như directors', () => {
      expect(branchHierarchyService.isGlobalViewer(userMarketingHead)).toBe(false);
      expect(branchHierarchyService.isGlobalViewer(userHrHead)).toBe(false);
      expect(branchHierarchyService.canAccessAgency(userMarketingHead, 'agency-01')).toBe(true);
      expect(branchHierarchyService.canAccessAgency(userHrHead, 'agency-01')).toBe(true);
    });

    it('Sale chỉ xem được dữ liệu cá nhân, Trưởng nhóm xem dữ liệu team mình', () => {
      expect(branchHierarchyService.canAccessUser(userSaleAgent1, userSaleAgent1)).toBe(true);
      expect(branchHierarchyService.canAccessUser(userSaleAgent1, userTeamLeader1)).toBe(false);

      expect(branchHierarchyService.canAccessUser(userTeamLeader1, userSaleAgent1)).toBe(true);
      expect(branchHierarchyService.canAccessUser(userTeamLeader1, userSalesManager1)).toBe(false);
    });
  });

  describe('2. Quản Trị Vùng Kinh Doanh & Báo Cáo Sức Khỏe Cơ Cấu (Structural Health)', () => {
    it('Lấy danh sách vùng kinh doanh và tạo vùng mới thành công', async () => {
      const regions = await teamRepository.getRegions();
      expect(regions.length).toBeGreaterThanOrEqual(3);

      const createRes = await teamRepository.createRegion({
        name: 'Vùng Tây Nguyên',
        code: 'REG-HIGHLANDS',
        description: 'Vùng kinh doanh Buôn Ma Thuột & Pleiku',
      });
      expect(createRes.success).toBe(true);
      expect(createRes.region?.code).toBe('REG-HIGHLANDS');

      const updated = await teamRepository.getRegions();
      expect(updated.some(r => r.code === 'REG-HIGHLANDS')).toBe(true);
    });

    it('Báo cáo sức khỏe cơ cấu phát hiện sàn thiếu vùng, vùng thiếu GĐ và sàn thiếu GĐ sàn', async () => {
      const report = await teamRepository.getStructuralHealthReport();
      expect(report.hasIssues).toBe(true);

      // Sàn agency-04 chưa có vùng
      expect(report.agenciesWithoutRegion?.some(a => a.id === 'agency-04')).toBe(true);

      // Vùng reg-central khuyết GĐ Vùng
      expect(report.regionsWithoutDirector?.some(r => r.id === 'reg-central')).toBe(true);

      // Sàn agency-02 khuyết GĐ Sàn
      expect(report.agenciesWithoutDirector?.some(a => a.id === 'agency-02')).toBe(true);
    });

    it('Xóa vùng kinh doanh: tự động chuyển các sàn trực thuộc về Vùng mặc định (chống mồ côi)', async () => {
      const delRes = await teamRepository.deleteRegion('reg-south');
      expect(delRes.success).toBe(true);

      const agencies = await teamRepository.getAgencies();
      const agency3 = agencies.find(a => a.id === 'agency-03');
      expect(agency3?.region_id).toBe('REG-DEFAULT');
    });
  });

  describe('3. Phê Duyệt Hợp Đồng Đa Tầng (Multi-Tier Maker-Checker)', () => {
    it('Hợp đồng dưới 5 tỷ: Trưởng phòng kinh doanh có thể phê duyệt', async () => {
      const tx: Transaction = {
        id: 'tx-5b',
        lead_id: 'lead-001',
        code: 'HD-001',
        deal_value: 3_000_000_000,
        amount: 3_000_000_000,
        agency_id: 'agency-01',
        type: 'contract',
        created_by: 'creator-sale-99',
        status: 'pending',
        approval_status: 'pending_approval',
        transaction_date: new Date().toISOString(),
      };
      localStorage.setItem('crm_transactions', JSON.stringify([tx]));

      const approveRes = await contractRepository.approveContractTransaction(tx.id, userSalesManager1);
      expect(approveRes.success).toBe(true);
      expect(approveRes.transaction?.approval_status).toBe('approved');
    });

    it('Hợp đồng trên 5 tỷ: Trưởng phòng bị chặn, yêu cầu Giám đốc Sàn phê duyệt', async () => {
      const tx: Transaction = {
        id: 'tx-8b',
        lead_id: 'lead-001',
        code: 'HD-002',
        deal_value: 8_000_000_000,
        amount: 8_000_000_000,
        requires_l1_approval: true,
        agency_id: 'agency-01',
        type: 'contract',
        created_by: 'creator-sale-99',
        status: 'pending',
        approval_status: 'pending_approval',
        transaction_date: new Date().toISOString(),
      };
      localStorage.setItem('crm_transactions', JSON.stringify([tx]));

      // Trưởng phòng duyệt -> Ném lỗi
      await expect(
        contractRepository.approveContractTransaction(tx.id, userSalesManager1)
      ).rejects.toThrow('Hợp đồng trên 5 tỷ VNĐ vượt hạn mức phê duyệt của Trưởng phòng');

      // Giám đốc Sàn duyệt -> Thành công
      const approveRes = await contractRepository.approveContractTransaction(tx.id, userDirectorAgency1);
      expect(approveRes.success).toBe(true);
    });

    it('Hợp đồng trên 15 tỷ: Giám đốc Sàn bị chặn, yêu cầu Giám đốc Vùng phê duyệt', async () => {
      const tx: Transaction = {
        id: 'tx-20b',
        lead_id: 'lead-001',
        code: 'HD-003',
        deal_value: 20_000_000_000,
        amount: 20_000_000_000,
        requires_l2_approval: true,
        agency_id: 'agency-01',
        region_id: 'reg-north',
        type: 'contract',
        created_by: 'creator-sale-99',
        status: 'pending',
        approval_status: 'pending_approval',
        transaction_date: new Date().toISOString(),
      };
      localStorage.setItem('crm_transactions', JSON.stringify([tx]));

      // Giám đốc Sàn duyệt -> Ném lỗi
      await expect(
        contractRepository.approveContractTransaction(tx.id, userDirectorAgency1)
      ).rejects.toThrow('Hợp đồng trên 15 tỷ VNĐ vượt hạn mức phê duyệt của Giám đốc Sàn');

      // Giám đốc Vùng duyệt -> Thành công
      const approveRes = await contractRepository.approveContractTransaction(tx.id, userRegDirNorth);
      expect(approveRes.success).toBe(true);
    });

    it('Hợp đồng trên 30 tỷ: Giám đốc Vùng bị chặn, bắt buộc Tổng Giám Đốc (CEO) phê duyệt', async () => {
      const tx: Transaction = {
        id: 'tx-45b',
        lead_id: 'lead-001',
        code: 'HD-004',
        deal_value: 45_000_000_000,
        amount: 45_000_000_000,
        requires_l3_approval: true,
        agency_id: 'agency-01',
        region_id: 'reg-north',
        type: 'contract',
        created_by: 'creator-sale-99',
        status: 'pending',
        approval_status: 'pending_approval',
        transaction_date: new Date().toISOString(),
      };
      localStorage.setItem('crm_transactions', JSON.stringify([tx]));

      // Giám đốc Vùng duyệt -> Ném lỗi
      await expect(
        contractRepository.approveContractTransaction(tx.id, userRegDirNorth)
      ).rejects.toThrow('Hợp đồng trên 30 tỷ VNĐ vượt hạn mức phê duyệt của Giám đốc Vùng');

      // CEO duyệt -> Thành công
      const approveRes = await contractRepository.approveContractTransaction(tx.id, userCeo);
      expect(approveRes.success).toBe(true);
    });

    it('Chống tự phê duyệt (Self-Approval Prohibited)', async () => {
      const tx: Transaction = {
        id: 'tx-self',
        lead_id: 'lead-001',
        code: 'HD-SELF',
        deal_value: 2_000_000_000,
        amount: 2_000_000_000,
        agency_id: 'agency-01',
        type: 'contract',
        created_by: userSalesManager1.id, // Chính SM tạo hợp đồng
        status: 'pending',
        approval_status: 'pending_approval',
        transaction_date: new Date().toISOString(),
      };
      localStorage.setItem('crm_transactions', JSON.stringify([tx]));

      await expect(
        contractRepository.approveContractTransaction(tx.id, userSalesManager1)
      ).rejects.toThrow('Maker-Checker vi phạm');
    });
  });

  describe('4. Điều Chuyển Nhân Sự Phân Cấp (Decentralized Transfer)', () => {
    it('Điều chuyển khác vùng kinh doanh: bắt buộc Tổng Giám Đốc (CEO) phê duyệt', async () => {
      const req = await hrRepository.createTransferRequest({
        userId: userSaleAgent1.id,
        requestType: 'transfer',
        fromAgencyId: 'agency-01', // Thuộc reg-north
        toAgencyId: 'agency-03',   // Thuộc reg-south
        effectiveDate: new Date().toISOString().slice(0, 10),
        reason: 'Chuyển vùng công tác Nam tiến',
        currentUser: userRegDirNorth,
      });

      // Giám đốc Vùng duyệt điều chuyển ra ngoài vùng của mình -> Ném lỗi
      await expect(
        hrRepository.applyPersonnelTransfer(req.id, userRegDirNorth)
      ).rejects.toThrow('Điều chuyển nhân sự khác vùng kinh doanh bắt buộc phải do Tổng Giám Đốc (CEO) phê duyệt');

      // CEO duyệt -> Thành công
      const applyRes = await hrRepository.applyPersonnelTransfer(req.id, userCeo);
      expect(applyRes.success).toBe(true);
    });

    it('Chống tự duyệt yêu cầu điều chuyển của chính mình', async () => {
      const req = await hrRepository.createTransferRequest({
        userId: userSalesManager1.id,
        requestType: 'promotion',
        toRole: 'director',
        effectiveDate: new Date().toISOString().slice(0, 10),
        reason: 'Đề bạt Giám đốc Sàn',
        currentUser: userHrHead,
      });

      await expect(
        hrRepository.applyPersonnelTransfer(req.id, userSalesManager1)
      ).rejects.toThrow('Bạn không thể tự phê duyệt yêu cầu điều chuyển của chính mình');
    });
  });

  describe('5. Bảo Vệ Dữ Liệu PII & Khóa Cấp Bậc (Protection)', () => {
    it('CEO xem được PII toàn hệ thống không giới hạn', () => {
      expect(canViewFullPII(userCeo, 'agency-01', 'reg-north')).toBe(true);
      expect(canViewFullPII(userCeo, 'agency-03', 'reg-south')).toBe(true);
    });

    it('Giám đốc Vùng xem được PII trong vùng, không xem được ngoài vùng', () => {
      expect(canViewFullPII(userRegDirNorth, 'agency-01', 'reg-north')).toBe(true);
      expect(canViewFullPII(userRegDirNorth, 'agency-03', 'reg-south')).toBe(false);
    });

    it('Marketing và HR không xem được PII của khách hàng', () => {
      expect(canViewFullPII(userMarketingHead, 'agency-01')).toBe(false);
      expect(canViewFullPII(userHrHead, 'agency-01')).toBe(false);
    });

    it('Chống sửa hoặc xóa tài khoản của CEO và Admin', () => {
      expect(() => {
        controlledDataService.assertScopeAndPermission(userRegDirNorth, 'agency-01', userCeo);
      }).toThrow('Giám đốc Vùng không được phép sửa/xóa tài khoản của Admin hoặc Tổng Giám Đốc');

      expect(() => {
        controlledDataService.assertScopeAndPermission(userDirectorAgency1, 'agency-01', userAdmin);
      }).toThrow('Giám đốc Sàn không được phép sửa/xóa tài khoản của Admin hoặc Giám đốc Sàn khác');

      expect(() => {
        controlledDataService.assertScopeAndPermission(userAdmin, undefined, userCeo);
      }).toThrow('Không thể khóa hoặc xóa Tổng Giám Đốc (CEO) duy nhất còn lại');
    });
  });

  describe('6. Phân Quyền View Theo Nhánh & Bộ Lọc Phân Cấp (Hierarchical Branch Scoping & Cascading Filters)', () => {
    const sampleRegions: Region[] = [
      { id: 'reg-north', name: 'Vùng Miền Bắc', code: 'REG-NORTH', regional_director_id: 'user-rd-north', status: 'active', created_at: new Date().toISOString() },
      { id: 'reg-south', name: 'Vùng Miền Nam', code: 'REG-SOUTH', regional_director_id: 'user-rd-south', status: 'active', created_at: new Date().toISOString() },
    ];

    it('Marketing và HR có quyền xem toàn bộ Giám đốc Vùng và toàn bộ hệ thống như CEO', () => {
      expect(branchHierarchyService.isGlobalViewer(userAdmin)).toBe(true);
      expect(branchHierarchyService.isGlobalViewer(userCeo)).toBe(false);
      expect(branchHierarchyService.isGlobalViewer(userMarketingHead)).toBe(false);
      expect(branchHierarchyService.isGlobalViewer(userHrHead)).toBe(false);

      // Xem tất cả các Vùng
      const regionsViewByCeo = branchHierarchyService.filterRegions(userCeo, sampleRegions);
      const regionsViewByMkt = branchHierarchyService.filterRegions(userMarketingHead, sampleRegions);
      const regionsViewByHr = branchHierarchyService.filterRegions(userHrHead, sampleRegions);
      expect(regionsViewByCeo).toHaveLength(2);
      expect(regionsViewByMkt).toHaveLength(2);
      expect(regionsViewByHr).toHaveLength(2);

      // Xem tất cả các Sàn
      const agenciesViewByMkt = branchHierarchyService.filterAgencies(userMarketingHead, sampleAgencies);
      const agenciesViewByHr = branchHierarchyService.filterAgencies(userHrHead, sampleAgencies);
      expect(agenciesViewByMkt).toHaveLength(sampleAgencies.length);
      expect(agenciesViewByHr).toHaveLength(sampleAgencies.length);
    });

    it('Giám đốc Vùng chỉ xem được các Sàn và Đội Nhóm thuộc Vùng của mình', () => {
      expect(branchHierarchyService.isGlobalViewer(userRegDirNorth)).toBe(false);

      // Vùng Bắc chỉ thấy Sàn Miền Bắc (agency-01, agency-02)
      const agenciesNorth = branchHierarchyService.filterAgencies(userRegDirNorth, sampleAgencies);
      expect(agenciesNorth.every(a => a.region_id === 'reg-north')).toBe(true);
      expect(agenciesNorth.some(a => a.id === 'agency-03')).toBe(false);

      // Vùng Bắc chỉ thấy Vùng Bắc trong dropdown
      const regionsNorth = branchHierarchyService.filterRegions(userRegDirNorth, sampleRegions);
      expect(regionsNorth).toHaveLength(1);
      expect(regionsNorth[0].id).toBe('reg-north');
    });

    it('Cưỡng chế phân cấp cây nhân sự: canAccessUser từ CEO -> Giám Đốc Vùng -> Giám Đốc Sàn -> Trưởng Nhóm -> Sale', () => {
      // 1. CEO truy cập được mọi cấp
      expect(branchHierarchyService.canAccessUser(userCeo, userRegDirNorth)).toBe(true);
      expect(branchHierarchyService.canAccessUser(userCeo, userDirectorAgency1)).toBe(true);
      expect(branchHierarchyService.canAccessUser(userCeo, userTeamLeader1)).toBe(true);
      expect(branchHierarchyService.canAccessUser(userCeo, userSaleAgent1)).toBe(true);
      expect(branchHierarchyService.canAccessUser(userCeo, userMarketingHead)).toBe(true);
      expect(branchHierarchyService.canAccessUser(userCeo, userHrHead)).toBe(true);

      // 2. Giám đốc Vùng Miền Bắc xem được nhân sự thuộc Vùng Bắc, KHÔNG xem được Admin, CEO, HR, Marketing hay GĐ Vùng Nam
      expect(branchHierarchyService.canAccessUser(userRegDirNorth, userDirectorAgency1)).toBe(true);
      expect(branchHierarchyService.canAccessUser(userRegDirNorth, userTeamLeader1)).toBe(true);
      expect(branchHierarchyService.canAccessUser(userRegDirNorth, userSaleAgent1)).toBe(true);
      expect(branchHierarchyService.canAccessUser(userRegDirNorth, userAdmin)).toBe(false);
      expect(branchHierarchyService.canAccessUser(userRegDirNorth, userCeo)).toBe(false);
      expect(branchHierarchyService.canAccessUser(userRegDirNorth, userMarketingHead)).toBe(false);
      expect(branchHierarchyService.canAccessUser(userRegDirNorth, userHrHead)).toBe(false);
      expect(branchHierarchyService.canAccessUser(userRegDirNorth, userRegDirSouth)).toBe(false);

      // 3. Giám đốc Sàn 1 xem được Trưởng phòng, Trưởng nhóm và Sale thuộc Sàn 1, KHÔNG xem được GĐ Vùng, CEO, hay sàn khác
      expect(branchHierarchyService.canAccessUser(userDirectorAgency1, userSalesManager1)).toBe(true);
      expect(branchHierarchyService.canAccessUser(userDirectorAgency1, userTeamLeader1)).toBe(true);
      expect(branchHierarchyService.canAccessUser(userDirectorAgency1, userSaleAgent1)).toBe(true);
      expect(branchHierarchyService.canAccessUser(userDirectorAgency1, userRegDirNorth)).toBe(false);
      expect(branchHierarchyService.canAccessUser(userDirectorAgency1, userCeo)).toBe(false);

      // 4. Trưởng nhóm chỉ xem được Sale thuộc team của mình
      expect(branchHierarchyService.canAccessUser(userTeamLeader1, userSaleAgent1)).toBe(true);
      expect(branchHierarchyService.canAccessUser(userTeamLeader1, userDirectorAgency1)).toBe(false);

      // 5. Chuyên viên Sale chỉ xem được chính mình
      expect(branchHierarchyService.canAccessUser(userSaleAgent1, userSaleAgent1)).toBe(true);
      expect(branchHierarchyService.canAccessUser(userSaleAgent1, userTeamLeader1)).toBe(false);
    });

    it('Lọc danh sách Lead theo nhánh (filterLeads): đúng phạm vi phân cấp', () => {
      const mockLeads = [
        { id: 'lead-1', customer_name: 'Khách 1', region_id: 'reg-north', agency_id: 'agency-01', team_id: 'team-01', assigned_to: 'user-sale-01' },
        { id: 'lead-2', customer_name: 'Khách 2', region_id: 'reg-north', agency_id: 'agency-01', team_id: 'team-01', assigned_to: 'other-sale' },
        { id: 'lead-3', customer_name: 'Khách 3', region_id: 'reg-north', agency_id: 'agency-02', team_id: 'team-02', assigned_to: 'sale-ag2' },
        { id: 'lead-4', customer_name: 'Khách 4', region_id: 'reg-south', agency_id: 'agency-03', team_id: 'team-03', assigned_to: 'sale-south' },
      ];

      // CEO, HR, Marketing xem toàn bộ
      expect(branchHierarchyService.filterLeads(userCeo, mockLeads)).toHaveLength(4);
      expect(branchHierarchyService.filterLeads(userHrHead, mockLeads)).toHaveLength(4);
      expect(branchHierarchyService.filterLeads(userMarketingHead, mockLeads)).toHaveLength(4);

      // GĐ Vùng Bắc xem 3 leads thuộc Vùng Bắc
      const leadsNorth = branchHierarchyService.filterLeads(userRegDirNorth, mockLeads);
      expect(leadsNorth).toHaveLength(3);
      expect(leadsNorth.map(l => l.id)).toEqual(['lead-1', 'lead-2', 'lead-3']);

      // GĐ Sàn 1 xem 2 leads thuộc Sàn 1
      const leadsAgency1 = branchHierarchyService.filterLeads(userDirectorAgency1, mockLeads);
      expect(leadsAgency1).toHaveLength(2);
      expect(leadsAgency1.map(l => l.id)).toEqual(['lead-1', 'lead-2']);

      // Trưởng nhóm 1 xem 2 leads thuộc Team 1
      const leadsTeam1 = branchHierarchyService.filterLeads(userTeamLeader1, mockLeads);
      expect(leadsTeam1).toHaveLength(2);
      expect(leadsTeam1.map(l => l.id)).toEqual(['lead-1', 'lead-2']);

      // Sale 1 chỉ xem 1 lead được giao cho mình
      const leadsSale1 = branchHierarchyService.filterLeads(userSaleAgent1, mockLeads);
      expect(leadsSale1).toHaveLength(1);
      expect(leadsSale1[0].id).toBe('lead-1');
    });

    it('Lọc Hợp Đồng Giao Dịch theo regionId trong repository', async () => {
      const allTx = await contractRepository.getTransactions({ currentUser: userCeo });
      expect(Array.isArray(allTx)).toBe(true);

      const filteredTx = await contractRepository.getTransactions({
        regionId: 'reg-north',
        currentUser: userCeo
      });
      expect(Array.isArray(filteredTx)).toBe(true);
    });

    it('Lọc Nhân Sự HR theo regionId trong repository', async () => {
      const empsNorth = await hrRepository.getEmployees({ regionId: 'reg-north' }, userCeo);
      expect(Array.isArray(empsNorth)).toBe(true);
    });

    it('Thi đua các CEO (CEO Leaderboard): Admin xem tất cả các CEO, CEO chỉ thấy mình và không thấy CEO khác', async () => {
      const userCeo2: UserProfile = {
        ...userCeo,
        id: 'user-ceo-2',
        full_name: 'CEO Đối Thủ',
        email: 'ceo2@system.vn',
        organization_id: 'org-competitor',
      };

      const mockLeaderboardItems: LeaderboardItem[] = [
        {
          id: userCeo.id,
          name: userCeo.full_name,
          type: 'ceo',
          revenue: 100000000000,
          contracts_count: 50,
          commission: 3000000000,
        },
        {
          id: userCeo2.id,
          name: userCeo2.full_name,
          type: 'ceo',
          revenue: 80000000000,
          contracts_count: 40,
          commission: 2400000000,
        },
      ];

      // Admin xem tất cả CEO
      const adminView = branchHierarchyService.filterLeaderboardItems(userAdmin, 'ceo', mockLeaderboardItems, [], [userCeo, userCeo2]);
      expect(adminView).toHaveLength(2);

      // CEO 1 chỉ thấy chính mình, không thấy CEO 2
      const ceo1View = branchHierarchyService.filterLeaderboardItems(userCeo, 'ceo', mockLeaderboardItems, [], [userCeo, userCeo2]);
      expect(ceo1View).toHaveLength(1);
      expect(ceo1View[0].id).toBe(userCeo.id);

      // CEO 2 chỉ thấy chính mình, không thấy CEO 1
      const ceo2View = branchHierarchyService.filterLeaderboardItems(userCeo2, 'ceo', mockLeaderboardItems, [], [userCeo, userCeo2]);
      expect(ceo2View).toHaveLength(1);
      expect(ceo2View[0].id).toBe(userCeo2.id);

      // Contract repository getLeaderboard({ type: 'ceo' }) chạy thành công
      const leaderboard = await contractRepository.getLeaderboard({
        type: 'ceo',
        currentUser: userAdmin,
        includeSample: true,
      });
      expect(Array.isArray(leaderboard)).toBe(true);
      expect(leaderboard.length).toBeGreaterThan(0);
      expect(leaderboard.every(item => item.type === 'ceo')).toBe(true);
    });
  });
});
