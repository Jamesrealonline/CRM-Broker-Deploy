import { describe, it, expect, beforeEach } from 'vitest';
import { LeadRepository } from '@/data/repositories/leadRepository';
import { UserProfile } from '@/domain/types';

describe('Quản Lý Leads & Phân Quyền RLS (Lead Repository)', () => {
  let leadRepo: LeadRepository;

  const saleAgent: UserProfile = {
    id: 'aaaaaaaa-6666-1111-1111-111111111111',
    email: 'sale@diaocvang.vn',
    full_name: 'Phạm Mai Anh (Chuyên Viên Tư Vấn)',
    phone: '0911000006',
    role: 'sale_agent',
    agency_id: '22222222-1111-1111-1111-111111111111',
    team_id: '44444444-1111-1111-1111-111111111111',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const teamLeader: UserProfile = {
    id: 'aaaaaaaa-5555-1111-1111-111111111111',
    email: 'truongnhom@diaocvang.vn',
    full_name: 'Vũ Đình Trọng',
    phone: '0911000005',
    role: 'team_leader',
    agency_id: '22222222-1111-1111-1111-111111111111',
    team_id: '44444444-1111-1111-1111-111111111111',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const salesManager: UserProfile = {
    id: 'aaaaaaaa-4444-1111-1111-111111111111',
    email: 'gdsan@diaocvang.vn',
    full_name: 'Nguyễn Hoàng Long',
    phone: '0911000004',
    role: 'sales_manager',
    agency_id: '22222222-1111-1111-1111-111111111111',
    status: 'active',
    must_change_password: false,
    totp_enabled: true,
  };

  beforeEach(() => {
    localStorage.clear();
    leadRepo = new LeadRepository();
  });

  it('Sale Agent chỉ nhìn thấy đúng Lead được giao cho mình', async () => {
    const res = await leadRepo.getLeads({}, saleAgent);
    expect(res.leads.length).toBeGreaterThan(0);
    for (const lead of res.leads) {
      expect(lead.assigned_to).toBe(saleAgent.id);
    }
  });

  it('Team Leader chỉ nhìn thấy Lead thuộc Team mình phụ trách', async () => {
    const res = await leadRepo.getLeads({}, teamLeader);
    expect(res.leads.length).toBeGreaterThan(0);
    for (const lead of res.leads) {
      expect(lead.team_id).toBe(teamLeader.team_id);
    }
  });

  it('Sales Manager nhìn thấy toàn bộ Lead thuộc Sàn phụ trách', async () => {
    const res = await leadRepo.getLeads({}, salesManager);
    expect(res.leads.length).toBeGreaterThan(0);
    for (const lead of res.leads) {
      expect(lead.agency_id).toBe(salesManager.agency_id);
    }
  });

  it('Phát hiện trùng số điện thoại khi thêm khách hàng mới', async () => {
    // SĐT '0980000001' đã có trong bộ dữ liệu seed
    const dupCheck = await leadRepo.checkDuplicatePhone('0980000001');
    expect(dupCheck.isDuplicate).toBe(true);

    // Chuẩn hoá đầu số 84... thành 0... vẫn phát hiện trùng
    const dupCheck84 = await leadRepo.checkDuplicatePhone('+84980000001');
    expect(dupCheck84.isDuplicate).toBe(true);

    // Tạo lead với SĐT trùng sẽ bị chặn
    const createRes = await leadRepo.createLead({
      fullName: 'Khách Trùng',
      phone: '0980000001',
      projectId: '33333333-1111-1111-1111-111111111111',
      currentUser: saleAgent,
    });
    expect(createRes.success).toBe(false);
    expect(createRes.error).toContain('đã tồn tại trên hệ thống');
  });
});
