// ========================================================
// TEST SUITE: CEO SAAS TENANT ISOLATION (CÔ LẬP KHÁCH HÀNG SAAS CHO CEO)
// Đảm bảo: CEO đóng vai trò như khách hàng SaaS, chỉ xem dữ liệu liên quan đến
// nhánh của họ: GĐ vùng của họ, hợp đồng của họ, nhân sự của họ, dự án của họ;
// tuyệt đối không xem được nội dung tương tự của CEO khác.
// ========================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { projectRepository } from '@/data/repositories/projectRepository';
import { teamRepository } from '@/data/repositories/teamRepository';
import { contractRepository } from '@/data/repositories/contractRepository';
import { hrRepository } from '@/data/repositories/hrRepository';
import { branchHierarchyService } from '@/domain/services/branchHierarchyService';
import { commissionService } from '@/domain/services/commissionService';
import { 
  UserProfile, 
  Organization, 
  Region, 
  Agency, 
  Team, 
  Project, 
  Transaction, 
  CommissionEntry 
} from '@/domain/types';

describe('CEO Multi-tenant SaaS Scoping & Isolation Suite', () => {
  // Tenant A (Công ty BĐS Hoàng Gia - CEO Nguyễn Hoàng Gia)
  const orgA: Organization = {
    id: 'tenant-a-org',
    name: 'Tập đoàn BĐS Hoàng Gia',
    code: 'HOANG_GIA',
    ceo_id: 'ceo-user-a',
    status: 'active',
  };

  const ceoA: UserProfile = {
    id: 'ceo-user-a',
    email: 'ceo.a@hoanggia.vn',
    full_name: 'Nguyễn Hoàng Gia (CEO Hoàng Gia)',
    phone: '0901111111',
    role: 'ceo',
    organization_id: 'tenant-a-org',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const rdA: UserProfile = {
    id: 'rd-user-a',
    email: 'rd.a@hoanggia.vn',
    full_name: 'Trần Vùng A (GĐ Vùng Hoàng Gia)',
    phone: '0901111112',
    role: 'regional_director',
    organization_id: 'tenant-a-org',
    region_id: 'region-a',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const saleA: UserProfile = {
    id: 'sale-user-a',
    email: 'sale.a@hoanggia.vn',
    full_name: 'Lê Sale A (Chuyên Viên Hoàng Gia)',
    phone: '0901111113',
    role: 'sale_agent',
    organization_id: 'tenant-a-org',
    agency_id: 'agency-a',
    team_id: 'team-a',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  // Tenant B (Công ty BĐS Thịnh Vượng - CEO Phạm Thịnh Vượng)
  const orgB: Organization = {
    id: 'tenant-b-org',
    name: 'Tập đoàn BĐS Thịnh Vượng',
    code: 'THINH_VUONG',
    ceo_id: 'ceo-user-b',
    status: 'active',
  };

  const ceoB: UserProfile = {
    id: 'ceo-user-b',
    email: 'ceo.b@thinhvuong.vn',
    full_name: 'Phạm Thịnh Vượng (CEO Thịnh Vượng)',
    phone: '0902222222',
    role: 'ceo',
    organization_id: 'tenant-b-org',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const rdB: UserProfile = {
    id: 'rd-user-b',
    email: 'rd.b@thinhvuong.vn',
    full_name: 'Đặng Vùng B (GĐ Vùng Thịnh Vượng)',
    phone: '0902222223',
    role: 'regional_director',
    organization_id: 'tenant-b-org',
    region_id: 'region-b',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const saleB: UserProfile = {
    id: 'sale-user-b',
    email: 'sale.b@thinhvuong.vn',
    full_name: 'Hoàng Sale B (Chuyên Viên Thịnh Vượng)',
    phone: '0902222224',
    role: 'sale_agent',
    organization_id: 'tenant-b-org',
    agency_id: 'agency-b',
    team_id: 'team-b',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  // Admin Kỹ Thuật Hệ Thống (isGlobalViewer = true)
  const adminUser: UserProfile = {
    id: 'admin-super-01',
    email: 'admin@platform.vn',
    full_name: 'Quản Trị Viên Nền Tảng',
    phone: '0900000000',
    role: 'admin',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  // Vùng, Sàn, Team của 2 bên
  const regionA: Region = {
    id: 'region-a',
    organization_id: 'tenant-a-org',
    name: 'Vùng Kinh Doanh Hoàng Gia Đông',
    code: 'REG-HG-DONG',
    regional_director_id: 'rd-user-a',
    status: 'active',
  };

  const regionB: Region = {
    id: 'region-b',
    organization_id: 'tenant-b-org',
    name: 'Vùng Kinh Doanh Thịnh Vượng Tây',
    code: 'REG-TV-TAY',
    regional_director_id: 'rd-user-b',
    status: 'active',
  };

  const agencyA: Agency = {
    id: 'agency-a',
    organization_id: 'tenant-a-org',
    region_id: 'region-a',
    name: 'Sàn Hoàng Gia Quận 1',
    code: 'S-HG-Q1',
    status: 'active',
  };

  const agencyB: Agency = {
    id: 'agency-b',
    organization_id: 'tenant-b-org',
    region_id: 'region-b',
    name: 'Sàn Thịnh Vượng Quận 7',
    code: 'S-TV-Q7',
    status: 'active',
  };

  const teamA: Team = {
    id: 'team-a',
    organization_id: 'tenant-a-org',
    agency_id: 'agency-a',
    code: 'TEAM-A',
    name: 'Team Chiến Binh Hoàng Gia',
  };

  const teamB: Team = {
    id: 'team-b',
    organization_id: 'tenant-b-org',
    agency_id: 'agency-b',
    code: 'TEAM-B',
    name: 'Team Tiên Phong Thịnh Vượng',
  };

  // Dự án của 2 bên
  const projectA: Project = {
    id: 'proj-hg-01',
    organization_id: 'tenant-a-org',
    name: 'Royal Palace Quận 1 (Hoàng Gia)',
    code: 'ROYAL-Q1',
    developer: 'Hoàng Gia Group',
    location: 'Quận 1, TP.HCM',
    property_type: 'Căn hộ cao cấp',
    status: 'opening',
    commission_rate: 3.5,
  };

  const projectB: Project = {
    id: 'proj-tv-02',
    organization_id: 'tenant-b-org',
    name: 'Prosperity Valley (Thịnh Vượng)',
    code: 'PROSP-Q7',
    developer: 'Thịnh Vượng Corp',
    location: 'Quận 7, TP.HCM',
    property_type: 'Biệt thự ven sông',
    status: 'opening',
    commission_rate: 4.0,
  };

  // Hợp đồng của 2 bên
  const contractA: Transaction = {
    id: 'tx-hg-001',
    type: 'contract',
    code: 'HD-HG-001',
    contract_code: 'HD-HG-001',
    lead_id: 'lead-hg-01',
    organization_id: 'tenant-a-org',
    ceo_id: 'ceo-user-a',
    region_id: 'region-a',
    agency_id: 'agency-a',
    team_id: 'team-a',
    sale_id: 'sale-user-a',
    customer_name: 'Khách Hoàng Gia',
    deal_value: 5000000000,
    amount: 5000000000,
    commission_amount: 175000000,
    sale_commission_amount: 75000000,
    status: 'confirmed',
    transaction_date: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  const contractB: Transaction = {
    id: 'tx-tv-002',
    type: 'contract',
    code: 'HD-TV-002',
    contract_code: 'HD-TV-002',
    lead_id: 'lead-tv-02',
    organization_id: 'tenant-b-org',
    ceo_id: 'ceo-user-b',
    region_id: 'region-b',
    agency_id: 'agency-b',
    team_id: 'team-b',
    sale_id: 'sale-user-b',
    customer_name: 'Khách Thịnh Vượng',
    deal_value: 8000000000,
    amount: 8000000000,
    commission_amount: 320000000,
    sale_commission_amount: 120000000,
    status: 'confirmed',
    transaction_date: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  // Bút toán hoa hồng
  const commEntryA: CommissionEntry = {
    id: 'entry-hg-01',
    contract_id: 'tx-hg-001',
    organization_id: 'tenant-a-org',
    recipient_id: 'ceo-user-a',
    recipient_role: 'ceo',
    tier: 'ceo',
    rate_percent: 0.05,
    amount: 2500000,
    status: 'eligible',
    created_at: new Date().toISOString(),
  };

  const commEntryB: CommissionEntry = {
    id: 'entry-tv-02',
    contract_id: 'tx-tv-002',
    organization_id: 'tenant-b-org',
    recipient_id: 'ceo-user-b',
    recipient_role: 'ceo',
    tier: 'ceo',
    rate_percent: 0.05,
    amount: 4000000,
    status: 'eligible',
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('crm_organizations', JSON.stringify([orgA, orgB]));
    localStorage.setItem('crm_profiles', JSON.stringify([adminUser, ceoA, rdA, saleA, ceoB, rdB, saleB]));
    localStorage.setItem('crm_regions', JSON.stringify([regionA, regionB]));
    localStorage.setItem('crm_agencies', JSON.stringify([agencyA, agencyB]));
    localStorage.setItem('crm_teams', JSON.stringify([teamA, teamB]));
    localStorage.setItem('crm_projects', JSON.stringify([projectA, projectB]));
    localStorage.setItem('crm_transactions', JSON.stringify([contractA, contractB]));
    localStorage.setItem('crm_commission_entries', JSON.stringify([commEntryA, commEntryB]));
  });

  // ==========================================
  // 1. DỰ ÁN CỦA CEO (PROJECT ISOLATION)
  // ==========================================
  describe('1. Dự án của họ (Project Isolation)', () => {
    it('CEO A chỉ xem được danh sách dự án thuộc tổ chức của mình, không thấy dự án của CEO B', async () => {
      const projectsForCeoA = await projectRepository.getProjects(ceoA);
      expect(projectsForCeoA.length).toBe(1);
      expect(projectsForCeoA[0].id).toBe('proj-hg-01');
      expect(projectsForCeoA[0].name).toBe('Royal Palace Quận 1 (Hoàng Gia)');
      expect(projectsForCeoA.some(p => p.id === 'proj-tv-02')).toBe(false);
    });

    it('CEO B chỉ xem được dự án của mình, không thấy dự án của CEO A', async () => {
      const projectsForCeoB = await projectRepository.getProjects(ceoB);
      expect(projectsForCeoB.length).toBe(1);
      expect(projectsForCeoB[0].id).toBe('proj-tv-02');
      expect(projectsForCeoB.some(p => p.id === 'proj-hg-01')).toBe(false);
    });

    it('Admin xem được toàn bộ dự án của tất cả các CEO/Tenant', async () => {
      const allProjects = await projectRepository.getProjects(adminUser);
      expect(allProjects.length).toBe(2);
      expect(allProjects.some(p => p.id === 'proj-hg-01')).toBe(true);
      expect(allProjects.some(p => p.id === 'proj-tv-02')).toBe(true);
    });

    it('Truy cập trực tiếp getProjectById của dự án CEO khác sẽ trả về null (bị chặn truy cập)', async () => {
      const accessibleByOwner = await projectRepository.getProjectById('proj-hg-01', ceoA);
      expect(accessibleByOwner).not.toBeNull();
      expect(accessibleByOwner?.id).toBe('proj-hg-01');

      // CEO B cố tình truy vấn dự án của CEO A
      const blockedForCompetitor = await projectRepository.getProjectById('proj-hg-01', ceoB);
      expect(blockedForCompetitor).toBeNull();
    });

    it('Khi CEO tạo dự án mới, hệ thống tự động gắn organization_id của CEO đó', async () => {
      const newProj = await projectRepository.createProject({
        name: 'Dự Án Mới Hoàng Gia',
        code: 'HG-NEW',
        developer: 'Hoàng Gia',
      }, ceoA);

      expect(newProj.organization_id).toBe('tenant-a-org');

      // Kiểm tra danh sách của CEO A có dự án này, nhưng CEO B thì không
      const listA = await projectRepository.getProjects(ceoA);
      expect(listA.some(p => p.id === newProj.id)).toBe(true);

      const listB = await projectRepository.getProjects(ceoB);
      expect(listB.some(p => p.id === newProj.id)).toBe(false);
    });
  });

  // ==========================================
  // 2. GIÁM ĐỐC VÙNG & CÁC VÙNG CỦA CEO (REGION & RD ISOLATION)
  // ==========================================
  describe('2. Giám đốc Vùng & Các Vùng của họ (Region & Regional Director Isolation)', () => {
    it('CEO A chỉ xem được các vùng kinh doanh thuộc tổ chức của mình', async () => {
      const regionsForCeoA = await teamRepository.getRegions(ceoA);
      expect(regionsForCeoA.length).toBe(1);
      expect(regionsForCeoA[0].id).toBe('region-a');
      expect(regionsForCeoA[0].code).toBe('REG-HG-DONG');
      expect(regionsForCeoA.some(r => r.id === 'region-b')).toBe(false);
    });

    it('CEO B chỉ xem được các vùng kinh doanh của mình, không thấy vùng của CEO A', async () => {
      const regionsForCeoB = await teamRepository.getRegions(ceoB);
      expect(regionsForCeoB.length).toBe(1);
      expect(regionsForCeoB[0].id).toBe('region-b');
      expect(regionsForCeoB.some(r => r.id === 'region-a')).toBe(false);
    });

    it('Admin xem được toàn bộ các vùng của tất cả CEO', async () => {
      const allRegions = await teamRepository.getRegions(adminUser);
      expect(allRegions.length).toBe(2);
      expect(allRegions.some(r => r.id === 'region-a')).toBe(true);
      expect(allRegions.some(r => r.id === 'region-b')).toBe(true);
    });

    it('canAccessRegion từ chối khi CEO truy cập vùng của CEO khác', () => {
      expect(branchHierarchyService.canAccessRegion(ceoA, 'region-a')).toBe(true);
      expect(branchHierarchyService.canAccessRegion(ceoA, 'region-b')).toBe(false);
      expect(branchHierarchyService.canAccessRegion(ceoB, 'region-a')).toBe(false);
      expect(branchHierarchyService.canAccessRegion(ceoB, 'region-b')).toBe(true);
      expect(branchHierarchyService.canAccessRegion(adminUser, 'region-b')).toBe(true);
    });
  });

  // ==========================================
  // 3. NHÂN SỰ CỦA CEO (PERSONNEL & PROFILES ISOLATION)
  // ==========================================
  describe('3. Nhân sự của họ (Personnel Isolation)', () => {
    it('CEO A chỉ xem được nhân sự trong tổ chức của mình (GĐ vùng, Sale, HR...) và chính mình', async () => {
      const profilesForCeoA = await teamRepository.getProfiles(undefined, undefined, ceoA);
      const profileIds = profilesForCeoA.map(p => p.id);

      expect(profileIds).toContain('ceo-user-a');
      expect(profileIds).toContain('rd-user-a');
      expect(profileIds).toContain('sale-user-a');

      // TUYỆT ĐỐI KHÔNG chứa CEO B hay nhân sự của CEO B
      expect(profileIds).not.toContain('ceo-user-b');
      expect(profileIds).not.toContain('rd-user-b');
      expect(profileIds).not.toContain('sale-user-b');

      // TUYỆT ĐỐI KHÔNG chứa Admin
      expect(profileIds).not.toContain('admin-super-01');
    });

    it('CEO B chỉ xem được nhân sự của tổ chức B, không thấy bất kỳ ai của tổ chức A', async () => {
      const profilesForCeoB = await teamRepository.getProfiles(undefined, undefined, ceoB);
      const profileIds = profilesForCeoB.map(p => p.id);

      expect(profileIds).toContain('ceo-user-b');
      expect(profileIds).toContain('rd-user-b');
      expect(profileIds).toContain('sale-user-b');

      expect(profileIds).not.toContain('ceo-user-a');
      expect(profileIds).not.toContain('rd-user-a');
      expect(profileIds).not.toContain('sale-user-a');
    });

    it('Admin xem được toàn bộ nhân sự của tất cả các tổ chức', async () => {
      const allProfiles = await teamRepository.getProfiles(undefined, undefined, adminUser);
      expect(allProfiles.length).toBe(7);
    });

    it('CEO A cố tình xem hồ sơ 360 của nhân sự thuộc CEO B sẽ bị chặn với lỗi từ chối truy cập', async () => {
      await expect(hrRepository.getEmployee360Profile('sale-user-b', ceoA))
        .rejects
        .toThrow('Từ chối truy cập: Nhân sự này không thuộc nhánh quản lý của bạn.');
    });

    it('CEO A xem hồ sơ 360 của nhân sự trong nhánh mình thành công', async () => {
      const emp360 = await hrRepository.getEmployee360Profile('sale-user-a', ceoA);
      expect(emp360.profile.id).toBe('sale-user-a');
      expect(emp360.profile.full_name).toBe('Lê Sale A (Chuyên Viên Hoàng Gia)');
    });
  });

  // ==========================================
  // 4. HỢP ĐỒNG CỦA CEO (CONTRACTS & TRANSACTIONS ISOLATION)
  // ==========================================
  describe('4. Hợp đồng của họ (Contracts & Transactions Isolation)', () => {
    it('CEO A chỉ xem được hợp đồng phát sinh trong nhánh của mình', async () => {
      const txsForCeoA = await contractRepository.getTransactions({ currentUser: ceoA });
      expect(txsForCeoA.length).toBe(1);
      expect(txsForCeoA[0].id).toBe('tx-hg-001');
      expect(txsForCeoA[0].customer_name).toBe('Khách Hoàng Gia');
      expect(txsForCeoA.some(t => t.id === 'tx-tv-002')).toBe(false);
    });

    it('CEO B chỉ xem được hợp đồng của tổ chức B', async () => {
      const txsForCeoB = await contractRepository.getTransactions({ currentUser: ceoB });
      expect(txsForCeoB.length).toBe(1);
      expect(txsForCeoB[0].id).toBe('tx-tv-002');
      expect(txsForCeoB[0].customer_name).toBe('Khách Thịnh Vượng');
      expect(txsForCeoB.some(t => t.id === 'tx-hg-001')).toBe(false);
    });

    it('Admin xem được tất cả hợp đồng của cả 2 CEO', async () => {
      const allTxs = await contractRepository.getTransactions({ currentUser: adminUser });
      expect(allTxs.length).toBe(2);
      expect(allTxs.some(t => t.id === 'tx-hg-001')).toBe(true);
      expect(allTxs.some(t => t.id === 'tx-tv-002')).toBe(true);
    });
  });

  // ==========================================
  // 5. THU NHẬP & SỔ CÁI HOA HỒNG (COMMISSION ISOLATION)
  // ==========================================
  describe('5. Thu nhập & Sổ cái Hoa hồng (Commission & Income Isolation)', () => {
    it('CEO A chỉ xem được dòng sổ cái hoa hồng thuộc tổ chức A, không thấy của CEO B', async () => {
      const summaryA = await contractRepository.getIncomeSummary({}, ceoA);
      expect(summaryA.filteredEntries.length).toBe(1);
      expect(summaryA.filteredEntries[0].id).toBe('entry-hg-01');
      expect(summaryA.filteredEntries[0].recipient_id).toBe('ceo-user-a');
      expect(summaryA.filteredEntries.some(e => e.id === 'entry-tv-02')).toBe(false);
    });

    it('CEO B chỉ xem được dòng sổ cái của tổ chức B', async () => {
      const summaryB = await contractRepository.getIncomeSummary({}, ceoB);
      expect(summaryB.filteredEntries.length).toBe(1);
      expect(summaryB.filteredEntries[0].id).toBe('entry-tv-02');
      expect(summaryB.filteredEntries[0].recipient_id).toBe('ceo-user-b');
      expect(summaryB.filteredEntries.some(e => e.id === 'entry-hg-01')).toBe(false);
    });

    it('canUserViewCommissionEntry từ chối khi CEO A cố tình xem dòng của CEO B', () => {
      expect(commissionService.canUserViewCommissionEntry(ceoA, commEntryA)).toBe(true);
      expect(commissionService.canUserViewCommissionEntry(ceoA, commEntryB)).toBe(false);
      expect(commissionService.canUserViewCommissionEntry(ceoB, commEntryA)).toBe(false);
      expect(commissionService.canUserViewCommissionEntry(ceoB, commEntryB)).toBe(true);
      expect(commissionService.canUserViewCommissionEntry(adminUser, commEntryB)).toBe(true);
    });
  });

  // ==========================================
  // 6. BẢNG THI ĐUA & HIỆU SUẤT (LEADERBOARD ISOLATION)
  // ==========================================
  describe('6. Bảng Thi Đua & Hiệu Suất (Leaderboard Isolation)', () => {
    it('Tab "Thi Đua Các CEO": CEO A chỉ thấy chính mình, không lộ số liệu của CEO B', async () => {
      const lbCeoA = await contractRepository.getLeaderboard({
        type: 'ceo',
        currentUser: ceoA,
      });

      expect(lbCeoA.length).toBe(1);
      expect(lbCeoA[0].id).toBe('ceo-user-a');
      expect(lbCeoA.some(item => item.id === 'ceo-user-b')).toBe(false);
    });

    it('Tab "Thi Đua Các Vùng": CEO A chỉ thấy các vùng thuộc nhánh Hoàng Gia', async () => {
      const lbRegionA = await contractRepository.getLeaderboard({
        type: 'region',
        currentUser: ceoA,
      });

      expect(lbRegionA.length).toBe(1);
      expect(lbRegionA[0].id).toBe('region-a');
      expect(lbRegionA.some(item => item.id === 'region-b')).toBe(false);
    });

    it('Tab "Thi Đua Các Sàn": CEO A chỉ thấy các sàn thuộc nhánh Hoàng Gia', async () => {
      const lbAgencyA = await contractRepository.getLeaderboard({
        type: 'agency',
        currentUser: ceoA,
      });

      expect(lbAgencyA.length).toBe(1);
      expect(lbAgencyA[0].id).toBe('agency-a');
      expect(lbAgencyA.some(item => item.id === 'agency-b')).toBe(false);
    });

    it('Tab "Thi Đua Đội Nhóm": CEO A chỉ thấy các đội nhóm thuộc Hoàng Gia', async () => {
      const lbTeamA = await contractRepository.getLeaderboard({
        type: 'team',
        currentUser: ceoA,
      });

      expect(lbTeamA.length).toBe(1);
      expect(lbTeamA[0].id).toBe('team-a');
      expect(lbTeamA.some(item => item.id === 'team-b')).toBe(false);
    });

    it('Tab "Chuyên Viên Tư Vấn": CEO A chỉ thấy Sale thuộc tổ chức mình', async () => {
      const lbSaleA = await contractRepository.getLeaderboard({
        type: 'sale_agent',
        currentUser: ceoA,
      });

      expect(lbSaleA.length).toBe(1);
      expect(lbSaleA[0].id).toBe('sale-user-a');
      expect(lbSaleA.some(item => item.id === 'sale-user-b')).toBe(false);
    });

    it('Admin xem được đầy đủ tất cả các CEO và đơn vị trên Leaderboard', async () => {
      const lbCeoAdmin = await contractRepository.getLeaderboard({
        type: 'ceo',
        currentUser: adminUser,
      });

      expect(lbCeoAdmin.length).toBe(2);
      expect(lbCeoAdmin.some(item => item.id === 'ceo-user-a')).toBe(true);
      expect(lbCeoAdmin.some(item => item.id === 'ceo-user-b')).toBe(true);
    });
  });

  // ==========================================
  // 7. TỔ CHỨC / DOANH NGHIỆP (ORGANIZATIONS ISOLATION)
  // ==========================================
  describe('7. Tổ chức / Doanh nghiệp (Organizations Isolation)', () => {
    it('CEO A chỉ thấy tổ chức của mình trong danh sách doanh nghiệp', async () => {
      const orgsForCeoA = await teamRepository.getOrganizations(ceoA);
      expect(orgsForCeoA.length).toBe(1);
      expect(orgsForCeoA[0].id).toBe('tenant-a-org');
      expect(orgsForCeoA.some(o => o.id === 'tenant-b-org')).toBe(false);
    });

    it('Admin thấy tất cả doanh nghiệp trong hệ thống', async () => {
      const allOrgs = await teamRepository.getOrganizations(adminUser);
      expect(allOrgs.length).toBe(2);
      expect(allOrgs.some(o => o.id === 'tenant-a-org')).toBe(true);
      expect(allOrgs.some(o => o.id === 'tenant-b-org')).toBe(true);
    });
  });
});
