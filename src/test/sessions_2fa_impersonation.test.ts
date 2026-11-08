import { describe, it, expect, beforeEach } from 'vitest';
import { AuthRepository } from '@/data/repositories/authRepository';
import { LeadRepository } from '@/data/repositories/leadRepository';
import { ContractRepository } from '@/data/repositories/contractRepository';
import { UserProfile } from '@/domain/types';

describe('P1.1 Quản Lý Phiên (Session Timeout), Bắt Buộc 2FA & Impersonation An Toàn', () => {
  let authRepo: AuthRepository;
  let leadRepo: LeadRepository;
  let contractRepo: ContractRepository;

  beforeEach(() => {
    localStorage.clear();
    authRepo = new AuthRepository();
    leadRepo = new LeadRepository();
    contractRepo = new ContractRepository();
  });

  describe('1. Bắt Buộc 2FA (Two-Factor Authentication) Cho Vai Trò Quản Trị', () => {
    it('Nhận diện chính xác các vai trò bắt buộc 2FA: admin, director, sales_manager', () => {
      expect(authRepo.isTwoFactorRequired('admin')).toBe(true);
      expect(authRepo.isTwoFactorRequired('director')).toBe(true);
      expect(authRepo.isTwoFactorRequired('sales_manager')).toBe(true);
      expect(authRepo.isTwoFactorRequired('sale_agent')).toBe(false);
      expect(authRepo.isTwoFactorRequired('marketing_manager')).toBe(false);
    });

    it('Đăng nhập với cờ enforce2FA yêu cầu xác thực mã 2FA', async () => {
      const res = await authRepo.login('admin@diaocvang.vn', 'password123', { enforce2FA: true });
      expect(res.success).toBe(false);
      expect(res.requires2FA).toBe(true);
      expect(res.error).toContain('Yêu cầu mã xác thực 2FA');
    });

    it('Xác thực 2FA thành công bằng mã TOTP 6 số', async () => {
      // Đăng nhập bước 1
      await authRepo.login('admin@diaocvang.vn', 'password123', { enforce2FA: true });

      // Xác thực bước 2 với mã TOTP 6 số hợp lệ
      const verifyRes = await authRepo.verify2FA('aaaaaaaa-1111-1111-1111-111111111111', '123456');
      expect(verifyRes.success).toBe(true);
      expect(verifyRes.profile?.email).toBe('admin@diaocvang.vn');
      expect(verifyRes.profile?.two_factor_verified_at).toBeDefined();

      // Kiểm tra audit log
      const auditLogs = JSON.parse(localStorage.getItem('crm_audit_logs') || '[]');
      const lastLog = auditLogs.find((l: any) => l.action === '2fa_verified');
      expect(lastLog).toBeDefined();
      expect(lastLog.actor_id).toBe('aaaaaaaa-1111-1111-1111-111111111111');
    });

    it('Xác thực 2FA bằng Backup Code (Mã dự phòng) và tiêu hủy mã sau khi dùng (One-time use)', async () => {
      // Sinh 5 mã dự phòng
      await authRepo.login('admin@diaocvang.vn', 'password123');
      const backupCodes = await authRepo.generateBackupCodes('aaaaaaaa-1111-1111-1111-111111111111');
      expect(backupCodes.length).toBe(5);
      const usedCode = backupCodes[0];

      // Đăng nhập lại với enforce2FA
      await authRepo.login('admin@diaocvang.vn', 'password123', { enforce2FA: true });

      // Xác thực bằng mã dự phòng
      const verifyRes = await authRepo.verify2FA('aaaaaaaa-1111-1111-1111-111111111111', usedCode);
      expect(verifyRes.success).toBe(true);

      // Mã dự phòng này không thể dùng lại lần 2
      const userProfile = await authRepo.getRealProfile();
      expect(userProfile?.backup_codes).not.toContain(usedCode);
      expect(userProfile?.backup_codes?.length).toBe(4);
    });

    it('Từ chối mã 2FA sai định dạng hoặc không hợp lệ', async () => {
      await authRepo.login('admin@diaocvang.vn', 'password123', { enforce2FA: true });
      const verifyRes = await authRepo.verify2FA('aaaaaaaa-1111-1111-1111-111111111111', 'invalid-code');
      expect(verifyRes.success).toBe(false);
      expect(verifyRes.error).toContain('Mã xác thực 2FA không hợp lệ');
    });
  });

  describe('2. Cưỡng Chế Timeout Phiên Phía Server (Session Timeout)', () => {
    it('Phiên đăng nhập mới có thời hạn session_expires_at (+30 phút)', async () => {
      const res = await authRepo.login('admin@diaocvang.vn', 'password123');
      expect(res.profile?.session_expires_at).toBeDefined();

      const expiresTime = new Date(res.profile!.session_expires_at!).getTime();
      expect(expiresTime).toBeGreaterThan(Date.now() + 29 * 60 * 1000);

      const validCheck = await authRepo.validateSession();
      expect(validCheck.isValid).toBe(true);
    });

    it('Tự động hủy phiên (Logout) khi session_expires_at đã hết hạn', async () => {
      await authRepo.login('admin@diaocvang.vn', 'password123');
      const user = await authRepo.getRealProfile();

      // Giả lập phiên đã quá hạn
      user!.session_expires_at = new Date(Date.now() - 5000).toISOString();
      localStorage.setItem('crm_auth_user', JSON.stringify(user));

      const validCheck = await authRepo.validateSession();
      expect(validCheck.isValid).toBe(false);
      expect(validCheck.error).toContain('Phiên làm việc đã hết hạn');

      // Profile đã bị logout
      const current = await authRepo.getRealProfile();
      expect(current).toBeNull();
    });

    it('refreshSession gia hạn thời hạn phiên làm việc', async () => {
      await authRepo.login('admin@diaocvang.vn', 'password123');
      await authRepo.refreshSession();
      const user = await authRepo.getRealProfile();
      expect(new Date(user!.session_expires_at!).getTime()).toBeGreaterThan(Date.now() + 29 * 60 * 1000);
    });
  });

  describe('3. Giả Lập Góc Nhìn (Impersonation) An Toàn: CHẾ ĐỘ CHỈ ĐỌC & Audit Log', () => {
    it('Chỉ Admin mới có thể kích hoạt Impersonation, có thời hạn tối đa 60 phút', async () => {
      // Sale agent thử kích hoạt -> Bị chặn
      await authRepo.login('sale@diaocvang.vn', 'password123');
      await authRepo.impersonateRole('director');
      expect(authRepo.isImpersonating()).toBe(false);

      // Admin kích hoạt -> Thành công và tạo ImpersonationSession
      await authRepo.login('admin@diaocvang.vn', 'password123');
      await authRepo.impersonateRole('sale_agent', 45, 'Kiểm tra giao diện sale');
      expect(authRepo.isImpersonating()).toBe(true);

      const session = authRepo.getImpersonationSession();
      expect(session).not.toBeNull();
      expect(session?.effective_role).toBe('sale_agent');
      expect(session?.is_read_only).toBe(true);
      expect(new Date(session!.expires_at).getTime()).toBeGreaterThan(Date.now());
    });

    it('Audit Log ghi nhận cả actor_id (Admin thật) và effective_role khi impersonate', async () => {
      await authRepo.login('admin@diaocvang.vn', 'password123');
      await authRepo.impersonateRole('director');

      const auditLogs = JSON.parse(localStorage.getItem('crm_audit_logs') || '[]');
      const impLog = auditLogs.find((l: any) => l.action === 'role_impersonate');
      expect(impLog).toBeDefined();
      expect(impLog.actor_id).toBe('aaaaaaaa-1111-1111-1111-111111111111');
      expect(impLog.effective_role).toBe('director');
    });

    it('CHẶN ĐỔI MẬT KHẨU khi đang ở chế độ Impersonation', async () => {
      await authRepo.login('admin@diaocvang.vn', 'password123');
      await authRepo.impersonateRole('sale_agent');

      await expect(
        authRepo.changePassword('aaaaaaaa-1111-1111-1111-111111111111', 'NewPassword123@')
      ).rejects.toThrow('Hành động bị chặn: Bạn đang ở chế độ xem thử nghiệm (Impersonation)');
    });

    it('CHẶN THAO TÁC TIỀN / TRẠNG THÁI LEAD khi đang ở chế độ Impersonation', async () => {
      await authRepo.login('admin@diaocvang.vn', 'password123');
      await authRepo.impersonateRole('sale_agent');

      const currentUser = (await authRepo.getCurrentProfile()) as UserProfile;

      await expect(
        leadRepo.updateLeadStageWithTransaction({
          leadId: 'lead-1',
          newStatus: 'booking',
          currentUser,
          txCode: 'BK-TEST-001',
          txAmount: 50000000,
          unitCode: ' căn CH-01',
        })
      ).rejects.toThrow('Hành động bị chặn: Bạn đang ở chế độ xem thử nghiệm (Impersonation)');
    });

    it('CHẶN TẠO HỢP ĐỒNG GIAO DỊCH khi đang ở chế độ Impersonation', async () => {
      await authRepo.login('admin@diaocvang.vn', 'password123');
      await authRepo.impersonateRole('sales_manager');

      await expect(
        contractRepo.createContractTransaction({
          lead_id: 'lead-1',
          amount: 100000000,
          type: 'contract',
        })
      ).rejects.toThrow('Hành động bị chặn: Bạn đang ở chế độ xem thử nghiệm (Impersonation)');
    });

    it('Tự động thoát Impersonation khi session hết hạn thời gian', async () => {
      await authRepo.login('admin@diaocvang.vn', 'password123');
      await authRepo.impersonateRole('sale_agent');

      // Giả lập session impersonation đã hết hạn
      const session = authRepo.getImpersonationSession();
      session!.expires_at = new Date(Date.now() - 1000).toISOString();
      localStorage.setItem('crm_impersonation_session', JSON.stringify(session));

      // Kiểm tra: isImpersonating phải tự động trả về false
      expect(authRepo.isImpersonating()).toBe(false);
      expect(authRepo.getImpersonatedRole()).toBeNull();
      const profile = await authRepo.getCurrentProfile();
      expect(profile?.role).toBe('admin');
    });
  });
});
