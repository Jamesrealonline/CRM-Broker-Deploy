// ========================================================
// REAL ESTATE CRM - TEAM & ORGANIZATION REPOSITORY
// Quản lý cơ cấu Tổ chức, Sàn, Team và Bổ nhiệm Nhân sự
// ========================================================

import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';
import { 
  Agency, 
  Team, 
  UserProfile, 
  UserRole,
  UserStatus,
  EmploymentType,
  TrashBinItem,
  Region,
  Organization,
  Division,
  CompanySettings,
  OrgPositionLevel,
  StructuralHealthReport
} from '@/domain/types';
import { 
  INITIAL_AGENCIES, 
  INITIAL_TEAMS, 
  INITIAL_PROFILES, 
  INITIAL_ORGS,
  INITIAL_REGIONS,
  INITIAL_DIVISIONS,
  INITIAL_COMPANY_SETTINGS,
  INITIAL_ORG_POSITIONS
} from '../mockData';
import { branchHierarchyService } from '@/domain/services/branchHierarchyService';

const STORAGE_KEY_ORGANIZATIONS = 'crm_organizations';
const STORAGE_KEY_AGENCIES = 'crm_agencies';
const STORAGE_KEY_TEAMS = 'crm_teams';
const STORAGE_KEY_PROFILES = 'crm_profiles';
const STORAGE_KEY_REGIONS = 'crm_regions';
const STORAGE_KEY_DIVISIONS = 'crm_divisions';
const STORAGE_KEY_COMPANY_SETTINGS = 'crm_company_settings';
const STORAGE_KEY_ORG_POSITIONS = 'crm_org_positions';

export interface CreateOrganizationInput {
  name: string;
  code?: string;
  tax_number?: string;
  phone?: string;
  email?: string;
  address?: string;
  ceo_id?: string | null;
  admin_id?: string | null;
}

/**
 * Tự động khởi tạo Mã Doanh Nghiệp (Enterprise Code) chuẩn hóa, duy nhất
 * Format: ORG-{ACRONYM} hoặc ORG-{SEQUENCE}
 * Tự động loại bỏ dấu tiếng Việt, xử lý stop words (Công ty, Cổ phần, TNHH, BĐS...)
 * Đảm bảo tính duy nhất không trùng lặp với các doanh nghiệp đã có.
 */
export function generateOrganizationCode(name?: string, existingOrgs: Organization[] = []): string {
  const existingCodes = new Set(existingOrgs.map(o => (o.code || '').trim().toUpperCase()));
  const trimmed = (name || '').trim();

  let baseCode = '';

  if (trimmed) {
    // 1. Chuẩn hóa tiếng Việt, loại bỏ dấu
    const normalized = trimmed
      .replace(/[đĐ]/g, 'd')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .trim();

    // 2. Danh sách stopwords doanh nghiệp VN thường gặp
    const stopWords = new Set([
      'cong', 'ty', 'cp', 'co', 'phan', 'tnhh', 'tap', 'doan', 'bds', 'bat', 'dong', 'san', 'group', 'corp', 'corporation', 'jsc', 'ltd'
    ]);

    const words = normalized.split(/\s+/).filter(w => w.length > 0);
    const significantWords = words.filter(w => !stopWords.has(w.toLowerCase()));

    const targetWords = significantWords.length > 0 ? significantWords : words;

    if (targetWords.length >= 2) {
      // Lấy chữ cái đầu (acronym) của các từ chính: "Dia Oc Vang Mien Trung" -> "DOVMT"
      const initials = targetWords.map(w => w[0].toUpperCase()).join('');
      baseCode = `ORG-${initials}`;
    } else if (targetWords.length === 1) {
      // Từ duy nhất: lấy tối đa 6 ký tự viết hoa
      const single = targetWords[0].toUpperCase().slice(0, 6);
      baseCode = `ORG-${single}`;
    }
  }

  // Nếu không có tên hoặc không tạo được baseCode từ tên:
  if (!baseCode) {
    const nextSeq = (existingOrgs.length + 1).toString().padStart(3, '0');
    baseCode = `ORG-${nextSeq}`;
  }

  // 3. Đảm bảo tính duy nhất, chống xung đột
  let candidate = baseCode;
  let counter = 1;

  while (existingCodes.has(candidate)) {
    candidate = `${baseCode}-${counter.toString().padStart(2, '0')}`;
    counter++;
  }

  return candidate;
}

export interface CreateUserInput {
  email: string;
  password?: string;
  full_name: string;
  phone: string;
  role: UserRole;
  organization_id?: string | null;
  agency_id?: string | null;
  team_id?: string | null;
  region_id?: string | null;
  position_code?: string | null;
  must_change_password?: boolean;
}

export interface UpdateUserInput {
  full_name?: string;
  phone?: string;
  email?: string;
  role?: UserRole;
  organization_id?: string | null;
  region_id?: string | null;
  agency_id?: string | null;
  team_id?: string | null;
  position_code?: string | null;
  employment_type?: EmploymentType;
  status?: UserStatus;
}

export interface DeleteUserOptions {
  delete_reason: string;
  handover_user_id?: string;
}

export interface CreateAgencyInput {
  name: string;
  code: string;
  organization_id?: string | null;
  region_id?: string | null;
  address?: string;
  phone?: string;
  email?: string;
  director_id?: string | null;
}

export interface CreateRegionInput {
  name: string;
  code: string;
  organization_id?: string | null;
  description?: string;
  regional_director_id?: string | null;
}

export interface CreateTeamInput {
  name: string;
  code: string;
  agency_id: string;
  leader_id?: string | null;
}

export class TeamRepository {
  /**
   * ==========================================
   * 0. DOANH NGHIỆP / TỔ CHỨC (CEO)
   * ==========================================
   */
  async getOrganizations(currentUser?: UserProfile): Promise<Organization[]> {
    let result: Organization[] = [];
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name');
      if (!error && data) {
        const orgs = data as Organization[];
        const profiles = await this.getProfiles();
        result = orgs.map(o => {
          const ceo = profiles.find(p => p.role === 'ceo' && p.organization_id === o.id);
          const compAdmin = profiles.find(p => p.role === 'company_admin' && p.organization_id === o.id);
          return {
            ...o,
            ceo_id: o.ceo_id || ceo?.id,
            ceo_name: o.ceo_name || ceo?.full_name,
            admin_id: o.admin_id || compAdmin?.id,
            admin_name: o.admin_name || compAdmin?.full_name,
          };
        });
      }
    } else {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_ORGANIZATIONS) : null;
      const list: Organization[] = raw ? JSON.parse(raw) : INITIAL_ORGS;
      if (typeof localStorage !== 'undefined' && !raw) {
        localStorage.setItem(STORAGE_KEY_ORGANIZATIONS, JSON.stringify(INITIAL_ORGS));
      }

