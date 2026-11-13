// ========================================================
// REAL ESTATE CRM - ENTERPRISE MULTI-TENANT & PROJECT SCOPING TEST
// Kiểm tra nghiêm ngặt phân quyền đa doanh nghiệp (Multi-Tenant Isolation) & Nhánh (Branch Scoping)
// 1. Company Admin / CEO / GĐ Vùng / Cấp dưới của DN nào chỉ thấy thông tin của DN đó
// 2. Dự án của DN nào do Company Admin tạo chỉ hiển thị cho DN đó, DN khác không thấy
// 3. Cơ sở tri thức AI & Danh Mục Dự Án cô lập hoàn toàn giữa các doanh nghiệp
// 4. Trung Tâm Quản Trị Doanh Nghiệp (Enterprise Admin) chỉ hiển thị dữ liệu nội bộ DN
// ========================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { branchHierarchyService } from '@/domain/services/branchHierarchyService';
import { projectRepository } from '@/data/repositories/projectRepository';
import { teamRepository } from '@/data/repositories/teamRepository';
import { UserProfile, Project, Region, Agency, Team, Organization } from '@/domain/types';

describe('Đa Doanh Nghiệp (Multi-Tenant) & Cô Lập Dự Án, Nhánh Phân Cấp', () => {
  const ORG_A_ID = '11111111-1111-1111-1111-111111111111'; // Golden Land Group
  const ORG_B_ID = '22222222-2222-2222-2222-222222222222'; // Maicom Group

  // Doanh nghiệp A
  const compAdminA: UserProfile = {
    id: 'user-admin-a',
    organization_id: ORG_A_ID,
    email: 'admin.glg@diaocvang.vn',
    full_name: 'Quản Trị DN A',
    role: 'company_admin',
    phone: '0901000001',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const ceoA: UserProfile = {
    id: 'user-ceo-a',
    organization_id: ORG_A_ID,
    email: 'ceo.glg@diaocvang.vn',
    full_name: 'CEO DN A',
    role: 'ceo',
    phone: '0901000002',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const regDirA: UserProfile = {
    id: 'user-rd-a',
    organization_id: ORG_A_ID,
    region_id: 'reg-a1',
    email: 'gdvung.a@diaocvang.vn',
    full_name: 'Giám Đốc Vùng A1',
    role: 'regional_director',
    phone: '0901000003',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const saleAgentA: UserProfile = {
    id: 'user-sale-a',
    organization_id: ORG_A_ID,
    region_id: 'reg-a1',
    agency_id: 'agency-a1',
    team_id: 'team-a1',
    email: 'sale.a@diaocvang.vn',
    full_name: 'Chuyên Viên Tư Vấn A',
    role: 'sale_agent',
    phone: '0901000004',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  // Doanh nghiệp B
  const compAdminB: UserProfile = {
    id: 'user-admin-b',
    organization_id: ORG_B_ID,
    email: 'admin@maicom.vn',
    full_name: 'Quản Trị DN B',
    role: 'company_admin',
    phone: '0902000001',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const ceoB: UserProfile = {
    id: 'user-ceo-b',
    organization_id: ORG_B_ID,
    email: 'ceo@maicom.vn',
    full_name: 'CEO DN B',
    role: 'ceo',
    phone: '0902000002',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const regDirB: UserProfile = {
    id: 'user-rd-b',
    organization_id: ORG_B_ID,
    region_id: 'reg-b1',
    email: 'gdvung.b@maicom.vn',
    full_name: 'Giám Đốc Vùng B1',
    role: 'regional_director',
    phone: '0902000003',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const saleAgentB: UserProfile = {
    id: 'user-sale-b',
    organization_id: ORG_B_ID,
    region_id: 'reg-b1',
    agency_id: 'agency-b1',
    team_id: 'team-b1',
    email: 'sale.b@maicom.vn',
    full_name: 'Chuyên Viên Tư Vấn B',
    role: 'sale_agent',
    phone: '0902000004',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  // Quản trị viên tối cao (Super Admin)
  const superAdmin: UserProfile = {
    id: 'user-super-admin',
    email: 'admin@diaocvang.vn',
    full_name: 'Quản Trị Hệ Thống',
    role: 'admin',
    phone: '0900000001',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  // Dữ liệu mẫu 2 doanh nghiệp
  const mockOrganizations: Organization[] = [
    { id: ORG_A_ID, code: 'ORG-GLG', name: 'Golden Land Group', status: 'active', created_at: new Date().toISOString() },
    { id: ORG_B_ID, code: 'ORG-MAICOM', name: 'Maicom Real Estate', status: 'active', created_at: new Date().toISOString() },
  ];

  const mockRegions: Region[] = [
    { id: 'reg-a1', organization_id: ORG_A_ID, code: 'REG-A1', name: 'Vùng Miền Nam A', status: 'active' },
    { id: 'reg-b1', organization_id: ORG_B_ID, code: 'REG-B1', name: 'Vùng Miền Bắc B', status: 'active' },
  ];

  const mockAgencies: Agency[] = [
    { id: 'agency-a1', organization_id: ORG_A_ID, region_id: 'reg-a1', code: 'S1-A', name: 'Sàn Quận 1 (DN A)', status: 'active' },
    { id: 'agency-b1', organization_id: ORG_B_ID, region_id: 'reg-b1', code: 'S1-B', name: 'Sàn Cầu Giấy (DN B)', status: 'active' },
  ];

  const mockTeams: Team[] = [
    { id: 'team-a1', agency_id: 'agency-a1', code: 'TM-A1', name: 'Team Eagle (DN A)' },
    { id: 'team-b1', agency_id: 'agency-b1', code: 'TM-B1', name: 'Team Dragon (DN B)' },
  ];

  const mockProfiles: UserProfile[] = [
    superAdmin,
    compAdminA,
    ceoA,
    regDirA,
    saleAgentA,
    compAdminB,
    ceoB,
    regDirB,
    saleAgentB,
  ];

  const mockProjects: Project[] = [
    {
      id: 'proj-a1',
      organization_id: ORG_A_ID,
      code: 'PRJ-A1',
      name: 'Vinhomes Grand Park (DN A)',
      developer: 'Vingroup',
      location: 'Quận 9',
      property_type: 'Căn hộ',
      status: 'opening',
      created_at: new Date().toISOString(),
    },
    {
      id: 'proj-b1',
      organization_id: ORG_B_ID,
      code: 'PRJ-B1',
      name: 'Ecopark Grand (DN B)',
      developer: 'Ecopark Group',
      location: 'Hưng Yên',
      property_type: 'Biệt thự',
      status: 'opening',
      created_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('crm_agencies', JSON.stringify(mockAgencies));
    localStorage.setItem('crm_regions', JSON.stringify(mockRegions));
    localStorage.setItem('crm_organizations', JSON.stringify(mockOrganizations));
    localStorage.setItem('crm_projects', JSON.stringify(mockProjects));
    localStorage.setItem('crm_profiles', JSON.stringify(mockProfiles));
  });

  describe('1. Cô Lập Dự Án & Cơ Sở Tri Thức AI Giữa Các Doanh Nghiệp', () => {
    it('Company Admin DN A chỉ xem được dự án của DN A, không xem được dự án DN B', () => {
      const projectsForAdminA = branchHierarchyService.filterProjects(compAdminA, mockProjects);
      expect(projectsForAdminA).toHaveLength(1);
      expect(projectsForAdminA[0].id).toBe('proj-a1');
      expect(projectsForAdminA.some(p => p.organization_id === ORG_B_ID)).toBe(false);
    });

    it('Company Admin DN B chỉ xem được dự án của DN B, không xem được dự án DN A', () => {
      const projectsForAdminB = branchHierarchyService.filterProjects(compAdminB, mockProjects);
      expect(projectsForAdminB).toHaveLength(1);
      expect(projectsForAdminB[0].id).toBe('proj-b1');
      expect(projectsForAdminB.some(p => p.organization_id === ORG_A_ID)).toBe(false);
    });

    it('CEO, Giám Đốc Vùng và Sale DN A chỉ thấy dự án DN A', () => {
      expect(branchHierarchyService.filterProjects(ceoA, mockProjects).map(p => p.id)).toEqual(['proj-a1']);
      expect(branchHierarchyService.filterProjects(regDirA, mockProjects).map(p => p.id)).toEqual(['proj-a1']);
      expect(branchHierarchyService.filterProjects(saleAgentA, mockProjects).map(p => p.id)).toEqual(['proj-a1']);
    });

    it('Quản Trị Tổng (Admin) xem được toàn bộ dự án của tất cả các doanh nghiệp', () => {
      const allProjects = branchHierarchyService.filterProjects(superAdmin, mockProjects);
      expect(allProjects).toHaveLength(2);
      expect(allProjects.map(p => p.id)).toContain('proj-a1');
      expect(allProjects.map(p => p.id)).toContain('proj-b1');
    });

    it('canAccessProject từ chối truy cập chi tiết dự án (AI Knowledge) nếu không cùng doanh nghiệp', () => {
      const projA = mockProjects[0];
      const projB = mockProjects[1];

      // Nhân sự DN A có quyền vào dự án A, bị cấm vào dự án B
      expect(branchHierarchyService.canAccessProject(compAdminA, projA)).toBe(true);
      expect(branchHierarchyService.canAccessProject(ceoA, projA)).toBe(true);
      expect(branchHierarchyService.canAccessProject(regDirA, projA)).toBe(true);
      expect(branchHierarchyService.canAccessProject(saleAgentA, projA)).toBe(true);

      expect(branchHierarchyService.canAccessProject(compAdminA, projB)).toBe(false);
      expect(branchHierarchyService.canAccessProject(ceoA, projB)).toBe(false);
      expect(branchHierarchyService.canAccessProject(regDirA, projB)).toBe(false);
      expect(branchHierarchyService.canAccessProject(saleAgentA, projB)).toBe(false);

      // Super Admin vào được cả hai
      expect(branchHierarchyService.canAccessProject(superAdmin, projA)).toBe(true);
      expect(branchHierarchyService.canAccessProject(superAdmin, projB)).toBe(true);
    });

    it('Khi Company Admin DN B tạo dự án mới, dự án tự động gắn organization_id của DN B và DN A không thấy', async () => {
      const createdProj = await projectRepository.createProject({
        name: 'Dự án Mới của Maicom',
        code: 'PRJ-MAICOM-01',
        developer: 'Maicom Real Estate',
        location: 'Hà Nội',
        property_type: 'Căn hộ',
      }, compAdminB);

      expect(createdProj.organization_id).toBe(ORG_B_ID);

      const listAfterCreateA = await projectRepository.getProjects(compAdminA);
      const listAfterCreateB = await projectRepository.getProjects(compAdminB);

      expect(listAfterCreateB.some(p => p.id === createdProj.id)).toBe(true);
      expect(listAfterCreateA.some(p => p.id === createdProj.id)).toBe(false);
    });
  });

  describe('2. Trung Tâm Quản Trị Doanh Nghiệp (Enterprise Admin): Cô Lập Tuyệt Đối', () => {
    it('Company Admin DN A chỉ thấy tổ chức của DN A trong danh sách tổ chức', () => {
      const orgsA = branchHierarchyService.filterOrganizations(compAdminA, mockOrganizations);
      expect(orgsA).toHaveLength(1);
      expect(orgsA[0].id).toBe(ORG_A_ID);
      expect(orgsA[0].code).toBe('ORG-GLG');
    });

    it('Company Admin DN B chỉ thấy tổ chức của DN B trong danh sách tổ chức', () => {
      const orgsB = branchHierarchyService.filterOrganizations(compAdminB, mockOrganizations);
      expect(orgsB).toHaveLength(1);
      expect(orgsB[0].id).toBe(ORG_B_ID);
      expect(orgsB[0].code).toBe('ORG-MAICOM');
    });

    it('Company Admin DN A chỉ thấy Vùng, Sàn, Đội Nhóm của DN A', () => {
      const regionsA = branchHierarchyService.filterRegions(compAdminA, mockRegions);
      const agenciesA = branchHierarchyService.filterAgencies(compAdminA, mockAgencies);
      const teamsA = branchHierarchyService.filterTeams(compAdminA, mockTeams);

      expect(regionsA).toHaveLength(1);
      expect(regionsA[0].id).toBe('reg-a1');

      expect(agenciesA).toHaveLength(1);
      expect(agenciesA[0].id).toBe('agency-a1');

      expect(teamsA).toHaveLength(1);
      expect(teamsA[0].id).toBe('team-a1');
    });

    it('Company Admin DN B chỉ thấy Vùng, Sàn, Đội Nhóm của DN B', () => {
      const regionsB = branchHierarchyService.filterRegions(compAdminB, mockRegions);
      const agenciesB = branchHierarchyService.filterAgencies(compAdminB, mockAgencies);
      const teamsB = branchHierarchyService.filterTeams(compAdminB, mockTeams);

      expect(regionsB).toHaveLength(1);
      expect(regionsB[0].id).toBe('reg-b1');

      expect(agenciesB).toHaveLength(1);
      expect(agenciesB[0].id).toBe('agency-b1');

      expect(teamsB).toHaveLength(1);
      expect(teamsB[0].id).toBe('team-b1');
    });

    it('Company Admin DN A chỉ thấy danh sách tài khoản thuộc DN A (không thấy DN B hoặc Admin tối cao)', () => {
      const usersA = branchHierarchyService.filterProfiles(compAdminA, mockProfiles);
      expect(usersA.every(u => u.organization_id === ORG_A_ID)).toBe(true);
      expect(usersA.some(u => u.id === compAdminB.id)).toBe(false);
      expect(usersA.some(u => u.id === ceoB.id)).toBe(false);
      expect(usersA.some(u => u.id === superAdmin.id)).toBe(false);
    });

    it('Giám Đốc Vùng chỉ thấy Sàn và Đội Nhóm thuộc Vùng của mình', () => {
      const agenciesRegA = branchHierarchyService.filterAgencies(regDirA, mockAgencies);
      expect(agenciesRegA).toHaveLength(1);
      expect(agenciesRegA[0].id).toBe('agency-a1');

      const agenciesRegB = branchHierarchyService.filterAgencies(regDirB, mockAgencies);
      expect(agenciesRegB).toHaveLength(1);
      expect(agenciesRegB[0].id).toBe('agency-b1');
    });
  });
});
