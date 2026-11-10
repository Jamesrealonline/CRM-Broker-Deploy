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
          return {
            ...o,
            ceo_id: o.ceo_id || ceo?.id,
            ceo_name: o.ceo_name || ceo?.full_name,
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
        return {
          ...o,
          ceo_id: o.ceo_id || ceo?.id,
          ceo_name: o.ceo_name || ceo?.full_name,
        };
      });
    }

    if (currentUser) {
      result = branchHierarchyService.filterOrganizations(currentUser, result);
    }

    return result;
  }

  async createOrganization(input: CreateOrganizationInput): Promise<{ success: boolean; organization?: Organization; error?: string }> {
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
      }).select().single();
      if (error) return { success: false, error: error.message };
      if (data) newOrg.id = data.id;
    }

    const updated = [...orgs, newOrg];
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_ORGANIZATIONS, JSON.stringify(updated));
    }

    if (input.ceo_id) {
      await this.assignRole(input.ceo_id, 'ceo', null, null);
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

    return { success: true, organization: newOrg };
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

  async getProfiles(agencyId?: string, teamId?: string, currentUser?: UserProfile): Promise<UserProfile[]> {
    let result: UserProfile[] = [];
    if (isLiveSupabaseConfigured) {
      let query = supabase.from('profiles').select('*').order('created_at', { ascending: true });
      if (agencyId) query = query.eq('agency_id', agencyId);
      if (teamId) query = query.eq('team_id', teamId);
      const { data, error } = await query;
      if (!error && data) result = data as UserProfile[];
    } else {
      const raw = localStorage.getItem(STORAGE_KEY_PROFILES);
      const list: UserProfile[] = raw ? JSON.parse(raw) : INITIAL_PROFILES;
      if (!raw) localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(INITIAL_PROFILES));
      
      let filtered = list;
      if (agencyId) filtered = filtered.filter(p => p.agency_id === agencyId);
      if (teamId) filtered = filtered.filter(p => p.team_id === teamId);
      result = filtered;
    }

    if (currentUser) {
      result = branchHierarchyService.filterProfiles(currentUser, result);
    }

    return result;
  }

  async createUser(input: CreateUserInput): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
    const cleanEmail = input.email.trim().toLowerCase();

    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.rpc('create_user_by_admin', {
        p_email: cleanEmail,
        p_password: input.password || 'password123',
        p_full_name: input.full_name.trim(),
        p_phone: input.phone.trim(),
        p_role: input.role,
        p_agency_id: input.agency_id || null,
        p_team_id: input.team_id || null,
        p_must_change_password: input.must_change_password ?? true,
      });

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true, profile: data as UserProfile };
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
      organization_id: input.organization_id || undefined,
      region_id: input.region_id || undefined,
      agency_id: input.agency_id || undefined,
      team_id: input.team_id || undefined,
      status: 'active',
      must_change_password: input.must_change_password ?? true,
      totp_enabled: false,
      created_at: new Date().toISOString(),
    };

    const updated = [...profiles, newProfile];
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(updated));
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

    const profiles = await this.getProfiles();
    const updated = profiles.map(p => p.id === userId ? { ...p, status: newStatus } : p);
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(updated));
    return true;
  }

  // ==========================================
  // QUẢN TRỊ SÀN GIAO DỊCH (AGENCY / BRANCH)
  // ==========================================
  async createAgency(input: CreateAgencyInput): Promise<{ success: boolean; agency?: Agency; error?: string }> {
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

  async updateAgency(agencyId: string, input: Partial<CreateAgencyInput>): Promise<{ success: boolean; error?: string }> {
    if (isLiveSupabaseConfigured) {
      const payload: any = { updated_at: new Date().toISOString() };
      if (input.name) payload.name = input.name.trim();
      if (input.code) payload.code = input.code.trim().toUpperCase();
      if (input.address !== undefined) payload.address = input.address;
      if (input.phone !== undefined) payload.phone = input.phone;
      if (input.email !== undefined) payload.email = input.email;
      if (input.director_id !== undefined) payload.director_id = input.director_id || null;

      const { error } = await supabase.from('agencies').update(payload).eq('id', agencyId);
      if (error) return { success: false, error: error.message };

      if (input.director_id) {
        await supabase
          .from('profiles')
          .update({ agency_id: agencyId, role: 'director' })
          .eq('id', input.director_id);
      }
      return { success: true };
    }

    const agencies = await this.getAgencies();
    const updated = agencies.map(a => {
      if (a.id === agencyId) {
        return {
          ...a,
          ...input,
          code: input.code ? input.code.trim().toUpperCase() : a.code,
        };
      }
      return a;
    });
    localStorage.setItem(STORAGE_KEY_AGENCIES, JSON.stringify(updated));

    if (input.director_id) {
      await this.assignRole(input.director_id, 'director', agencyId, null);
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

  // ==========================================
  // BỔ NHIỆM / CHUYỂN ĐỔI VAI TRÒ & PHÒNG BAN
  // (Giám đốc sàn, Trưởng phòng kinh doanh, Trưởng nhóm)
  // ==========================================
  async assignRole(
    userId: string,
    role: UserRole,
    agencyId?: string | null,
    teamId?: string | null,
    regionId?: string | null,
    organizationId?: string | null
  ): Promise<{ success: boolean; error?: string }> {
    if (isLiveSupabaseConfigured) {
      const payload: any = {
        role,
        updated_at: new Date().toISOString(),
      };
      if (agencyId !== undefined) payload.agency_id = agencyId;
      if (teamId !== undefined) payload.team_id = teamId;
      if (regionId !== undefined) payload.region_id = regionId;
      if (organizationId !== undefined) payload.organization_id = organizationId;

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
          agency_id: agencyId !== undefined ? (agencyId || undefined) : p.agency_id,
          team_id: teamId !== undefined ? (teamId || undefined) : p.team_id,
          region_id: regionId !== undefined ? (regionId || undefined) : p.region_id,
          organization_id: organizationId !== undefined ? (organizationId || undefined) : p.organization_id,
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

  async createRegion(input: CreateRegionInput): Promise<{ success: boolean; region?: Region; error?: string }> {
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

  async updateRegion(id: string, input: Partial<Region>): Promise<{ success: boolean; region?: Region; error?: string }> {
    const regions = await this.getRegions();
    const existing = regions.find(r => r.id === id);
    if (!existing) return { success: false, error: 'Không tìm thấy vùng kinh doanh.' };

    const updatedRegion: Region = {
      ...existing,
      ...input,
      updated_at: new Date().toISOString(),
    };

    if (isLiveSupabaseConfigured) {
      const { error } = await supabase.from('regions').update({
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

    if (input.regional_director_id) {
      await this.assignRole(input.regional_director_id, 'regional_director', null, null);
    }

    return { success: true, region: updatedRegion };
  }

  async deleteRegion(id: string, fallbackRegionId?: string): Promise<{ success: boolean; error?: string }> {
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
