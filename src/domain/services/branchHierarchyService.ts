// ========================================================
// REAL ESTATE CRM - BRANCH HIERARCHY & DATA SCOPING SERVICE
// Cưỡng chế phân quyền cây phân cấp (Branch / Subtree Scoping)
// Cấp bậc: sale_agent -> team_leader -> sales_manager / director sàn -> directors -> admin
// HR & Marketing: quyền xem tất cả các giám đốc sàn như directors (hoặc thuộc riêng director đó)
// Nguyên tắc: Dữ liệu của nhánh nào chỉ được xem nhánh đó
// ========================================================

import { UserProfile, UserRole, Team, Transaction, LeaderboardItem, RecruiterRank, AgencyHRRank } from '../types';

export class BranchHierarchyService {
  /**
   * Kiểm tra người dùng có quyền xem toàn hệ thống (Admin, Directors cấp cao, HR/Marketing toàn quyền)
   */
  isGlobalViewer(user: UserProfile | null | undefined): boolean {
    if (!user) return false;
    if (user.role === 'admin') return true;
    
    // Directors (Khối Giám Đốc): toàn quyền xem tất cả các giám đốc sàn thuộc quyền quản lý
    if (user.role === 'director') {
      return true;
    }

    // HR & Marketing: quyền xem được tất cả các giám đốc sàn như directors (và thuộc riêng director đó nếu có chỉ định)
    if (user.role === 'hr_admin' || user.role === 'marketing_manager') {
      if (!user.reporting_to) return true;
    }

    return false;
  }

  /**
   * Kiểm tra quyền truy cập vào một sàn giao dịch cụ thể
   */
  canAccessAgency(user: UserProfile | null | undefined, agencyId?: string): boolean {
    if (!user) return false;
    if (this.isGlobalViewer(user)) return true;
    if (!agencyId) return true;
    return user.agency_id === agencyId;
  }

  /**
   * Kiểm tra quyền truy cập vào một đội nhóm cụ thể
   */
  canAccessTeam(user: UserProfile | null | undefined, teamId?: string, teamAgencyId?: string): boolean {
    if (!user) return false;
    if (this.isGlobalViewer(user)) return true;
    if (!teamId) return true;

    // Giám đốc Sàn: xem được tất cả các team thuộc sàn của mình
    if (user.role === 'sales_manager' || (user.role === 'director' && user.agency_id)) {
      if (teamAgencyId) return teamAgencyId === user.agency_id;
      return true;
    }

    // Trưởng nhóm & Sale: chỉ xem được team của mình
    if (user.role === 'team_leader' || user.role === 'sale_agent') {
      return user.team_id === teamId;
    }

    return false;
  }

  /**
   * Kiểm tra xem targetUser có thuộc cây phân cấp dưới quyền của user không
   */
  canAccessUser(user: UserProfile | null | undefined, targetUser: UserProfile): boolean {
    if (!user) return false;
    if (this.isGlobalViewer(user)) return true;

    // Giám đốc Sàn: chỉ xem được nhân sự thuộc sàn của mình (và không xem được Admin / Director cấp cao)
    if (user.role === 'sales_manager' || (user.role === 'director' && user.agency_id)) {
      if (targetUser.role === 'admin' || (targetUser.role === 'director' && !targetUser.agency_id)) {
        return false;
      }
      return targetUser.agency_id === user.agency_id || targetUser.id === user.id;
    }

    // Trưởng nhóm: chỉ xem được nhân sự trong team của mình
    if (user.role === 'team_leader') {
      if (['admin', 'director', 'sales_manager'].includes(targetUser.role)) {
        return false;
      }
      return targetUser.team_id === user.team_id || targetUser.id === user.id;
    }

    // Chuyên viên tư vấn (Sale): chỉ xem được chính mình
    if (user.role === 'sale_agent') {
      return targetUser.id === user.id;
    }

    // HR/Marketing được gắn riêng với một Director: chỉ xem các nhân sự thuộc các sàn do Director đó quản lý
    if (user.reporting_to && (user.role === 'hr_admin' || user.role === 'marketing_manager')) {
      return targetUser.reporting_to === user.reporting_to || targetUser.id === user.id;
    }

    return targetUser.id === user.id;
  }

  /**
   * Lọc danh sách sàn theo quyền nhánh
   */
  filterAgencies<T extends { id: string }>(user: UserProfile | null | undefined, agencies: T[]): T[] {
    if (!user || this.isGlobalViewer(user)) return agencies;
    if (user.agency_id) {
      return agencies.filter(a => a.id === user.agency_id);
    }
    return agencies;
  }

  /**
   * Lọc danh sách đội nhóm theo quyền nhánh
   */
  filterTeams<T extends { id: string; agency_id?: string }>(user: UserProfile | null | undefined, teams: T[]): T[] {
    if (!user || this.isGlobalViewer(user)) return teams;
    if (user.role === 'sales_manager' || (user.role === 'director' && user.agency_id)) {
      return teams.filter(t => t.agency_id === user.agency_id);
    }
    if (user.role === 'team_leader' || user.role === 'sale_agent') {
      return teams.filter(t => t.id === user.team_id);
    }
    return teams;
  }

