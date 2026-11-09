import { describe, it, expect, beforeEach } from 'vitest';
import { controlledDataService } from '@/domain/services/controlledDataService';
import { UserProfile, Lead, Transaction, Team } from '@/domain/types';

describe('Phase 7: Controlled Data Management & Trash Bin', () => {
  const adminUser: UserProfile = {
    id: 'user-admin-01',
    email: 'admin@broker.vn',
    full_name: 'Admin Hệ Thống',
    phone: '0901111111',
    role: 'admin',
    status: 'active',
    must_change_password: false,
    totp_enabled: true
  };

  const directorAgency1: UserProfile = {
    id: 'user-dir-01',
    email: 'director1@agency1.vn',
    full_name: 'Giám Đốc Sàn 1',
    phone: '0902222222',
    role: 'director',
    agency_id: 'agency-01',
    status: 'active',
    must_change_password: false,
    totp_enabled: true
  };

  const directorAgency2: UserProfile = {
    id: 'user-dir-02',
    email: 'director2@agency2.vn',
    full_name: 'Giám Đốc Sàn 2',
    phone: '0903333333',
    role: 'director',
    agency_id: 'agency-02',
    status: 'active',
    must_change_password: false,
    totp_enabled: true
  };

  const saleAgent: UserProfile = {
    id: 'user-sale-01',
    email: 'sale@agency1.vn',
    full_name: 'Sale Agent 1',
    phone: '0904444444',
    role: 'sale_agent',
    agency_id: 'agency-01',
    status: 'active',
    must_change_password: false,
    totp_enabled: true
  };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('crm_profiles', JSON.stringify([adminUser, directorAgency1, directorAgency2, saleAgent]));
  });

  // ========================================================
  // 1. PHÂN QUYỀN THEO SÀN & CHỐNG LEO THANG QUYỀN
  // ========================================================
  describe('Scope Enforcement & Privilege Protection', () => {
    it('chặn Giám đốc Sàn thao tác trên dữ liệu ngoài sàn của mình', () => {
      expect(() => {
        controlledDataService.assertScopeAndPermission(directorAgency1, 'agency-02');
      }).toThrow('Giám đốc Sàn chỉ có quyền thao tác trên dữ liệu thuộc sàn của mình.');

      // Thao tác trong sàn mình thì hợp lệ
      expect(() => {
        controlledDataService.assertScopeAndPermission(directorAgency1, 'agency-01');
      }).not.toThrow();
    });

    it('chặn Giám đốc Sàn sửa hoặc xóa tài khoản Admin và Giám đốc khác', () => {
      expect(() => {
        controlledDataService.assertScopeAndPermission(directorAgency1, 'agency-01', adminUser);
      }).toThrow('Giám đốc Sàn không được phép sửa/xóa tài khoản của Admin hoặc Giám đốc Sàn khác.');

      expect(() => {
        controlledDataService.assertScopeAndPermission(directorAgency1, 'agency-01', directorAgency2);
      }).toThrow('Giám đốc Sàn không được phép sửa/xóa tài khoản của Admin hoặc Giám đốc Sàn khác.');
    });

    it('chặn xóa hoặc khóa Admin duy nhất còn lại của hệ thống', () => {
      expect(() => {
        controlledDataService.assertScopeAndPermission(adminUser, undefined, adminUser);
      }).toThrow('Không thể khóa hoặc xóa Quản trị viên (Admin) duy nhất còn lại');
    });

    it('chặn mọi thao tác sửa/xóa khi đang trong chế độ Giả lập góc nhìn (Impersonation)', () => {
      const impersonatingAdmin = {
        ...adminUser,
        is_impersonating: true,
        is_read_only: true
      };

      expect(() => {
        controlledDataService.assertScopeAndPermission(impersonatingAdmin, 'agency-01');
      }).toThrow('Không được phép sửa/xóa dữ liệu trong chế độ Giả lập góc nhìn (Impersonation).');
    });
  });

  // ========================================================
  // 2. KHÓA LẠC QUAN (OPTIMISTIC LOCKING)
  // ========================================================
  describe('Optimistic Locking', () => {
    it('phát hiện xung đột phiên bản dữ liệu khi hai người cùng sửa', () => {
      const sampleLead: Partial<Lead> = {
        id: 'lead-opt-1',
        customer_id: 'cust-1',
        customer_name: 'Nguyễn Văn B',
        customer_phone: '0912345678',
        agency_id: 'agency-01',
        status: 'contacted',
        version: 2
      };
      localStorage.setItem('crm_leads', JSON.stringify([sampleLead]));

      // Client gửi stale version = 1 (trong khi version hiện tại là 2)
      expect(() => {
        controlledDataService.updateLeadControlled(
          'lead-opt-1',
          { customer_name: 'Nguyễn Văn B (Updated)' },
          1, // Stale version!
          'Cập nhật tên khách hàng',
          directorAgency1
        );
      }).toThrow('Xung đột cập nhật dữ liệu (Optimistic Lock)');

      // Gửi đúng version = 2
      const updated = controlledDataService.updateLeadControlled(
        'lead-opt-1',
        { customer_name: 'Nguyễn Văn B (Updated)' },
        2,
        'Cập nhật tên khách hàng',
        directorAgency1
      );

      expect(updated.customer_name).toBe('Nguyễn Văn B (Updated)');
      expect(updated.version).toBe(3); // Version được tăng lên 3
    });
  });

  // ========================================================
  // 3. QUẢN TRỊ LEAD, XÓA MỀM & THÙNG RÁC
  // ========================================================
  describe('Lead Management & Trash Bin', () => {
    it('chặn xóa mềm lead nếu đã phát sinh Hợp đồng giao dịch hiệu lực', () => {
      const sampleLead: Partial<Lead> = {
        id: 'lead-with-contract',
        customer_id: 'cust-2',
        customer_name: 'Trần Văn C',
        agency_id: 'agency-01',
        status: 'contract'
      };
      localStorage.setItem('crm_leads', JSON.stringify([sampleLead]));

      const sampleContract: Partial<Transaction> = {
        id: 'ct-active-01',
        lead_id: 'lead-with-contract',
        deal_value: 4000000000,
        status: 'confirmed'
      };
      localStorage.setItem('crm_contracts', JSON.stringify([sampleContract]));

      expect(() => {
        controlledDataService.softDeleteLead('lead-with-contract', 'Xóa lead trùng lặp', directorAgency1);
      }).toThrow('Không thể xóa lead đã phát sinh Hợp đồng giao dịch có hiệu lực');
    });

    it('xóa mềm lead vào Thùng rác và khôi phục kèm tái tạo SLA 24h hợp lý', () => {
      const sampleLead: Partial<Lead> = {
        id: 'lead-soft-delete',
        customer_id: 'cust-3',
        customer_name: 'Lê Hoàng D',
        customer_phone: '0988888888',
        agency_id: 'agency-01',
        status: 'contacted',
        version: 1
      };
      localStorage.setItem('crm_leads', JSON.stringify([sampleLead]));

      // 1. Xóa mềm
      const trashItem = controlledDataService.softDeleteLead(
        'lead-soft-delete',
        'Khách đổi ý không muốn tìm nhà nữa',
        directorAgency1
      );

      expect(trashItem.id).toBeDefined();
      expect(trashItem.entity_type).toBe('lead');

      const leadsAfterDelete: Lead[] = JSON.parse(localStorage.getItem('crm_leads') || '[]');
      expect(leadsAfterDelete[0].deleted_at).toBeDefined();
      expect(leadsAfterDelete[0].delete_reason).toBe('Khách đổi ý không muốn tìm nhà nữa');

      // 2. Khôi phục từ thùng rác
      const restored = controlledDataService.restoreLeadFromTrash(trashItem.id, directorAgency1);
      expect(restored.deleted_at).toBeUndefined();
      expect(restored.care_deadline_at).toBeDefined();

      // Kiểm tra SLA được cấp 24h mới (tối thiểu 23.9 giờ từ hiện tại)
      const deadlineDate = new Date(restored.care_deadline_at!).getTime();
      expect(deadlineDate).toBeGreaterThan(Date.now() + 23 * 3600 * 1000);
    });

    it('phân quyền xem Thùng rác: Giám đốc Sàn chỉ thấy mục sàn mình, Admin thấy toàn bộ', () => {
      const sampleTrashItems = [
        {
          id: 'trash-1',
          entity_type: 'lead',
          entity_id: 'l-1',
          agency_id: 'agency-01',
          payload: {},
          delete_reason: 'Lý do 1',
          deleted_by: 'dir-1',
          deleted_at: '2026-11-09T08:00:00Z'
        },
        {
          id: 'trash-2',
          entity_type: 'lead',
          entity_id: 'l-2',
          agency_id: 'agency-02',
          payload: {},
          delete_reason: 'Lý do 2',
          deleted_by: 'dir-2',
          deleted_at: '2026-11-09T08:00:00Z'
        }
      ];
      localStorage.setItem('crm_trash_bins', JSON.stringify(sampleTrashItems));

      // Giám đốc Sàn 1 chỉ thấy mục của agency-01
      const dir1Trash = controlledDataService.getTrashBin(directorAgency1);
      expect(dir1Trash.length).toBe(1);
      expect(dir1Trash[0].id).toBe('trash-1');

      // Admin thấy cả 2 mục
      const adminTrash = controlledDataService.getTrashBin(adminUser);
      expect(adminTrash.length).toBe(2);
    });
  });

  // ========================================================
  // 4. QUẢN TRỊ HỢP ĐỒNG & GIẢI THỂ ĐỘI NHÓM
  // ========================================================
  describe('Contract Control & Team Dissolution', () => {
    it('chặn sửa trực tiếp số tiền/hoa hồng trên hợp đồng đã duyệt và chặn xóa hợp đồng đã duyệt', () => {
      const approvedContract: Partial<Transaction> = {
        id: 'ct-approved-01',
        lead_id: 'lead-1',
        deal_value: 5000000000,
        commission_amount: 150000000,
        agency_id: 'agency-01',
        status: 'confirmed',
        approval_status: 'approved',
        version: 1
      };
      localStorage.setItem('crm_contracts', JSON.stringify([approvedContract]));

      // Chặn sửa tiền trực tiếp
      expect(() => {
        controlledDataService.updateContractControlled(
          'ct-approved-01',
          { deal_value: 6000000000 },
          1,
          'Sửa giá trị giao dịch',
          directorAgency1
        );
      }).toThrow('Hợp đồng đã được duyệt không được phép sửa trực tiếp số tiền/hoa hồng');

      // Chặn xóa hợp đồng đã duyệt
      expect(() => {
        controlledDataService.softDeleteContract(
          'ct-approved-01',
          'Muốn xóa hợp đồng này',
          directorAgency1
        );
      }).toThrow('Chỉ có thể xóa mềm Hợp đồng ở trạng thái Nháp');
    });

    it('giải thể đội nhóm nguyên tử (atomic): tự động chuyển toàn bộ nhân sự và lead mở sang nhóm khác', () => {
      const teams: Partial<Team>[] = [
        { id: 'team-old', agency_id: 'agency-01', name: 'Nhóm Cũ', code: 'N1' },
        { id: 'team-new', agency_id: 'agency-01', name: 'Nhóm Mới Tiếp Nhận', code: 'N2' }
      ];
      localStorage.setItem('crm_teams', JSON.stringify(teams));

      // 1 nhân sự thuộc team-old
      const profiles: Partial<UserProfile>[] = [
        { id: 'user-member-1', full_name: 'Member 1', team_id: 'team-old', role: 'sale_agent', status: 'active' }
      ];
      localStorage.setItem('crm_profiles', JSON.stringify(profiles));

      // 1 lead mở thuộc team-old
      const leads: Partial<Lead>[] = [
        { id: 'lead-team-1', customer_name: 'Khách Nhóm Cũ', team_id: 'team-old', status: 'contacted' }
      ];
      localStorage.setItem('crm_leads', JSON.stringify(leads));

      // Thực thi giải thể team-old sang team-new
      controlledDataService.dissolveTeamControlled(
        'team-old',
        'team-new',
        'Sáp nhập đội ngũ bán hàng theo định hướng Q4',
        directorAgency1
      );

      // Kiểm tra nhân sự đã được chuyển sang team-new
      const updatedProfiles: UserProfile[] = JSON.parse(localStorage.getItem('crm_profiles') || '[]');
      expect(updatedProfiles[0].team_id).toBe('team-new');

      // Kiểm tra lead mở đã được chuyển sang team-new
      const updatedLeads: Lead[] = JSON.parse(localStorage.getItem('crm_leads') || '[]');
      expect(updatedLeads[0].team_id).toBe('team-new');

      // Kiểm tra nhóm cũ đã được đánh dấu xóa mềm
      const updatedTeams: Team[] = JSON.parse(localStorage.getItem('crm_teams') || '[]');
      const oldTeam = updatedTeams.find(t => t.id === 'team-old')!;
      expect(oldTeam.deleted_at).toBeDefined();
      expect(oldTeam.delete_reason).toContain('Đã chuyển giao 1 nhân sự và 1 leads sang nhóm Nhóm Mới Tiếp Nhận');
    });
  });
});
