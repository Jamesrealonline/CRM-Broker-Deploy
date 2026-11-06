// ========================================================
// REAL ESTATE CRM - AUTH REPOSITORY
// Xử lý xác thực, kiểm tra khóa tài khoản, đổi mật khẩu bắt buộc
// ========================================================

import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';
import { UserProfile, UserRole } from '@/domain/types';
import { INITIAL_PROFILES } from '../mockData';

const STORAGE_KEY_AUTH = 'crm_auth_user';
const STORAGE_KEY_LOGIN_ATTEMPTS = 'crm_login_attempts';
const STORAGE_KEY_IMPERSONATED_ROLE = 'crm_impersonated_role';

interface LoginAttemptInfo {
  count: number;
  lockedUntil?: number;
}

export class AuthRepository {
  // Lấy người dùng hiện tại từ session / local store
  async getCurrentProfile(): Promise<UserProfile | null> {
    const impersonated = localStorage.getItem(STORAGE_KEY_IMPERSONATED_ROLE) as UserRole | null;
    
    if (isLiveSupabaseConfigured) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
        
      if (error || !data) return null;
      
      const profile = data as UserProfile;
      if (impersonated && profile.role === 'admin') {
        return { ...profile, role: impersonated };
      }
      return profile;
    }

    // Local / Offline fallback
    const raw = localStorage.getItem(STORAGE_KEY_AUTH);
    if (!raw) return null;
    const profile = JSON.parse(raw) as UserProfile;
    if (impersonated && profile.role === 'admin') {
      return { ...profile, role: impersonated };
    }
    return profile;
  }

  // Đăng nhập email & mật khẩu
  async login(email: string, password: string): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Kiểm tra khóa tạm sau 5 lần sai
    const attempts = this.getLoginAttempts(cleanEmail);
    if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
      const remainingMinutes = Math.ceil((attempts.lockedUntil - Date.now()) / 60000);
      return {
        success: false,
        error: `Tài khoản tạm thời bị khóa do nhập sai nhiều lần. Vui lòng thử lại sau ${remainingMinutes} phút.`,
      };
    }

    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (error || !data.user) {
        this.recordFailedAttempt(cleanEmail);
        return {
          success: false,
          error: 'Thông tin tài khoản hoặc mật khẩu không chính xác.',
        };
      }

      this.clearFailedAttempts(cleanEmail);
      const profile = await this.getCurrentProfile();
      return { success: true, profile: profile || undefined };
    }

    // Fallback: Tìm profile mẫu
    const targetProfile = INITIAL_PROFILES.find(p => p.email.toLowerCase() === cleanEmail);
    // Mật khẩu mặc định demo cho tất cả role là '12345678aA@' hoặc 'password123'
    if (!targetProfile || (password !== '12345678aA@' && password !== 'password123' && password !== '123456')) {
      this.recordFailedAttempt(cleanEmail);
      return {
        success: false,
        error: 'Thông tin tài khoản hoặc mật khẩu không chính xác.',
      };
    }

    if (targetProfile.status === 'locked') {
      return {
        success: false,
        error: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản trị viên.',
      };
    }

    this.clearFailedAttempts(cleanEmail);
    localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(targetProfile));
    localStorage.removeItem(STORAGE_KEY_IMPERSONATED_ROLE);

    // Ghi audit log đăng nhập
    this.recordAuditLog(targetProfile.id, 'login', 'Đăng nhập hệ thống thành công');

    return { success: true, profile: targetProfile };
  }

  // Đổi mật khẩu
  async changePassword(userId: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    // Ràng buộc mật khẩu: tối thiểu 8 ký tự, có cả chữ và số
    const hasLength = newPassword.length >= 8;
    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);

    if (!hasLength || !hasLetter || !hasNumber) {
      return {
        success: false,
        error: 'Mật khẩu mới phải có tối thiểu 8 ký tự, bao gồm cả chữ cái và chữ số.',
      };
    }

    if (isLiveSupabaseConfigured) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { success: false, error: error.message };
      await supabase.from('profiles').update({ must_change_password: false }).eq('id', userId);
    } else {
      const raw = localStorage.getItem(STORAGE_KEY_AUTH);
      if (raw) {
        const profile = JSON.parse(raw) as UserProfile;
        profile.must_change_password = false;
        localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(profile));
      }
    }

    this.recordAuditLog(userId, 'password_change', 'Đổi mật khẩu thành công');
    return { success: true };
  }

  // Đăng xuất
  async logout(): Promise<void> {
    const profile = await this.getCurrentProfile();
    if (profile) {
      this.recordAuditLog(profile.id, 'logout', 'Đăng xuất khỏi hệ thống');
    }
    if (isLiveSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem(STORAGE_KEY_AUTH);
    localStorage.removeItem(STORAGE_KEY_IMPERSONATED_ROLE);
  }

  // Admin xem giao diện theo vai trò khác (Impersonate)
  async impersonateRole(role: UserRole | null): Promise<void> {
    const current = await this.getCurrentProfile();
    // Phải kiểm tra quyền thực tế
    const raw = localStorage.getItem(STORAGE_KEY_AUTH);
    const originalRole = raw ? (JSON.parse(raw) as UserProfile).role : current?.role;
    
    if (originalRole !== 'admin') {
      throw new Error('Chỉ Quản trị viên (Admin) mới có quyền chuyển đổi góc nhìn vai trò!');
    }

    if (role) {
      localStorage.setItem(STORAGE_KEY_IMPERSONATED_ROLE, role);
      this.recordAuditLog(current!.id, 'role_impersonate', `Chuyển sang góc nhìn vai trò: ${role}`);
    } else {
      localStorage.removeItem(STORAGE_KEY_IMPERSONATED_ROLE);
      this.recordAuditLog(current!.id, 'role_impersonate', 'Quay lại góc nhìn Quản trị viên (Admin)');
    }
  }

  // Quản lý số lần đăng nhập sai
  private getLoginAttempts(email: string): LoginAttemptInfo {
    const raw = localStorage.getItem(`${STORAGE_KEY_LOGIN_ATTEMPTS}_${email}`);
    if (!raw) return { count: 0 };
    return JSON.parse(raw);
  }

  private recordFailedAttempt(email: string) {
    const attempts = this.getLoginAttempts(email);
    attempts.count += 1;
    if (attempts.count >= 5) {
      attempts.lockedUntil = Date.now() + 5 * 60 * 1000; // Khóa 5 phút
    }
    localStorage.setItem(`${STORAGE_KEY_LOGIN_ATTEMPTS}_${email}`, JSON.stringify(attempts));
  }

  private clearFailedAttempts(email: string) {
    localStorage.removeItem(`${STORAGE_KEY_LOGIN_ATTEMPTS}_${email}`);
  }

  private recordAuditLog(userId: string, action: string, detailsText: string) {
    const logs = JSON.parse(localStorage.getItem('crm_audit_logs') || '[]');
    logs.unshift({
      id: crypto.randomUUID(),
      user_id: userId,
      action,
      details: { message: detailsText },
      created_at: new Date().toISOString(),
    });
    localStorage.setItem('crm_audit_logs', JSON.stringify(logs.slice(0, 500)));
  }
}

export const authRepository = new AuthRepository();
