import { describe, it, expect, beforeEach } from 'vitest';
import { UserProfile, Organization, Region, Agency, Team, Transaction, CommissionEntry } from '@/domain/types';
import { branchHierarchyService } from '@/domain/services/branchHierarchyService';
import { commissionService } from '@/domain/services/commissionService';
import { teamRepository } from '@/data/repositories/teamRepository';
import { hrRepository } from '@/data/repositories/hrRepository';

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

    it('Quản Trị Doanh Nghiệp (Company Admin) có quyền tạo tài khoản CEO cho DN của mình, cấp dưới không thể tạo', async () => {
      // 1. Super Admin tạo CEO -> Thành công
      const resSuper = await teamRepository.createUser({
        email: 'new.ceo@test.vn',
        full_name: 'CEO Mới Super',
        phone: '0902999999',
        role: 'ceo',
        organization_id: 'org-tenant-a',
      }, superAdmin);
      expect(resSuper.success).toBe(true);

      // 2. Company Admin tạo CEO cho DN của mình -> Thành công và tự động gán org-tenant-a
      const resComp = await teamRepository.createUser({
        email: 'ceo.tenant.a@test.vn',
        full_name: 'CEO Doanh Nghiệp A',
        phone: '0902999888',
        role: 'ceo',
      }, compAdminA);
      expect(resComp.success).toBe(true);
      expect(resComp.profile?.organization_id).toBe('org-tenant-a');

      // 3. Company Admin cố tạo CEO cho Doanh Nghiệp B -> Bị từ chối
      const resCompCross = await teamRepository.createUser({
        email: 'ceo.tenant.b@test.vn',
        full_name: 'CEO Cross Tenant',
        phone: '0902999777',
        role: 'ceo',
        organization_id: 'org-tenant-b',
      }, compAdminA);
      expect(resCompCross.success).toBe(false);
      expect(resCompCross.error).toContain('thuộc doanh nghiệp của mình');

      // 4. Cấp dưới (Sale) cố tạo CEO -> Bị từ chối
      const resSale = await teamRepository.createUser({
        email: 'fake.ceo@test.vn',
        full_name: 'Sale Tạo CEO',
        phone: '0902999666',
        role: 'ceo',
      }, saleA);
      expect(resSale.success).toBe(false);
      expect(resSale.error).toContain('Chỉ Quản Trị Tổng (Admin) hoặc Quản Trị Doanh Nghiệp');
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
          contract_code: 'HĐ-AK-001',
          type: 'contract',
          lead_id: 'lead-01',
          organization_id: 'org-tenant-a',
          amount: 3500000000,
          transaction_date: new Date().toISOString(),
          status: 'confirmed',
          commission_amount: 100000000,
          created_at: new Date().toISOString(),
        },
        {
          id: 'tx-b-01',
          code: 'TX-TV-01',
          contract_code: 'HĐ-TV-001',
          type: 'contract',
          lead_id: 'lead-02',
          organization_id: 'org-tenant-b',
          amount: 12000000000,
          transaction_date: new Date().toISOString(),
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
          recipient_role: 'sale',
          tier: 'sale',
          rate_percent: 1.5,
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
          recipient_role: 'sale',
          tier: 'sale',
          rate_percent: 1.5,
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

  // ==========================================
  // 3. TẠO & BỔ NHIỆM QUẢN TRỊ DOANH NGHIỆP (COMPANY ADMIN ASSIGNMENT)
  // ==========================================
  describe('3. Tạo & Bổ nhiệm Quản Trị Doanh Nghiệp (Enterprise Admin Assignment)', () => {
    it('Tạo Quản Trị Doanh Nghiệp bắt buộc phải chọn Doanh nghiệp để gán', async () => {
      // 1. Super Admin tạo company_admin nhưng thiếu organization_id -> Bị từ chối
      const res = await teamRepository.createUser({
        email: 'missing.org.admin@test.vn',
        full_name: 'Admin Không DN',
        phone: '0901234567',
        role: 'company_admin',
        // thiếu organization_id
      }, superAdmin);

      expect(res.success).toBe(false);
      expect(res.error).toContain('bắt buộc phải chọn Doanh nghiệp');
    });

    it('Super Admin tạo Quản Trị Doanh Nghiệp hợp lệ -> Tự động gán vào Organization admin_id', async () => {
      // Chuẩn bị organization trong storage
      const orgRes = await teamRepository.createOrganization({
        name: 'Công ty Cổ phần BĐS Nam Á',
        code: 'NAMA',
      }, superAdmin);
      expect(orgRes.success).toBe(true);
      const targetOrg = orgRes.organization!;

      // Super Admin tạo company_admin có organization_id
      const res = await teamRepository.createUser({
        email: 'admin.nama@test.vn',
        full_name: 'Nguyễn Quản Trị Nam Á',
        phone: '0908889999',
        role: 'company_admin',
        organization_id: targetOrg.id,
      }, superAdmin);

      expect(res.success).toBe(true);
      expect(res.profile?.role).toBe('company_admin');
      expect(res.profile?.organization_id).toBe(targetOrg.id);

      // Kiểm tra organization đã được cập nhật admin_id
      const orgs = await teamRepository.getOrganizations();
      const updatedOrg = orgs.find(o => o.id === targetOrg.id);
      expect(updatedOrg?.admin_id).toBe(res.profile?.id);
    });

    it('Super Admin bổ nhiệm nhân sự có sẵn làm Quản Trị Doanh Nghiệp qua assignOrganizationAdmin', async () => {
      // Tạo một nhân viên sale trước
      const saleRes = await teamRepository.createUser({
        email: 'staff.to.admin@test.vn',
        full_name: 'Nhân Viên Tiềm Năng',
        phone: '0907776655',
        role: 'sale_agent',
      }, superAdmin);
      expect(saleRes.success).toBe(true);
      const staffUser = saleRes.profile!;

      // Bổ nhiệm nhân sự này làm Quản Trị DN cho orgA
      const assignRes = await teamRepository.assignOrganizationAdmin(
        orgA.id,
        staffUser.id,
        superAdmin
      );
      expect(assignRes.success).toBe(true);

      // Kiểm tra profile đã được nâng lên company_admin và gán vào orgA
      const profiles = await teamRepository.getProfiles();
      const updatedProfile = profiles.find(p => p.id === staffUser.id);
      expect(updatedProfile?.role).toBe('company_admin');
      expect(updatedProfile?.organization_id).toBe(orgA.id);

      // Kiểm tra organization đã nhận admin_id mới
      const orgs = await teamRepository.getOrganizations();
      const updatedOrg = orgs.find(o => o.id === orgA.id);
      expect(updatedOrg?.admin_id).toBe(staffUser.id);
    });

    it('Non-admin (Company Admin, CEO, Sale...) KHÔNG có quyền bổ nhiệm Quản Trị Doanh Nghiệp', async () => {
      // Company Admin thử bổ nhiệm
      const res1 = await teamRepository.assignOrganizationAdmin(
        orgA.id,
        saleA.id,
        compAdminA
      );
      expect(res1.success).toBe(false);
      expect(res1.error).toContain('Chỉ Quản Trị Tổng (Admin)');

      // CEO thử bổ nhiệm
      const res2 = await teamRepository.assignOrganizationAdmin(
        orgA.id,
        saleA.id,
        ceoA
      );
      expect(res2.success).toBe(false);
      expect(res2.error).toContain('Chỉ Quản Trị Tổng (Admin)');

      // Nhân sự thường thử bổ nhiệm
      const res3 = await teamRepository.assignOrganizationAdmin(
        orgA.id,
        saleA.id,
        saleA
      );
      expect(res3.success).toBe(false);
      expect(res3.error).toContain('Chỉ Quản Trị Tổng (Admin)');
    });

    it('assignOrganizationAdmin từ chối khi thiếu organizationId hoặc adminUserId', async () => {
      const res1 = await teamRepository.assignOrganizationAdmin('', 'user-123', superAdmin);
      expect(res1.success).toBe(false);
      expect(res1.error).toContain('Thiếu thông tin');

      const res2 = await teamRepository.assignOrganizationAdmin('org-123', '', superAdmin);
      expect(res2.success).toBe(false);
      expect(res2.error).toContain('Thiếu thông tin');
    });

    it('Quy trình tuần tự 3 bước: 1. Tạo Doanh Nghiệp -> 2. Tạo Quản Trị DN -> 3. Bổ nhiệm Tổng Giám Đốc (CEO)', async () => {
      // BƯỚC 1: Quản Trị Tổng tạo Doanh Nghiệp mới độc lập (chưa có CEO hay Admin)
      const orgRes = await teamRepository.createOrganization({
        name: 'Tập Đoàn BĐS Maicom Holdings',
        tax_number: '0312984729',
        phone: '02877778888',
        email: 'contact@maicom.vn',
        address: 'Tòa nhà Bitexco, Q.1, TP.HCM',
      }, superAdmin);

      expect(orgRes.success).toBe(true);
      expect(orgRes.organization).toBeDefined();
      expect(orgRes.organization?.code).toContain('ORG-');
      expect(orgRes.organization?.admin_id).toBeUndefined();
      expect(orgRes.organization?.ceo_id).toBeUndefined();

      const createdOrgId = orgRes.organization!.id;

      // BƯỚC 2: Quản Trị Tổng tạo mới tài khoản Quản Trị Doanh Nghiệp (company_admin)
      const adminUserRes = await teamRepository.createUser({
        full_name: 'Trần Văn Quản Trị Maicom',
        email: 'admin.maicom@maicom.vn',
        phone: '0912345678',
        role: 'company_admin',
        organization_id: createdOrgId,
      }, superAdmin);

      expect(adminUserRes.success).toBe(true);
      expect(adminUserRes.profile).toBeDefined();
      expect(adminUserRes.profile?.role).toBe('company_admin');
      expect(adminUserRes.profile?.organization_id).toBe(createdOrgId);

      // Kiểm tra Doanh nghiệp đã được cập nhật admin_id
      const orgsAfterStep2 = await teamRepository.getOrganizations();
      const updatedOrgStep2 = orgsAfterStep2.find(o => o.id === createdOrgId);
      expect(updatedOrgStep2?.admin_id).toBe(adminUserRes.profile?.id);

      // BƯỚC 3: Quản Trị Tổng tạo mới và bổ nhiệm Tổng Giám Đốc (CEO) cho Doanh nghiệp
      const ceoUserRes = await teamRepository.createUser({
        full_name: 'Lê Văn CEO Maicom',
        email: 'ceo.maicom@maicom.vn',
        phone: '0918889999',
        role: 'ceo',
        organization_id: createdOrgId,
      }, superAdmin);

      expect(ceoUserRes.success).toBe(true);
      expect(ceoUserRes.profile).toBeDefined();
      expect(ceoUserRes.profile?.role).toBe('ceo');
      expect(ceoUserRes.profile?.organization_id).toBe(createdOrgId);

      // Kiểm tra Doanh nghiệp đã được cập nhật ceo_id
      const orgsAfterStep3 = await teamRepository.getOrganizations();
      const updatedOrgStep3 = orgsAfterStep3.find(o => o.id === createdOrgId);
      expect(updatedOrgStep3?.ceo_id).toBe(ceoUserRes.profile?.id);
    });

    it('assignOrganizationCEO: Super Admin có quyền bổ nhiệm hoặc đổi CEO cho Doanh Nghiệp', async () => {
      // Tạo user tiềm năng
      const staffRes = await teamRepository.createUser({
        full_name: 'Phan Thị Giám Đốc',
        email: 'phan.giamdoc@diaocvang.vn',
        phone: '0901234567',
        role: 'sale_agent',
      }, superAdmin);
      expect(staffRes.success).toBe(true);

      // Super Admin bổ nhiệm làm CEO cho Doanh nghiệp A
      const assignRes = await teamRepository.assignOrganizationCEO(
        orgA.id,
        staffRes.profile!.id,
        superAdmin
      );
      expect(assignRes.success).toBe(true);

      // Kiểm tra vai trò của user chuyển sang 'ceo' và thuộc về orgA
      const profiles = await teamRepository.getProfiles();
      const promotedUser = profiles.find(p => p.id === staffRes.profile!.id);
      expect(promotedUser?.role).toBe('ceo');
      expect(promotedUser?.organization_id).toBe(orgA.id);

      // Kiểm tra người không phải Admin không thể gọi assignOrganizationCEO
      const failRes = await teamRepository.assignOrganizationCEO(
        orgA.id,
        staffRes.profile!.id,
        compAdminA
      );
      expect(failRes.success).toBe(false);
      expect(failRes.error).toContain('Chỉ Quản Trị Tổng (Admin)');
    });

    it('Company Admin KHÔNG có quyền thay đổi vai trò (role) của tài khoản Company Admin', async () => {
      // 1. Tạo tài khoản Company Admin trong Org A
      const createAdminRes = await teamRepository.createUser({
        full_name: 'Quản Trị Viên Chi Nhánh A',
        email: 'admin.branch.a@diaocvang.vn',
        phone: '0912999888',
        role: 'company_admin',
        organization_id: orgA.id,
      }, superAdmin);
      expect(createAdminRes.success).toBe(true);
      const companyAdminUser = createAdminRes.profile!;

      // 2. Company Admin cố gắng đổi role của Company Admin sang 'regional_director' hoặc 'sale_agent' -> Bị từ chối
      const updateRoleAttempt = await teamRepository.updateUser(
        companyAdminUser.id,
        {
          role: 'regional_director',
        },
        compAdminA
      );
      expect(updateRoleAttempt.success).toBe(false);
      expect(updateRoleAttempt.error).toContain('Quản Trị Doanh Nghiệp không có quyền thay đổi vai trò của tài khoản Quản Trị Doanh Nghiệp');

      // 3. Company Admin cố gắng dùng assignRole để đổi vai trò của Company Admin -> Bị từ chối
      const assignRoleAttempt = await teamRepository.assignRole(
        companyAdminUser.id,
        'director',
        null,
        null,
        null,
        orgA.id,
        compAdminA
      );
      expect(assignRoleAttempt.success).toBe(false);
      expect(assignRoleAttempt.error).toContain('Quản Trị Doanh Nghiệp không có quyền thay đổi vai trò của tài khoản Quản Trị Doanh Nghiệp');

      // 4. Company Admin cố gắng thăng cấp một nhân sự thường lên 'company_admin' -> Bị từ chối
      const promoteAttempt = await teamRepository.assignRole(
        saleA.id,
        'company_admin',
        null,
        null,
        null,
        orgA.id,
        compAdminA
      );
      expect(promoteAttempt.success).toBe(false);
      expect(promoteAttempt.error).toContain('Quản Trị Doanh Nghiệp không có quyền bổ nhiệm vai trò');

      // 5. Company Admin vẫn được quyền sửa thông tin cá nhân (họ tên, sđt) của nhân sự thuộc DN mình
      const updateInfoAttempt = await teamRepository.updateUser(
        companyAdminUser.id,
        {
          full_name: 'Quản Trị Viên Chi Nhánh A (Cập nhật SĐT)',
          phone: '0988776655',
        },
        compAdminA
      );
      expect(updateInfoAttempt.success).toBe(true);
      expect(updateInfoAttempt.profile?.full_name).toBe('Quản Trị Viên Chi Nhánh A (Cập nhật SĐT)');
      expect(updateInfoAttempt.profile?.role).toBe('company_admin');
    });

    it('Doanh Thu TB / Nhân Sự của Company Admin không bị rò rỉ số liệu từ DN khác hay mẫu mặc định', async () => {
      // Khi DN A chưa có giao dịch nào (hoặc deal value = 0)
      const hrSummaryZero = await hrRepository.getComprehensiveHRKpiSummary(
        { from: '2026-11-01', to: '2026-11-14' },
        compAdminA,
        {
          totalDealValue: 0,
          contractCount: 0,
          totalLeads: 0,
        }
      );

      // Doanh thu trung bình / nhân sự phải là 0 đ, không bị tính 9.350.000.000 đ
      expect(hrSummaryZero.perCapitaRevenue).toBe(0);
      expect(hrSummaryZero.perCapitaContracts).toBe(0);
      expect(hrSummaryZero.perCapitaLeads).toBe(0);

      // Khi DN A có doanh thu thực tế (ví dụ: 10 tỷ với 2 nhân sự)
      const hrSummaryWithRev = await hrRepository.getComprehensiveHRKpiSummary(
        { from: '2026-11-01', to: '2026-11-14' },
        compAdminA,
        {
          totalDealValue: 10000000000,
          contractCount: 2,
          totalLeads: 10,
        }
      );
      // Giả sử có ít nhất 1 nhân sự active
      expect(hrSummaryWithRev.perCapitaRevenue).toBeGreaterThan(0);
      expect(hrSummaryWithRev.perCapitaContracts).toBeGreaterThan(0);
    });
  });
});
