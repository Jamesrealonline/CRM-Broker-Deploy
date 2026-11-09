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
   * Kiểm tra người dùng có quyền xem toàn hệ thống (Quản trị viên Admin)
   * Quản Trị Viên (admin): Có quyền xem toàn bộ hệ thống (isGlobalViewer = true) bao gồm tất cả các ceo.
   * Tổng Giám Đốc (ceo) chỉ xem được toàn bộ hệ thống các giám đốc vùng bên dưới, các ceo khác nhau không xem được hệ thống của nhau.
   */
  isGlobalViewer(user: UserProfile | null | undefined): boolean {
    if (!user) return false;
    return user.role === 'admin';
  }

  /**
   * Kiểm tra quyền truy cập vào một vùng kinh doanh cụ thể
   */
  canAccessRegion(user: UserProfile | null | undefined, regionId?: string): boolean {
    if (!user) return false;
    if (this.isGlobalViewer(user)) return true;
    if (!regionId) return true;

    // CEO, HR, Marketing: xem được toàn bộ các giám đốc vùng bên dưới mình, không xem vùng của CEO khác
    if (user.role === 'ceo' || user.role === 'hr_admin' || user.role === 'marketing_manager') {
      if (user.organization_id && typeof localStorage !== 'undefined') {
        const regions: Region[] = JSON.parse(localStorage.getItem('crm_regions') || '[]');
        const reg = regions.find(r => r.id === regionId);
        if (reg && reg.organization_id && reg.organization_id !== user.organization_id) {
          return false;
        }
      }
      return true;
    }

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

    // CEO, HR, Marketing: xem được các sàn bên dưới giám đốc vùng của mình, không xem sàn của CEO khác
    if (user.role === 'ceo' || user.role === 'hr_admin' || user.role === 'marketing_manager') {
      if (user.organization_id && typeof localStorage !== 'undefined') {
        const agencies: Agency[] = JSON.parse(localStorage.getItem('crm_agencies') || '[]');
        const ag = agencies.find(a => a.id === agencyId);
        if (ag && ag.organization_id && ag.organization_id !== user.organization_id) {
          return false;
        }
      }
      return true;
    }

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

    // Giám đốc Sàn: nếu không gắn sàn cụ thể (hoặc cờ director_global_scope) thì xem được
    if (user.role === 'director' && !user.agency_id) {
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

    // CEO, HR, Marketing: xem được các đội nhóm bên dưới hệ thống của mình
    if (user.role === 'ceo' || user.role === 'hr_admin' || user.role === 'marketing_manager') {
      if (user.organization_id && typeof localStorage !== 'undefined') {
        const teams: Team[] = JSON.parse(localStorage.getItem('crm_teams') || '[]');
        const tm = teams.find(t => t.id === teamId);
        const agId = teamAgencyId || tm?.agency_id;
        if (agId) {
          const agencies: Agency[] = JSON.parse(localStorage.getItem('crm_agencies') || '[]');
          const ag = agencies.find(a => a.id === agId);
          if (ag && ag.organization_id && ag.organization_id !== user.organization_id) {
            return false;
          }
        }
      }
      return true;
    }

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
    // 1. Quản Trị Viên (admin): Có quyền xem toàn bộ hệ thống bao gồm tất cả các ceo
    if (this.isGlobalViewer(user)) return true;

    // 2. Không vai trò nào được xem tài khoản của Admin (trừ chính Admin)
    if (targetUser.role === 'admin') {
      return false;
    }

    // 3. Tổng Giám Đốc (CEO):
    // "Tổng Giám Đốc (ceo) chỉ xem được toàn bộ hệ thống các giám đốc vùng bên dưới , các ceo khác nhau không xem được hệ thống của nhau"
    if (user.role === 'ceo') {
      if (targetUser.id === user.id) return true;
      // Chặn xem các CEO khác
      if (targetUser.role === 'ceo') return false;

      // Chặn xem nhân sự thuộc tổ chức/doanh nghiệp của CEO khác
      if (user.organization_id && targetUser.organization_id && user.organization_id !== targetUser.organization_id) {
        return false;
      }

      // CEO xem được toàn bộ hệ thống các giám đốc vùng bên dưới và các cấp dưới
      return true;
    }

    // 4. Khối Marketing & HR: trực thuộc CEO, xem được toàn bộ hệ thống các giám đốc vùng bên dưới CEO của mình
    if (user.role === 'hr_admin' || user.role === 'marketing_manager') {
      if (targetUser.id === user.id) return true;
      // Nếu gắn riêng với một Director: chỉ xem nhân sự cùng reporting_to hoặc chính mình
      if (user.reporting_to) {
        return targetUser.reporting_to === user.reporting_to || targetUser.id === user.id;
      }
      if (targetUser.role === 'ceo') {
        return !user.organization_id || targetUser.organization_id === user.organization_id;
      }
      if (user.organization_id && targetUser.organization_id && user.organization_id !== targetUser.organization_id) {
        return false;
      }
      return true;
    }

    // 5. Giám đốc Vùng: xem được nhân sự thuộc các sàn trong vùng, không xem Admin / CEO / HR / Marketing / GĐ Vùng khác
    if (user.role === 'regional_director') {
      if (['admin', 'ceo', 'hr_admin', 'marketing_manager'].includes(targetUser.role)) {
        return false;
      }
      if (targetUser.role === 'regional_director') {
        return targetUser.id === user.id;
      }
      if (user.organization_id && targetUser.organization_id && user.organization_id !== targetUser.organization_id) {
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

    // 6. Giám đốc Sàn: chỉ xem được nhân sự thuộc sàn của mình (và không xem được Admin, CEO, Giám đốc Vùng, HR, Marketing, Director khác)
    if (user.role === 'sales_manager' || (user.role === 'director' && user.agency_id)) {
      if (['admin', 'ceo', 'regional_director', 'hr_admin', 'marketing_manager'].includes(targetUser.role) || (targetUser.role === 'director' && targetUser.id !== user.id)) {
        return false;
      }
      return targetUser.agency_id === user.agency_id || targetUser.id === user.id;
    }

    // 7. Trưởng nhóm: chỉ xem được nhân sự trong team của mình
    if (user.role === 'team_leader') {
      if (['admin', 'ceo', 'regional_director', 'director', 'sales_manager', 'hr_admin', 'marketing_manager'].includes(targetUser.role)) {
        return false;
      }
      return targetUser.team_id === user.team_id || targetUser.id === user.id;
    }

    // 8. Chuyên viên tư vấn (Sale): chỉ xem được chính mình
    if (user.role === 'sale_agent') {
      return targetUser.id === user.id;
    }

    return targetUser.id === user.id;
  }

  /**
   * Lọc danh sách vùng theo quyền nhánh
   */
  filterRegions<T extends { id: string; organization_id?: string }>(user: UserProfile | null | undefined, regions: T[]): T[] {
    if (!user) return regions;
    if (this.isGlobalViewer(user)) return regions;

    // CEO, HR, Marketing: chỉ xem các vùng thuộc tổ chức/doanh nghiệp của mình (chặn xem vùng của CEO khác)
    if (user.role === 'ceo' || user.role === 'hr_admin' || user.role === 'marketing_manager') {
      if (user.organization_id) {
        return regions.filter(r => !r.organization_id || r.organization_id === user.organization_id);
      }
      return regions;
    }

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
  filterAgencies<T extends { id: string; region_id?: string; organization_id?: string }>(user: UserProfile | null | undefined, agencies: T[]): T[] {
    if (!user) return agencies;
    if (this.isGlobalViewer(user)) return agencies;

    // CEO, HR, Marketing: chỉ xem các sàn thuộc tổ chức/doanh nghiệp của mình (chặn xem sàn của CEO khác)
    if (user.role === 'ceo' || user.role === 'hr_admin' || user.role === 'marketing_manager') {
      if (user.organization_id) {
        return agencies.filter(a => !a.organization_id || a.organization_id === user.organization_id);
      }
      return agencies;
    }

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
  filterTeams<T extends { id: string; agency_id?: string; organization_id?: string }>(user: UserProfile | null | undefined, teams: T[]): T[] {
    if (!user) return teams;
    if (this.isGlobalViewer(user)) return teams;

    // CEO, HR, Marketing: chỉ xem các đội nhóm thuộc tổ chức/doanh nghiệp của mình
    if (user.role === 'ceo' || user.role === 'hr_admin' || user.role === 'marketing_manager') {
      if (user.organization_id && typeof localStorage !== 'undefined') {
        const agencies: Agency[] = JSON.parse(localStorage.getItem('crm_agencies') || '[]');
        const allowedAgencyIds = new Set(agencies.filter(a => !a.organization_id || a.organization_id === user.organization_id).map(a => a.id));
        return teams.filter(t => !t.agency_id || allowedAgencyIds.has(t.agency_id));
      }
      return teams;
    }

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
    if (!user) return profiles;
    if (this.isGlobalViewer(user)) return profiles;
    return profiles.filter(p => this.canAccessUser(user, p));
  }

  /**
   * Lọc danh sách hợp đồng / giao dịch theo quyền nhánh
   */
  filterTransactions<T extends { agency_id?: string; team_id?: string; sale_id?: string; created_by?: string; region_id?: string; organization_id?: string }>(
    user: UserProfile | null | undefined, 
    transactions: T[]
  ): T[] {
    if (!user) return transactions;
    if (this.isGlobalViewer(user)) return transactions;

    // CEO, HR, Marketing: chỉ xem giao dịch thuộc tổ chức/doanh nghiệp của mình
    if (user.role === 'ceo' || user.role === 'hr_admin' || user.role === 'marketing_manager') {
      if (user.organization_id) {
        return transactions.filter(t => !t.organization_id || t.organization_id === user.organization_id);
      }
      return transactions;
    }

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
  filterLeads<T extends { agency_id?: string; team_id?: string; assigned_to?: string; region_id?: string; organization_id?: string }>(
    user: UserProfile | null | undefined,
    leads: T[]
  ): T[] {
    if (!user) return leads;
    if (this.isGlobalViewer(user)) return leads;

    // CEO, HR, Marketing: chỉ xem lead thuộc tổ chức/doanh nghiệp của mình
    if (user.role === 'ceo' || user.role === 'hr_admin' || user.role === 'marketing_manager') {
      if (user.organization_id) {
        return leads.filter(l => !l.organization_id || l.organization_id === user.organization_id);
      }
      return leads;
    }

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
    type: 'ceo' | 'region' | 'agency' | 'sales_manager' | 'team' | 'sale_agent',
    items: LeaderboardItem[],
    allTeams?: Team[],
    allProfiles?: UserProfile[]
  ): LeaderboardItem[] {
    if (!user || this.isGlobalViewer(user)) return items;

    if (type === 'ceo') {
      // CEO chỉ xem được chính mình (không xem CEO khác)
      if (user.role === 'ceo') {
        return items.filter(it => it.id === user.id);
      }
      // Các cấp dưới chỉ xem CEO thuộc tổ chức của mình
      if (user.organization_id && allProfiles) {
        const myCeoIds = new Set(allProfiles.filter(p => p.role === 'ceo' && p.organization_id === user.organization_id).map(p => p.id));
        if (myCeoIds.size > 0) {
          return items.filter(it => myCeoIds.has(it.id));
        }
      }
      return items;
    }

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
