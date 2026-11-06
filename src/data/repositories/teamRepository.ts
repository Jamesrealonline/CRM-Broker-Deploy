// ========================================================
// REAL ESTATE CRM - TEAM & ORGANIZATION REPOSITORY
// ========================================================

import { Agency, Team, UserProfile } from '@/domain/types';
import { INITIAL_AGENCIES, INITIAL_TEAMS, INITIAL_PROFILES } from '../mockData';

const STORAGE_KEY_AGENCIES = 'crm_agencies';
const STORAGE_KEY_TEAMS = 'crm_teams';
const STORAGE_KEY_PROFILES = 'crm_profiles';

export class TeamRepository {
  async getAgencies(): Promise<Agency[]> {
    const raw = localStorage.getItem(STORAGE_KEY_AGENCIES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_AGENCIES, JSON.stringify(INITIAL_AGENCIES));
      return INITIAL_AGENCIES;
    }
    return JSON.parse(raw);
  }

  async getTeams(agencyId?: string): Promise<Team[]> {
    const raw = localStorage.getItem(STORAGE_KEY_TEAMS);
    const list: Team[] = raw ? JSON.parse(raw) : INITIAL_TEAMS;
    if (!raw) localStorage.setItem(STORAGE_KEY_TEAMS, JSON.stringify(INITIAL_TEAMS));
    if (agencyId) return list.filter(t => t.agency_id === agencyId);
    return list;
  }

  async getProfiles(agencyId?: string, teamId?: string): Promise<UserProfile[]> {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILES);
    const list: UserProfile[] = raw ? JSON.parse(raw) : INITIAL_PROFILES;
    if (!raw) localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(INITIAL_PROFILES));
    
    let filtered = list;
    if (agencyId) filtered = filtered.filter(p => p.agency_id === agencyId);
    if (teamId) filtered = filtered.filter(p => p.team_id === teamId);
    return filtered;
  }
}

export const teamRepository = new TeamRepository();
