// ========================================================
// REAL ESTATE CRM - TEAM & ORGANIZATION REPOSITORY
// Quản lý cơ cấu Tổ chức, Sàn, Team và Tài khoản Người Dùng
// ========================================================

import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';
import { Agency, Team, UserProfile, UserRole } from '@/domain/types';
import { INITIAL_AGENCIES, INITIAL_TEAMS, INITIAL_PROFILES } from '../mockData';

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

export class TeamRepository {
  async getAgencies(): Promise<Agency[]> {
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase
        .from('agencies')
        .select('*')
        .order('name');
      if (!error && data) return data as Agency[];
    }

    const raw = localStorage.getItem(STORAGE_KEY_AGENCIES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_AGENCIES, JSON.stringify(INITIAL_AGENCIES));
      return INITIAL_AGENCIES;
    }
    return JSON.parse(raw);
  }

  async getTeams(agencyId?: string): Promise<Team[]> {
    if (isLiveSupabaseConfigured) {
      let query = supabase.from('teams').select('*').order('name');
      if (agencyId) query = query.eq('agency_id', agencyId);
      const { data, error } = await query;
      if (!error && data) return data as Team[];
    }

    const raw = localStorage.getItem(STORAGE_KEY_TEAMS);
    const list: Team[] = raw ? JSON.parse(raw) : INITIAL_TEAMS;
    if (!raw) localStorage.setItem(STORAGE_KEY_TEAMS, JSON.stringify(INITIAL_TEAMS));
    if (agencyId) return list.filter(t => t.agency_id === agencyId);
    return list;
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
}

export const teamRepository = new TeamRepository();