  /**
   * Lọc danh sách hồ sơ nhân sự theo quyền nhánh
   */
  filterProfiles(user: UserProfile | null | undefined, profiles: UserProfile[]): UserProfile[] {
    if (!user || this.isGlobalViewer(user)) return profiles;
    return profiles.filter(p => this.canAccessUser(user, p));
  }

  /**
   * Lọc danh sách hợp đồng / giao dịch theo quyền nhánh
   */
  filterTransactions<T extends { agency_id?: string; team_id?: string; sale_id?: string; created_by?: string }>(
    user: UserProfile | null | undefined, 
    transactions: T[]
  ): T[] {
    if (!user || this.isGlobalViewer(user)) return transactions;

    if (user.role === 'sales_manager' || (user.role === 'director' && user.agency_id)) {
      return transactions.filter(t => t.agency_id === user.agency_id);
    }
    if (user.role === 'team_leader') {
      return transactions.filter(t => t.team_id === user.team_id);
    }
    if (user.role === 'sale_agent') {
      return transactions.filter(t => t.sale_id === user.id || t.created_by === user.id);
    }
    return transactions;
  }

  /**
   * Lọc Bảng Xếp Hạng Thi Đua (Doanh số, HĐMB, Hoa hồng) theo cấp bậc và nhánh
   */
  filterLeaderboardItems(
    user: UserProfile | null | undefined,
    type: 'agency' | 'sales_manager' | 'team' | 'sale_agent',
    items: LeaderboardItem[],
    allTeams?: Team[],
    allProfiles?: UserProfile[]
  ): LeaderboardItem[] {
    if (!user || this.isGlobalViewer(user)) return items;

    if (type === 'agency') {
      // Giám đốc sàn, Trưởng nhóm, Sale chỉ thấy sàn của mình
      if (user.agency_id) {
        return items.filter(it => it.id === user.agency_id);
      }
      return items;
    }

    if (type === 'sales_manager') {
      // Giám đốc sàn chỉ thấy chính sàn mình
      if (user.agency_id) {
        return items.filter(it => it.id === user.agency_id);
      }
      return items;
    }

    if (type === 'team') {
      // Giám đốc sàn: xem các team thuộc sàn của mình
      if (user.role === 'sales_manager' || (user.role === 'director' && user.agency_id)) {
        if (allTeams && allTeams.length > 0) {
          const allowedTeamIds = new Set(allTeams.filter(t => t.agency_id === user.agency_id).map(t => t.id));
          return items.filter(it => allowedTeamIds.has(it.id));
        }
        return items;
      }
      // Trưởng nhóm & Sale: chỉ xem team của mình
      if (user.team_id) {
        return items.filter(it => it.id === user.team_id);
      }
      return items;
    }

    if (type === 'sale_agent') {
      // Giám đốc sàn: xem các sale thuộc sàn của mình
      if (user.role === 'sales_manager' || (user.role === 'director' && user.agency_id)) {
        if (allProfiles && allProfiles.length > 0) {
          const allowedSaleIds = new Set(allProfiles.filter(p => p.agency_id === user.agency_id).map(p => p.id));
          return items.filter(it => allowedSaleIds.has(it.id));
        }
        return items;
      }
      // Trưởng nhóm: xem các sale thuộc team của mình
      if (user.role === 'team_leader') {
        if (allProfiles && allProfiles.length > 0) {
          const allowedSaleIds = new Set(allProfiles.filter(p => p.team_id === user.team_id).map(p => p.id));
          return items.filter(it => allowedSaleIds.has(it.id));
        }
        return items;
      }
      // Sale: chỉ xem chính mình
      if (user.role === 'sale_agent') {
        return items.filter(it => it.id === user.id);
      }
    }

    return items;
  }

  /**
   * Lọc danh sách thi đua tuyển dụng theo nhánh
   */
  filterRecruiterRanks(
    user: UserProfile | null | undefined,
    recruiters: RecruiterRank[],
    allProfiles?: UserProfile[]
  ): RecruiterRank[] {
    if (!user || this.isGlobalViewer(user)) return recruiters;

    if (user.role === 'sales_manager' || (user.role === 'director' && user.agency_id)) {
      return recruiters.filter(r => {
        if (r.agencyId) return r.agencyId === user.agency_id;
        const p = allProfiles?.find(prof => prof.id === r.recruiterId);
        return p?.agency_id === user.agency_id;
      });
    }

    if (user.role === 'team_leader') {
      return recruiters.filter(r => {
        if (r.teamId) return r.teamId === user.team_id;
        const p = allProfiles?.find(prof => prof.id === r.recruiterId);
        return p?.team_id === user.team_id || r.recruiterId === user.id;
      });
    }

    if (user.role === 'sale_agent') {
      return recruiters.filter(r => r.recruiterId === user.id);
    }

    return recruiters;
  }

  /**
   * Lọc bảng xếp hạng quy mô sàn (Agency HR) theo nhánh
   */
  filterAgencyHRRanks(
    user: UserProfile | null | undefined,
    agencies: AgencyHRRank[]
  ): AgencyHRRank[] {
    if (!user || this.isGlobalViewer(user)) return agencies;
    if (user.agency_id) {
      return agencies.filter(a => a.agencyId === user.agency_id);
    }
    return agencies;
  }
}

export const branchHierarchyService = new BranchHierarchyService();
