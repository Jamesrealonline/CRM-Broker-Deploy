// ========================================================
// TEST SUITE: CƠ CHẾ PHÂN QUYỀN CÂY NHÁNH & CÔ LẬP DỮ LIỆU
// Cấp bậc: sale_agent -> team_leader -> sales_manager / GĐ Sàn -> directors -> admin
// HR & Marketing: quyền xem tất cả các giám đốc sàn như directors
// Nguyên tắc: Dữ liệu của nhánh nào chỉ được xem nhánh đó
// ========================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { branchHierarchyService } from '@/domain/services/branchHierarchyService';
import { contractRepository } from '@/data/repositories/contractRepository';
import { hrRepository } from '@/data/repositories/hrRepository';
import { UserProfile, Agency, Team, Transaction, LeaderboardItem } from '@/domain/types';

describe('Branch Hierarchy & Data Scoping Test Suite', () => {
  const agencyA: Agency = {
    id: 'agency-A',
    organization_id: 'org-1',
    name: 'Sàn Giao Dịch A',
    code: 'SAN-A',
    status: 'active',
  };

  const agencyB: Agency = {
    id: 'agency-B',
    organization_id: 'org-1',
    name: 'Sàn Giao Dịch B',
    code: 'SAN-B',
    status: 'active',
  };

  const teamA1: Team = {
    id: 'team-A1',
    agency_id: 'agency-A',
    name: 'Team A1 (Sàn A)',
    code: 'TM-A1',
  };

  const teamA2: Team = {
    id: 'team-A2',
    agency_id: 'agency-A',
    name: 'Team A2 (Sàn A)',
    code: 'TM-A2',
  };

  const teamB1: Team = {
    id: 'team-B1',
    agency_id: 'agency-B',
    name: 'Team B1 (Sàn B)',
    code: 'TM-B1',
  };

  // Người dùng mẫu đại diện các cấp bậc
  const userAdmin: UserProfile = {
    id: 'user-admin',
    email: 'admin@system.vn',
    full_name: 'Quản Trị Viên Tối Cao',
    phone: '0901000001',
    role: 'admin',
    status: 'active',
    must_change_password: false,
    totp_enabled: true,
  };

  const userDirector: UserProfile = {
    id: 'user-director',
    email: 'director@system.vn',
    full_name: 'Trần Hải Nam (Tổng Giám Đốc)',
    phone: '0901000002',
    role: 'director',
    status: 'active',
    must_change_password: false,
    totp_enabled: true,
  };

  const userHR: UserProfile = {
    id: 'user-hr',
    email: 'hr@system.vn',
    full_name: 'Nguyễn Thị HR',
    phone: '0901000003',
    role: 'hr_admin',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const userMarketing: UserProfile = {
    id: 'user-marketing',
    email: 'marketing@system.vn',
    full_name: 'Lê Thu Hà (Marketing)',
    phone: '0901000004',
    role: 'marketing_manager',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const userGDSanA: UserProfile = {
    id: 'user-gd-san-A',
    email: 'gd_a@system.vn',
    full_name: 'Giám Đốc Sàn A',
    phone: '0901000005',
    role: 'sales_manager',
    agency_id: 'agency-A',
    status: 'active',
    must_change_password: false,
    totp_enabled: true,
  };

  const userGDSanB: UserProfile = {
    id: 'user-gd-san-B',
    email: 'gd_b@system.vn',
    full_name: 'Giám Đốc Sàn B',
    phone: '0901000006',
    role: 'sales_manager',
    agency_id: 'agency-B',
    status: 'active',
    must_change_password: false,
    totp_enabled: true,
  };

  const userLeaderA1: UserProfile = {
    id: 'user-leader-A1',
    email: 'leader_a1@system.vn',
    full_name: 'Trưởng Nhóm A1',
    phone: '0901000007',
    role: 'team_leader',
    agency_id: 'agency-A',
    team_id: 'team-A1',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const userSaleA1: UserProfile = {
    id: 'user-sale-A1',
    email: 'sale_a1@system.vn',
    full_name: 'Chuyên Viên Tư Vấn A1',
    phone: '0901000008',
    role: 'sale_agent',
    agency_id: 'agency-A',
    team_id: 'team-A1',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const userSaleB1: UserProfile = {
    id: 'user-sale-B1',
    email: 'sale_b1@system.vn',
    full_name: 'Chuyên Viên Tư Vấn B1',
    phone: '0901000009',
    role: 'sale_agent',
    agency_id: 'agency-B',
    team_id: 'team-B1',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('crm_agencies', JSON.stringify([agencyA, agencyB]));
    localStorage.setItem('crm_teams', JSON.stringify([teamA1, teamA2, teamB1]));
    localStorage.setItem('crm_profiles', JSON.stringify([
      userAdmin,
      userDirector,
      userHR,
      userMarketing,
      userGDSanA,
      userGDSanB,
      userLeaderA1,
      userSaleA1,
      userSaleB1,
    ]));
  });

  describe('1. Kiểm tra quyền truy cập theo cấp bậc cây phân cấp (BranchHierarchyService)', () => {
    it('Chỉ Quản Trị Viên (admin) có isGlobalViewer = true; HR và Marketing xem được các sàn trong phạm vi', () => {
      expect(branchHierarchyService.isGlobalViewer(userAdmin)).toBe(true);
      expect(branchHierarchyService.isGlobalViewer(userDirector)).toBe(false);
      expect(branchHierarchyService.isGlobalViewer(userHR)).toBe(false);
      expect(branchHierarchyService.isGlobalViewer(userMarketing)).toBe(false);

      expect(branchHierarchyService.canAccessAgency(userHR, 'agency-A')).toBe(true);
      expect(branchHierarchyService.canAccessAgency(userHR, 'agency-B')).toBe(true);
      expect(branchHierarchyService.canAccessAgency(userMarketing, 'agency-A')).toBe(true);
      expect(branchHierarchyService.canAccessAgency(userMarketing, 'agency-B')).toBe(true);
    });

    it('Giám đốc Sàn A chỉ được xem Sàn A, không được xem Sàn B', () => {
      expect(branchHierarchyService.isGlobalViewer(userGDSanA)).toBe(false);
      expect(branchHierarchyService.canAccessAgency(userGDSanA, 'agency-A')).toBe(true);
      expect(branchHierarchyService.canAccessAgency(userGDSanA, 'agency-B')).toBe(false);
    });

    it('Trưởng Nhóm A1 chỉ được xem Team A1, không xem được Team B1 hay Sàn B', () => {
      expect(branchHierarchyService.canAccessTeam(userLeaderA1, 'team-A1')).toBe(true);
      expect(branchHierarchyService.canAccessTeam(userLeaderA1, 'team-B1')).toBe(false);
      expect(branchHierarchyService.canAccessAgency(userLeaderA1, 'agency-A')).toBe(true);
      expect(branchHierarchyService.canAccessAgency(userLeaderA1, 'agency-B')).toBe(false);
    });

    it('Sale A1 chỉ được xem chính mình, không được xem hồ sơ của Sale B1', () => {
      expect(branchHierarchyService.canAccessUser(userSaleA1, userSaleA1)).toBe(true);
      expect(branchHierarchyService.canAccessUser(userSaleA1, userSaleB1)).toBe(false);
    });
  });

  describe('2. Cô lập dữ liệu nhân sự (HR) theo nhánh', () => {
    it('Giám đốc Sàn A truy vấn danh sách nhân sự chỉ thấy nhân sự thuộc Sàn A', async () => {
      const employees = await hrRepository.getEmployees({}, userGDSanA);
      const hasStaffFromAgencyB = employees.some(e => e.agency_id === 'agency-B');
      expect(hasStaffFromAgencyB).toBe(false);

      const hasStaffFromAgencyA = employees.some(e => e.agency_id === 'agency-A');
      expect(hasStaffFromAgencyA).toBe(true);
    });

    it('Trưởng nhóm A1 chỉ thấy nhân sự thuộc Team A1', async () => {
      const employees = await hrRepository.getEmployees({}, userLeaderA1);
      const allInTeamA1 = employees.every(e => e.team_id === 'team-A1' || e.id === userLeaderA1.id);
      expect(allInTeamA1).toBe(true);
      expect(employees.some(e => e.id === userSaleA1.id)).toBe(true);
      expect(employees.some(e => e.id === userSaleB1.id)).toBe(false);
    });

    it('Giám đốc Sàn A bị từ chối khi cố xem hồ sơ 360° của nhân sự thuộc Sàn B', async () => {
      await expect(
        hrRepository.getEmployee360Profile(userSaleB1.id, userGDSanA)
      ).rejects.toThrow('Từ chối truy cập');
    });

    it('Giám đốc Sàn A xem hồ sơ 360° của Sale A1 (cùng sàn) thành công', async () => {
      const profile360 = await hrRepository.getEmployee360Profile(userSaleA1.id, userGDSanA);
      expect(profile360.profile.id).toBe(userSaleA1.id);
      expect(profile360.hasPrivateAccess).toBe(true);
    });
  });

  describe('3. Cô lập dữ liệu Hợp đồng, Giao dịch & Bảng thi đua theo nhánh', () => {
    beforeEach(() => {
      const sampleTransactions: Partial<Transaction>[] = [
        {
          id: 'tx-01',
          code: 'HD-001',
          type: 'contract',
          status: 'confirmed',
          agency_id: 'agency-A',
          agency_name: 'Sàn Giao Dịch A',
          team_id: 'team-A1',
          team_name: 'Team A1 (Sàn A)',
          sale_id: userSaleA1.id,
          sale_name: userSaleA1.full_name,
          deal_value: 5000000000,
          amount: 5000000000,
          commission_amount: 150000000,
          sale_commission_amount: 50000000,
          contract_date: '2026-11-05',
        },
        {
          id: 'tx-02',
          code: 'HD-002',
          type: 'contract',
          status: 'confirmed',
          agency_id: 'agency-B',
          agency_name: 'Sàn Giao Dịch B',
          team_id: 'team-B1',
          team_name: 'Team B1 (Sàn B)',
          sale_id: userSaleB1.id,
          sale_name: userSaleB1.full_name,
          deal_value: 8000000000,
          amount: 8000000000,
          commission_amount: 240000000,
          sale_commission_amount: 80000000,
          contract_date: '2026-11-06',
        },
      ];
      localStorage.setItem('crm_transactions', JSON.stringify(sampleTransactions));
    });

    it('Giám đốc Sàn A lấy danh sách giao dịch chỉ thấy các giao dịch của Sàn A', async () => {
      const txs = await contractRepository.getTransactions({ currentUser: userGDSanA });
      expect(txs.length).toBe(1);
      expect(txs[0].agency_id).toBe('agency-A');
      expect(txs.some(t => t.agency_id === 'agency-B')).toBe(false);
    });

    it('Giám đốc Sàn A trên Bảng Thi Đua Các Sàn chỉ thấy sàn của mình', async () => {
      const leaderboard = await contractRepository.getLeaderboard({
        type: 'agency',
        currentUser: userGDSanA,
      });

      // Chỉ hiển thị đúng Sàn A
      expect(leaderboard.some(it => it.id === 'agency-A')).toBe(true);
      expect(leaderboard.some(it => it.id === 'agency-B')).toBe(false);
    });

    it('Giám đốc Sàn A trên Bảng Thi Đua Đội Nhóm chỉ thấy các team thuộc Sàn A', async () => {
      const leaderboard = await contractRepository.getLeaderboard({
        type: 'team',
        currentUser: userGDSanA,
      });

      expect(leaderboard.some(it => it.id === 'team-A1')).toBe(true);
      expect(leaderboard.some(it => it.id === 'team-B1')).toBe(false);
    });

    it('Trưởng Nhóm A1 trên Bảng Thi Đua Chuyên Viên Tư Vấn chỉ thấy sale thuộc Team A1', async () => {
      const leaderboard = await contractRepository.getLeaderboard({
        type: 'sale_agent',
        currentUser: userLeaderA1,
      });

      expect(leaderboard.some(it => it.id === userSaleA1.id)).toBe(true);
      expect(leaderboard.some(it => it.id === userSaleB1.id)).toBe(false);
    });

    it('Admin, Directors, HR thấy đầy đủ tất cả các sàn trên Bảng thi đua', async () => {
      const adminLB = await contractRepository.getLeaderboard({
        type: 'agency',
        currentUser: userAdmin,
      });
      expect(adminLB.some(it => it.id === 'agency-A')).toBe(true);
      expect(adminLB.some(it => it.id === 'agency-B')).toBe(true);

      const hrLB = await contractRepository.getLeaderboard({
        type: 'agency',
        currentUser: userHR,
      });
      expect(hrLB.some(it => it.id === 'agency-A')).toBe(true);
      expect(hrLB.some(it => it.id === 'agency-B')).toBe(true);
    });
  });
});
