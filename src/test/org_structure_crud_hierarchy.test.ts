// ========================================================
// TEST SUITE: CRUD TOÀN DIỆN CHO CƠ CẤU TỔ CHỨC
// Doanh Nghiệp (CEO), Vùng Kinh Doanh, Sàn Giao Dịch, Đội Nhóm
// ========================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { teamRepository } from '@/data/repositories/teamRepository';
import { UserProfile, UserRole } from '@/domain/types';

describe('CRUD Cơ Cấu Tổ Chức: Doanh Nghiệp, Vùng, Sàn, Đội Nhóm', () => {
  const superAdmin: UserProfile = {
    id: 'user-admin-01',
    email: 'admin@diaocvang.vn',
    full_name: 'Quản Trị Viên Tổng',
    phone: '0901111111',
    role: 'admin',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const compAdmin: UserProfile = {
    id: 'user-ca-01',
    email: 'admin.maicom@maicom.vn',
    full_name: 'Admin Maicom',
    phone: '0902222222',
    role: 'company_admin',
    organization_id: 'org-maicom',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const regularSale: UserProfile = {
    id: 'user-sale-01',
    email: 'sale@diaocvang.vn',
    full_name: 'Chuyên Viên Sale',
    phone: '0903333333',
    role: 'sale_agent',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  beforeEach(() => {
    localStorage.clear();
  });

  // ========================================================
  // 1. DOANH NGHIỆP (ORGANIZATIONS / CEO)
  // ========================================================
  describe('1. CRUD Doanh Nghiệp (Organizations)', () => {
    it('Quản Trị Tổng có quyền Tạo, Sửa và Xóa Doanh Nghiệp', async () => {
      // 1. Thêm Doanh Nghiệp
      const createRes = await teamRepository.createOrganization({
        name: 'Tập Đoàn BĐS Alpha Group',
        code: 'ORG-ALPHA',
        tax_number: '0319998888',
        phone: '02899998888',
        email: 'contact@alphagroup.vn',
        address: 'Quận 1, TP.HCM',
      }, superAdmin);
      expect(createRes.success).toBe(true);
      expect(createRes.organization).toBeDefined();
      const orgId = createRes.organization!.id;

      // 2. Chỉnh sửa Doanh Nghiệp
      const updateRes = await teamRepository.updateOrganization(orgId, {
        name: 'Tập Đoàn BĐS Alpha Holdings',
        phone: '02899999999',
        address: 'Thủ Đức, TP.HCM',
      }, superAdmin);
      expect(updateRes.success).toBe(true);
      expect(updateRes.organization?.name).toBe('Tập Đoàn BĐS Alpha Holdings');
      expect(updateRes.organization?.phone).toBe('02899999999');

      // 3. Xóa Doanh Nghiệp (khi chưa có Vùng/Sàn/Nhân sự trực thuộc)
      const deleteRes = await teamRepository.deleteOrganization(orgId, superAdmin);
      expect(deleteRes.success).toBe(true);

      const orgs = await teamRepository.getOrganizations();
      expect(orgs.some(o => o.id === orgId)).toBe(false);
    });

    it('Từ chối xóa Doanh nghiệp nếu còn Vùng, Sàn hoặc Nhân sự hoạt động trực thuộc', async () => {
      // Tạo Doanh nghiệp
      const orgRes = await teamRepository.createOrganization({
        name: 'Doanh Nghiệp Có Chi Nhánh',
        code: 'ORG-HAS-BRANCH',
      }, superAdmin);
      const orgId = orgRes.organization!.id;

      // Tạo Sàn thuộc Doanh nghiệp này
      await teamRepository.createAgency({
        name: 'Sàn Trực Thuộc Chi Nhánh',
        code: 'SAN-CN',
        organization_id: orgId,
      }, superAdmin);

      // Thử xóa Doanh nghiệp -> Bị chặn vì có Sàn trực thuộc
      const deleteRes = await teamRepository.deleteOrganization(orgId, superAdmin);
      expect(deleteRes.success).toBe(false);
      expect(deleteRes.error).toContain('Không thể xóa Doanh nghiệp');
    });

    it('Người dùng thông thường không có quyền sửa hoặc xóa Doanh nghiệp', async () => {
      const orgRes = await teamRepository.createOrganization({
        name: 'Doanh Nghiệp Bảo Mật',
        code: 'ORG-SECURE',
      }, superAdmin);
      const orgId = orgRes.organization!.id;

      const updateRes = await teamRepository.updateOrganization(orgId, { name: 'Hack Name' }, regularSale);
      expect(updateRes.success).toBe(false);
      expect(updateRes.error).toContain('Bạn không có quyền');

      const deleteRes = await teamRepository.deleteOrganization(orgId, regularSale);
      expect(deleteRes.success).toBe(false);
      expect(deleteRes.error).toContain('Chỉ Quản Trị Tổng');
    });
  });

  // ========================================================
  // 2. VÙNG KINH DOANH (REGIONS)
  // ========================================================
  describe('2. CRUD Vùng Kinh Doanh (Regions)', () => {
    it('Tạo, Sửa và Xóa Vùng Kinh Doanh với cơ chế Fallback an toàn', async () => {
      // 1. Tạo Vùng
      const createRes = await teamRepository.createRegion({
        name: 'Vùng Tây Nam Bộ Mới',
        code: 'REG-TNB-NEW',
        description: 'Vùng kinh doanh miền Tây',
      }, superAdmin);
      expect(createRes.success).toBe(true);
      const regId = createRes.region!.id;

      // 2. Sửa Vùng
      const updateRes = await teamRepository.updateRegion(regId, {
        name: 'Vùng Tây Nam Bộ Cập Nhật',
        description: 'Mô tả mở rộng',
      }, superAdmin);
      expect(updateRes.success).toBe(true);
      expect(updateRes.region?.name).toBe('Vùng Tây Nam Bộ Cập Nhật');

      // 3. Xóa Vùng với fallback sang REG-DEFAULT
      const deleteRes = await teamRepository.deleteRegion(regId, 'REG-DEFAULT', superAdmin);
      expect(deleteRes.success).toBe(true);

      const regions = await teamRepository.getRegions();
      expect(regions.some(r => r.id === regId)).toBe(false);
    });

    it('Không cho phép xóa Vùng Mặc Định (REG-DEFAULT)', async () => {
      const deleteRes = await teamRepository.deleteRegion('REG-DEFAULT', undefined, superAdmin);
      expect(deleteRes.success).toBe(false);
      expect(deleteRes.error).toContain('Không được phép xóa Vùng Mặc Định');
    });
  });

  // ========================================================
  // 3. SÀN GIAO DỊCH (AGENCIES)
  // ========================================================
  describe('3. CRUD Sàn Giao Dịch (Agencies)', () => {
    it('Tạo, Sửa và Xóa Sàn Giao Dịch với chuyển giao Teams và Nhân sự sang Sàn khác', async () => {
      // 1. Tạo Sàn A và Sàn B
      const agencyARes = await teamRepository.createAgency({
        name: 'Sàn Giao Dịch A',
        code: 'SAN-A',
      }, superAdmin);
      const agencyIdA = agencyARes.agency!.id;

      const agencyBRes = await teamRepository.createAgency({
        name: 'Sàn Giao Dịch B',
        code: 'SAN-B',
      }, superAdmin);
      const agencyIdB = agencyBRes.agency!.id;

      // 2. Chỉnh sửa Sàn A
      const updateRes = await teamRepository.updateAgency(agencyIdA, {
        name: 'Sàn Giao Dịch A VIP',
        phone: '0901234567',
        email: 'sanA@diaocvang.vn',
      }, superAdmin);
      expect(updateRes.success).toBe(true);
      expect(updateRes.agency?.name).toBe('Sàn Giao Dịch A VIP');

      // 3. Tạo Team và Nhân sự thuộc Sàn A
      const teamRes = await teamRepository.createTeam({
        name: 'Team Thuộc Sàn A',
        code: 'TM-A1',
        agency_id: agencyIdA,
      });
      expect(teamRes.success).toBe(true);

      // 4. Xóa Sàn A chuyển giao sang Sàn B
      const deleteRes = await teamRepository.deleteAgency(agencyIdA, agencyIdB, superAdmin);
      expect(deleteRes.success).toBe(true);

      // Kiểm tra Team đã được chuyển sang Sàn B
      const teams = await teamRepository.getTeams();
      const updatedTeam = teams.find(t => t.code === 'TM-A1');
      expect(updatedTeam?.agency_id).toBe(agencyIdB);

      // Sàn A đã bị xóa
      const agencies = await teamRepository.getAgencies();
      expect(agencies.some(a => a.id === agencyIdA)).toBe(false);
    });

    it('Từ chối xóa Sàn nếu đang có Teams/Nhân sự mà không chỉ định Sàn tiếp nhận', async () => {
      const agencyRes = await teamRepository.createAgency({
        name: 'Sàn Có Đội Nhóm',
        code: 'SAN-BUSY',
      }, superAdmin);
      const agencyId = agencyRes.agency!.id;

      await teamRepository.createTeam({
        name: 'Team Bận Rộn',
        code: 'TM-BUSY',
        agency_id: agencyId,
      });

      // Thử xóa không có fallbackAgencyId
      const deleteRes = await teamRepository.deleteAgency(agencyId, undefined, superAdmin);
      expect(deleteRes.success).toBe(false);
      expect(deleteRes.error).toContain('Vui lòng chọn Sàn tiếp nhận để chuyển giao');
    });
  });

  // ========================================================
  // 4. ĐỘI NHÓM KINH DOANH (TEAMS)
  // ========================================================
  describe('4. CRUD Đội Nhóm Kinh Doanh (Teams)', () => {
    it('Tạo, Sửa và Xóa Đội Nhóm chuyển giao hoặc hoàn trả nhân sự về Sàn', async () => {
      // 1. Tạo Sàn
      const agencyRes = await teamRepository.createAgency({
        name: 'Sàn Trung Tâm',
        code: 'SAN-TT',
      }, superAdmin);
      const agencyId = agencyRes.agency!.id;

      // 2. Tạo Team 1 và Team 2
      const team1Res = await teamRepository.createTeam({
        name: 'Team Chiến Binh 1',
        code: 'TM-CB1',
        agency_id: agencyId,
      });
      const team1Id = team1Res.team!.id;

      const team2Res = await teamRepository.createTeam({
        name: 'Team Chiến Binh 2',
        code: 'TM-CB2',
        agency_id: agencyId,
      });
      const team2Id = team2Res.team!.id;

      // 3. Sửa Team 1
      const updateRes = await teamRepository.updateTeam(team1Id, {
        name: 'Team Đại Bàng Lửa',
      }, superAdmin);
      expect(updateRes.success).toBe(true);
      expect(updateRes.team?.name).toBe('Team Đại Bàng Lửa');

      // 4. Tạo nhân sự trong Team 1
      const userRes = await teamRepository.createUser({
        full_name: 'Chiến Binh Sale',
        email: 'sale.cb@diaocvang.vn',
        phone: '0911222333',
        role: 'sale_agent',
        agency_id: agencyId,
        team_id: team1Id,
      }, superAdmin);
      expect(userRes.success).toBe(true);

      // 5. Xóa Team 1 chuyển giao nhân sự sang Team 2
      const deleteRes = await teamRepository.deleteTeam(team1Id, team2Id, superAdmin);
      expect(deleteRes.success).toBe(true);

      // Kiểm tra nhân sự đã được chuyển sang Team 2
      const profiles = await teamRepository.getProfiles();
      const updatedUser = profiles.find(p => p.email === 'sale.cb@diaocvang.vn');
      expect(updatedUser?.team_id).toBe(team2Id);

      // Team 1 đã bị xóa
      const teams = await teamRepository.getTeams();
      expect(teams.some(t => t.id === team1Id)).toBe(false);
    });

    it('Xóa Team không chọn fallback -> Nhân sự được gỡ team_id về trực thuộc Sàn', async () => {
      const agencyRes = await teamRepository.createAgency({
        name: 'Sàn Quận 7',
        code: 'SAN-Q7',
      }, superAdmin);
      const agencyId = agencyRes.agency!.id;

      const teamRes = await teamRepository.createTeam({
        name: 'Team Tự Do',
        code: 'TM-FREE',
        agency_id: agencyId,
      });
      const teamId = teamRes.team!.id;

      const userRes = await teamRepository.createUser({
        full_name: 'Sale Tự Do',
        email: 'sale.free@diaocvang.vn',
        phone: '0988777666',
        role: 'sale_agent',
        agency_id: agencyId,
        team_id: teamId,
      }, superAdmin);

      // Xóa team không có fallback
      const deleteRes = await teamRepository.deleteTeam(teamId, undefined, superAdmin);
      expect(deleteRes.success).toBe(true);

      const profiles = await teamRepository.getProfiles();
      const updatedUser = profiles.find(p => p.email === 'sale.free@diaocvang.vn');
      expect(updatedUser?.team_id).toBeUndefined();
    });
  });
});
