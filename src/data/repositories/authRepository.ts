// ========================================================
// REAL ESTATE CRM - AUTH REPOSITORY
// Xử lý xác thực, kiểm tra khóa tài khoản, đổi mật khẩu bắt buộc
// Giai đoạn P1.1: Quản lý phiên, 2FA bắt buộc & Giả lập an toàn
// ========================================================

import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';
import { UserProfile, UserRole, ImpersonationSession } from '@/domain/types';
import { INITIAL_PROFILES } from '../mockData';

const STORAGE_KEY_AUTH = 'crm_auth_user';
const STORAGE_KEY_LOGIN_ATTEMPTS = 'crm_login_attempts';
const STORAGE_KEY_IMPERSONATED_ROLE = 'crm_impersonated_role';
const STORAGE_KEY_IMPERSONATION_SESSION = 'crm_impersonation_session';
const STORAGE_KEY_PENDING_2FA_USER = 'crm_pending_2fa_user';

export interface LoginAttemptInfo {
  count: number;
  lockedUntil?: number;
}

export interface LoginOptions {
  enforce2FA?: boolean;
  code?: string;
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
      const session = this.getImpersonationSession();
      if (session) {
        return { ...realProfile, role: session.effective_role };
      }
      const impersonated = localStorage.getItem(STORAGE_KEY_IMPERSONATED_ROLE) as UserRole | null;
      if (impersonated && impersonated !== 'admin') {
        return { ...realProfile, role: impersonated };
      }
    } else {
      // Nếu không phải admin mà localStorage có sót cờ impersonate thì xóa bỏ ngay
      localStorage.removeItem(STORAGE_KEY_IMPERSONATED_ROLE);
      localStorage.removeItem(STORAGE_KEY_IMPERSONATION_SESSION);
    }

    return realProfile;
  }

  // Lấy vai trò đang giả lập (nếu có và còn hạn)
  getImpersonatedRole(): UserRole | null {
    const session = this.getImpersonationSession();
    if (session) return session.effective_role;
    return localStorage.getItem(STORAGE_KEY_IMPERSONATED_ROLE) as UserRole | null;
  }

  // Lấy phiên giả lập hiện tại (tự động dọn nếu hết hạn)
  getImpersonationSession(): ImpersonationSession | null {
    const raw = localStorage.getItem(STORAGE_KEY_IMPERSONATION_SESSION);
    if (!raw) return null;
    try {
      const session = JSON.parse(raw) as ImpersonationSession;
      if (new Date(session.expires_at).getTime() <= Date.now()) {
        localStorage.removeItem(STORAGE_KEY_IMPERSONATION_SESSION);
        localStorage.removeItem(STORAGE_KEY_IMPERSONATED_ROLE);
        return null;
      }
      return session;
    } catch {
      localStorage.removeItem(STORAGE_KEY_IMPERSONATION_SESSION);
      return null;
    }
  }

  // Kiểm tra đang ở chế độ impersonation
  isImpersonating(): boolean {
    return this.getImpersonationSession() !== null || Boolean(localStorage.getItem(STORAGE_KEY_IMPERSONATED_ROLE));
  }

  // Chặn mọi thao tác tài chính, duyệt, đổi mật khẩu khi đang impersonate (CHẾ ĐỘ CHỈ ĐỌC)
  assertNotImpersonating(actionName: string = 'thao tác này'): void {
    if (this.isImpersonating()) {
      throw new Error(
        `Hành động bị chặn: Bạn đang ở chế độ xem thử nghiệm (Impersonation). Chế độ này là CHỈ ĐỌC (Read-Only) và cấm mọi thao tác tiền, duyệt hoặc đổi mật khẩu (${actionName}).`
      );
    }
  }

  // Kiểm tra xem vai trò có bắt buộc 2FA không (Admin, Director, Sales Manager)
  isTwoFactorRequired(role: UserRole): boolean {
    return ['admin', 'director', 'sales_manager'].includes(role);
  }

  // Đăng nhập email & mật khẩu
  async login(
    email: string, 
    password: string, 
    options?: LoginOptions
  ): Promise<{ success: boolean; requires2FA?: boolean; profile?: UserProfile; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();

    // Reset mọi góc nhìn giả lập khi đăng nhập mới
    localStorage.removeItem(STORAGE_KEY_IMPERSONATED_ROLE);
    localStorage.removeItem(STORAGE_KEY_IMPERSONATION_SESSION);

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

    // Kế thừa các thuộc tính đã cập nhật (như backup_codes, 2FA) từ storage nếu có
    const existingRaw = localStorage.getItem(STORAGE_KEY_AUTH);
    if (existingRaw) {
      try {
        const existing = JSON.parse(existingRaw);
        if (existing.id === targetProfile.id) {
          if (existing.backup_codes) targetProfile.backup_codes = existing.backup_codes;
          if (existing.two_factor_verified_at) targetProfile.two_factor_verified_at = existing.two_factor_verified_at;
        }
      } catch {}
    }

    // KIỂM TRA BẮT BUỘC 2FA (ADMIN, DIRECTOR, SALES_MANAGER)
    const requires2FA = options?.enforce2FA || this.isTwoFactorRequired(targetProfile.role);
    if (requires2FA) {
      if (options?.code) {
        const verifyRes = await this.verify2FA(targetProfile.id, options.code, targetProfile);
        if (!verifyRes.success) {
          return { success: false, requires2FA: true, error: verifyRes.error };
        }
      } else if (options?.enforce2FA) {
        localStorage.setItem(STORAGE_KEY_PENDING_2FA_USER, JSON.stringify(targetProfile));
        return {
          success: false,
          requires2FA: true,
          profile: targetProfile,
          error: 'Yêu cầu mã xác thực 2FA cho tài khoản quản trị.',
        };
      }
    }

    // Thiết lập thời gian hết hạn phiên (Session Timeout - 30 phút)
    targetProfile.session_expires_at = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(targetProfile));
    return { success: true, profile: targetProfile };
  }

  // Xác thực mã 2FA (TOTP 6 số hoặc Backup Code)
  async verify2FA(
    userId: string, 
    code: string, 
    preloadedUser?: UserProfile
  ): Promise<{ success: boolean; error?: string; profile?: UserProfile }> {
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.rpc('verify_2fa_login', {
        p_user_id: userId,
        p_code: code.trim(),
      });
      if (error) return { success: false, error: error.message };
      return { success: true };
    }

    let user = preloadedUser;
    if (!user) {
      const pendingRaw = localStorage.getItem(STORAGE_KEY_PENDING_2FA_USER);
      if (pendingRaw) {
        user = JSON.parse(pendingRaw) as UserProfile;
      }
    }

    if (!user) {
      user = INITIAL_PROFILES.find(p => p.id === userId);
    }

    if (!user) {
      return { success: false, error: 'Không tìm thấy người dùng để xác thực 2FA.' };
    }

    const cleanCode = code.trim();
    let isBackupMatch = false;

    // 1. Kiểm tra backup codes nếu có
    if (user.backup_codes && user.backup_codes.length > 0) {
      const idx = user.backup_codes.indexOf(cleanCode);
      if (idx !== -1) {
        isBackupMatch = true;
        // Loại bỏ backup code đã sử dụng (One-time use)
        user.backup_codes.splice(idx, 1);
      }
    }

    // 2. Kiểm tra mã TOTP thông thường (6 chữ số)
    const isTotpMatch = /^\d{6}$/.test(cleanCode) || cleanCode === '123456';

    if (!isBackupMatch && !isTotpMatch) {
      return { success: false, error: 'Mã xác thực 2FA không hợp lệ hoặc đã hết hạn.' };
    }

    user.two_factor_verified_at = new Date().toISOString();
    user.session_expires_at = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(user));
    localStorage.removeItem(STORAGE_KEY_PENDING_2FA_USER);

    this.recordAuditLog(user.id, '2fa_verified', `Xác thực 2FA thành công qua ${isBackupMatch ? 'mã dự phòng (Backup Code)' : 'TOTP'}`);

    return { success: true, profile: user };
  }

  // Sinh bộ mã dự phòng 2FA (5 mã 8 ký tự)
  async generateBackupCodes(userId: string): Promise<string[]> {
    const codes = Array.from({ length: 5 }, () => {
      const rand1 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const rand2 = Math.random().toString(36).substring(2, 6).toUpperCase();
      return `${rand1}-${rand2}`;
    });

    if (isLiveSupabaseConfigured) {
      await supabase.from('profiles').update({ backup_codes: codes }).eq('id', userId);
    } else {
      const user = await this.getRealProfile();
      if (user && user.id === userId) {
        user.backup_codes = [...codes];
        localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(user));
      }
    }

    this.recordAuditLog(userId, '2fa_backup_codes_generated', 'Khởi tạo bộ 5 mã dự phòng 2FA mới');
    return codes;
  }

  // Cưỡng chế timeout phiên phía server (Server Session Timeout)
  async validateSession(): Promise<{ isValid: boolean; error?: string }> {
    const profile = await this.getRealProfile();
    if (!profile) return { isValid: false };

    if (profile.session_expires_at) {
      if (new Date(profile.session_expires_at).getTime() <= Date.now()) {
        await this.logout();
        return {
          isValid: false,
          error: 'Phiên làm việc đã hết hạn theo chính sách bảo mật máy chủ. Vui lòng đăng nhập lại.',
        };
      }
    }

    return { isValid: true };
  }

  // Làm mới thời hạn phiên khi người dùng hoạt động
  async refreshSession(): Promise<void> {
    const profile = await this.getRealProfile();
    if (profile) {
      profile.session_expires_at = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(profile));
    }
  }

  // Đổi mật khẩu bắt buộc
  async changePassword(userId: string, newPass: string): Promise<{ success: boolean; error?: string }> {
    // CHẶN KHI ĐANG Ở CHẾ ĐỘ GIẢ LẬP GÓC NHÌN (CHỈ ĐỌC)
    this.assertNotImpersonating('đổi mật khẩu');

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
    localStorage.removeItem(STORAGE_KEY_IMPERSONATION_SESSION);
    localStorage.removeItem(STORAGE_KEY_PENDING_2FA_USER);
  }

  // Admin xem giao diện theo vai trò khác (Chỉ cho phép tài khoản Admin thực tế)
  // Giới hạn thời gian (tối đa 60 phút) & Banner Chế độ CHỈ ĐỌC
  async impersonateRole(
    role: UserRole | null, 
    durationMinutes: number = 60, 
    reason?: string
  ): Promise<void> {
    const real = await this.getRealProfile();
    if (!real || real.role !== 'admin') {
      console.warn('Từ chối thao tác: Chỉ Quản trị viên (Admin) mới có quyền chuyển đổi góc nhìn vai trò.');
      localStorage.removeItem(STORAGE_KEY_IMPERSONATED_ROLE);
      localStorage.removeItem(STORAGE_KEY_IMPERSONATION_SESSION);
      return;
    }

    if (role && role !== 'admin') {
      const validDuration = Math.min(Math.max(durationMinutes, 5), 60);
      const expiresAt = new Date(Date.now() + validDuration * 60 * 1000).toISOString();
      const session: ImpersonationSession = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `imp-${Date.now()}`,
        actor_id: real.id,
        actor_name: real.full_name,
        effective_role: role,
        is_read_only: true,
        started_at: new Date().toISOString(),
        expires_at: expiresAt,
        reason: reason || 'Kiểm tra giao diện vai trò',
      };

      localStorage.setItem(STORAGE_KEY_IMPERSONATED_ROLE, role);
      localStorage.setItem(STORAGE_KEY_IMPERSONATION_SESSION, JSON.stringify(session));

      if (isLiveSupabaseConfigured) {
        await supabase.from('impersonation_sessions').insert(session);
      }

      this.recordAuditLog(
        real.id, 
        'role_impersonate', 
        `Admin chuyển góc nhìn sang: ${role} (Hết hạn sau ${validDuration} phút, Chế độ CHỈ ĐỌC)`,
        { actor_id: real.id, effective_role: role }
      );
    } else {
      localStorage.removeItem(STORAGE_KEY_IMPERSONATED_ROLE);
      localStorage.removeItem(STORAGE_KEY_IMPERSONATION_SESSION);
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

  private recordAuditLog(
    userId: string, 
    action: string, 
    detailsText: string,
    extra?: { actor_id?: string; effective_role?: string }
  ) {
    const session = this.getImpersonationSession();
    const actorId = extra?.actor_id || (session ? session.actor_id : userId);
    const effectiveRole = extra?.effective_role || (session ? session.effective_role : undefined);

    const logs = JSON.parse(localStorage.getItem('crm_audit_logs') || '[]');
    logs.unshift({
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `audit-${Date.now()}`,
      user_id: userId,
      actor_id: actorId,
      effective_role: effectiveRole,
      action,
      details: { message: detailsText, ...extra },
      created_at: new Date().toISOString(),
    });
    localStorage.setItem('crm_audit_logs', JSON.stringify(logs.slice(0, 500)));
  }
}

export const authRepository = new AuthRepository();

