// ========================================================
// REAL ESTATE CRM - AUTH STORE (Zustand)
// Quản lý trạng thái phiên đăng nhập & tự động đăng xuất 30 phút
// ========================================================

import { create } from 'zustand';
import { UserProfile, UserRole } from '@/domain/types';
import { authRepository } from '@/data/repositories/authRepository';

interface AuthState {
  currentUser: UserProfile | null;
  realUser: UserProfile | null;
  isLoading: boolean;
  lastActiveTime: number;
  impersonatingRole: UserRole | null;
  
  initialize: () => Promise<void>;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateActivity: () => void;
  setImpersonatedRole: (role: UserRole | null) => Promise<void>;
}

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 phút tự động đăng xuất

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  realUser: null,
  isLoading: true,
  lastActiveTime: Date.now(),
  impersonatingRole: null,

  initialize: async () => {
    try {
      const [realProfile, activeProfile] = await Promise.all([
        authRepository.getRealProfile(),
        authRepository.getCurrentProfile(),
      ]);
      const impRole = authRepository.getImpersonatedRole();

      set({ 
        realUser: realProfile,
        currentUser: activeProfile, 
        impersonatingRole: impRole,
        isLoading: false, 
        lastActiveTime: Date.now() 
      });
    } catch {
      set({ realUser: null, currentUser: null, impersonatingRole: null, isLoading: false });
    }
  },

  login: async (email, pass) => {
    set({ isLoading: true });
    const res = await authRepository.login(email, pass);
    if (res.success && res.profile) {
      const realProfile = await authRepository.getRealProfile();
      set({ 
        realUser: realProfile,
        currentUser: res.profile, 
        impersonatingRole: null,
        isLoading: false, 
        lastActiveTime: Date.now() 
      });
      return { success: true };
    }
    set({ isLoading: false });
    return { success: false, error: res.error };
  },

  logout: async () => {
    await authRepository.logout();
    set({ realUser: null, currentUser: null, impersonatingRole: null });
  },

  updateActivity: () => {
    const { currentUser, lastActiveTime, logout } = get();
    if (!currentUser) return;

    const now = Date.now();
    if (now - lastActiveTime > INACTIVITY_TIMEOUT_MS) {
      console.warn('Phiên làm việc đã hết hạn sau 30 phút không hoạt động. Tự động đăng xuất.');
      logout();
      return;
    }
    set({ lastActiveTime: now });
  },

  setImpersonatedRole: async (role) => {
    await authRepository.impersonateRole(role);
    const [realProfile, activeProfile] = await Promise.all([
      authRepository.getRealProfile(),
      authRepository.getCurrentProfile(),
    ]);
    const impRole = authRepository.getImpersonatedRole();

    set({ 
      realUser: realProfile,
      currentUser: activeProfile, 
      impersonatingRole: impRole 
    });
  },
}));
