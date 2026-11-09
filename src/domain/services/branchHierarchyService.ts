// ========================================================
// REAL ESTATE CRM - BRANCH HIERARCHY & DATA SCOPING SERVICE
// Cưỡng chế phân quyền cây phân cấp (Branch / Subtree Scoping)
// Cơ cấu mới:
// Tổng Giám Đốc (ceo)
//   ├─ Khối Kinh Doanh: Giám Đốc Vùng (regional_director) → Giám Đốc Sàn (director) → Trưởng Phòng (sales_manager) → Trưởng Nhóm (team_leader) → Chuyên Viên (sale_agent)
//   ├─ Khối Marketing: Giám Đốc Marketing (marketing_manager) → Đơn Vị Marketing
//   └─ Khối HR: Giám Đốc HR (hr_admin) → Nhân Viên HR
// Quản trị kỹ thuật: admin
// ========================================================

import { UserProfile, UserRole, Team, Transaction, LeaderboardItem, RecruiterRank, AgencyHRRank, Agency, Region } from '../types';

export class BranchHierarchyService {
  /**
   * Kiểm tra người dùng có quyền xem toàn hệ thống (Admin, CEO, Directors không gắn sàn, HR/Marketing toàn quyền)
   * Marketing và HR được view toàn bộ giám đốc vùng như CEO và trực thuộc CEO
   */
  isGlobalViewer(user: UserProfile | null | undefined): boolean {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'ceo' || user.role === 'hr_admin' || user.role === 'marketing_manager') {
      return true;
    }
    
    // Directors (không gắn agency_id cụ thể): xem toàn quyền
    if (user.role === 'director' && !user.agency_id) {
      return true;
    }

