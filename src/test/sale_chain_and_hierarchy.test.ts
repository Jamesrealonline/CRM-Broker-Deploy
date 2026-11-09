import { describe, it, expect, beforeEach } from 'vitest';
import { hrRepository } from '@/data/repositories/hrRepository';
import { teamRepository } from '@/data/repositories/teamRepository';
import { UserProfile, Team, Department, MarketingUnit } from '@/domain/types';

describe('Giai đoạn 5.0A: Chuỗi Cấp Bậc Bắt Buộc & Kế Nhiệm (No Orphan Sale)', () => {
  const adminUser: UserProfile = {
    id: 'admin-001',
    full_name: 'Quản Trị Viên',
    email: 'admin@diaocvang.vn',
    phone: '0901234500',
    role: 'admin',
    agency_id: 'agency-1',
    status: 'active',
    must_change_password: false,
    totp_enabled: true,
  };

  const saleAgent: UserProfile = {
    id: 'sale-chain-01',
    full_name: 'Trần Văn Sale Chuỗi',
    email: 'sale.chain@diaocvang.vn',
    phone: '0901234501',
    role: 'sale_agent',
    agency_id: 'agency-1',
    team_id: 'team-valid',
    department_id: 'dept-valid',
    marketing_unit_id: 'mkt-valid',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const teamLeader: UserProfile = {
    id: 'leader-01',
    full_name: 'Nguyễn Văn Leader',
    email: 'leader@diaocvang.vn',
    phone: '0901234502',
    role: 'team_leader',
    agency_id: 'agency-1',
    team_id: 'team-valid',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const deptHead: UserProfile = {
    id: 'head-01',
    full_name: 'Phạm Thị Trưởng Phòng',
    email: 'head@diaocvang.vn',
    phone: '0901234503',
    role: 'sales_manager',
    agency_id: 'agency-1',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const mktManager: UserProfile = {
    id: 'mkt-lead-01',
    full_name: 'Đặng Văn Marketing Lead',
    email: 'mkt@diaocvang.vn',
    phone: '0901234504',
    role: 'marketing_manager',
    agency_id: 'agency-1',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. Cưỡng Chế Chuỗi Quản Lý Đầy Đủ (No Orphan Sale)', () => {
    it('Sale có đầy đủ chuỗi (Team + Leader + Dept + Head + Marketing) hợp lệ 100%', async () => {
      // Thiết lập phòng, nhóm, đơn vị marketing
      const dept: Department = {
        id: 'dept-valid',
        agency_id: 'agency-1',
        name: 'Phòng Kinh Doanh Số 1',
        head_id: deptHead.id,
        head_name: deptHead.full_name,
        director_id: adminUser.id,
      };
      localStorage.setItem('crm_departments', JSON.stringify([dept]));

      const team: Team = {
        id: 'team-valid',
        agency_id: 'agency-1',
        department_id: dept.id,
        name: 'Nhóm Tinh Hoa',
        code: 'TEAM-TH',
        leader_id: teamLeader.id,
        leader_name: teamLeader.full_name,
      };
      localStorage.setItem('crm_teams', JSON.stringify([team]));

      const mktUnit: MarketingUnit = {
        id: 'mkt-valid',
        name: 'Đơn Vị MKT Digital',
        manager_id: mktManager.id,
        manager_name: mktManager.full_name,
      };
      localStorage.setItem('crm_marketing_units', JSON.stringify([mktUnit]));

      localStorage.setItem('crm_profiles', JSON.stringify([adminUser, deptHead, teamLeader, mktManager, saleAgent]));

      const check = await hrRepository.validateSaleChain(saleAgent.id);
      expect(check.valid).toBe(true);
      expect(check.missingLinks.length).toBe(0);
      expect(check.chain?.leader_id).toBe(teamLeader.id);
      expect(check.chain?.head_id).toBe(deptHead.id);
      expect(check.chain?.marketing_manager_id).toBe(mktManager.id);
    });

    it('Phát hiện và báo lỗi khi Sale thiếu các mắt xích quản lý', async () => {
      // Sale mồ côi: không team, không marketing unit
      const orphanSale: UserProfile = {
        id: 'sale-orphan',
        full_name: 'Sale Mồ Côi',
        email: 'orphan@diaocvang.vn',
        phone: '0909999999',
        role: 'sale_agent',
        status: 'active',
        must_change_password: false,
        totp_enabled: false,
      };
      localStorage.setItem('crm_profiles', JSON.stringify([orphanSale]));

      const check = await hrRepository.validateSaleChain(orphanSale.id);
      expect(check.valid).toBe(false);
      expect(check.missingLinks).toContain('missing_team');
      expect(check.missingLinks).toContain('department_without_head');
      expect(check.missingLinks).toContain('missing_marketing_unit');
    });

    it('Báo lỗi team_without_leader khi Nhóm bị khuyết Trưởng nhóm', async () => {
      const emptyTeam: Team = {
        id: 'team-no-leader',
        agency_id: 'agency-1',
        department_id: 'dept-01',
        name: 'Nhóm Khuyết Leader',
        code: 'TEAM-KL',
        leader_id: undefined, // Khuyết leader
      };
      localStorage.setItem('crm_teams', JSON.stringify([emptyTeam]));

      const saleInTeam: UserProfile = {
        id: 'sale-in-empty-team',
        full_name: 'Sale Nhóm Khuyết Leader',
        email: 'sale.kl@diaocvang.vn',
        phone: '0901234599',
        role: 'sale_agent',
        team_id: emptyTeam.id,
        department_id: 'dept-01',
        marketing_unit_id: 'mkt-01',
        status: 'active',
        must_change_password: false,
        totp_enabled: false,
      };
      localStorage.setItem('crm_profiles', JSON.stringify([saleInTeam]));

      const check = await hrRepository.validateSaleChain(saleInTeam.id);
      expect(check.valid).toBe(false);
      expect(check.missingLinks).toContain('team_without_leader');
    });
  });

  describe('2. Quản Lý Kế Nhiệm & Quyền Tạm Thời (Acting)', () => {
    it('Chỉ định quyền phụ trách tạm thời (acting) có thời hạn và ghi sự kiện nhân sự', async () => {
      const team: Team = {
        id: 'team-acting-test',
        agency_id: 'agency-1',
        name: 'Nhóm Cần Kế Nhiệm',
        code: 'TEAM-ACT',
        leader_id: teamLeader.id,
      };
      localStorage.setItem('crm_teams', JSON.stringify([team]));

      const successor: UserProfile = {
        id: 'sale-promoted-to-acting',
        full_name: 'Vũ Thị Kế Nhiệm',
        email: 'acting@diaocvang.vn',
        phone: '0908888888',
        role: 'sale_agent',
        status: 'active',
        must_change_password: false,
        totp_enabled: false,
      };
      localStorage.setItem('crm_profiles', JSON.stringify([adminUser, teamLeader, successor]));

      const res = await hrRepository.assignSuccessorOrActing({
        positionType: 'team_leader',
        currentUserId: teamLeader.id,
        successorUserId: successor.id,
        isActing: true,
        actingDays: 45,
        reason: 'Trưởng nhóm cũ đi công tác dài ngày tại dự án miền Trung',
        currentUser: adminUser,
      });

      expect(res.success).toBe(true);
      expect(res.event.metadata?.isActing).toBe(true);

      // Kiểm tra team đã đổi leader_id
      const teams = await teamRepository.getTeams();
      const updatedTeam = teams.find(t => t.id === team.id)!;
      expect(updatedTeam.leader_id).toBe(successor.id);

      // Kiểm tra profile người kế nhiệm có cờ acting
      const profiles = await teamRepository.getProfiles();
      const updatedSuccessor = profiles.find(p => p.id === successor.id)!;
      expect(updatedSuccessor.is_acting).toBe(true);
      expect(updatedSuccessor.acting_until).toBeDefined();
    });

    it('Chặn khóa/cho nghỉ quản lý khi còn cấp dưới mà chưa chỉ định người kế nhiệm', async () => {
      const team: Team = {
        id: 'team-subordinate-check',
        agency_id: 'agency-1',
        name: 'Nhóm Quản Lý Đi Vắng',
        code: 'TEAM-SUB',
        leader_id: teamLeader.id,
      };
      localStorage.setItem('crm_teams', JSON.stringify([team]));

      const subordinateSale: UserProfile = {
        id: 'sale-sub-1',
        full_name: 'Nhân Viên Của Leader',
        email: 'sub@diaocvang.vn',
        phone: '0907777777',
        role: 'sale_agent',
        team_id: team.id,
        status: 'active',
        must_change_password: false,
        totp_enabled: false,
      };
      localStorage.setItem('crm_profiles', JSON.stringify([adminUser, teamLeader, subordinateSale]));

      // Thử cho leader nghỉ việc mà không bàn giao người kế nhiệm -> Bị từ chối
      await expect(
        hrRepository.deactivateOrTransferManager({
          managerId: teamLeader.id,
          currentUser: adminUser,
        })
      ).rejects.toThrow('subordinates_exist: Không thể khóa/cho nghỉ quản lý khi còn cấp dưới chưa được gán người kế nhiệm!');
    });
  });

  describe('3. Báo Cáo Sức Khỏe Cấu Trúc Tổ Chức (Structural Health Report)', () => {
    it('Tổng hợp đầy đủ các cảnh báo bất thường trong chuỗi cấp bậc', async () => {
      const orphan1: UserProfile = {
        id: 'sale-orphan-1',
        full_name: 'Sale Thiếu Chuỗi 1',
        email: 's1@crm.vn',
        phone: '0901111111',
        role: 'sale_agent',
        status: 'active',
        must_change_password: false,
        totp_enabled: false,
      };
      localStorage.setItem('crm_profiles', JSON.stringify([orphan1]));

      const report = await hrRepository.getStructuralHealthReport();
      expect(report.orphanSalesCount).toBeGreaterThanOrEqual(1);
      expect(report.orphanSales.some(s => s.id === orphan1.id)).toBe(true);
    });
  });
});