      const profiles = await this.getProfiles();
      result = list.map(o => {
        const ceo = profiles.find(p => p.role === 'ceo' && p.organization_id === o.id);
        const compAdmin = profiles.find(p => p.role === 'company_admin' && p.organization_id === o.id);
        return {
          ...o,
          ceo_id: o.ceo_id || ceo?.id,
          ceo_name: o.ceo_name || ceo?.full_name,
          admin_id: o.admin_id || compAdmin?.id,
          admin_name: o.admin_name || compAdmin?.full_name,
        };
      });
    }

    if (currentUser) {
      result = branchHierarchyService.filterOrganizations(currentUser, result);
    }

    return result;
  }

  async createOrganization(input: CreateOrganizationInput, currentUser?: UserProfile | null): Promise<{ success: boolean; organization?: Organization; error?: string }> {
    if (currentUser && currentUser.role !== 'admin') {
      return { success: false, error: 'Chỉ Quản Trị Tổng (Admin) mới có quyền thành lập doanh nghiệp mới.' };
    }

    const orgs = await this.getOrganizations();
    const providedCode = input.code?.trim();
    const cleanCode = providedCode
      ? providedCode.toUpperCase()
      : generateOrganizationCode(input.name, orgs);

    if (providedCode && orgs.some(o => o.code === cleanCode)) {
      return { success: false, error: `Mã doanh nghiệp '${cleanCode}' đã tồn tại trong hệ thống.` };
    }

    const newOrg: Organization = {
      id: `org-${Date.now()}`,
      name: input.name.trim(),
      code: cleanCode,
      tax_number: input.tax_number?.trim(),
      phone: input.phone?.trim(),
      email: input.email?.trim(),
      address: input.address?.trim(),
      ceo_id: input.ceo_id || undefined,
      admin_id: input.admin_id || undefined,
      status: 'active',
      created_at: new Date().toISOString(),
    };

    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.from('organizations').insert({
        name: newOrg.name,
        code: newOrg.code,
        tax_number: newOrg.tax_number || null,
        phone: newOrg.phone || null,
        email: newOrg.email || null,
        address: newOrg.address || null,
        ceo_id: newOrg.ceo_id || null,
        admin_id: newOrg.admin_id || null,
      }).select().single();
      if (error) return { success: false, error: error.message };
      if (data) newOrg.id = data.id;
    }

    const updated = [...orgs, newOrg];
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_ORGANIZATIONS, JSON.stringify(updated));
    }

    if (input.ceo_id) {
      await this.assignRole(input.ceo_id, 'ceo', null, null, null, newOrg.id);
      const rawProfiles = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_PROFILES) : null;
      if (rawProfiles) {
        const profs: UserProfile[] = JSON.parse(rawProfiles);
        const idx = profs.findIndex(p => p.id === input.ceo_id);
        if (idx !== -1) {
          profs[idx].organization_id = newOrg.id;
          profs[idx].role = 'ceo';
          localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profs));
        }
      }
    }

    if (input.admin_id) {
      await this.assignRole(input.admin_id, 'company_admin', null, null, null, newOrg.id);
      const rawProfiles = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_PROFILES) : null;
      if (rawProfiles) {
        const profs: UserProfile[] = JSON.parse(rawProfiles);
        const idx = profs.findIndex(p => p.id === input.admin_id);
        if (idx !== -1) {
          profs[idx].organization_id = newOrg.id;
          profs[idx].role = 'company_admin';
          localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profs));
        }
      }
    }

    return { success: true, organization: newOrg };
  }

  async updateOrganization(
    id: string,
    input: Partial<CreateOrganizationInput>,
    currentUser?: UserProfile | null
  ): Promise<{ success: boolean; organization?: Organization; error?: string }> {
    if (currentUser) {
      const isAdmin = currentUser.role === 'admin';
      const isOwnerTenant = ['company_admin', 'ceo'].includes(currentUser.role) && currentUser.organization_id === id;
      if (!isAdmin && !isOwnerTenant) {
        return { success: false, error: 'Bạn không có quyền chỉnh sửa thông tin Doanh nghiệp này.' };
      }
    }

    const orgs = await this.getOrganizations();
    const existing = orgs.find(o => o.id === id);
    if (!existing) return { success: false, error: 'Không tìm thấy Doanh nghiệp.' };

    const cleanCode = input.code?.trim() ? input.code.trim().toUpperCase() : existing.code;
    if (cleanCode !== existing.code && orgs.some(o => o.id !== id && o.code === cleanCode)) {
      return { success: false, error: `Mã doanh nghiệp '${cleanCode}' đã tồn tại.` };
    }

    const updatedOrg: Organization = {
      ...existing,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      code: cleanCode,
      tax_number: input.tax_number !== undefined ? (input.tax_number?.trim() || undefined) : existing.tax_number,
      phone: input.phone !== undefined ? (input.phone?.trim() || undefined) : existing.phone,
      email: input.email !== undefined ? (input.email?.trim() || undefined) : existing.email,
      address: input.address !== undefined ? (input.address?.trim() || undefined) : existing.address,
      ceo_id: input.ceo_id !== undefined ? (input.ceo_id || undefined) : existing.ceo_id,
      admin_id: input.admin_id !== undefined ? (input.admin_id || undefined) : existing.admin_id,
      updated_at: new Date().toISOString(),
    };

    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.from('organizations').update({
        name: updatedOrg.name,
        code: updatedOrg.code,
        tax_number: updatedOrg.tax_number || null,
        phone: updatedOrg.phone || null,
        email: updatedOrg.email || null,
        address: updatedOrg.address || null,
        ceo_id: updatedOrg.ceo_id || null,
        admin_id: updatedOrg.admin_id || null,
        updated_at: updatedOrg.updated_at,
      }).eq('id', id).select().single();
      if (error) return { success: false, error: error.message };
      if (data) updatedOrg.id = data.id;
    }

    const updated = orgs.map(o => o.id === id ? updatedOrg : o);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_ORGANIZATIONS, JSON.stringify(updated));
    }

    if (input.ceo_id && input.ceo_id !== existing.ceo_id) {
      await this.assignOrganizationCEO(id, input.ceo_id, currentUser);
    }
    if (input.admin_id && input.admin_id !== existing.admin_id) {
      await this.assignOrganizationAdmin(id, input.admin_id, currentUser);
    }

    return { success: true, organization: updatedOrg };
  }

  async deleteOrganization(
    id: string,
    currentUser?: UserProfile | null
  ): Promise<{ success: boolean; error?: string }> {
    if (currentUser && currentUser.role !== 'admin') {
      return { success: false, error: 'Chỉ Quản Trị Tổng (Admin) mới có quyền xóa Doanh nghiệp.' };
    }

    const regions = await this.getRegions();
    const agencies = await this.getAgencies();
    const profiles = await this.getProfiles();

    const attachedRegions = regions.filter(r => r.organization_id === id);
    const attachedAgencies = agencies.filter(a => a.organization_id === id);
    const attachedProfiles = profiles.filter(p => p.organization_id === id && p.role !== 'admin');

    if (attachedRegions.length > 0 || attachedAgencies.length > 0 || attachedProfiles.length > 0) {
      return {
        success: false,
        error: `Không thể xóa Doanh nghiệp đang có ${attachedRegions.length} Vùng, ${attachedAgencies.length} Sàn và ${attachedProfiles.length} nhân sự. Vui lòng chuyển giao hoặc xóa các đơn vị/nhân sự trực thuộc trước.`
      };
    }

    if (isLiveSupabaseConfigured) {
      const { error } = await supabase.from('organizations').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
    }

    const orgs = await this.getOrganizations();
    const updated = orgs.filter(o => o.id !== id);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_ORGANIZATIONS, JSON.stringify(updated));
    }

    return { success: true };
  }

  // ==========================================
  // BỔ NHIỆM QUẢN TRỊ DOANH NGHIỆP (COMPANY ADMIN)
  // Chỉ Quản trị tổng (Admin) mới có quyền thực hiện
  // ==========================================
  async assignOrganizationAdmin(
    organizationId: string,
    adminUserId: string,
    currentUser?: UserProfile | null
  ): Promise<{ success: boolean; error?: string }> {
    if (currentUser && currentUser.role !== 'admin') {
      return {
        success: false,
        error: 'Chỉ Quản Trị Tổng (Admin) mới có quyền bổ nhiệm Quản Trị Doanh Nghiệp.',
      };
    }

    if (!organizationId || !adminUserId) {
      return { success: false, error: 'Thiếu thông tin Doanh nghiệp hoặc Người dùng.' };
    }

    const roleRes = await this.assignRole(adminUserId, 'company_admin', null, null, null, organizationId);
    if (!roleRes.success) {
      return roleRes;
    }

    if (isLiveSupabaseConfigured) {
      const { error } = await supabase
        .from('organizations')
        .update({ admin_id: adminUserId, updated_at: new Date().toISOString() })
        .eq('id', organizationId);
      if (error) return { success: false, error: error.message };
    }

    const orgs = await this.getOrganizations();
    const profiles = await this.getProfiles();
    const adminUser = profiles.find(p => p.id === adminUserId);

    const updatedOrgs = orgs.map(o => o.id === organizationId ? {
      ...o,
      admin_id: adminUserId,
      admin_name: adminUser ? adminUser.full_name : o.admin_name,
    } : o);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_ORGANIZATIONS, JSON.stringify(updatedOrgs));
    }

    return { success: true };
  }

  // ==========================================
  // BỔ NHIỆM TỔNG GIÁM ĐỐC (CEO)
  // Chỉ Quản trị tổng (Admin) mới có quyền thực hiện
  // ==========================================
  async assignOrganizationCEO(
    organizationId: string,
    ceoUserId: string,
    currentUser?: UserProfile | null
  ): Promise<{ success: boolean; error?: string }> {
    if (currentUser && currentUser.role !== 'admin') {
      return {
        success: false,
        error: 'Chỉ Quản Trị Tổng (Admin) mới có quyền bổ nhiệm Tổng Giám Đốc (CEO).',
      };
    }

    if (!organizationId || !ceoUserId) {
      return { success: false, error: 'Thiếu thông tin Doanh nghiệp hoặc Người dùng.' };
    }

    const roleRes = await this.assignRole(ceoUserId, 'ceo', null, null, null, organizationId);
    if (!roleRes.success) {
      return roleRes;
    }

    if (isLiveSupabaseConfigured) {
      const { error } = await supabase
        .from('organizations')
        .update({ ceo_id: ceoUserId, updated_at: new Date().toISOString() })
        .eq('id', organizationId);
      if (error) return { success: false, error: error.message };
    }

    const orgs = await this.getOrganizations();
    const profiles = await this.getProfiles();
    const ceoUser = profiles.find(p => p.id === ceoUserId);

    const updatedOrgs = orgs.map(o => o.id === organizationId ? {
      ...o,
      ceo_id: ceoUserId,
      ceo_name: ceoUser ? ceoUser.full_name : o.ceo_name,
    } : o);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_ORGANIZATIONS, JSON.stringify(updatedOrgs));
    }

    return { success: true };
  }

  async getAgencies(regionId?: string, currentUser?: UserProfile): Promise<Agency[]> {
    let result: Agency[] = [];
    if (isLiveSupabaseConfigured) {
      let query = supabase.from('agencies').select('*').order('name');
      if (regionId) query = query.eq('region_id', regionId);
      const { data, error } = await query;
      if (!error && data) {
        // Lấy tên director nếu có
        const agencies = data as Agency[];
        const profiles = await this.getProfiles();
        result = agencies.map(a => {
          const director = profiles.find(p => p.id === a.director_id);
          return {
            ...a,
            director_name: director ? director.full_name : undefined,
          };
        });
      }
    } else {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_AGENCIES) : null;
      const list: Agency[] = raw ? JSON.parse(raw) : INITIAL_AGENCIES;
      if (typeof localStorage !== 'undefined' && !raw) {
        localStorage.setItem(STORAGE_KEY_AGENCIES, JSON.stringify(INITIAL_AGENCIES));
      }
      const profiles = await this.getProfiles();
      const rawRegions = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_REGIONS) : null;
      const regions: Region[] = rawRegions ? JSON.parse(rawRegions) : INITIAL_REGIONS;

      result = list.map(a => {
        const director = profiles.find(p => p.id === a.director_id);
        const reg = regions.find(r => r.id === a.region_id);
        return {
          ...a,
          director_name: director ? director.full_name : undefined,
          region_name: reg ? reg.name : undefined,
        };
      });

      if (regionId) {
        result = result.filter(a => a.region_id === regionId);
      }
    }

    if (currentUser) {
      result = branchHierarchyService.filterAgencies(currentUser, result);
    }

    return result;
  }

  async getTeams(agencyId?: string, currentUser?: UserProfile): Promise<Team[]> {
    let result: Team[] = [];
    if (isLiveSupabaseConfigured) {
      let query = supabase.from('teams').select('*').order('name');
      if (agencyId) query = query.eq('agency_id', agencyId);
      const { data, error } = await query;
      if (!error && data) {
        const teams = data as Team[];
        const profiles = await this.getProfiles();
        result = teams.map(t => {
          const leader = profiles.find(p => p.id === t.leader_id);
          const members = profiles.filter(p => p.team_id === t.id);
          return {
            ...t,
            leader_name: leader ? leader.full_name : undefined,
            member_count: members.length,
          };
        });
      }
    } else {
      const raw = localStorage.getItem(STORAGE_KEY_TEAMS);
      const list: Team[] = raw ? JSON.parse(raw) : INITIAL_TEAMS;
      if (!raw) localStorage.setItem(STORAGE_KEY_TEAMS, JSON.stringify(INITIAL_TEAMS));
      
      let filtered = list;
      if (agencyId) filtered = filtered.filter(t => t.agency_id === agencyId);

      const profiles = await this.getProfiles();
      result = filtered.map(t => {
        const leader = profiles.find(p => p.id === t.leader_id);
        const members = profiles.filter(p => p.team_id === t.id);
        return {
          ...t,
          leader_name: leader ? leader.full_name : undefined,
          member_count: members.length,
        };
      });
    }

    if (currentUser) {
      result = branchHierarchyService.filterTeams(currentUser, result);
    }

    return result;
  }

  async getProfiles(agencyId?: string, teamId?: string, currentUser?: UserProfile, includeDeleted: boolean = false): Promise<UserProfile[]> {
    let result: UserProfile[] = [];
    if (isLiveSupabaseConfigured) {
      let query = supabase.from('profiles').select('*').order('created_at', { ascending: true });
      if (!includeDeleted) query = query.is('deleted_at', null);
      if (agencyId) query = query.eq('agency_id', agencyId);
      if (teamId) query = query.eq('team_id', teamId);
      const { data, error } = await query;
      if (!error && data) result = data as UserProfile[];
    } else {
      const raw = localStorage.getItem(STORAGE_KEY_PROFILES);
      const list: UserProfile[] = raw ? JSON.parse(raw) : INITIAL_PROFILES;
      if (!raw) localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(INITIAL_PROFILES));
      
      let filtered = list;
      if (!includeDeleted) filtered = filtered.filter(p => !p.deleted_at);
      if (agencyId) filtered = filtered.filter(p => p.agency_id === agencyId);
      if (teamId) filtered = filtered.filter(p => p.team_id === teamId);
      result = filtered;
    }

    if (currentUser) {
      result = branchHierarchyService.filterProfiles(currentUser, result);
    }

    return result;
  }

  async createUser(input: CreateUserInput, currentUser?: UserProfile | null): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
    // Kiểm tra quyền hạn tạo vai trò:
    // 1. Chỉ Quản trị tổng (Admin) mới có quyền tạo Admin, CEO hoặc Company Admin
    if (['admin', 'ceo', 'company_admin'].includes(input.role)) {
      if (currentUser && currentUser.role !== 'admin') {
        const roleLabels: Record<string, string> = {
          admin: 'Quản Trị Viên (Admin)',
          ceo: 'Tổng Giám Đốc (CEO)',
          company_admin: 'Quản Trị Doanh Nghiệp (Company Admin)'
        };
        return { 
          success: false, 
          error: `Chỉ Quản Trị Tổng (Admin) mới có quyền tạo tài khoản ${roleLabels[input.role]}.` 
        };
      }
    }

    // 1b. Tài khoản Quản Trị Doanh Nghiệp bắt buộc phải gắn với một Doanh nghiệp cụ thể
    if (input.role === 'company_admin' && !input.organization_id) {
      return {
        success: false,
        error: 'Tài khoản Quản Trị Doanh Nghiệp bắt buộc phải chọn Doanh nghiệp để gán.'
      };
    }

    // 2. Nếu người tạo là Company Admin: cưỡng chế organization_id thuộc về chính doanh nghiệp của họ
    if (currentUser && currentUser.role === 'company_admin') {
      if (['admin', 'ceo', 'company_admin'].includes(input.role)) {
        return {
          success: false,
          error: 'Quản Trị Doanh Nghiệp không có quyền tạo tài khoản CEO, Admin hoặc Quản Trị Doanh Nghiệp khác.'
        };
      }
      if (input.organization_id && currentUser.organization_id && input.organization_id !== currentUser.organization_id) {
        return {
          success: false,
          error: 'Quản Trị Doanh Nghiệp chỉ được tạo tài khoản thuộc doanh nghiệp của mình.'
        };
      }
      input.organization_id = currentUser.organization_id;
    }

    const cleanEmail = input.email.trim().toLowerCase();
    const sanitized = this.sanitizeRoleHierarchy(
      input.role,
      input.organization_id,
      input.region_id,
      input.agency_id,
      input.team_id
    );

    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.rpc('create_user_by_admin', {
        p_email: cleanEmail,
        p_password: input.password || 'password123',
        p_full_name: input.full_name.trim(),
        p_phone: input.phone.trim(),
        p_role: input.role,
        p_agency_id: sanitized.agency_id || null,
        p_team_id: sanitized.team_id || null,
        p_must_change_password: input.must_change_password ?? true,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data?.id) {
        const updatePayload: any = {};
        if (sanitized.organization_id !== undefined) updatePayload.organization_id = sanitized.organization_id;
        if (sanitized.region_id !== undefined) updatePayload.region_id = sanitized.region_id;
        if (sanitized.agency_id !== undefined) updatePayload.agency_id = sanitized.agency_id;
        if (sanitized.team_id !== undefined) updatePayload.team_id = sanitized.team_id;

        if (Object.keys(updatePayload).length > 0) {
          await supabase.from('profiles').update(updatePayload).eq('id', data.id);
        }
      }

      if (input.role === 'company_admin' && sanitized.organization_id && data?.id) {
        await supabase
          .from('organizations')
          .update({ admin_id: data.id, updated_at: new Date().toISOString() })
          .eq('id', sanitized.organization_id);
      }

      if (input.role === 'ceo' && sanitized.organization_id && data?.id) {
        await supabase
          .from('organizations')
          .update({ ceo_id: data.id, updated_at: new Date().toISOString() })
          .eq('id', sanitized.organization_id);
      }

      return { success: true, profile: { ...data, ...sanitized } as UserProfile };
    }

    // Local / Offline fallback
    const profiles = await this.getProfiles();
    if (profiles.some(p => p.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: `Email ${cleanEmail} đã tồn tại trong hệ thống.` };
    }

    const newProfile: UserProfile = {
      id: `local-user-${Date.now()}`,
      email: cleanEmail,
      full_name: input.full_name.trim(),
      phone: input.phone.trim(),
      role: input.role,
      organization_id: sanitized.organization_id || undefined,
      region_id: sanitized.region_id || undefined,
      agency_id: sanitized.agency_id || undefined,
      team_id: sanitized.team_id || undefined,
      status: 'active',
      must_change_password: input.must_change_password ?? true,
      totp_enabled: false,
      created_at: new Date().toISOString(),
    };

    const updated = [...profiles, newProfile];
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(updated));

    if (input.role === 'company_admin' && input.organization_id) {
      const orgs = await this.getOrganizations();
      const updatedOrgs = orgs.map(o => o.id === input.organization_id ? {
        ...o,
        admin_id: newProfile.id,
        admin_name: newProfile.full_name,
      } : o);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_ORGANIZATIONS, JSON.stringify(updatedOrgs));
      }
    }

    if (input.role === 'ceo' && input.organization_id) {
      const orgs = await this.getOrganizations();
      const updatedOrgs = orgs.map(o => o.id === input.organization_id ? {
        ...o,
        ceo_id: newProfile.id,
        ceo_name: newProfile.full_name,
      } : o);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_ORGANIZATIONS, JSON.stringify(updatedOrgs));
      }
    }

    return { success: true, profile: newProfile };
  }

  async toggleUserStatus(userId: string, newStatus: 'active' | 'locked'): Promise<boolean> {
    if (isLiveSupabaseConfigured) {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', userId);
      return !error;
    }

    const profiles = await this.getProfiles(undefined, undefined, undefined, true);
    const updated = profiles.map(p => p.id === userId ? { ...p, status: newStatus } : p);
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(updated));
    return true;
  }

  // ==========================================
  // CẬP NHẬT THÔNG TIN NGƯỜI DÙNG (UPDATE USER)
  // ==========================================
  async updateUser(
    userId: string,
    input: UpdateUserInput,
    currentUser?: UserProfile | null
  ): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
    if (!currentUser) {
      return { success: false, error: 'Yêu cầu đăng nhập để thực hiện cập nhật người dùng.' };
    }

    if ((currentUser as any).is_impersonating || (currentUser as any).is_read_only) {
      return { success: false, error: 'Từ chối thao tác: Không được phép sửa dữ liệu trong chế độ Giả lập góc nhìn (Impersonation).' };
    }

    // 1. Lấy thông tin user hiện tại cần sửa
    const allProfiles = await this.getProfiles(undefined, undefined, undefined, true);
    const targetUser = allProfiles.find(p => p.id === userId);
    if (!targetUser) {
      return { success: false, error: 'Không tìm thấy người dùng trong hệ thống.' };
    }

    // 2. Kiểm tra phân quyền:
    if (currentUser.role === 'company_admin') {
      if (targetUser.organization_id && currentUser.organization_id && targetUser.organization_id !== currentUser.organization_id) {
        return { success: false, error: 'Quản Trị Doanh Nghiệp chỉ được sửa tài khoản thuộc doanh nghiệp của mình.' };
      }
      if (['admin', 'ceo', 'company_admin'].includes(targetUser.role) && targetUser.id !== currentUser.id) {
        return { success: false, error: 'Quản Trị Doanh Nghiệp không thể chỉnh sửa tài khoản Admin, CEO hoặc Quản Trị Doanh Nghiệp khác.' };
      }
      if (input.role && ['admin', 'ceo', 'company_admin'].includes(input.role) && targetUser.role !== input.role) {
        return { success: false, error: 'Quản Trị Doanh Nghiệp không có quyền thăng cấp tài khoản lên Admin, CEO hoặc Quản Trị Doanh Nghiệp.' };
      }
      if (input.organization_id && currentUser.organization_id && input.organization_id !== currentUser.organization_id) {
        return { success: false, error: 'Quản Trị Doanh Nghiệp không thể chuyển người dùng sang doanh nghiệp khác.' };
      }
    } else if (currentUser.role !== 'admin') {
      return { success: false, error: 'Chỉ Quản Trị Viên (Admin) hoặc Quản Trị Doanh Nghiệp mới có quyền chỉnh sửa tài khoản người dùng.' };
    }

    // 3. Ràng buộc bảo vệ Admin & CEO duy nhất
    if (targetUser.role === 'admin') {
      const activeAdmins = allProfiles.filter(p => p.role === 'admin' && p.status === 'active' && !p.deleted_at);
      if (activeAdmins.length <= 1 && targetUser.id === activeAdmins[0]?.id) {
        if (input.role && input.role !== 'admin') {
          return { success: false, error: 'Không thể hạ vai trò của Quản trị viên (Admin) duy nhất còn lại của hệ thống.' };
        }
        if (input.status && input.status !== 'active') {
          return { success: false, error: 'Không thể khóa hoặc vô hiệu hóa Quản trị viên (Admin) duy nhất còn lại của hệ thống.' };
        }
      }
    }

    if (targetUser.role === 'ceo' && targetUser.organization_id) {
      const activeCeos = allProfiles.filter(p => p.role === 'ceo' && p.organization_id === targetUser.organization_id && p.status === 'active' && !p.deleted_at);
      if (activeCeos.length <= 1 && targetUser.id === activeCeos[0]?.id) {
        if (input.role && input.role !== 'ceo') {
          return { success: false, error: 'Không thể thay đổi vai trò của Tổng Giám Đốc (CEO) duy nhất còn lại của doanh nghiệp. Vui lòng bổ nhiệm CEO thay thế trước.' };
        }
      }
    }

    // 4. Nếu gán vai trò company_admin: bắt buộc phải có organization_id
    const finalRole = input.role || targetUser.role;
    const finalOrgId = input.organization_id !== undefined ? input.organization_id : targetUser.organization_id;
    if (finalRole === 'company_admin' && !finalOrgId) {
      return { success: false, error: 'Tài khoản Quản Trị Doanh Nghiệp bắt buộc phải chọn Doanh nghiệp để gán.' };
    }

    const sanitized = this.sanitizeRoleHierarchy(
      finalRole,
      input.organization_id !== undefined ? input.organization_id : targetUser.organization_id,
      input.region_id !== undefined ? input.region_id : targetUser.region_id,
      input.agency_id !== undefined ? input.agency_id : targetUser.agency_id,
      input.team_id !== undefined ? input.team_id : targetUser.team_id
    );

    // 5. Cập nhật vào DB Supabase hoặc LocalStorage
    if (isLiveSupabaseConfigured) {
      const payload: any = { updated_at: new Date().toISOString() };
      if (input.full_name !== undefined) payload.full_name = input.full_name.trim();
      if (input.phone !== undefined) payload.phone = input.phone.trim();
      if (input.email !== undefined) payload.email = input.email.trim().toLowerCase();
      if (input.role !== undefined) payload.role = input.role;
      payload.organization_id = sanitized.organization_id;
      payload.region_id = sanitized.region_id;
      payload.agency_id = sanitized.agency_id;
      payload.team_id = sanitized.team_id;
      if (input.status !== undefined) payload.status = input.status;
      if (input.employment_type !== undefined) payload.employment_type = input.employment_type;

      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', userId)
        .select()
        .single();

      if (error) return { success: false, error: error.message };

      if (finalRole === 'company_admin' && sanitized.organization_id) {
        await supabase
          .from('organizations')
          .update({ admin_id: userId, updated_at: new Date().toISOString() })
          .eq('id', sanitized.organization_id);
      }

      return { success: true, profile: data as UserProfile };
    }

    // Local / Offline fallback
    const raw = localStorage.getItem(STORAGE_KEY_PROFILES);
    const profiles: UserProfile[] = raw ? JSON.parse(raw) : INITIAL_PROFILES;
    const idx = profiles.findIndex(p => p.id === userId);
    if (idx === -1) {
      return { success: false, error: 'Không tìm thấy người dùng trong hệ thống offline.' };
    }

    const updatedProfile: UserProfile = {
      ...profiles[idx],
      ...(input.full_name !== undefined && { full_name: input.full_name.trim() }),
      ...(input.phone !== undefined && { phone: input.phone.trim() }),
      ...(input.email !== undefined && { email: input.email.trim().toLowerCase() }),
      ...(input.role !== undefined && { role: input.role }),
      organization_id: sanitized.organization_id || undefined,
      region_id: sanitized.region_id || undefined,
      agency_id: sanitized.agency_id || undefined,
      team_id: sanitized.team_id || undefined,
      ...(input.status !== undefined && { status: input.status }),
      ...(input.employment_type !== undefined && { employment_type: input.employment_type }),
      updated_at: new Date().toISOString(),
    };

    profiles[idx] = updatedProfile;
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));

    if (finalRole === 'company_admin' && finalOrgId) {
      const orgs = await this.getOrganizations();
      const updatedOrgs = orgs.map(o => o.id === finalOrgId ? {
        ...o,
        admin_id: updatedProfile.id,
        admin_name: updatedProfile.full_name,
      } : o);
      localStorage.setItem(STORAGE_KEY_ORGANIZATIONS, JSON.stringify(updatedOrgs));
    }

    return { success: true, profile: updatedProfile };
  }

  // ==========================================
  // XÓA MỀM NGƯỜI DÙNG (SOFT DELETE USER)
  // ==========================================
  async deleteUser(
    userId: string,
    options: DeleteUserOptions,
    currentUser?: UserProfile | null
  ): Promise<{ success: boolean; error?: string }> {
    if (!currentUser) {
      return { success: false, error: 'Yêu cầu đăng nhập để thực hiện xóa người dùng.' };
    }

    if ((currentUser as any).is_impersonating || (currentUser as any).is_read_only) {
      return { success: false, error: 'Từ chối thao tác: Không được phép xóa dữ liệu trong chế độ Giả lập góc nhìn (Impersonation).' };
    }

    if (currentUser.id === userId) {
      return { success: false, error: 'Bạn không thể tự xóa tài khoản của chính mình.' };
    }

    if (!options.delete_reason || options.delete_reason.trim().length < 5) {
      return { success: false, error: 'Lý do xóa nhân sự là bắt buộc (tối thiểu 5 ký tự).' };
    }

    const allProfiles = await this.getProfiles(undefined, undefined, undefined, true);
    const targetUser = allProfiles.find(p => p.id === userId);
    if (!targetUser) {
      return { success: false, error: 'Không tìm thấy người dùng cần xóa.' };
    }

    // Phân quyền:
    if (currentUser.role === 'company_admin') {
      if (targetUser.organization_id && currentUser.organization_id && targetUser.organization_id !== currentUser.organization_id) {
        return { success: false, error: 'Quản Trị Doanh Nghiệp chỉ được xóa nhân sự thuộc doanh nghiệp của mình.' };
      }
      if (['admin', 'ceo', 'company_admin'].includes(targetUser.role)) {
        return { success: false, error: 'Quản Trị Doanh Nghiệp không thể xóa tài khoản Admin, CEO hoặc Quản Trị Doanh Nghiệp.' };
      }
    } else if (currentUser.role !== 'admin') {
      return { success: false, error: 'Chỉ Quản Trị Viên (Admin) hoặc Quản Trị Doanh Nghiệp mới có quyền xóa tài khoản nhân sự.' };
    }

    // Chặn xóa Super Admin duy nhất
    if (targetUser.role === 'admin') {
      const activeAdmins = allProfiles.filter(p => p.role === 'admin' && p.status === 'active' && !p.deleted_at);
      if (activeAdmins.length <= 1 && targetUser.id === activeAdmins[0]?.id) {
        return { success: false, error: 'Không thể xóa Quản trị viên (Admin) duy nhất còn lại của hệ thống.' };
      }
    }

    // Chặn xóa CEO duy nhất
    if (targetUser.role === 'ceo' && targetUser.organization_id) {
      const activeCeos = allProfiles.filter(p => p.role === 'ceo' && p.organization_id === targetUser.organization_id && p.status === 'active' && !p.deleted_at);
      if (activeCeos.length <= 1 && targetUser.id === activeCeos[0]?.id) {
        return { success: false, error: 'Không thể xóa Tổng Giám Đốc (CEO) duy nhất còn lại của doanh nghiệp. Vui lòng bổ nhiệm CEO thay thế trước.' };
      }
    }

    // Bàn giao Lead (nếu có chọn nhân sự nhận bàn giao)
    let handoverCount = 0;
    if (options.handover_user_id) {
      if (options.handover_user_id === userId) {
        return { success: false, error: 'Nhân sự tiếp nhận bàn giao không thể trùng với nhân sự bị xóa.' };
      }
      const handoverUser = allProfiles.find(p => p.id === options.handover_user_id && p.status === 'active' && !p.deleted_at);
      if (!handoverUser) {
        return { success: false, error: 'Nhân sự tiếp nhận bàn giao không tồn tại hoặc đã bị khóa/xóa.' };
      }

      // Cập nhật leads trong offline storage & supabase
      const rawLeads = localStorage.getItem('crm_leads');
      if (rawLeads) {
        const leads: any[] = JSON.parse(rawLeads);
        for (let i = 0; i < leads.length; i++) {
          if (leads[i].assigned_to === userId && !leads[i].deleted_at && !['contract', 'lost'].includes(leads[i].status)) {
            leads[i].assigned_to = handoverUser.id;
            leads[i].assigned_name = handoverUser.full_name;
            handoverCount++;
          }
        }
        localStorage.setItem('crm_leads', JSON.stringify(leads));
      }

      if (isLiveSupabaseConfigured) {
        await supabase
          .from('leads')
          .update({ assigned_to: handoverUser.id })
          .eq('assigned_to', userId)
          .is('deleted_at', null);
      }
    }

    const now = new Date().toISOString();
    const finalReason = options.delete_reason.trim() + (handoverCount > 0 ? ` (Đã bàn giao ${handoverCount} leads)` : '');

    // Cập nhật soft delete cho user
    if (isLiveSupabaseConfigured) {
      const { error } = await supabase
        .from('profiles')
        .update({
          status: 'inactive',
          deleted_at: now,
          deleted_by: currentUser.id,
          delete_reason: finalReason,
          accepts_leads: false,
          updated_at: now,
        })
        .eq('id', userId);

      if (error) return { success: false, error: error.message };

      // Ghi nhận vào trash_bins
      await supabase.from('trash_bins').insert({
        entity_type: 'employee',
        entity_id: userId,
        agency_id: targetUser.agency_id || null,
        entity_name: targetUser.full_name,
        payload: targetUser,
        delete_reason: finalReason,
        deleted_by: currentUser.id,
        deleted_at: now,
      });
    }

    // Local / Offline fallback
    const rawProfiles = localStorage.getItem(STORAGE_KEY_PROFILES);
    const profiles: UserProfile[] = rawProfiles ? JSON.parse(rawProfiles) : INITIAL_PROFILES;
    const idx = profiles.findIndex(p => p.id === userId);
    if (idx !== -1) {
      profiles[idx] = {
        ...profiles[idx],
        status: 'inactive',
        deleted_at: now,
        deleted_by: currentUser.id,
        delete_reason: finalReason,
        accepts_leads: false,
        updated_at: now,
      };
      localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));
    }

    // Lưu vào localStorage crm_trash_bins
    const rawTrash = localStorage.getItem('crm_trash_bins');
    const trashList: TrashBinItem[] = rawTrash ? JSON.parse(rawTrash) : [];
    const newTrashItem: TrashBinItem = {
      id: `trash-emp-${Date.now()}`,
      entity_type: 'employee',
      entity_id: userId,
      agency_id: targetUser.agency_id,
      entity_name: targetUser.full_name,
      payload: targetUser,
      delete_reason: finalReason,
      deleted_by: currentUser.id,
      deleted_by_name: currentUser.full_name,
      deleted_at: now,
      purge_due_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
    trashList.unshift(newTrashItem);
    localStorage.setItem('crm_trash_bins', JSON.stringify(trashList));

    return { success: true };
  }

  // ==========================================
  // KHÔI PHỤC NGƯỜI DÙNG TỪ THÙNG RÁC (RESTORE USER)
  // ==========================================
  async restoreUser(
    userId: string,
    currentUser?: UserProfile | null
  ): Promise<{ success: boolean; error?: string }> {
    if (!currentUser) {
      return { success: false, error: 'Yêu cầu đăng nhập để khôi phục người dùng.' };
    }

    if ((currentUser as any).is_impersonating || (currentUser as any).is_read_only) {
      return { success: false, error: 'Từ chối thao tác: Không được phép thao tác trong chế độ Giả lập góc nhìn.' };
    }

    if (currentUser.role !== 'admin' && currentUser.role !== 'company_admin') {
      return { success: false, error: 'Chỉ Quản Trị Viên (Admin) hoặc Quản Trị Doanh Nghiệp mới có quyền khôi phục nhân sự.' };
    }

    const now = new Date().toISOString();

    if (isLiveSupabaseConfigured) {
      const { error } = await supabase
        .from('profiles')
        .update({
          status: 'active',
          deleted_at: null,
          deleted_by: null,
          delete_reason: null,
          accepts_leads: true,
          updated_at: now,
        })
        .eq('id', userId);

      if (error) return { success: false, error: error.message };

      await supabase
        .from('trash_bins')
        .update({ restored_at: now, restored_by: currentUser.id })
        .eq('entity_type', 'employee')
        .eq('entity_id', userId);
    }

    const rawProfiles = localStorage.getItem(STORAGE_KEY_PROFILES);
    if (rawProfiles) {
      const profiles: UserProfile[] = JSON.parse(rawProfiles);
      const idx = profiles.findIndex(p => p.id === userId);
      if (idx !== -1) {
        profiles[idx] = {
          ...profiles[idx],
          status: 'active',
          deleted_at: undefined,
          deleted_by: undefined,
          delete_reason: undefined,
          accepts_leads: true,
          updated_at: now,
        };
        localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));
      }
    }

    // Cập nhật crm_trash_bins
    const rawTrash = localStorage.getItem('crm_trash_bins');
    if (rawTrash) {
      const trashList: TrashBinItem[] = JSON.parse(rawTrash);
      const updatedTrash = trashList.filter(t => !(t.entity_type === 'employee' && t.entity_id === userId));
      localStorage.setItem('crm_trash_bins', JSON.stringify(updatedTrash));
    }

    return { success: true };
  }

  // ==========================================
  // QUẢN TRỊ SÀN GIAO DỊCH (AGENCY / BRANCH)
  // ==========================================
  async createAgency(input: CreateAgencyInput, currentUser?: UserProfile | null): Promise<{ success: boolean; agency?: Agency; error?: string }> {
    if (currentUser?.role === 'company_admin' && currentUser.organization_id) {
      input.organization_id = currentUser.organization_id;
    }
    const cleanCode = input.code.trim().toUpperCase();
    const orgId = input.organization_id || INITIAL_ORGS[0].id;

    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase
        .from('agencies')
        .insert({
          organization_id: orgId,
          region_id: input.region_id || null,
          name: input.name.trim(),
          code: cleanCode,
          address: input.address?.trim() || null,
          phone: input.phone?.trim() || null,
          email: input.email?.trim() || null,
          director_id: input.director_id || null,
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      // Nếu bổ nhiệm Giám đốc sàn, cập nhật agency_id của nhân sự đó
      if (input.director_id) {
        await supabase
          .from('profiles')
          .update({ agency_id: data.id, role: 'director' })
          .eq('id', input.director_id);
      }

      return { success: true, agency: data as Agency };
    }

    // Local / Offline fallback
    const agencies = await this.getAgencies();
    if (agencies.some(a => a.code === cleanCode)) {
      return { success: false, error: `Mã sàn '${cleanCode}' đã tồn tại!` };
    }

    const newAgency: Agency = {
      id: `local-agency-${Date.now()}`,
      organization_id: orgId,
      region_id: input.region_id || undefined,
      name: input.name.trim(),
      code: cleanCode,
      address: input.address?.trim(),
      phone: input.phone?.trim(),
      email: input.email?.trim(),
      status: 'active',
      director_id: input.director_id || undefined,
    };

    const updated = [...agencies, newAgency];
    localStorage.setItem(STORAGE_KEY_AGENCIES, JSON.stringify(updated));

    if (input.director_id) {
      await this.assignRole(input.director_id, 'director', newAgency.id, null);
    }

    return { success: true, agency: newAgency };
  }

  async updateAgency(
    agencyId: string, 
    input: Partial<CreateAgencyInput>, 
    currentUser?: UserProfile | null
  ): Promise<{ success: boolean; agency?: Agency; error?: string }> {
    if (currentUser) {
      const allowedRoles = ['admin', 'company_admin', 'ceo', 'director'];
      if (!allowedRoles.includes(currentUser.role)) {
        return { success: false, error: 'Bạn không có quyền chỉnh sửa Sàn giao dịch.' };
      }
    }

    const agencies = await this.getAgencies();
    const existing = agencies.find(a => a.id === agencyId);
    if (!existing) return { success: false, error: 'Không tìm thấy Sàn giao dịch.' };

    const cleanCode = input.code ? input.code.trim().toUpperCase() : existing.code;
    if (cleanCode !== existing.code && agencies.some(a => a.id !== agencyId && a.code === cleanCode)) {
      return { success: false, error: `Mã sàn '${cleanCode}' đã tồn tại.` };
    }

    const updatedAgency: Agency = {
      ...existing,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      code: cleanCode,
      organization_id: (input.organization_id !== undefined && input.organization_id) ? input.organization_id : existing.organization_id,
      region_id: input.region_id !== undefined ? (input.region_id || undefined) : existing.region_id,
      address: input.address !== undefined ? input.address : existing.address,
      phone: input.phone !== undefined ? input.phone : existing.phone,
      email: input.email !== undefined ? input.email : existing.email,
      director_id: input.director_id !== undefined ? (input.director_id || undefined) : existing.director_id,
      updated_at: new Date().toISOString(),
    };

    if (isLiveSupabaseConfigured) {
      const payload: any = {
        name: updatedAgency.name,
        code: updatedAgency.code,
        organization_id: updatedAgency.organization_id || null,
        region_id: updatedAgency.region_id || null,
        address: updatedAgency.address || null,
        phone: updatedAgency.phone || null,
        email: updatedAgency.email || null,
        director_id: updatedAgency.director_id || null,
        updated_at: updatedAgency.updated_at,
      };

      const { error } = await supabase.from('agencies').update(payload).eq('id', agencyId);
      if (error) return { success: false, error: error.message };

      if (input.director_id) {
        await supabase
          .from('profiles')
          .update({ agency_id: agencyId, role: 'director' })
          .eq('id', input.director_id);
      }
    }

    const updated = agencies.map(a => a.id === agencyId ? updatedAgency : a);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_AGENCIES, JSON.stringify(updated));
    }

    if (input.director_id && input.director_id !== existing.director_id) {
      await this.assignRole(input.director_id, 'director', agencyId, null);
    }
    return { success: true, agency: updatedAgency };
  }

  async deleteAgency(
    agencyId: string, 
    fallbackAgencyId?: string, 
    currentUser?: UserProfile | null
  ): Promise<{ success: boolean; error?: string }> {
    if (currentUser) {
      const allowedRoles = ['admin', 'company_admin', 'ceo'];
      if (!allowedRoles.includes(currentUser.role)) {
        return { success: false, error: 'Chỉ Quản trị viên mới có quyền xóa Sàn giao dịch.' };
      }
    }

    const teams = await this.getTeams();
    const profiles = await this.getProfiles();
    const attachedTeams = teams.filter(t => t.agency_id === agencyId);
    const attachedStaff = profiles.filter(p => p.agency_id === agencyId);

    if ((attachedTeams.length > 0 || attachedStaff.length > 0) && !fallbackAgencyId) {
      return {
        success: false,
        error: `Sàn này đang có ${attachedTeams.length} đội nhóm và ${attachedStaff.length} nhân sự. Vui lòng chọn Sàn tiếp nhận để chuyển giao.`
      };
    }

    // Nếu có sàn tiếp nhận (fallback), chuyển toàn bộ teams & staff sang sàn đích
    if (fallbackAgencyId) {
      const reallocatedTeams = teams.map(t => t.agency_id === agencyId ? { ...t, agency_id: fallbackAgencyId } : t);
      const reallocatedStaff = profiles.map(p => p.agency_id === agencyId ? { ...p, agency_id: fallbackAgencyId } : p);

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_TEAMS, JSON.stringify(reallocatedTeams));
        localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(reallocatedStaff));
      }

      if (isLiveSupabaseConfigured) {
        await supabase.from('teams').update({ agency_id: fallbackAgencyId }).eq('agency_id', agencyId);
        await supabase.from('profiles').update({ agency_id: fallbackAgencyId }).eq('agency_id', agencyId);
      }
    }

    if (isLiveSupabaseConfigured) {
      const { error } = await supabase.from('agencies').delete().eq('id', agencyId);
      if (error) return { success: false, error: error.message };
    }

    const agencies = await this.getAgencies();
    const updated = agencies.filter(a => a.id !== agencyId);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_AGENCIES, JSON.stringify(updated));
    }

    return { success: true };
  }

  // ==========================================
  // QUẢN TRỊ ĐỘI NHÓM KINH DOANH (TEAMS)
  // ==========================================
  async createTeam(input: CreateTeamInput): Promise<{ success: boolean; team?: Team; error?: string }> {
    const cleanCode = input.code.trim().toUpperCase();

    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase
        .from('teams')
        .insert({
          agency_id: input.agency_id,
          name: input.name.trim(),
          code: cleanCode,
          leader_id: input.leader_id || null,
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      // Nếu bổ nhiệm Team Leader, cập nhật team_id & agency_id của nhân sự đó
      if (input.leader_id) {
        await supabase
          .from('profiles')
          .update({ team_id: data.id, agency_id: input.agency_id, role: 'team_leader' })
          .eq('id', input.leader_id);
      }

      return { success: true, team: data as Team };
    }

    // Local / Offline fallback
    const teams = await this.getTeams();
    if (teams.some(t => t.code === cleanCode)) {
      return { success: false, error: `Mã đội nhóm '${cleanCode}' đã tồn tại!` };
    }

    const newTeam: Team = {
      id: `local-team-${Date.now()}`,
      agency_id: input.agency_id,
      name: input.name.trim(),
      code: cleanCode,
      leader_id: input.leader_id || undefined,
      member_count: input.leader_id ? 1 : 0,
    };

    const updated = [...teams, newTeam];
    localStorage.setItem(STORAGE_KEY_TEAMS, JSON.stringify(updated));

    if (input.leader_id) {
      await this.assignRole(input.leader_id, 'team_leader', input.agency_id, newTeam.id);
    }

    return { success: true, team: newTeam };
  }

  async updateTeam(
    teamId: string, 
    input: Partial<CreateTeamInput>, 
    currentUser?: UserProfile | null
  ): Promise<{ success: boolean; team?: Team; error?: string }> {
    if (currentUser) {
      const allowedRoles = ['admin', 'company_admin', 'ceo', 'director', 'sales_manager'];
      if (!allowedRoles.includes(currentUser.role)) {
        return { success: false, error: 'Bạn không có quyền chỉnh sửa Đội nhóm.' };
      }
    }

    const teams = await this.getTeams();
    const existing = teams.find(t => t.id === teamId);
    if (!existing) return { success: false, error: 'Không tìm thấy Đội nhóm.' };

    const cleanCode = input.code ? input.code.trim().toUpperCase() : existing.code;
    if (cleanCode !== existing.code && teams.some(t => t.id !== teamId && t.code === cleanCode)) {
      return { success: false, error: `Mã đội nhóm '${cleanCode}' đã tồn tại.` };
    }

    const updatedTeam: Team = {
      ...existing,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      code: cleanCode,
      agency_id: input.agency_id !== undefined ? input.agency_id : existing.agency_id,
      leader_id: input.leader_id !== undefined ? (input.leader_id || undefined) : existing.leader_id,
      updated_at: new Date().toISOString(),
    };

    if (isLiveSupabaseConfigured) {
      const payload: any = {
        name: updatedTeam.name,
        code: updatedTeam.code,
        agency_id: updatedTeam.agency_id,
        leader_id: updatedTeam.leader_id || null,
        updated_at: updatedTeam.updated_at,
      };

      const { error } = await supabase.from('teams').update(payload).eq('id', teamId);
      if (error) return { success: false, error: error.message };

      if (input.leader_id) {
        await supabase
          .from('profiles')
          .update({ team_id: teamId, agency_id: updatedTeam.agency_id, role: 'team_leader' })
          .eq('id', input.leader_id);
      }
    }

    const updated = teams.map(t => t.id === teamId ? updatedTeam : t);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_TEAMS, JSON.stringify(updated));
    }

    if (input.leader_id && input.leader_id !== existing.leader_id) {
      await this.assignRole(input.leader_id, 'team_leader', updatedTeam.agency_id, teamId);
    }

    return { success: true, team: updatedTeam };
  }

  async deleteTeam(
    teamId: string, 
    fallbackTeamId?: string, 
    currentUser?: UserProfile | null
  ): Promise<{ success: boolean; error?: string }> {
    if (currentUser) {
      const allowedRoles = ['admin', 'company_admin', 'ceo', 'director'];
      if (!allowedRoles.includes(currentUser.role)) {
        return { success: false, error: 'Chỉ Quản trị viên hoặc Giám đốc sàn mới có quyền xóa Đội nhóm.' };
      }
    }

    const profiles = await this.getProfiles();

    // Nếu có team tiếp nhận (fallback), chuyển members sang team đó; nếu không thì gỡ team_id
    const targetTeamId = fallbackTeamId || null;
    const reallocatedStaff = profiles.map(p => {
      if (p.team_id === teamId) {
        return { ...p, team_id: targetTeamId || undefined };
      }
      return p;
    });

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(reallocatedStaff));
    }

    if (isLiveSupabaseConfigured) {
      await supabase.from('profiles').update({ team_id: targetTeamId }).eq('team_id', teamId);
      const { error } = await supabase.from('teams').delete().eq('id', teamId);
      if (error) return { success: false, error: error.message };
    }

    const teams = await this.getTeams();
    const updated = teams.filter(t => t.id !== teamId);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_TEAMS, JSON.stringify(updated));
    }

    return { success: true };
  }

  // ==========================================
  // BỔ NHIỆM / CHUYỂN ĐỔI VAI TRÒ & PHÒNG BAN
  // (Giám đốc sàn, Trưởng phòng kinh doanh, Trưởng nhóm)
  // ==========================================
  /**
   * Chuẩn hóa cấp phân công theo vai trò (Hierarchy Scoping):
   * 1. Cấp cao hơn Giám đốc vùng (admin, company_admin, ceo, marketing_manager, hr_admin):
   *    -> Không bổ nhiệm Vùng, Sàn, Team (tất cả null).
   * 2. Giám đốc vùng (regional_director):
   *    -> Cấp cao hơn Giám đốc sàn / Trưởng phòng: Chỉ bổ nhiệm Vùng, không bổ nhiệm Sàn hay Team.
   * 3. Giám đốc sàn & Trưởng phòng KD (director, sales_manager):
   *    -> Cấp cao hơn Trưởng nhóm: Bổ nhiệm Vùng và Sàn, không bổ nhiệm Team.
   * 4. Trưởng nhóm & Chuyên viên tư vấn (team_leader, sale_agent):
   *    -> Bổ nhiệm đầy đủ Vùng, Sàn, Team.
   */
  sanitizeRoleHierarchy(
    role: UserRole,
    organizationId?: string | null,
    regionId?: string | null,
    agencyId?: string | null,
    teamId?: string | null
  ): {
    organization_id: string | null;
    region_id: string | null;
    agency_id: string | null;
    team_id: string | null;
  } {
    if (['admin', 'company_admin', 'ceo', 'marketing_manager', 'hr_admin'].includes(role)) {
      return {
        organization_id: role === 'admin' ? null : (organizationId || null),
        region_id: null,
        agency_id: null,
        team_id: null,
      };
    }

    if (role === 'regional_director') {
      return {
        organization_id: organizationId || null,
        region_id: regionId || null,
        agency_id: null,
        team_id: null,
      };
    }

    if (['director', 'sales_manager'].includes(role)) {
      return {
        organization_id: organizationId || null,
        region_id: regionId || null,
        agency_id: agencyId || null,
        team_id: null,
      };
    }

    return {
      organization_id: organizationId || null,
      region_id: regionId || null,
      agency_id: agencyId || null,
      team_id: teamId || null,
    };
  }

  async assignRole(
    userId: string,
    role: UserRole,
    agencyId?: string | null,
    teamId?: string | null,
    regionId?: string | null,
    organizationId?: string | null
  ): Promise<{ success: boolean; error?: string }> {
    const sanitized = this.sanitizeRoleHierarchy(role, organizationId, regionId, agencyId, teamId);

    if (isLiveSupabaseConfigured) {
      const payload: any = {
        role,
        updated_at: new Date().toISOString(),
        agency_id: sanitized.agency_id,
        team_id: sanitized.team_id,
        region_id: sanitized.region_id,
        organization_id: sanitized.organization_id,
      };

      const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
      if (error) return { success: false, error: error.message };
      return { success: true };
    }

    const profiles = await this.getProfiles();
    const updated = profiles.map(p => {
      if (p.id === userId) {
        return {
          ...p,
          role,
          agency_id: sanitized.agency_id || undefined,
          team_id: sanitized.team_id || undefined,
          region_id: sanitized.region_id || undefined,
          organization_id: sanitized.organization_id || undefined,
        };
      }
      return p;
    });
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(updated));
    return { success: true };
  }

  // ==========================================
  // QUẢN TRỊ VÙNG KINH DOANH (REGIONS)
  // ==========================================
  async getRegions(currentUser?: UserProfile): Promise<Region[]> {
    let result: Region[] = [];
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.from('regions').select('*').order('name');
      if (!error && data) {
        const regions = data as Region[];
        const profiles = await this.getProfiles();
        result = regions.map(r => {
          const dir = profiles.find(p => p.id === r.regional_director_id);
          return {
            ...r,
            regional_director_name: dir ? dir.full_name : undefined,
          };
        });
      }
    } else {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_REGIONS) : null;
      const list: Region[] = raw ? JSON.parse(raw) : INITIAL_REGIONS;
      if (typeof localStorage !== 'undefined' && !raw) {
        localStorage.setItem(STORAGE_KEY_REGIONS, JSON.stringify(INITIAL_REGIONS));
      }

      const profiles = await this.getProfiles();
      result = list.map(r => {
        const dir = profiles.find(p => p.id === r.regional_director_id);
        return {
          ...r,
          regional_director_name: dir ? dir.full_name : undefined,
        };
      });
    }

    if (currentUser) {
      result = branchHierarchyService.filterRegions(currentUser, result);
    }

    return result;
  }

  async createRegion(input: CreateRegionInput, currentUser?: UserProfile | null): Promise<{ success: boolean; region?: Region; error?: string }> {
    if (currentUser?.role === 'company_admin' && currentUser.organization_id) {
      input.organization_id = currentUser.organization_id;
    }
    const cleanCode = input.code.trim().toUpperCase();
    const regions = await this.getRegions();
    if (regions.some(r => r.code === cleanCode)) {
      return { success: false, error: `Mã vùng ${cleanCode} đã tồn tại trong hệ thống.` };
    }

    const newRegion: Region = {
      id: `reg-${Date.now()}`,
      organization_id: input.organization_id || undefined,
      name: input.name.trim(),
      code: cleanCode,
      description: input.description,
      regional_director_id: input.regional_director_id || undefined,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.from('regions').insert({
        organization_id: newRegion.organization_id || null,
        name: newRegion.name,
        code: newRegion.code,
        description: newRegion.description,
        regional_director_id: newRegion.regional_director_id || null,
        status: 'active',
      }).select().single();
      if (error) return { success: false, error: error.message };
      if (data) newRegion.id = data.id;
    }

    const updated = [...regions, newRegion];
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_REGIONS, JSON.stringify(updated));
    }

    if (input.regional_director_id) {
      await this.assignRole(input.regional_director_id, 'regional_director', null, null);
      const rawProfiles = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_PROFILES) : null;
      if (rawProfiles) {
        const profs: UserProfile[] = JSON.parse(rawProfiles);
        const idx = profs.findIndex(p => p.id === input.regional_director_id);
        if (idx !== -1) {
          profs[idx].region_id = newRegion.id;
          if (input.organization_id) profs[idx].organization_id = input.organization_id;
          localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profs));
        }
      }
    }

    return { success: true, region: newRegion };
  }

  async updateRegion(
    id: string, 
    input: Partial<Region>, 
    currentUser?: UserProfile | null
  ): Promise<{ success: boolean; region?: Region; error?: string }> {
    if (currentUser) {
      const allowedRoles = ['admin', 'company_admin', 'ceo'];
      if (!allowedRoles.includes(currentUser.role)) {
        return { success: false, error: 'Bạn không có quyền chỉnh sửa Vùng kinh doanh.' };
      }
    }

    const regions = await this.getRegions();
    const existing = regions.find(r => r.id === id);
    if (!existing) return { success: false, error: 'Không tìm thấy vùng kinh doanh.' };

    const cleanCode = input.code ? input.code.trim().toUpperCase() : existing.code;
    if (cleanCode !== existing.code && regions.some(r => r.id !== id && r.code === cleanCode)) {
      return { success: false, error: `Mã vùng '${cleanCode}' đã tồn tại.` };
    }

    const updatedRegion: Region = {
      ...existing,
      ...input,
      code: cleanCode,
      organization_id: (input.organization_id !== undefined && input.organization_id) ? input.organization_id : existing.organization_id,
      updated_at: new Date().toISOString(),
    };

    if (isLiveSupabaseConfigured) {
      const { error } = await supabase.from('regions').update({
        organization_id: updatedRegion.organization_id || null,
        name: updatedRegion.name,
        code: updatedRegion.code,
        description: updatedRegion.description,
        regional_director_id: updatedRegion.regional_director_id || null,
        status: updatedRegion.status,
        updated_at: updatedRegion.updated_at,
      }).eq('id', id);
      if (error) return { success: false, error: error.message };
    }

    const updatedList = regions.map(r => r.id === id ? updatedRegion : r);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_REGIONS, JSON.stringify(updatedList));
    }

    if (input.regional_director_id && input.regional_director_id !== existing.regional_director_id) {
      await this.assignRole(input.regional_director_id, 'regional_director', null, null, id, updatedRegion.organization_id);
    }

    return { success: true, region: updatedRegion };
  }

  async deleteRegion(
    id: string, 
    fallbackRegionId?: string, 
    currentUser?: UserProfile | null
  ): Promise<{ success: boolean; error?: string }> {
    if (currentUser) {
      const allowedRoles = ['admin', 'company_admin', 'ceo'];
      if (!allowedRoles.includes(currentUser.role)) {
        return { success: false, error: 'Chỉ Quản trị viên hoặc CEO mới có quyền xóa Vùng kinh doanh.' };
      }
    }

    if (id === 'REG-DEFAULT') {
      return { success: false, error: 'Không được phép xóa Vùng Mặc Định (Chưa phân vùng).' };
    }

    const agencies = await this.getAgencies();
    const targetFallback = fallbackRegionId || 'REG-DEFAULT';

    // Chuyển toàn bộ sàn thuộc vùng bị xóa sang vùng đích
    const reallocated = agencies.map(a => {
      if (a.region_id === id) {
        return { ...a, region_id: targetFallback };
      }
      return a;
    });

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_AGENCIES, JSON.stringify(reallocated));
      const regions = await this.getRegions();
      const filtered = regions.filter(r => r.id !== id);
      localStorage.setItem(STORAGE_KEY_REGIONS, JSON.stringify(filtered));
    }

    if (isLiveSupabaseConfigured) {
      await supabase.from('agencies').update({ region_id: targetFallback }).eq('region_id', id);
      const { error } = await supabase.from('regions').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
    }

    return { success: true };
  }

  // ==========================================
  // QUẢN TRỊ KHỐI / ĐƠN VỊ (DIVISIONS)
  // ==========================================
  async getDivisions(currentUser?: UserProfile): Promise<Division[]> {
    let list: Division[] = [];
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.from('divisions').select('*').order('name');
      if (!error && data) list = data as Division[];
    } else {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_DIVISIONS) : null;
      list = raw ? JSON.parse(raw) : INITIAL_DIVISIONS;
      if (typeof localStorage !== 'undefined' && !raw) {
        localStorage.setItem(STORAGE_KEY_DIVISIONS, JSON.stringify(INITIAL_DIVISIONS));
      }
    }

    if (currentUser?.role === 'ceo') {
      return list.filter(d => !d.ceo_id || d.ceo_id === currentUser.id);
    }
    return list;
  }

  async updateDivision(id: string, input: Partial<Division>): Promise<{ success: boolean; division?: Division; error?: string }> {
    const divs = await this.getDivisions();
    const existing = divs.find(d => d.id === id);
    if (!existing) return { success: false, error: 'Không tìm thấy khối/đơn vị.' };

    const updated = divs.map(d => d.id === id ? { ...d, ...input, updated_at: new Date().toISOString() } : d);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_DIVISIONS, JSON.stringify(updated));
    }

    return { success: true, division: updated.find(d => d.id === id) };
  }

  // ==========================================
  // CẤU HÌNH DOANH NGHIỆP & NGƯỠNG DUYỆT (COMPANY SETTINGS)
  // ==========================================
  async getCompanySettings(): Promise<CompanySettings> {
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.from('company_settings').select('*').single();
      if (!error && data) return data as CompanySettings;
    }

    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_COMPANY_SETTINGS) : null;
    const settings: CompanySettings = raw ? JSON.parse(raw) : INITIAL_COMPANY_SETTINGS;
    if (typeof localStorage !== 'undefined' && !raw) {
      localStorage.setItem(STORAGE_KEY_COMPANY_SETTINGS, JSON.stringify(INITIAL_COMPANY_SETTINGS));
    }
    return settings;
  }

  async updateCompanySettings(input: Partial<CompanySettings>): Promise<{ success: boolean; settings?: CompanySettings; error?: string }> {
    const current = await this.getCompanySettings();
    const updated: CompanySettings = {
      ...current,
      ...input,
      updated_at: new Date().toISOString(),
    };

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_COMPANY_SETTINGS, JSON.stringify(updated));
    }

    return { success: true, settings: updated };
  }

  // ==========================================
  // CHỨC DANH ĐỊNH NGHĨA (ORG POSITIONS)
  // ==========================================
  async getOrgPositions(): Promise<OrgPositionLevel[]> {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_ORG_POSITIONS) : null;
    const list: OrgPositionLevel[] = raw ? JSON.parse(raw) : INITIAL_ORG_POSITIONS;
    if (typeof localStorage !== 'undefined' && !raw) {
      localStorage.setItem(STORAGE_KEY_ORG_POSITIONS, JSON.stringify(INITIAL_ORG_POSITIONS));
    }
    return list;
  }

  // ==========================================
  // BÁO CÁO SỨC KHỎE CƠ CẤU (STRUCTURAL HEALTH REPORT)
  // ==========================================
  async getStructuralHealthReport(): Promise<StructuralHealthReport> {
    const agencies = await this.getAgencies();
    const regions = await this.getRegions();

    const agenciesWithoutRegion = agencies
      .filter(a => !a.region_id || a.region_id === 'REG-DEFAULT' || !regions.some(r => r.id === a.region_id))
      .map(a => ({ id: a.id, name: a.name }));

    const regionsWithoutDirector = regions
      .filter(r => !r.regional_director_id && r.id !== 'REG-DEFAULT')
      .map(r => ({ id: r.id, name: r.name }));

    const agenciesWithoutDirector = agencies
      .filter(a => !a.director_id)
      .map(a => ({ id: a.id, name: a.name }));

    return {
      orphanSalesCount: 0,
      teamsWithoutLeaderCount: 0,
      departmentsWithoutHeadCount: 0,
      marketingUnitsWithoutManagerCount: 0,
      regionsWithoutDirectorCount: regionsWithoutDirector.length,
      agenciesWithoutRegionCount: agenciesWithoutRegion.length,
      agenciesWithoutDirectorCount: agenciesWithoutDirector.length,
      expiredActingCount: 0,
      orphanSales: [],
      teamsWithoutLeader: [],
      departmentsWithoutHead: [],
      agenciesWithoutRegion,
      regionsWithoutDirector,
      agenciesWithoutDirector,
      actingPositionsExpiring: [],
      hasIssues: agenciesWithoutRegion.length > 0 || regionsWithoutDirector.length > 0 || agenciesWithoutDirector.length > 0
    };
  }
}

export const teamRepository = new TeamRepository();
