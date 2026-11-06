import { describe, it, expect, beforeEach } from 'vitest';
import { AuthRepository } from '@/data/repositories/authRepository';
import { TeamRepository } from '@/data/repositories/teamRepository';

describe('Bảo Mật Xác Thực & Phân Quyền (Auth & Team Repository)', () => {
  let authRepo: AuthRepository;
  let teamRepo: TeamRepository;

  beforeEach(() => {
    localStorage.clear();
    authRepo = new AuthRepository();
    teamRepo = new TeamRepository();
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

  it('Chỉ tài khoản Admin mới được phép kích hoạt góc nhìn vai trò khác (Impersonate)', async () => {
    // 1. Đăng nhập tài khoản Sale Agent
    await authRepo.login('sale@diaocvang.vn', 'password123');
    
    // Thử chuyển góc nhìn -> phải bị từ chối
    await authRepo.impersonateRole('director');
    expect(authRepo.getImpersonatedRole()).toBeNull();
    const saleProfile = await authRepo.getCurrentProfile();
    expect(saleProfile?.role).toBe('sale_agent');

    // 2. Đăng nhập tài khoản Admin
    await authRepo.login('admin@diaocvang.vn', 'password123');
    await authRepo.impersonateRole('sale_agent');
    expect(authRepo.getImpersonatedRole()).toBe('sale_agent');
    const impProfile = await authRepo.getCurrentProfile();
    expect(impProfile?.role).toBe('sale_agent');

    // Reset góc nhìn trở lại Admin
    await authRepo.impersonateRole(null);
    expect(authRepo.getImpersonatedRole()).toBeNull();
    const adminProfile = await authRepo.getCurrentProfile();
    expect(adminProfile?.role).toBe('admin');
  });

  it('Tạo người dùng mới thành công và kiểm tra trùng lặp email', async () => {
    const createRes = await teamRepo.createUser({
      full_name: 'Nguyễn Văn Test',
      email: 'test.sale@diaocvang.vn',
      phone: '0988776655',
      role: 'sale_agent',
      password: 'password123',
    });

    expect(createRes.success).toBe(true);
    expect(createRes.profile?.email).toBe('test.sale@diaocvang.vn');
    expect(createRes.profile?.role).toBe('sale_agent');

    // Thử tạo trùng email -> thất bại
    const dupRes = await teamRepo.createUser({
      full_name: 'Người Trùng Email',
      email: 'test.sale@diaocvang.vn',
      phone: '0911223344',
      role: 'team_leader',
    });

    expect(dupRes.success).toBe(false);
    expect(dupRes.error).toContain('đã tồn tại');
  });

  it('Thành lập Sàn mới, Team kinh doanh mới và Bổ nhiệm Sales Manager', async () => {
    // 1. Tạo Sàn giao dịch mới
    const agencyRes = await teamRepo.createAgency({
      name: 'Sàn Giao Dịch Bình Thạnh',
      code: 'S4-BT',
      address: '128 Điện Biên Phủ, Bình Thạnh',
      phone: '02838889999',
    });
    expect(agencyRes.success).toBe(true);
    expect(agencyRes.agency?.code).toBe('S4-BT');

    // 2. Tạo Team kinh doanh thuộc sàn vừa tạo
    const teamRes = await teamRepo.createTeam({
      name: 'Team Dragon Bình Thạnh',
      code: 'TM-DRAGON',
      agency_id: agencyRes.agency!.id,
    });
    expect(teamRes.success).toBe(true);
    expect(teamRes.team?.code).toBe('TM-DRAGON');

    // 3. Tạo nhân sự và Bổ nhiệm làm Sales Manager (Trưởng phòng kinh doanh)
    const userRes = await teamRepo.createUser({
      full_name: 'Phan Văn Quản Lý',
      email: 'manager.phan@diaocvang.vn',
      phone: '0909888777',
      role: 'sales_manager',
      agency_id: agencyRes.agency!.id,
    });
    expect(userRes.success).toBe(true);
    expect(userRes.profile?.role).toBe('sales_manager');

    // 4. Bổ nhiệm Giám Đốc Sàn (Director) cho sàn mới
    const assignDirectorRes = await teamRepo.updateAgency(agencyRes.agency!.id, {
      director_id: userRes.profile!.id,
    });
    expect(assignDirectorRes.success).toBe(true);
  });
});
