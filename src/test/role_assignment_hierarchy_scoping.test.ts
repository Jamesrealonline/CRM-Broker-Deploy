// ========================================================
// TEST SUITE: BỔ NHIỆM & PHÂN CẤP TỔ CHỨC THEO VAI TRÒ
// (Role Assignment Hierarchy Scoping Test)
// Đặc tả:
// 1. Cấp cao hơn Giám Đốc Vùng (admin, company_admin, ceo, marketing, hr): Không cần bổ nhiệm Vùng, Sàn, Team
// 2. Giám Đốc Vùng (regional_director): Chỉ bổ nhiệm Vùng, không cần Sàn hay Team
// 3. Giám Đốc Sàn & Trưởng Phòng KD (director, sales_manager): Bổ nhiệm Vùng và Sàn, không cần Team
// 4. Trưởng Nhóm & Chuyên Viên (team_leader, sale_agent): Bổ nhiệm Vùng, Sàn và Team
// ========================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { teamRepository } from '@/data/repositories/teamRepository';
import { UserProfile } from '@/domain/types';

describe('Bổ Nhiệm & Phân Cấp Cơ Cấu Nhân Sự (Role Hierarchy Scoping)', () => {
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

  const sampleStaff: UserProfile = {
    id: 'user-staff-01',
    email: 'txn.group@gmail.com',
    full_name: 'Trịnh Xuân Nam',
    phone: '0914697997',
    role: 'sale_agent',
    organization_id: 'org-maicom',
    region_id: 'reg-south',
    agency_id: 'agency-q1',
    team_id: 'team-eagle',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('crm_profiles', JSON.stringify([superAdmin, sampleStaff]));
  });

  describe('1. Kiểm thử sanitizeRoleHierarchy (Hàm làm sạch dữ liệu phân cấp)', () => {
    it('Cấp cao hơn Giám Đốc Vùng: Không cần Vùng, Sàn, Team (tất cả null)', () => {
      const rolesToTest = ['admin', 'company_admin', 'ceo', 'marketing_manager', 'hr_admin'] as const;

      for (const r of rolesToTest) {
        const sanitized = teamRepository.sanitizeRoleHierarchy(
          r,
          'org-maicom',
          'reg-south',
          'agency-q1',
          'team-eagle'
        );

        expect(sanitized.region_id, `${r} không được gán region_id`).toBeNull();
        expect(sanitized.agency_id, `${r} không được gán agency_id`).toBeNull();
        expect(sanitized.team_id, `${r} không được gán team_id`).toBeNull();

        if (r === 'admin') {
          expect(sanitized.organization_id).toBeNull();
        } else {
          expect(sanitized.organization_id).toBe('org-maicom');
        }
      }
    });

    it('Giám Đốc Vùng (regional_director): Chỉ nhận Vùng, không nhận Sàn hoặc Team', () => {
      const sanitized = teamRepository.sanitizeRoleHierarchy(
        'regional_director',
        'org-maicom',
        'reg-south',
        'agency-q1',
        'team-eagle'
      );

      expect(sanitized.organization_id).toBe('org-maicom');
      expect(sanitized.region_id).toBe('reg-south');
      expect(sanitized.agency_id).toBeNull();
      expect(sanitized.team_id).toBeNull();
    });

    it('Giám Đốc Sàn & Trưởng Phòng KD: Nhận Vùng và Sàn, không nhận Team', () => {
      const agencyRoles = ['director', 'sales_manager'] as const;

      for (const r of agencyRoles) {
        const sanitized = teamRepository.sanitizeRoleHierarchy(
          r,
          'org-maicom',
          'reg-south',
          'agency-q1',
          'team-eagle'
        );

        expect(sanitized.organization_id).toBe('org-maicom');
        expect(sanitized.region_id).toBe('reg-south');
        expect(sanitized.agency_id).toBe('agency-q1');
        expect(sanitized.team_id, `${r} không được gán team_id`).toBeNull();
      }
    });

    it('Trưởng Nhóm & Chuyên Viên Tư Vấn: Nhận đầy đủ Vùng, Sàn và Team', () => {
      const teamRoles = ['team_leader', 'sale_agent'] as const;

      for (const r of teamRoles) {
        const sanitized = teamRepository.sanitizeRoleHierarchy(
          r,
          'org-maicom',
          'reg-south',
          'agency-q1',
          'team-eagle'
        );

        expect(sanitized.organization_id).toBe('org-maicom');
        expect(sanitized.region_id).toBe('reg-south');
        expect(sanitized.agency_id).toBe('agency-q1');
        expect(sanitized.team_id).toBe('team-eagle');
      }
    });
  });

  describe('2. Bổ nhiệm qua teamRepository.assignRole', () => {
    it('Bổ nhiệm lên Quản Trị Doanh Nghiệp (company_admin) -> Vùng, Sàn, Team được tự động gỡ', async () => {
      const res = await teamRepository.assignRole(
        'user-staff-01',
        'company_admin',
        'agency-q1', // Truyền vào nhưng phải bị gỡ
        'team-eagle', // Truyền vào nhưng phải bị gỡ
        'reg-south',  // Truyền vào nhưng phải bị gỡ
        'org-maicom'
      );

      expect(res.success).toBe(true);

      const updated = await teamRepository.getProfiles();
      const user = updated.find(p => p.id === 'user-staff-01');
      expect(user?.role).toBe('company_admin');
      expect(user?.organization_id).toBe('org-maicom');
      expect(user?.region_id).toBeUndefined();
      expect(user?.agency_id).toBeUndefined();
      expect(user?.team_id).toBeUndefined();
    });

    it('Bổ nhiệm lên Giám Đốc Vùng (regional_director) -> Sàn và Team được tự động gỡ', async () => {
      const res = await teamRepository.assignRole(
        'user-staff-01',
        'regional_director',
        'agency-q1', // Phải bị gỡ
        'team-eagle', // Phải bị gỡ
        'reg-south',
        'org-maicom'
      );

      expect(res.success).toBe(true);

      const updated = await teamRepository.getProfiles();
      const user = updated.find(p => p.id === 'user-staff-01');
      expect(user?.role).toBe('regional_director');
      expect(user?.region_id).toBe('reg-south');
      expect(user?.agency_id).toBeUndefined();
      expect(user?.team_id).toBeUndefined();
    });

    it('Bổ nhiệm lên Giám Đốc Sàn (director) -> Team được tự động gỡ, Sàn được giữ', async () => {
      const res = await teamRepository.assignRole(
        'user-staff-01',
        'director',
        'agency-q1',
        'team-eagle', // Phải bị gỡ
        'reg-south',
        'org-maicom'
      );

      expect(res.success).toBe(true);

      const updated = await teamRepository.getProfiles();
      const user = updated.find(p => p.id === 'user-staff-01');
      expect(user?.role).toBe('director');
      expect(user?.region_id).toBe('reg-south');
      expect(user?.agency_id).toBe('agency-q1');
      expect(user?.team_id).toBeUndefined();
    });

    it('Bổ nhiệm Trưởng Nhóm (team_leader) -> Giữ nguyên Team', async () => {
      const res = await teamRepository.assignRole(
        'user-staff-01',
        'team_leader',
        'agency-q1',
        'team-eagle',
        'reg-south',
        'org-maicom'
      );

      expect(res.success).toBe(true);

      const updated = await teamRepository.getProfiles();
      const user = updated.find(p => p.id === 'user-staff-01');
      expect(user?.role).toBe('team_leader');
      expect(user?.region_id).toBe('reg-south');
      expect(user?.agency_id).toBe('agency-q1');
      expect(user?.team_id).toBe('team-eagle');
    });
  });

  describe('3. Cập nhật qua teamRepository.updateUser', () => {
    it('Chỉnh sửa thăng chức lên CEO -> Tự động xóa Vùng, Sàn, Team', async () => {
      const res = await teamRepository.updateUser(
        'user-staff-01',
        {
          role: 'ceo',
          organization_id: 'org-maicom',
          region_id: 'reg-south',
          agency_id: 'agency-q1',
          team_id: 'team-eagle',
        },
        superAdmin
      );

      expect(res.success).toBe(true);
      expect(res.profile?.role).toBe('ceo');
      expect(res.profile?.organization_id).toBe('org-maicom');
      expect(res.profile?.region_id).toBeUndefined();
      expect(res.profile?.agency_id).toBeUndefined();
      expect(res.profile?.team_id).toBeUndefined();
    });
  });
});
