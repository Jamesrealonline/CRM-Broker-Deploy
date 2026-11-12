import { describe, it, expect, beforeEach } from 'vitest';
import { UserProfile, Organization, Agency, Team, Lead } from '@/domain/types';
import { teamRepository } from '@/data/repositories/teamRepository';

describe('Quản Trị Hệ Thống - Chức Năng Sửa & Xóa Người Dùng (Admin Control Center)', () => {
  const superAdmin: UserProfile = {
    id: 'u-super-admin-01',
    email: 'admin.master@system.vn',
    full_name: 'Quản Trị Viên Tổng',
    phone: '0901000000',
    role: 'admin',
    status: 'active',
    must_change_password: false,
    totp_enabled: true,
  };

  const compAdminA: UserProfile = {
    id: 'u-company-admin-a',
    email: 'admin@ankhang.vn',
    full_name: 'Quản Trị DN An Khang',
    phone: '0901000001',
    role: 'company_admin',
    organization_id: 'org-ankhang',
    status: 'active',
    must_change_password: false,
    totp_enabled: true,
  };

  const ceoA: UserProfile = {
    id: 'u-ceo-a',
    email: 'ceo@ankhang.vn',
    full_name: 'Nguyễn Văn An (CEO An Khang)',
    phone: '0902000001',
    role: 'ceo',
    organization_id: 'org-ankhang',
    status: 'active',
    must_change_password: false,
    totp_enabled: true,
  };

  const saleAgentA1: UserProfile = {
    id: 'u-sale-a1',
    email: 'sale1@ankhang.vn',
    full_name: 'Phạm Sale Một',
    phone: '0903000001',
    role: 'sale_agent',
    organization_id: 'org-ankhang',
    agency_id: 'agency-a1',
    team_id: 'team-a1',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const saleAgentA2: UserProfile = {
    id: 'u-sale-a2',
    email: 'sale2@ankhang.vn',
    full_name: 'Lê Sale Hai (Nhận Bàn Giao)',
    phone: '0903000002',
    role: 'sale_agent',
    organization_id: 'org-ankhang',
    agency_id: 'agency-a1',
    team_id: 'team-a1',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const saleAgentB: UserProfile = {
    id: 'u-sale-b1',
    email: 'sale@thinhvuong.vn',
    full_name: 'Trần Sale Thịnh Vượng',
    phone: '0904000001',
    role: 'sale_agent',
    organization_id: 'org-thinhvuong',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const testProfiles: UserProfile[] = [
    superAdmin,
    compAdminA,
    ceoA,
    saleAgentA1,
    saleAgentA2,
    saleAgentB,
  ];

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('crm_profiles', JSON.stringify(testProfiles));
    localStorage.setItem('crm_trash_bins', JSON.stringify([]));
  });

  // ==========================================
  // 1. CHỨC NĂNG SỬA NGƯỜI DÙNG (UPDATE USER)
  // ==========================================
  describe('1. Chức Năng Sửa Thông Tin Người Dùng (Update User)', () => {
    it('Super Admin cập nhật thành công họ tên, SĐT, vai trò và phòng ban của nhân viên', async () => {
      const res = await teamRepository.updateUser(saleAgentA1.id, {
        full_name: 'Phạm Sale Một (Đã Đổi Tên)',
        phone: '0988776655',
        role: 'team_leader',
        team_id: 'team-a2',
      }, superAdmin);

      expect(res.success).toBe(true);
      expect(res.profile?.full_name).toBe('Phạm Sale Một (Đã Đổi Tên)');
      expect(res.profile?.phone).toBe('0988776655');
      expect(res.profile?.role).toBe('team_leader');
      expect(res.profile?.team_id).toBe('team-a2');

      // Kiểm tra trong storage
      const profiles = await teamRepository.getProfiles();
      const updated = profiles.find(p => p.id === saleAgentA1.id);
      expect(updated?.full_name).toBe('Phạm Sale Một (Đã Đổi Tên)');
      expect(updated?.role).toBe('team_leader');
    });

    it('Company Admin chỉ có quyền sửa nhân sự thuộc doanh nghiệp của mình', async () => {
      // 1. Sửa nhân sự cùng DN -> Thành công
      const resOk = await teamRepository.updateUser(saleAgentA1.id, {
        full_name: 'Phạm Sale Cùng DN',
        phone: '0911223344',
      }, compAdminA);
      expect(resOk.success).toBe(true);

      // 2. Cố tình sửa nhân sự của DN khác -> Bị từ chối
      const resFail = await teamRepository.updateUser(saleAgentB.id, {
        full_name: 'Hack Tên DN Khác',
      }, compAdminA);
      expect(resFail.success).toBe(false);
      expect(resFail.error).toContain('thuộc doanh nghiệp của mình');
    });

    it('Company Admin KHÔNG được phép thăng cấp tài khoản lên Admin, CEO hoặc Company Admin', async () => {
      const resAdmin = await teamRepository.updateUser(saleAgentA1.id, {
        role: 'admin',
      }, compAdminA);
      expect(resAdmin.success).toBe(false);
      expect(resAdmin.error).toContain('không có quyền thăng cấp');

      const resCeo = await teamRepository.updateUser(saleAgentA1.id, {
        role: 'ceo',
      }, compAdminA);
      expect(resCeo.success).toBe(false);
      expect(resCeo.error).toContain('không có quyền thăng cấp');

      const resCompAdmin = await teamRepository.updateUser(saleAgentA1.id, {
        role: 'company_admin',
      }, compAdminA);
      expect(resCompAdmin.success).toBe(false);
      expect(resCompAdmin.error).toContain('không có quyền thăng cấp');
    });

    it('Company Admin KHÔNG thể chuyển người dùng sang Doanh nghiệp khác', async () => {
      const res = await teamRepository.updateUser(saleAgentA1.id, {
        organization_id: 'org-thinhvuong',
      }, compAdminA);
      expect(res.success).toBe(false);
      expect(res.error).toContain('không thể chuyển người dùng sang doanh nghiệp khác');
    });

    it('Chống hạ quyền hoặc vô hiệu hóa Quản trị viên (Admin) duy nhất còn lại của hệ thống', async () => {
      // Thử hạ vai trò của Super Admin duy nhất xuống sale_agent
      const resRole = await teamRepository.updateUser(superAdmin.id, {
        role: 'sale_agent',
      }, superAdmin);
      expect(resRole.success).toBe(false);
      expect(resRole.error).toContain('Quản trị viên (Admin) duy nhất');

      // Thử khóa Super Admin duy nhất
      const resStatus = await teamRepository.updateUser(superAdmin.id, {
        status: 'locked',
      }, superAdmin);
      expect(resStatus.success).toBe(false);
      expect(resStatus.error).toContain('Quản trị viên (Admin) duy nhất');
    });

    it('Chống đổi vai trò của Tổng Giám Đốc (CEO) duy nhất còn lại của doanh nghiệp', async () => {
      const resRole = await teamRepository.updateUser(ceoA.id, {
        role: 'sale_agent',
      }, superAdmin);
      expect(resRole.success).toBe(false);
      expect(resRole.error).toContain('Tổng Giám Đốc (CEO) duy nhất');
    });

    it('Từ chối chỉnh sửa khi đang ở chế độ Giả lập góc nhìn (Impersonation)', async () => {
      const impersonatingAdmin = { ...superAdmin, is_impersonating: true, is_read_only: true };
      const res = await teamRepository.updateUser(saleAgentA1.id, {
        full_name: 'Hack Trong Khi Impersonate',
      }, impersonatingAdmin);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Impersonation');
    });
  });

  // ==========================================
  // 2. CHỨC NĂNG XÓA MỀM & BÀN GIAO (DELETE USER)
  // ==========================================
  describe('2. Chức Năng Xóa Mềm Người Dùng & Bàn Giao Khách Hàng (Delete User)', () => {
    it('Chặn người dùng tự xóa tài khoản của chính mình', async () => {
      const res = await teamRepository.deleteUser(superAdmin.id, {
        delete_reason: 'Tự xóa tài khoản',
      }, superAdmin);

      expect(res.success).toBe(false);
      expect(res.error).toContain('không thể tự xóa tài khoản');
    });

    it('Bắt buộc phải có lý do xóa nhân sự (tối thiểu 5 ký tự)', async () => {
      const resEmpty = await teamRepository.deleteUser(saleAgentA1.id, {
        delete_reason: '',
      }, superAdmin);
      expect(resEmpty.success).toBe(false);
      expect(resEmpty.error).toContain('Lý do xóa nhân sự là bắt buộc');

      const resShort = await teamRepository.deleteUser(saleAgentA1.id, {
        delete_reason: 'abc',
      }, superAdmin);
      expect(resShort.success).toBe(false);
      expect(resShort.error).toContain('tối thiểu 5 ký tự');
    });

    it('Chống xóa Quản trị viên (Admin) duy nhất còn lại của hệ thống', async () => {
      // Giả sử có một admin khác thử xóa superAdmin
      const anotherAdmin: UserProfile = { ...superAdmin, id: 'u-admin-2', email: 'admin2@test.vn' };
      const res = await teamRepository.deleteUser(superAdmin.id, {
        delete_reason: 'Cho thôi việc Quản trị viên duy nhất',
      }, anotherAdmin);

      expect(res.success).toBe(false);
      expect(res.error).toContain('Quản trị viên (Admin) duy nhất');
    });

    it('Company Admin KHÔNG thể xóa nhân sự của Doanh nghiệp khác hoặc Admin/CEO', async () => {
      // 1. Thử xóa nhân sự DN khác
      const res1 = await teamRepository.deleteUser(saleAgentB.id, {
        delete_reason: 'Cho thôi việc nhân viên DN khác',
      }, compAdminA);
      expect(res1.success).toBe(false);
      expect(res1.error).toContain('thuộc doanh nghiệp của mình');

      // 2. Thử xóa CEO cùng DN
      const res2 = await teamRepository.deleteUser(ceoA.id, {
        delete_reason: 'Quản trị DN đòi xóa CEO',
      }, compAdminA);
      expect(res2.success).toBe(false);
      expect(res2.error).toContain('không thể xóa tài khoản Admin, CEO');
    });

    it('Xóa mềm nhân viên và tự động bàn giao các Lead đang mở sang nhân sự tiếp nhận', async () => {
      // Giả lập 2 Lead đang mở thuộc về saleAgentA1
      const mockLeads: Partial<Lead>[] = [
        {
          id: 'lead-001',
          customer_name: 'Khách Hàng Biệt Thự',
          customer_phone: '0912999001',
          assigned_to: saleAgentA1.id,
          assigned_name: saleAgentA1.full_name,
          status: 'contacted',
        },
        {
          id: 'lead-002',
          customer_name: 'Khách Hàng Chung Cư',
          customer_phone: '0912999002',
          assigned_to: saleAgentA1.id,
          assigned_name: saleAgentA1.full_name,
          status: 'appointment_set',
        },
      ];
      localStorage.setItem('crm_leads', JSON.stringify(mockLeads));

      // Thực hiện xóa mềm saleAgentA1 và bàn giao sang saleAgentA2
      const deleteRes = await teamRepository.deleteUser(saleAgentA1.id, {
        delete_reason: 'Chuyển công tác sang chi nhánh miền Bắc',
        handover_user_id: saleAgentA2.id,
      }, compAdminA);

      expect(deleteRes.success).toBe(true);

      // 1. Kiểm tra Lead đã được chuyển giao sang saleAgentA2
      const updatedLeads: any[] = JSON.parse(localStorage.getItem('crm_leads') || '[]');
      expect(updatedLeads[0].assigned_to).toBe(saleAgentA2.id);
      expect(updatedLeads[0].assigned_name).toBe(saleAgentA2.full_name);
      expect(updatedLeads[1].assigned_to).toBe(saleAgentA2.id);

      // 2. Nhân viên bị xóa chuyển status = 'inactive', có deleted_at và delete_reason
      const allProfiles = await teamRepository.getProfiles(undefined, undefined, undefined, true);
      const deletedUser = allProfiles.find(p => p.id === saleAgentA1.id);
      expect(deletedUser?.status).toBe('inactive');
      expect(deletedUser?.deleted_at).toBeDefined();
      expect(deletedUser?.deleted_by).toBe(compAdminA.id);
      expect(deletedUser?.delete_reason).toContain('Chuyển công tác');
      expect(deletedUser?.delete_reason).toContain('Đã bàn giao 2 leads');

      // 3. Nhân sự bị xóa mềm không xuất hiện trong danh sách getProfiles thông thường
      const activeProfiles = await teamRepository.getProfiles();
      expect(activeProfiles.some(p => p.id === saleAgentA1.id)).toBe(false);

      // 4. Nhân sự xuất hiện trong Thùng Rác Quản Trị (crm_trash_bins)
      const trashList = JSON.parse(localStorage.getItem('crm_trash_bins') || '[]');
      const trashItem = trashList.find((t: any) => t.entity_id === saleAgentA1.id);
      expect(trashItem).toBeDefined();
      expect(trashItem.entity_type).toBe('employee');
      expect(trashItem.entity_name).toBe(saleAgentA1.full_name);
    });

    it('Khôi phục nhân sự từ Thùng Rác Quản Trị (Restore User) trả lại trạng thái active', async () => {
      // 1. Xóa nhân viên trước
      await teamRepository.deleteUser(saleAgentA1.id, {
        delete_reason: 'Nghỉ việc tạm thời',
      }, superAdmin);

      // 2. Khôi phục nhân viên
      const restoreRes = await teamRepository.restoreUser(saleAgentA1.id, superAdmin);
      expect(restoreRes.success).toBe(true);

      // 3. Nhân viên xuất hiện trở lại trong danh sách active profiles
      const activeProfiles = await teamRepository.getProfiles();
      const restoredUser = activeProfiles.find(p => p.id === saleAgentA1.id);
      expect(restoredUser).toBeDefined();
      expect(restoredUser?.status).toBe('active');
      expect(restoredUser?.deleted_at).toBeUndefined();

      // 4. Mục trong thùng rác đã được dọn
      const trashList = JSON.parse(localStorage.getItem('crm_trash_bins') || '[]');
      expect(trashList.some((t: any) => t.entity_id === saleAgentA1.id)).toBe(false);
    });
  });
});
