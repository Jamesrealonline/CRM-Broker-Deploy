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
  // Lấy người dùng thực tế từ DB/Session (Không bị can thiệp bởi góc nhìn giả lập)
  async getRealProfile(): Promise<UserProfile | null> {
    if (isLiveSupabaseConfigured) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
        
      if (error || !data) return null;
      return data as UserProfile;
    }

    // Local / Offline fallback
    const raw = localStorage.getItem(STORAGE_KEY_AUTH);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  }

  // Lấy người dùng hiện tại (nếu Admin đang chuyển góc nhìn thì role sẽ là role giả lập)
  async getCurrentProfile(): Promise<UserProfile | null> {
    const realProfile = await this.getRealProfile();
    if (!realProfile) return null;

    // Chỉ tài khoản có vai trò thực tế là 'admin' mới được phép chuyển góc nhìn
    if (realProfile.role === 'admin') {
      const impersonated = localStorage.getItem(STORAGE_KEY_IMPERSONATED_ROLE) as UserRole | null;
      if (impersonated && impersonated !== 'admin') {
        return { ...realProfile, role: impersonated };
      }
    } else {
      // Nếu không phải admin mà localStorage có sót cờ impersonate thì xóa bỏ ngay
      localStorage.removeItem(STORAGE_KEY_IMPERSONATED_ROLE);
    }

    return realProfile;
  }

  // Lấy vai trò đang giả lập (nếu có)
  getImpersonatedRole(): UserRole | null {
    return localStorage.getItem(STORAGE_KEY_IMPERSONATED_ROLE) as UserRole | null;
  }

  // Đăng nhập email & mật khẩu
  async login(email: string, password: string): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();

    // Reset mọi góc nhìn giả lập khi đăng nhập mới
    localStorage.removeItem(STORAGE_KEY_IMPERSONATED_ROLE);

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
    if (!targetProfile || (password !== 'password123' && password !== '12345678aA@' && password !== '123456')) {
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
    return { success: true, profile: targetProfile };
  }

  // Đổi mật khẩu bắt buộc
  async changePassword(userId: string, newPass: string): Promise<{ success: boolean; error?: string }> {
    const hasLetter = /[a-zA-Z]/.test(newPass);
    const hasNumber = /[0-9]/.test(newPass);
    if (newPass.length < 8 || !hasLetter || !hasNumber) {
      return { success: false, error: 'Mật khẩu phải chứa ít nhất 8 ký tự, bao gồm cả chữ và số.' };
    }

    if (isLiveSupabaseConfigured) {
      const { error } = await supabase.auth.updateUser({ password: newPass });
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

  // Admin xem giao diện theo vai trò khác (Chỉ cho phép tài khoản Admin thực tế)
  async impersonateRole(role: UserRole | null): Promise<void> {
    const real = await this.getRealProfile();
    if (!real || real.role !== 'admin') {
      console.warn('Từ chối thao tác: Chỉ Quản trị viên (Admin) mới có quyền chuyển đổi góc nhìn vai trò.');
      localStorage.removeItem(STORAGE_KEY_IMPERSONATED_ROLE);
      return;
    }

    if (role && role !== 'admin') {
      localStorage.setItem(STORAGE_KEY_IMPERSONATED_ROLE, role);
      this.recordAuditLog(real.id, 'role_impersonate', `Admin chuyển góc nhìn sang: ${role}`);
    } else {
      localStorage.removeItem(STORAGE_KEY_IMPERSONATED_ROLE);
      this.recordAuditLog(real.id, 'role_impersonate', 'Admin quay lại góc nhìn quản trị viên mặc định');
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
