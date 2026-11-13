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
import { INITIAL_AGENCIES } from '@/data/mockData';

export class BranchHierarchyService {
  /**
   * Helper lấy danh sách Sàn Giao Dịch lưu tạm hoặc mặc định
   */
  getCachedAgencies(): Agency[] {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('crm_agencies');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {}
      }
    }
    return INITIAL_AGENCIES;
  }
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

    // CEO, Company Admin, HR, Marketing: xem được toàn bộ các giám đốc vùng bên dưới mình, không xem vùng của CEO khác
    if (user.role === 'ceo' || user.role === 'company_admin' || user.role === 'hr_admin' || user.role === 'marketing_manager') {
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

    // CEO, Company Admin, HR, Marketing: xem được các sàn bên dưới giám đốc vùng của mình, không xem sàn của CEO khác
    if (user.role === 'ceo' || user.role === 'company_admin' || user.role === 'hr_admin' || user.role === 'marketing_manager') {
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

    // CEO, Company Admin, HR, Marketing: xem được các đội nhóm bên dưới hệ thống của mình
    if (user.role === 'ceo' || user.role === 'company_admin' || user.role === 'hr_admin' || user.role === 'marketing_manager') {
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

    // 2a. Multi-tenant isolation: Nhân sự thuộc doanh nghiệp nào chỉ xem nhân sự thuộc doanh nghiệp đó
    if (user.organization_id && targetUser.organization_id && user.organization_id !== targetUser.organization_id) {
      return false;
    }

    // 2b. Quyền xem tài khoản Quản Trị Doanh Nghiệp (company_admin):
    // Chỉ Quản Trị Tổng (Admin), CEO cùng doanh nghiệp hoặc chính Company Admin cùng doanh nghiệp mới được xem.
    // Các vai trò cấp dưới hoặc doanh nghiệp khác tuyệt đối không xem được.
    if (targetUser.role === 'company_admin') {
      if (user.role === 'company_admin' || user.role === 'ceo') {
        return !user.organization_id || !targetUser.organization_id || user.organization_id === targetUser.organization_id;
      }
      return false;
    }

    // 3. Quản Trị Doanh Nghiệp (company_admin):
    // Quản trị cấu hình và các tài khoản trong doanh nghiệp đó, dưới quyền Quản Trị Tổng.
    // Chung doanh nghiệp với CEO nào chỉ quản trị cho doanh nghiệp đó, không xem doanh nghiệp khác.
    if (user.role === 'company_admin') {
      if (targetUser.id === user.id) return true;
      // Chặn xem CEO của DN khác (xem được CEO của chính DN mình)
      if (targetUser.role === 'ceo') {
        return !user.organization_id || !targetUser.organization_id || user.organization_id === targetUser.organization_id;
      }
      if (user.organization_id && targetUser.organization_id && user.organization_id !== targetUser.organization_id) {
        return false;
      }
      return true;
    }

    // 4. Tổng Giám Đốc (CEO):
    // "Tổng Giám Đốc (ceo) chỉ xem được toàn bộ hệ thống các giám đốc vùng bên dưới , các ceo khác nhau không xem được hệ thống của nhau"
    if (user.role === 'ceo') {
      if (targetUser.id === user.id) return true;
      // Chặn xem các CEO khác
      if (targetUser.role === 'ceo') return false;

      // Chặn xem nhân sự thuộc tổ chức/doanh nghiệp của CEO khác
      if (user.organization_id && targetUser.organization_id && user.organization_id !== targetUser.organization_id) {
        return false;
      }
      return true;
    }

    // 5. Khối Marketing & HR: trực thuộc CEO, xem được toàn bộ hệ thống các giám đốc vùng bên dưới CEO của mình
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

    // 6. Giám đốc Vùng: xem được nhân sự thuộc các sàn trong vùng, không xem Admin / CEO / Company Admin / HR / Marketing / GĐ Vùng khác
    if (user.role === 'regional_director') {
      if (['admin', 'ceo', 'company_admin', 'hr_admin', 'marketing_manager'].includes(targetUser.role)) {
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
      if (targetUser.agency_id) {
        const agencies = this.getCachedAgencies();
        const ag = agencies.find(a => a.id === targetUser.agency_id);
        if (ag && ag.region_id) {
          return ag.region_id === user.region_id;
        }
      }
      return targetUser.id === user.id;
    }

    // 7. Giám đốc Sàn: chỉ xem được nhân sự thuộc sàn của mình (và không xem được Admin, CEO, Company Admin, Giám đốc Vùng, HR, Marketing, Director khác)
    if (user.role === 'sales_manager' || (user.role === 'director' && user.agency_id)) {
      if (['admin', 'ceo', 'company_admin', 'regional_director', 'hr_admin', 'marketing_manager'].includes(targetUser.role) || (targetUser.role === 'director' && targetUser.id !== user.id)) {
        return false;
      }
      return targetUser.agency_id === user.agency_id || targetUser.id === user.id;
    }

    // 8. Trưởng nhóm: chỉ xem được nhân sự trong team của mình
    if (user.role === 'team_leader') {
      if (['admin', 'ceo', 'company_admin', 'regional_director', 'director', 'sales_manager', 'hr_admin', 'marketing_manager'].includes(targetUser.role)) {
        return false;
      }
      return targetUser.team_id === user.team_id || targetUser.id === user.id;
    }

    // 9. Chuyên viên tư vấn (Sale): chỉ xem được chính mình
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

    // CEO, Company Admin, HR, Marketing: chỉ xem các vùng thuộc tổ chức/doanh nghiệp của mình (chặn xem vùng của CEO khác)
    if (user.role === 'ceo' || user.role === 'company_admin' || user.role === 'hr_admin' || user.role === 'marketing_manager') {
      if (user.organization_id) {
        return regions.filter(r => !r.organization_id || r.organization_id === user.organization_id);
      }
      return regions;
    }

    if (user.role === 'regional_director' && user.region_id) {
      return regions.filter(r => r.id === user.region_id && (!user.organization_id || !r.organization_id || r.organization_id === user.organization_id));
    }
    if (user.region_id) {
      return regions.filter(r => r.id === user.region_id && (!user.organization_id || !r.organization_id || r.organization_id === user.organization_id));
    }
    if (user.agency_id) {
      const agencies = this.getCachedAgencies();
      const ag = agencies.find(a => a.id === user.agency_id);
      if (ag && ag.region_id) {
        return regions.filter(r => r.id === ag.region_id && (!user.organization_id || !r.organization_id || r.organization_id === user.organization_id));
      }
    }
    if (user.organization_id) {
      return regions.filter(r => !r.organization_id || r.organization_id === user.organization_id);
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

    let orgAgencies = agencies;
    if (user.organization_id) {
      orgAgencies = orgAgencies.filter(a => !a.organization_id || a.organization_id === user.organization_id);
    }

    // CEO, Company Admin, HR, Marketing: chỉ xem các sàn thuộc tổ chức/doanh nghiệp của mình (chặn xem sàn của CEO khác)
    if (user.role === 'ceo' || user.role === 'company_admin' || user.role === 'hr_admin' || user.role === 'marketing_manager') {
      return orgAgencies;
    }

    if (user.role === 'regional_director' && user.region_id) {
      return orgAgencies.filter(a => a.region_id === user.region_id);
    }
    if (user.agency_id) {
      return orgAgencies.filter(a => a.id === user.agency_id);
    }
    return orgAgencies;
  }

  /**
   * Lọc danh sách đội nhóm theo quyền nhánh
   */
  filterTeams<T extends { id: string; agency_id?: string; organization_id?: string }>(user: UserProfile | null | undefined, teams: T[]): T[] {
    if (!user) return teams;
    if (this.isGlobalViewer(user)) return teams;

    // CEO, Company Admin, HR, Marketing: chỉ xem các đội nhóm thuộc tổ chức/doanh nghiệp của mình
    if (user.role === 'ceo' || user.role === 'company_admin' || user.role === 'hr_admin' || user.role === 'marketing_manager') {
      if (user.organization_id) {
        const agencies = this.getCachedAgencies();
        const allowedAgencyIds = new Set(agencies.filter(a => !a.organization_id || a.organization_id === user.organization_id).map(a => a.id));
        return teams.filter(t => !t.agency_id || allowedAgencyIds.has(t.agency_id));
      }
      return teams;
    }

    if (user.role === 'regional_director' && user.region_id) {
      const agencies = this.getCachedAgencies();
      const allowedAgencyIds = new Set(agencies.filter(a => a.region_id === user.region_id && (!user.organization_id || !a.organization_id || a.organization_id === user.organization_id)).map(a => a.id));
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

    // Multi-tenant: nếu user có organization_id thì chỉ xem transactions của organization_id đó
    let orgTransactions = transactions;
    if (user.organization_id) {
      orgTransactions = orgTransactions.filter(t => !t.organization_id || t.organization_id === user.organization_id);
    }

    // CEO, Company Admin, HR, Marketing: chỉ xem giao dịch thuộc tổ chức/doanh nghiệp của mình
    if (user.role === 'ceo' || user.role === 'company_admin' || user.role === 'hr_admin' || user.role === 'marketing_manager') {
      return orgTransactions;
    }

    if (user.role === 'regional_director' && user.region_id) {
      const agencies = this.getCachedAgencies();
      const allowedAgencyIds = new Set(agencies.filter(a => a.region_id === user.region_id).map(a => a.id));
      return orgTransactions.filter(t => (t.region_id && t.region_id === user.region_id) || (t.agency_id && allowedAgencyIds.has(t.agency_id)));
    }

    if (user.role === 'sales_manager' || (user.role === 'director' && user.agency_id)) {
      return orgTransactions.filter(t => t.agency_id === user.agency_id);
    }
    if (user.role === 'team_leader') {
      return orgTransactions.filter(t => t.team_id === user.team_id);
    }
    if (user.role === 'sale_agent') {
      return orgTransactions.filter(t => t.sale_id === user.id || t.created_by === user.id);
    }
    return orgTransactions;
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

    // Multi-tenant: nếu user có organization_id thì chỉ xem lead của organization_id đó
    let orgLeads = leads;
    if (user.organization_id) {
      orgLeads = orgLeads.filter(l => !l.organization_id || l.organization_id === user.organization_id);
    }

    // CEO, Company Admin, HR, Marketing: chỉ xem lead thuộc tổ chức/doanh nghiệp của mình
    if (user.role === 'ceo' || user.role === 'company_admin' || user.role === 'hr_admin' || user.role === 'marketing_manager') {
      return orgLeads;
    }

    if (user.role === 'regional_director' && user.region_id) {
      const agencies = this.getCachedAgencies();
      const allowedAgencyIds = new Set(agencies.filter(a => a.region_id === user.region_id).map(a => a.id));
      return orgLeads.filter(l => (l.region_id && l.region_id === user.region_id) || (l.agency_id && allowedAgencyIds.has(l.agency_id)));
    }

    if (user.role === 'sales_manager' || (user.role === 'director' && user.agency_id)) {
      return orgLeads.filter(l => l.agency_id === user.agency_id);
    }

    if (user.role === 'team_leader' && user.team_id) {
      return orgLeads.filter(l => l.team_id === user.team_id);
    }

    if (user.role === 'sale_agent') {
      return orgLeads.filter(l => l.assigned_to === user.id);
    }

    return orgLeads;
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
      // Quản trị DN chỉ xem CEO thuộc tổ chức của mình
      if (user.role === 'company_admin') {
        if (user.organization_id && allProfiles) {
          const myCeoIds = new Set(allProfiles.filter(p => p.role === 'ceo' && p.organization_id === user.organization_id).map(p => p.id));
          return items.filter(it => myCeoIds.has(it.id));
        }
        return [];
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
      if ((user.role === 'ceo' || user.role === 'company_admin' || user.role === 'hr_admin' || user.role === 'marketing_manager') && user.organization_id && typeof localStorage !== 'undefined') {
        const regions: Region[] = JSON.parse(localStorage.getItem('crm_regions') || '[]');
        const allowedRegionIds = new Set(regions.filter(r => !r.organization_id || r.organization_id === user.organization_id).map(r => r.id));
        return items.filter(it => allowedRegionIds.has(it.id));
      }
      if (user.role === 'regional_director' && user.region_id) {
        return items.filter(it => it.id === user.region_id);
      }
      return items;
    }

    if (type === 'agency') {
      if ((user.role === 'ceo' || user.role === 'company_admin' || user.role === 'hr_admin' || user.role === 'marketing_manager') && user.organization_id && typeof localStorage !== 'undefined') {
        const agencies: Agency[] = JSON.parse(localStorage.getItem('crm_agencies') || '[]');
        const allowedAgencyIds = new Set(agencies.filter(a => !a.organization_id || a.organization_id === user.organization_id).map(a => a.id));
        return items.filter(it => allowedAgencyIds.has(it.id));
      }
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
      if ((user.role === 'ceo' || user.role === 'company_admin' || user.role === 'hr_admin' || user.role === 'marketing_manager') && user.organization_id && typeof localStorage !== 'undefined') {
        const agencies: Agency[] = JSON.parse(localStorage.getItem('crm_agencies') || '[]');
        const allowedAgencyIds = new Set(agencies.filter(a => !a.organization_id || a.organization_id === user.organization_id).map(a => a.id));
        return items.filter(it => allowedAgencyIds.has(it.id));
      }
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
      if ((user.role === 'ceo' || user.role === 'company_admin' || user.role === 'hr_admin' || user.role === 'marketing_manager') && user.organization_id && typeof localStorage !== 'undefined') {
        const agencies: Agency[] = JSON.parse(localStorage.getItem('crm_agencies') || '[]');
        const allowedAgencyIds = new Set(agencies.filter(a => !a.organization_id || a.organization_id === user.organization_id).map(a => a.id));
        if (allTeams && allTeams.length > 0) {
          const allowedTeamIds = new Set(allTeams.filter(t => !t.agency_id || allowedAgencyIds.has(t.agency_id)).map(t => t.id));
          return items.filter(it => allowedTeamIds.has(it.id));
        }
      }
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
      if ((user.role === 'ceo' || user.role === 'company_admin' || user.role === 'hr_admin' || user.role === 'marketing_manager') && user.organization_id) {
        if (allProfiles && allProfiles.length > 0) {
          const allowedSaleIds = new Set(allProfiles.filter(p => !p.organization_id || p.organization_id === user.organization_id).map(p => p.id));
          return items.filter(it => allowedSaleIds.has(it.id));
        }
      }
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
   * Kiểm tra quyền truy cập vào một dự án
   */
  canAccessProject(user: UserProfile | null | undefined, project: { id: string; organization_id?: string } | null | undefined): boolean {
    if (!user || !project) return false;
    if (this.isGlobalViewer(user)) return true;
    if (user.organization_id && project.organization_id) {
      return project.organization_id === user.organization_id;
    }
    return false;
  }

  /**
   * Lọc danh sách dự án theo quyền tổ chức (CEO/Chi nhánh/Company Admin)
   */
  filterProjects<T extends { id: string; organization_id?: string }>(user: UserProfile | null | undefined, projects: T[]): T[] {
    if (!user || this.isGlobalViewer(user)) return projects;
    if (user.organization_id) {
      return projects.filter(p => p.organization_id === user.organization_id);
    }
    return [];
  }

  /**
   * Lọc danh sách tổ chức/doanh nghiệp: CEO/Company Admin chỉ thấy doanh nghiệp của mình, Admin thấy tất cả
   */
  filterOrganizations<T extends { id: string; ceo_id?: string | null; admin_id?: string | null }>(user: UserProfile | null | undefined, orgs: T[]): T[] {
    if (!user || this.isGlobalViewer(user)) return orgs;
    if (user.role === 'ceo') {
      return orgs.filter(o => o.id === user.organization_id || o.ceo_id === user.id);
    }
    if (user.role === 'company_admin') {
      return orgs.filter(o => o.id === user.organization_id || o.admin_id === user.id);
    }
    if (user.organization_id) {
      return orgs.filter(o => o.id === user.organization_id);
    }
    return orgs;
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

    if (user.role === 'ceo' || user.role === 'company_admin' || user.role === 'hr_admin' || user.role === 'marketing_manager') {
      if (user.organization_id && allProfiles && allProfiles.length > 0) {
        const allowedUserIds = new Set(allProfiles.filter(p => !p.organization_id || p.organization_id === user.organization_id).map(p => p.id));
        return recruiters.filter(r => allowedUserIds.has(r.recruiterId));
      }
      return recruiters;
    }

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
    if ((user.role === 'ceo' || user.role === 'company_admin' || user.role === 'hr_admin' || user.role === 'marketing_manager') && user.organization_id && typeof localStorage !== 'undefined') {
      const agenciesList: Agency[] = JSON.parse(localStorage.getItem('crm_agencies') || '[]');
      const allowedAgencyIds = new Set(agenciesList.filter(a => !a.organization_id || a.organization_id === user.organization_id).map(a => a.id));
      return agencies.filter(a => allowedAgencyIds.has(a.agencyId));
    }
    if (user.agency_id) {
      return agencies.filter(a => a.agencyId === user.agency_id);
    }
    return agencies;
  }
}

export const branchHierarchyService = new BranchHierarchyService();
