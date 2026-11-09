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

const STORAGE_KEY_AGENCIES = 'crm_agencies';
const STORAGE_KEY_TEAMS = 'crm_teams';
const STORAGE_KEY_PROFILES = 'crm_profiles';
const STORAGE_KEY_REGIONS = 'crm_regions';
const STORAGE_KEY_DIVISIONS = 'crm_divisions';
const STORAGE_KEY_COMPANY_SETTINGS = 'crm_company_settings';
const STORAGE_KEY_ORG_POSITIONS = 'crm_org_positions';

export interface CreateUserInput {
  email: string;
  password?: string;
  full_name: string;
  phone: string;
  role: UserRole;
  agency_id?: string | null;
  team_id?: string | null;
  region_id?: string | null;
  position_code?: string | null;
  must_change_password?: boolean;
}

export interface CreateAgencyInput {
  name: string;
  code: string;
  region_id?: string | null;
  address?: string;
  phone?: string;
  email?: string;
  director_id?: string | null;
}

export interface CreateRegionInput {
  name: string;
  code: string;
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
  async getAgencies(): Promise<Agency[]> {
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase
        .from('agencies')
        .select('*')
        .order('name');
      if (!error && data) {
        // Lấy tên director nếu có
        const agencies = data as Agency[];
        const profiles = await this.getProfiles();
        return agencies.map(a => {
          const director = profiles.find(p => p.id === a.director_id);
          return {
            ...a,
            director_name: director ? director.full_name : undefined,
          };
        });
      }
    }

    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_AGENCIES) : null;
    const list: Agency[] = raw ? JSON.parse(raw) : INITIAL_AGENCIES;
    if (typeof localStorage !== 'undefined' && !raw) {
      localStorage.setItem(STORAGE_KEY_AGENCIES, JSON.stringify(INITIAL_AGENCIES));
    }
    const profiles = await this.getProfiles();
    const rawRegions = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_REGIONS) : null;
    const regions: Region[] = rawRegions ? JSON.parse(rawRegions) : INITIAL_REGIONS;

    return list.map(a => {
      const director = profiles.find(p => p.id === a.director_id);
      const reg = regions.find(r => r.id === a.region_id);
      return {
        ...a,
        director_name: director ? director.full_name : undefined,
        region_name: reg ? reg.name : undefined,
      };
    });
  }

  async getTeams(agencyId?: string): Promise<Team[]> {
    if (isLiveSupabaseConfigured) {
      let query = supabase.from('teams').select('*').order('name');
      if (agencyId) query = query.eq('agency_id', agencyId);
      const { data, error } = await query;
      if (!error && data) {
        const teams = data as Team[];
        const profiles = await this.getProfiles();
        return teams.map(t => {
          const leader = profiles.find(p => p.id === t.leader_id);
          const members = profiles.filter(p => p.team_id === t.id);
          return {
            ...t,
            leader_name: leader ? leader.full_name : undefined,
            member_count: members.length,
          };
        });
      }
    }

    const raw = localStorage.getItem(STORAGE_KEY_TEAMS);
    const list: Team[] = raw ? JSON.parse(raw) : INITIAL_TEAMS;
    if (!raw) localStorage.setItem(STORAGE_KEY_TEAMS, JSON.stringify(INITIAL_TEAMS));
    
    let filtered = list;
    if (agencyId) filtered = filtered.filter(t => t.agency_id === agencyId);

    const profiles = await this.getProfiles();
    return filtered.map(t => {
      const leader = profiles.find(p => p.id === t.leader_id);
      const members = profiles.filter(p => p.team_id === t.id);
      return {
        ...t,
        leader_name: leader ? leader.full_name : undefined,
        member_count: members.length,
      };
    });
  }

  async getProfiles(agencyId?: string, teamId?: string): Promise<UserProfile[]> {
    if (isLiveSupabaseConfigured) {
      let query = supabase.from('profiles').select('*').order('created_at', { ascending: true });
      if (agencyId) query = query.eq('agency_id', agencyId);
      if (teamId) query = query.eq('team_id', teamId);
      const { data, error } = await query;
      if (!error && data) return data as UserProfile[];
    }

    const raw = localStorage.getItem(STORAGE_KEY_PROFILES);
    const list: UserProfile[] = raw ? JSON.parse(raw) : INITIAL_PROFILES;
    if (!raw) localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(INITIAL_PROFILES));
    
    let filtered = list;
    if (agencyId) filtered = filtered.filter(p => p.agency_id === agencyId);
    if (teamId) filtered = filtered.filter(p => p.team_id === teamId);
    return filtered;
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
    const orgId = INITIAL_ORGS[0].id;

    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase
        .from('agencies')
        .insert({
          organization_id: orgId,
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
    teamId?: string | null
  ): Promise<{ success: boolean; error?: string }> {
    if (isLiveSupabaseConfigured) {
      const payload: any = {
        role,
        updated_at: new Date().toISOString(),
      };
      if (agencyId !== undefined) payload.agency_id = agencyId;
      if (teamId !== undefined) payload.team_id = teamId;

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
  async getRegions(): Promise<Region[]> {
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.from('regions').select('*').order('name');
      if (!error && data) {
        const regions = data as Region[];
        const profiles = await this.getProfiles();
        return regions.map(r => {
          const dir = profiles.find(p => p.id === r.regional_director_id);
          return {
            ...r,
            regional_director_name: dir ? dir.full_name : undefined,
          };
        });
      }
    }

    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_REGIONS) : null;
    const list: Region[] = raw ? JSON.parse(raw) : INITIAL_REGIONS;
    if (typeof localStorage !== 'undefined' && !raw) {
      localStorage.setItem(STORAGE_KEY_REGIONS, JSON.stringify(INITIAL_REGIONS));
    }

    const profiles = await this.getProfiles();
    return list.map(r => {
      const dir = profiles.find(p => p.id === r.regional_director_id);
      return {
        ...r,
        regional_director_name: dir ? dir.full_name : undefined,
      };
    });
  }

  async createRegion(input: CreateRegionInput): Promise<{ success: boolean; region?: Region; error?: string }> {
    const cleanCode = input.code.trim().toUpperCase();
    const regions = await this.getRegions();
    if (regions.some(r => r.code === cleanCode)) {
      return { success: false, error: `Mã vùng ${cleanCode} đã tồn tại trong hệ thống.` };
    }

    const newRegion: Region = {
      id: `reg-${Date.now()}`,
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
  async getDivisions(): Promise<Division[]> {
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.from('divisions').select('*').order('name');
      if (!error && data) return data as Division[];
    }

    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_DIVISIONS) : null;
    const list: Division[] = raw ? JSON.parse(raw) : INITIAL_DIVISIONS;
    if (typeof localStorage !== 'undefined' && !raw) {
      localStorage.setItem(STORAGE_KEY_DIVISIONS, JSON.stringify(INITIAL_DIVISIONS));
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