    return false;
  }

  /**
   * Kiểm tra quyền truy cập vào một vùng kinh doanh cụ thể
   */
  canAccessRegion(user: UserProfile | null | undefined, regionId?: string): boolean {
    if (!user) return false;
    if (this.isGlobalViewer(user)) return true;
    if (!regionId) return true;

    if (user.role === 'regional_director') {
      return user.region_id === regionId;
    }

    if (user.role === 'director' || user.role === 'sales_manager') {
      return !user.region_id || user.region_id === regionId;
    }

    return false;
  }

  /**
   * Kiểm tra quyền truy cập vào một sàn giao dịch cụ thể
   */
  canAccessAgency(user: UserProfile | null | undefined, agencyId?: string, agencyRegionId?: string): boolean {
    if (!user) return false;
    if (this.isGlobalViewer(user)) return true;
    if (!agencyId) return true;

    // Giám đốc Vùng: xem được các sàn thuộc vùng của mình
    if (user.role === 'regional_director') {
      if (agencyRegionId) return agencyRegionId === user.region_id;
      // Tra cứu từ local storage nếu có
      if (typeof localStorage !== 'undefined') {
        const agencies: Agency[] = JSON.parse(localStorage.getItem('crm_agencies') || '[]');
        const ag = agencies.find(a => a.id === agencyId);
        if (ag && ag.region_id) {
          return ag.region_id === user.region_id;
        }
      }
      return true;
    }

    return user.agency_id === agencyId;
  }

  /**
   * Kiểm tra quyền truy cập vào một đội nhóm cụ thể
   */
  canAccessTeam(user: UserProfile | null | undefined, teamId?: string, teamAgencyId?: string): boolean {
    if (!user) return false;
    if (this.isGlobalViewer(user)) return true;
    if (!teamId) return true;

    // Giám đốc Vùng: xem các team thuộc các sàn trong vùng của mình
    if (user.role === 'regional_director') {
      if (teamAgencyId) {
        return this.canAccessAgency(user, teamAgencyId);
      }
      return true;
    }

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

    // Giám đốc Vùng: xem được nhân sự thuộc các sàn trong vùng, không xem Admin / CEO / HR / Marketing
    if (user.role === 'regional_director') {
      if (['admin', 'ceo', 'hr_admin', 'marketing_manager'].includes(targetUser.role)) {
        return false;
      }
      if (targetUser.role === 'regional_director' && targetUser.id !== user.id) {
        return false;
      }
      if (targetUser.region_id && user.region_id) {
        return targetUser.region_id === user.region_id;
      }
      if (targetUser.agency_id && typeof localStorage !== 'undefined') {
        const agencies: Agency[] = JSON.parse(localStorage.getItem('crm_agencies') || '[]');
        const ag = agencies.find(a => a.id === targetUser.agency_id);
        if (ag && ag.region_id) {
          return ag.region_id === user.region_id;
        }
      }
      return targetUser.id === user.id;
    }

    // Giám đốc Sàn: chỉ xem được nhân sự thuộc sàn của mình (và không xem được Admin, CEO, Giám đốc Vùng, HR, Marketing, Director khác)
    if (user.role === 'sales_manager' || (user.role === 'director' && user.agency_id)) {
      if (['admin', 'ceo', 'regional_director', 'hr_admin', 'marketing_manager'].includes(targetUser.role) || (targetUser.role === 'director' && !targetUser.agency_id)) {
        return false;
      }
      return targetUser.agency_id === user.agency_id || targetUser.id === user.id;
    }

    // Trưởng nhóm: chỉ xem được nhân sự trong team của mình
    if (user.role === 'team_leader') {
      if (['admin', 'ceo', 'regional_director', 'director', 'sales_manager', 'hr_admin', 'marketing_manager'].includes(targetUser.role)) {
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
   * Lọc danh sách vùng theo quyền nhánh
   */
  filterRegions<T extends { id: string }>(user: UserProfile | null | undefined, regions: T[]): T[] {
    if (!user || this.isGlobalViewer(user)) return regions;
    if (user.role === 'regional_director' && user.region_id) {
      return regions.filter(r => r.id === user.region_id);
    }
    if (user.region_id) {
      return regions.filter(r => r.id === user.region_id);
    }
    if (user.agency_id && typeof localStorage !== 'undefined') {
      const agencies: Agency[] = JSON.parse(localStorage.getItem('crm_agencies') || '[]');
      const ag = agencies.find(a => a.id === user.agency_id);
      if (ag && ag.region_id) {
        return regions.filter(r => r.id === ag.region_id);
      }
    }
    return regions;
  }

  /**
   * Lọc danh sách nhân viên tư vấn / sale theo quyền nhánh
   */
  filterSales<T extends UserProfile>(user: UserProfile | null | undefined, profiles: T[]): T[] {
    if (!user || this.isGlobalViewer(user)) return profiles;
    return profiles.filter(p => this.canAccessUser(user, p));
  }

  /**
   * Lọc danh sách sàn theo quyền nhánh
   */
  filterAgencies<T extends { id: string; region_id?: string }>(user: UserProfile | null | undefined, agencies: T[]): T[] {
    if (!user || this.isGlobalViewer(user)) return agencies;
    if (user.role === 'regional_director' && user.region_id) {
      return agencies.filter(a => a.region_id === user.region_id);
    }
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
    if (user.role === 'regional_director' && user.region_id && typeof localStorage !== 'undefined') {
      const agencies: Agency[] = JSON.parse(localStorage.getItem('crm_agencies') || '[]');
      const allowedAgencyIds = new Set(agencies.filter(a => a.region_id === user.region_id).map(a => a.id));
      return teams.filter(t => t.agency_id && allowedAgencyIds.has(t.agency_id));
    }
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
  filterTransactions<T extends { agency_id?: string; team_id?: string; sale_id?: string; created_by?: string; region_id?: string }>(
    user: UserProfile | null | undefined, 
    transactions: T[]
  ): T[] {
    if (!user || this.isGlobalViewer(user)) return transactions;

    if (user.role === 'regional_director' && user.region_id) {
      if (typeof localStorage !== 'undefined') {
        const agencies: Agency[] = JSON.parse(localStorage.getItem('crm_agencies') || '[]');
        const allowedAgencyIds = new Set(agencies.filter(a => a.region_id === user.region_id).map(a => a.id));
        return transactions.filter(t => (t.region_id && t.region_id === user.region_id) || (t.agency_id && allowedAgencyIds.has(t.agency_id)));
      }
      return transactions.filter(t => t.region_id === user.region_id);
    }

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
   * Lọc danh sách Lead theo quyền nhánh (Branch Subtree Scoping)
   * ceo -> regional_director -> director -> team_leader -> sale_agent
   * Marketing và HR có quyền xem toàn bộ như ceo
   */
  filterLeads<T extends { agency_id?: string; team_id?: string; assigned_to?: string; region_id?: string }>(
    user: UserProfile | null | undefined,
    leads: T[]
  ): T[] {
    if (!user || this.isGlobalViewer(user)) return leads;

    if (user.role === 'regional_director' && user.region_id) {
      if (typeof localStorage !== 'undefined') {
        const agencies: Agency[] = JSON.parse(localStorage.getItem('crm_agencies') || '[]');
        const allowedAgencyIds = new Set(agencies.filter(a => a.region_id === user.region_id).map(a => a.id));
        return leads.filter(l => (l.region_id && l.region_id === user.region_id) || (l.agency_id && allowedAgencyIds.has(l.agency_id)));
      }
      return leads.filter(l => l.region_id === user.region_id);
    }

    if (user.role === 'sales_manager' || (user.role === 'director' && user.agency_id)) {
      return leads.filter(l => l.agency_id === user.agency_id);
    }

    if (user.role === 'team_leader' && user.team_id) {
      return leads.filter(l => l.team_id === user.team_id);
    }

    if (user.role === 'sale_agent') {
      return leads.filter(l => l.assigned_to === user.id);
    }

    return leads;
  }

  /**
   * Lọc Bảng Xếp Hạng Thi Đua (Doanh số, HĐMB, Hoa hồng) theo cấp bậc và nhánh
   */
  filterLeaderboardItems(
    user: UserProfile | null | undefined,
    type: 'region' | 'agency' | 'sales_manager' | 'team' | 'sale_agent',
    items: LeaderboardItem[],
    allTeams?: Team[],
    allProfiles?: UserProfile[]
  ): LeaderboardItem[] {
    if (!user || this.isGlobalViewer(user)) return items;

    if (type === 'region') {
      if (user.role === 'regional_director' && user.region_id) {
        return items.filter(it => it.id === user.region_id);
      }
      return items;
    }

    if (type === 'agency') {
      if (user.role === 'regional_director' && user.region_id && typeof localStorage !== 'undefined') {
        const agencies: Agency[] = JSON.parse(localStorage.getItem('crm_agencies') || '[]');
        const allowedAgencyIds = new Set(agencies.filter(a => a.region_id === user.region_id).map(a => a.id));
        return items.filter(it => allowedAgencyIds.has(it.id));
      }
      // Giám đốc sàn, Trưởng nhóm, Sale chỉ thấy sàn của mình
      if (user.agency_id) {
        return items.filter(it => it.id === user.agency_id);
      }
      return items;
    }

    if (type === 'sales_manager') {
      if (user.role === 'regional_director' && user.region_id && typeof localStorage !== 'undefined') {
        const agencies: Agency[] = JSON.parse(localStorage.getItem('crm_agencies') || '[]');
        const allowedAgencyIds = new Set(agencies.filter(a => a.region_id === user.region_id).map(a => a.id));
        return items.filter(it => allowedAgencyIds.has(it.id));
      }
      // Giám đốc sàn chỉ thấy chính sàn mình
      if (user.agency_id) {
        return items.filter(it => it.id === user.agency_id);
      }
      return items;
    }

    if (type === 'team') {
      if (user.role === 'regional_director' && user.region_id && typeof localStorage !== 'undefined') {
        const agencies: Agency[] = JSON.parse(localStorage.getItem('crm_agencies') || '[]');
        const allowedAgencyIds = new Set(agencies.filter(a => a.region_id === user.region_id).map(a => a.id));
        if (allTeams && allTeams.length > 0) {
          const allowedTeamIds = new Set(allTeams.filter(t => t.agency_id && allowedAgencyIds.has(t.agency_id)).map(t => t.id));
          return items.filter(it => allowedTeamIds.has(it.id));
        }
      }
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
      if (user.role === 'regional_director' && user.region_id && typeof localStorage !== 'undefined') {
        const agencies: Agency[] = JSON.parse(localStorage.getItem('crm_agencies') || '[]');
        const allowedAgencyIds = new Set(agencies.filter(a => a.region_id === user.region_id).map(a => a.id));
        if (allProfiles && allProfiles.length > 0) {
          const allowedSaleIds = new Set(allProfiles.filter(p => p.agency_id && allowedAgencyIds.has(p.agency_id)).map(p => p.id));
          return items.filter(it => allowedSaleIds.has(it.id));
        }
      }
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

    if (user.role === 'regional_director' && user.region_id && typeof localStorage !== 'undefined') {
      const agencies: Agency[] = JSON.parse(localStorage.getItem('crm_agencies') || '[]');
      const allowedAgencyIds = new Set(agencies.filter(a => a.region_id === user.region_id).map(a => a.id));
      return recruiters.filter(r => {
        if (r.agencyId) return allowedAgencyIds.has(r.agencyId);
        const p = allProfiles?.find(prof => prof.id === r.recruiterId);
        return p?.agency_id && allowedAgencyIds.has(p.agency_id);
      });
    }

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
