import { describe, it, expect, beforeEach } from 'vitest';
import { UserProfile, Organization, Region, Agency, Team, Transaction } from '@/domain/types';
import { branchHierarchyService } from '@/domain/services/branchHierarchyService';
import { commissionService, CommissionEntry } from '@/domain/services/commissionService';
import { teamRepository } from '@/data/repositories/teamRepository';

describe('Quản Trị Doanh Nghiệp (Company Admin) & Multi-tenant Isolation Test Suite', () => {
  // Test Data: Enterprise A & B
  const orgA: Organization = {
    id: 'org-tenant-a',
    name: 'Công ty Cổ phần BĐS An Khang',
    code: 'ANKHANG',
    ceo_id: 'ceo-a-id',
    ceo_name: 'Nguyễn Văn An (CEO An Khang)',
    admin_id: 'admin-a-id',
    admin_name: 'Trần Admin A (Admin An Khang)',
  };

  const orgB: Organization = {
    id: 'org-tenant-b',
    name: 'Công ty Cổ phần BĐS Thịnh Vượng',
    code: 'THINHVUONG',
    ceo_id: 'ceo-b-id',
    ceo_name: 'Lê Văn Thịnh (CEO Thịnh Vượng)',
    admin_id: 'admin-b-id',
    admin_name: 'Phạm Admin B (Admin Thịnh Vượng)',
  };

  // Profiles
  const superAdmin: UserProfile = {
    id: 'super-admin-001',
    email: 'admin@system.vn',
    full_name: 'Quản Trị Tổng Hệ Thống',
    phone: '0901000000',
    role: 'admin',
    status: 'active',
    must_change_password: false,
    totp_enabled: true,
  };

  const compAdminA: UserProfile = {
    id: 'admin-a-id',
    email: 'admin@ankhang.vn',
    full_name: 'Trần Admin A',
    phone: '0901000001',
    role: 'company_admin',
    organization_id: 'org-tenant-a',
    status: 'active',
    must_change_password: false,
    totp_enabled: true,
  };

  const compAdminB: UserProfile = {
    id: 'admin-b-id',
    email: 'admin@thinhvuong.vn',
    full_name: 'Phạm Admin B',
    phone: '0901000002',
    role: 'company_admin',
    organization_id: 'org-tenant-b',
    status: 'active',
    must_change_password: false,
    totp_enabled: true,
  };

  const ceoA: UserProfile = {
    id: 'ceo-a-id',
    email: 'ceo@ankhang.vn',
    full_name: 'Nguyễn Văn An (CEO A)',
    phone: '0902000001',
    role: 'ceo',
    organization_id: 'org-tenant-a',
    status: 'active',
    must_change_password: false,
    totp_enabled: true,
  };

  const ceoB: UserProfile = {
    id: 'ceo-b-id',
    email: 'ceo@thinhvuong.vn',
    full_name: 'Lê Văn Thịnh (CEO B)',
    phone: '0902000002',
    role: 'ceo',
    organization_id: 'org-tenant-b',
    status: 'active',
    must_change_password: false,
    totp_enabled: true,
  };

  const saleA: UserProfile = {
    id: 'sale-a-01',
    email: 'sale1@ankhang.vn',
    full_name: 'Nguyễn Sale A',
    phone: '0903000001',
    role: 'sale_agent',
    organization_id: 'org-tenant-a',
    region_id: 'reg-a-01',
    agency_id: 'agency-a-01',
    team_id: 'team-a-01',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const saleB: UserProfile = {
    id: 'sale-b-01',
    email: 'sale1@thinhvuong.vn',
    full_name: 'Lê Sale B',
    phone: '0903000002',
    role: 'sale_agent',
    organization_id: 'org-tenant-b',
    region_id: 'reg-b-01',
    agency_id: 'agency-b-01',
    team_id: 'team-b-01',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const regions: Region[] = [
    { id: 'reg-a-01', organization_id: 'org-tenant-a', name: 'Vùng An Khang 1', code: 'REG-AK1', status: 'active' },
    { id: 'reg-b-01', organization_id: 'org-tenant-b', name: 'Vùng Thịnh Vượng 1', code: 'REG-TV1', status: 'active' },
  ];

  const agencies: Agency[] = [
    { id: 'agency-a-01', organization_id: 'org-tenant-a', region_id: 'reg-a-01', name: 'Sàn AK Đông', code: 'AK-DONG', status: 'active' },
    { id: 'agency-b-01', organization_id: 'org-tenant-b', region_id: 'reg-b-01', name: 'Sàn TV Tây', code: 'TV-TAY', status: 'active' },
  ];

  const teams: Team[] = [
    { id: 'team-a-01', agency_id: 'agency-a-01', name: 'Team Chiến Binh AK', code: 'TEAM-AK' },
    { id: 'team-b-01', agency_id: 'agency-b-01', name: 'Team Tiên Phong TV', code: 'TEAM-TV' },
  ];

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('crm_organizations', JSON.stringify([orgA, orgB]));
    localStorage.setItem('crm_regions', JSON.stringify(regions));
    localStorage.setItem('crm_agencies', JSON.stringify(agencies));
    localStorage.setItem('crm_teams', JSON.stringify(teams));
    localStorage.setItem('crm_profiles', JSON.stringify([superAdmin, compAdminA, compAdminB, ceoA, ceoB, saleA, saleB]));
  });

  describe('1. Quyền Tạo Tài Khoản & Phân Cấp Quản Trị (Account Creation Hierarchy)', () => {
    it('Chỉ Quản Trị Tổng (Admin) mới có quyền tạo tài khoản Company Admin', async () => {
      // 1. Super Admin tạo Company Admin -> Thành công
      const resSuper = await teamRepository.createUser({
        email: 'new.admin@test.vn',
        full_name: 'Admin Mới',
        phone: '0901999999',
        role: 'company_admin',
        organization_id: 'org-tenant-a',
      }, superAdmin);
      expect(resSuper.success).toBe(true);

      // 2. Company Admin cố tạo Company Admin khác -> Bị từ chối
      const resComp = await teamRepository.createUser({
        email: 'fake.admin@test.vn',
        full_name: 'Cố Tình Tạo Admin',
        phone: '0901999888',
        role: 'company_admin',
      }, compAdminA);
      expect(resComp.success).toBe(false);
      expect(resComp.error).toContain('Chỉ Quản Trị Tổng (Admin)');

      // 3. CEO cố tạo Company Admin -> Bị từ chối
      const resCeo = await teamRepository.createUser({
        email: 'ceo.admin@test.vn',
        full_name: 'CEO Tạo Admin',
        phone: '0901999777',
        role: 'company_admin',
      }, ceoA);
      expect(resCeo.success).toBe(false);
      expect(resCeo.error).toContain('Chỉ Quản Trị Tổng (Admin)');
    });

    it('Chỉ Quản Trị Tổng (Admin) mới có quyền tạo tài khoản CEO', async () => {
      // 1. Super Admin tạo CEO -> Thành công
      const resSuper = await teamRepository.createUser({
        email: 'new.ceo@test.vn',
        full_name: 'CEO Mới',
        phone: '0902999999',
        role: 'ceo',
        organization_id: 'org-tenant-a',
      }, superAdmin);
      expect(resSuper.success).toBe(true);

      // 2. Company Admin cố tạo CEO -> Bị từ chối
      const resComp = await teamRepository.createUser({
        email: 'fake.ceo@test.vn',
        full_name: 'Cố Tình Tạo CEO',
        phone: '0902999888',
        role: 'ceo',
      }, compAdminA);
      expect(resComp.success).toBe(false);
      expect(resComp.error).toContain('Chỉ Quản Trị Tổng (Admin)');
    });

    it('Chỉ Quản Trị Tổng (Admin) mới có quyền tạo Doanh Nghiệp (Organization)', async () => {
      // 1. Super Admin tạo Organization -> Thành công
      const resSuper = await teamRepository.createOrganization({
        name: 'Công ty Cổ phần BĐS Phúc Lộc',
        code: 'PHUCLOC',
      }, superAdmin);
      expect(resSuper.success).toBe(true);
      expect(resSuper.organization?.code).toBe('PHUCLOC');

      // 2. Company Admin cố tạo Organization -> Bị từ chối
      const resComp = await teamRepository.createOrganization({
        name: 'Doanh nghiệp Trái Phép',
      }, compAdminA);
      expect(resComp.success).toBe(false);
      expect(resComp.error).toContain('Chỉ Quản Trị Tổng (Admin)');
    });

    it('Company Admin có quyền tạo Vùng, Sàn, và User cấp dưới thuộc DN của mình', async () => {
      // 1. Company Admin tạo Vùng -> tự động gắn organization_id của DN
      const resRegion = await teamRepository.createRegion({
        name: 'Vùng An Khang Mới',
        code: 'REG-AK-NEW',
      }, compAdminA);
      expect(resRegion.success).toBe(true);
      expect(resRegion.region?.organization_id).toBe('org-tenant-a');

      // 2. Company Admin tạo Sàn -> tự động gắn organization_id của DN
      const resAgency = await teamRepository.createAgency({
        name: 'Sàn An Khang Nam',
        code: 'AK-NAM',
      }, compAdminA);
      expect(resAgency.success).toBe(true);
      expect(resAgency.agency?.organization_id).toBe('org-tenant-a');

      // 3. Company Admin tạo User (Sale, Manager, HR...) -> tự động gắn organization_id của DN
      const resUser = await teamRepository.createUser({
        email: 'new.sale.ak@ankhang.vn',
        full_name: 'Sale An Khang Mới',
        phone: '0909111222',
        role: 'sale_agent',
      }, compAdminA);
      expect(resUser.success).toBe(true);
      expect(resUser.profile?.organization_id).toBe('org-tenant-a');
    });

    it('Company Admin KHÔNG thể tạo tài khoản cho Doanh nghiệp khác', async () => {
      const resUser = await teamRepository.createUser({
        email: 'hack.cross.tenant@thinhvuong.vn',
        full_name: 'Hack Doanh Nghiệp Khác',
        phone: '0909999000',
        role: 'sale_agent',
        organization_id: 'org-tenant-b', // Cố tình gán sang DN B
      }, compAdminA);

      expect(resUser.success).toBe(false);
      expect(resUser.error).toContain('thuộc doanh nghiệp của mình');
    });
  });

  describe('2. Cô Lập Đa Khách Thuê (Multi-Tenant Scoping & Strict Isolation)', () => {
    it('Company Admin A chỉ nhìn thấy Doanh nghiệp của mình, không nhìn thấy DN khác', async () => {
      const orgsA = await teamRepository.getOrganizations(compAdminA);
      expect(orgsA.length).toBe(1);
      expect(orgsA[0].id).toBe('org-tenant-a');

      const orgsB = await teamRepository.getOrganizations(compAdminB);
      expect(orgsB.length).toBe(1);
      expect(orgsB[0].id).toBe('org-tenant-b');

      // Super Admin nhìn thấy tất cả
      const orgsAll = await teamRepository.getOrganizations(superAdmin);
      expect(orgsAll.length).toBe(2);
    });

    it('Company Admin A chỉ nhìn thấy Vùng và Sàn thuộc DN A', () => {
      const filteredRegionsA = branchHierarchyService.filterRegions(compAdminA, regions);
      expect(filteredRegionsA.length).toBe(1);
      expect(filteredRegionsA[0].id).toBe('reg-a-01');

      const filteredAgenciesA = branchHierarchyService.filterAgencies(compAdminA, agencies);
      expect(filteredAgenciesA.length).toBe(1);
      expect(filteredAgenciesA[0].id).toBe('agency-a-01');
    });

    it('Company Admin A chỉ nhìn thấy Đội nhóm và Nhân sự thuộc DN A', () => {
      const filteredTeamsA = branchHierarchyService.filterTeams(compAdminA, teams);
      expect(filteredTeamsA.length).toBe(1);
      expect(filteredTeamsA[0].id).toBe('team-a-01');

      const allProfiles = [superAdmin, compAdminA, compAdminB, ceoA, ceoB, saleA, saleB];
      const filteredProfilesA = branchHierarchyService.filterProfiles(compAdminA, allProfiles);

      // Thấy chính mình, CEO A, Sale A
      expect(filteredProfilesA.map(p => p.id)).toContain('admin-a-id');
      expect(filteredProfilesA.map(p => p.id)).toContain('ceo-a-id');
      expect(filteredProfilesA.map(p => p.id)).toContain('sale-a-01');

      // TUYỆT ĐỐI KHÔNG thấy Super Admin, Company Admin B, CEO B, hay Sale B
      expect(filteredProfilesA.map(p => p.id)).not.toContain('super-admin-001');
      expect(filteredProfilesA.map(p => p.id)).not.toContain('admin-b-id');
      expect(filteredProfilesA.map(p => p.id)).not.toContain('ceo-b-id');
      expect(filteredProfilesA.map(p => p.id)).not.toContain('sale-b-01');
    });

    it('CEO A nhìn thấy Company Admin A cùng DN nhưng không nhìn thấy Company Admin B', () => {
      expect(branchHierarchyService.canAccessUser(ceoA, compAdminA)).toBe(true);
      expect(branchHierarchyService.canAccessUser(ceoA, compAdminB)).toBe(false);
      expect(branchHierarchyService.canAccessUser(ceoB, compAdminA)).toBe(false);
      expect(branchHierarchyService.canAccessUser(ceoB, compAdminB)).toBe(true);
    });

    it('Nhân sự thường (Sale, Director, RD) không thể xem Company Admin của DN khác', () => {
      expect(branchHierarchyService.canAccessUser(saleA, compAdminA)).toBe(false);
      expect(branchHierarchyService.canAccessUser(saleA, compAdminB)).toBe(false);
    });

    it('Cô lập Giao dịch & Hợp đồng giữa các Doanh nghiệp', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx-a-01',
          code: 'TX-AK-01',
          contract_number: 'HĐ-AK-001',
          lead_id: 'lead-01',
          property_title: 'Căn hộ An Khang 101',
          project_id: 'prj-01',
          organization_id: 'org-tenant-a',
          amount: 3500000000,
          status: 'confirmed',
          commission_amount: 100000000,
          created_at: new Date().toISOString(),
        },
        {
          id: 'tx-b-01',
          code: 'TX-TV-01',
          contract_number: 'HĐ-TV-001',
          lead_id: 'lead-02',
          property_title: 'Biệt thự Thịnh Vượng Villa',
          project_id: 'prj-02',
          organization_id: 'org-tenant-b',
          amount: 12000000000,
          status: 'confirmed',
          commission_amount: 400000000,
          created_at: new Date().toISOString(),
        },
      ];

      const txA = branchHierarchyService.filterTransactions(compAdminA, transactions);
      expect(txA.length).toBe(1);
      expect(txA[0].id).toBe('tx-a-01');

      const txB = branchHierarchyService.filterTransactions(compAdminB, transactions);
      expect(txB.length).toBe(1);
      expect(txB[0].id).toBe('tx-b-01');
    });

    it('Cô lập Sổ cái Hoa hồng (Commission Ledger Entries) giữa các Doanh nghiệp', () => {
      const entries: CommissionEntry[] = [
        {
          id: 'entry-a-01',
          contract_id: 'tx-a-01',
          recipient_id: 'sale-a-01',
          recipient_name: 'Nguyễn Sale A',
          tier: 'sale',
          percent: 1.5,
          amount: 52500000,
          base_amount: 3500000000,
          status: 'eligible',
          organization_id: 'org-tenant-a',
          created_at: new Date().toISOString(),
        },
        {
          id: 'entry-b-01',
          contract_id: 'tx-b-01',
          recipient_id: 'sale-b-01',
          recipient_name: 'Lê Sale B',
          tier: 'sale',
          percent: 1.5,
          amount: 180000000,
          base_amount: 12000000000,
          status: 'eligible',
          organization_id: 'org-tenant-b',
          created_at: new Date().toISOString(),
        },
      ];

      // Company Admin A chỉ xem được hoa hồng của DN A
      expect(commissionService.canUserViewCommissionEntry(compAdminA, entries[0])).toBe(true);
      expect(commissionService.canUserViewCommissionEntry(compAdminA, entries[1])).toBe(false);

      // Company Admin B chỉ xem được hoa hồng của DN B
      expect(commissionService.canUserViewCommissionEntry(compAdminB, entries[0])).toBe(false);
      expect(commissionService.canUserViewCommissionEntry(compAdminB, entries[1])).toBe(true);

      // Super Admin xem được toàn bộ
      expect(commissionService.canUserViewCommissionEntry(superAdmin, entries[0])).toBe(true);
      expect(commissionService.canUserViewCommissionEntry(superAdmin, entries[1])).toBe(true);
    });
  });
});
