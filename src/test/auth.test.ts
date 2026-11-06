import { describe, it, expect, beforeEach } from 'vitest';
import { AuthRepository } from '@/data/repositories/authRepository';

describe('Bảo Mật Xác Thực & Đăng Nhập (Auth Repository)', () => {
  let authRepo: AuthRepository;

  beforeEach(() => {
    localStorage.clear();
    authRepo = new AuthRepository();
  });

  it('Đăng nhập thành công với tài khoản demo đúng mật khẩu', async () => {
    const res = await authRepo.login('admin@diaocvang.vn', 'password123');
    expect(res.success).toBe(true);
    expect(res.profile?.role).toBe('admin');
  });

  it('Thông báo lỗi chung, không tiết lộ email có tồn tại hay không', async () => {
    const res1 = await authRepo.login('nonexistent@diaocvang.vn', 'wrongpass');
    expect(res1.success).toBe(false);
    expect(res1.error).toBe('Thông tin tài khoản hoặc mật khẩu không chính xác.');

    const res2 = await authRepo.login('admin@diaocvang.vn', 'wrongpass');
    expect(res2.success).toBe(false);
    expect(res2.error).toBe('Thông tin tài khoản hoặc mật khẩu không chính xác.');
  });

  it('Tự động khóa tạm sau 5 lần nhập sai mật khẩu', async () => {
    for (let i = 0; i < 4; i++) {
      await authRepo.login('admin@diaocvang.vn', 'wrongpass');
    }
    // Lần thứ 5 sai -> khóa tài khoản 5 phút
    const res5 = await authRepo.login('admin@diaocvang.vn', 'wrongpass');
    expect(res5.success).toBe(false);

    // Lần thứ 6 dù gõ đúng pass cũng bị chặn vì đang trong thời gian khóa
    const res6 = await authRepo.login('admin@diaocvang.vn', 'password123');
    expect(res6.success).toBe(false);
    expect(res6.error).toContain('Tài khoản tạm thời bị khóa do nhập sai nhiều lần');
  });

  it('Bắt buộc đổi mật khẩu mới tối thiểu 8 ký tự có cả chữ và số', async () => {
    const invalidShort = await authRepo.changePassword('user-1', '12345');
    expect(invalidShort.success).toBe(false);

    const invalidNoNumber = await authRepo.changePassword('user-1', 'abcdefgh');
    expect(invalidNoNumber.success).toBe(false);

    const valid = await authRepo.changePassword('user-1', 'MatKhauMoi2026');
    expect(valid.success).toBe(true);
  });
});
