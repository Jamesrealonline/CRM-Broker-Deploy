// ========================================================
// REAL ESTATE CRM - TEAM & ORGANIZATION REPOSITORY
// Quản lý cơ cấu Tổ chức, Sàn, Team và Bổ nhiệm Nhân sự
// ========================================================

import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';
import { Agency, Team, UserProfile, UserRole } from '@/domain/types';
import { INITIAL_AGENCIES, INITIAL_TEAMS, INITIAL_PROFILES, INITIAL_ORGS } from '../mockData';

const STORAGE_KEY_AGENCIES = 'crm_agencies';
const STORAGE_KEY_TEAMS = 'crm_teams';
const STORAGE_KEY_PROFILES = 'crm_profiles';

export interface CreateUserInput {
  email: string;
  password?: string;
  full_name: string;
  phone: string;
  role: UserRole;
  agency_id?: string | null;
  team_id?: string | null;
  must_change_password?: boolean;
}

export interface CreateAgencyInput {
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  director_id?: string | null;
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

    const raw = localStorage.getItem(STORAGE_KEY_AGENCIES);
    const list: Agency[] = raw ? JSON.parse(raw) : INITIAL_AGENCIES;
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_AGENCIES, JSON.stringify(INITIAL_AGENCIES));
    }
    const profiles = await this.getProfiles();
    return list.map(a => {
      const director = profiles.find(p => p.id === a.director_id);
      return {
        ...a,
        director_name: director ? director.full_name : undefined,
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
}

export const teamRepository = new TeamRepository();
