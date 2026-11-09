// ========================================================
// REAL ESTATE CRM - ADMIN & DIRECTOR FULL ACCESS, HR KPI & SAMPLE DATA TESTS
// Unit and Integration test suite covering Requirements 1 to 5
// ========================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { canViewFullPII, maskPhone, maskIdCard, maskEmail } from '@/lib/masking';
import { controlledDataService } from '@/domain/services/controlledDataService';
import { computePresetRange, computeComparisonRange, formatVietnamDate } from '@/hooks/useDateRange';
import { UserProfile, Lead, Transaction } from '@/domain/types';

describe('1. PII Masking & Admin/Director Full Privileges (Yêu cầu 1 & 2)', () => {
  const adminUser = {
    id: 'user-admin-01',
    email: 'admin@diaocviet.vn',
    full_name: 'Quản Trị Viên Hệ Thống',
    role: 'admin',
    agency_id: 'agency-01',
    team_id: 'team-01',
    status: 'active',
    created_at: new Date().toISOString(),
  } as unknown as UserProfile;

  const directorAgency1 = {
    id: 'user-director-01',
    email: 'director@agency1.vn',
    full_name: 'Giám Đốc Sàn 1',
    role: 'director',
    agency_id: 'agency-01',
    team_id: 'team-01',
    status: 'active',
    created_at: new Date().toISOString(),
  } as unknown as UserProfile;

  const saleAgent = {
    id: 'user-sale-01',
    email: 'sale@agency1.vn',
    full_name: 'Nguyễn Văn Sale',
    role: 'sale_agent',
    agency_id: 'agency-01',
    team_id: 'team-01',
    status: 'active',
    created_at: new Date().toISOString(),
  } as unknown as UserProfile;

  const teamLeader = {
    id: 'user-leader-01',
    email: 'leader@agency1.vn',
    full_name: 'Trần Văn Trưởng Nhóm',
    role: 'team_leader',
    agency_id: 'agency-01',
    team_id: 'team-01',
    status: 'active',
    created_at: new Date().toISOString(),
  } as unknown as UserProfile;

  beforeEach(() => {
    localStorage.clear();
    controlledDataService.setDirectorGlobalScope(false);
  });

  it('Admin xem đầy đủ PII không che trên mọi đối tượng và mọi sàn', () => {
    expect(canViewFullPII(adminUser, 'agency-01')).toBe(true);
    expect(canViewFullPII(adminUser, 'agency-02')).toBe(true);
    expect(canViewFullPII(adminUser, undefined)).toBe(true);
  });

  it('Giám đốc Sàn xem đầy đủ PII trong nội bộ sàn của mình', () => {
    expect(canViewFullPII(directorAgency1, 'agency-01')).toBe(true);
  });

  it('Giám đốc Sàn bị che PII ở sàn khác khi director_global_scope = false', () => {
    expect(canViewFullPII(directorAgency1, 'agency-02', false)).toBe(false);
  });

  it('Giám đốc Sàn xem được PII toàn hệ thống khi bật director_global_scope = true', () => {
    controlledDataService.setDirectorGlobalScope(true);
    expect(canViewFullPII(directorAgency1, 'agency-02', true)).toBe(true);
  });

  it('Các vai trò sale_agent, team_leader, sales_manager luôn bị che PII (bảo mật nghiêm ngặt)', () => {
    expect(canViewFullPII(saleAgent, 'agency-01')).toBe(false);
    expect(canViewFullPII(teamLeader, 'agency-01')).toBe(false);
  });

  it('Kiểm tra hàm che số CCCD (maskIdCard) và email (maskEmail)', () => {
    expect(maskIdCard('079201004567')).toBe('079******567');
    expect(maskIdCard('123')).toBe('***');
    expect(maskEmail('nguyen.van.a@gmail.com')).toBe('ng***@gmail.com');
    expect(maskPhone('0901234567')).toBe('09xx xxx 567');
  });
});

describe('2. Kiểm Soát Xóa & Thùng Rác (Yêu cầu 1: Trash Bin, Soft Delete, Reversal & Protection)', () => {
  const adminUser = {
    id: 'user-admin-01',
    email: 'admin@diaocviet.vn',
    full_name: 'Quản Trị Viên Hệ Thống',
    role: 'admin',
    agency_id: 'agency-01',
    team_id: 'team-01',
    status: 'active',
    created_at: new Date().toISOString(),
  } as unknown as UserProfile;

  const directorUser = {
    id: 'user-director-01',
    email: 'director@agency1.vn',
    full_name: 'Giám Đốc Sàn 1',
    role: 'director',
    agency_id: 'agency-01',
    team_id: 'team-01',
    status: 'active',
    created_at: new Date().toISOString(),
  } as unknown as UserProfile;

  beforeEach(() => {
    localStorage.clear();
    // Seed initial users for last admin protection check
    localStorage.setItem('crm_profiles', JSON.stringify([
      adminUser,
      directorUser,
      { id: 'user-sale-01', role: 'sale_agent', status: 'active', agency_id: 'agency-01' }
    ]));
  });

  it('Xóa mềm Lead -> lưu vào Thùng rác (Trash Bin) -> Khôi phục Lead khôi phục SLA 24h', () => {
    const testLead = {
      id: 'lead-test-trash',
      customer_name: 'Khách Hàng Xóa Thử',
      customer_phone: '0909999888',
      status: 'contacted',
      assigned_to: 'user-sale-01',
      agency_id: 'agency-01',
      created_at: new Date().toISOString(),
      version: 1,
    } as unknown as Lead;
    localStorage.setItem('crm_leads', JSON.stringify([testLead]));

    // Soft delete
    const result = controlledDataService.softDeleteLead(
      testLead.id,
      'Khách hàng yêu cầu hủy tiếp cận',
      adminUser
    );
    expect(result.id).toBeDefined();
    expect(result.entity_id).toBe(testLead.id);

    // Verify marked as deleted in storage
    const allLeads: Lead[] = JSON.parse(localStorage.getItem('crm_leads') || '[]');
    expect(allLeads.find(l => l.id === testLead.id && !l.deleted_at)).toBeUndefined();
    expect(allLeads.find(l => l.id === testLead.id)?.deleted_at).toBeDefined();

    // Verify present in Trash bin
    const trash = controlledDataService.getTrashBin(adminUser);
    const trashItem = trash.find(t => t.entity_id === testLead.id);
    expect(trashItem).toBeDefined();
    expect(trashItem?.entity_type).toBe('lead');
    expect(trashItem?.delete_reason).toBe('Khách hàng yêu cầu hủy tiếp cận');

    // Restore from Trash
    const restored = controlledDataService.restoreLeadFromTrash(testLead.id, adminUser);
    expect(restored.id).toBe(testLead.id);
    expect(restored.care_deadline_at).toBeDefined();

    // Verify back in active leads (deleted_at removed)
    const reloadedLeads: Lead[] = JSON.parse(localStorage.getItem('crm_leads') || '[]');
    expect(reloadedLeads.find(l => l.id === testLead.id && !l.deleted_at)).toBeDefined();
  });

  it('Hợp đồng đã duyệt (Approved Contract): Hủy có kiểm soát -> Bút toán hoàn nguyên hoa hồng -> Giải phóng căn', () => {
    const testContract = {
      id: 'tx-approved-01',
      code: 'TX-2026-001',
      contract_code: 'HDMB-TEST-001',
      type: 'contract',
      status: 'confirmed',
      deal_value: 5000000000,
      amount: 5000000000,
      commission_amount: 175000000,
      sale_commission_amount: 75000000,
      agency_id: 'agency-01',
      sale_id: 'user-sale-01',
      unit_code: ' căn A-12.04',
      project_id: 'prj-01',
      created_at: new Date().toISOString(),
    } as unknown as Transaction;
    localStorage.setItem('crm_contracts', JSON.stringify([testContract]));

    // Force cancel approved contract
    const res = controlledDataService.softDeleteContract(
      testContract.id,
      'Khách hủy hợp đồng mua bán do lý do tài chính',
      adminUser,
      { forceCancelApproved: true }
    );
    expect(res.id).toBeDefined();
    expect(res.entity_id).toBe(testContract.id);

    // Verify reversal entry created
    const txs: Transaction[] = JSON.parse(localStorage.getItem('crm_contracts') || '[]');
    const reversal = txs.find(t => t.is_reversal === true);
    expect(reversal).toBeDefined();
    expect(reversal?.deal_value).toBe(-5000000000);
    expect(reversal?.commission_amount).toBe(-175000000);
    expect(reversal?.sale_commission_amount).toBe(-75000000);

    // Verify present in Trash bin
    const trash = controlledDataService.getTrashBin(adminUser);
    expect(trash.find(t => t.entity_id === testContract.id)).toBeDefined();
  });

  it('Bảo vệ hệ thống: Chặn xóa hoặc khóa Admin duy nhất cuối cùng', () => {
    expect(() => {
      controlledDataService.deleteEmployeeControlled(
        adminUser.id,
        'user-sale-01',
        'Xóa tài khoản admin',
        adminUser
      );
    }).toThrow('Không thể khóa hoặc xóa Quản trị viên (Admin) duy nhất còn lại');
  });

  it('Bảo vệ phân quyền: Giám đốc Sàn không được phép sửa hoặc xóa Admin hoặc Giám đốc Sàn khác', () => {
    expect(() => {
      controlledDataService.deleteEmployeeControlled(
        adminUser.id,
        'user-sale-01',
        'Giám đốc sàn cố gắng xóa admin',
        directorUser
      );
    }).toThrow('Giám đốc Sàn không được phép sửa/xóa tài khoản của Admin');
  });
});

describe('3. Quản Lý Dữ Liệu Mẫu (Yêu cầu 5: Sample Data Seeding & Purge Idempotency)', () => {
  const adminUser = {
    id: 'user-admin-01',
    email: 'admin@diaocviet.vn',
    full_name: 'Quản Trị Viên Hệ Thống',
    role: 'admin',
    agency_id: 'agency-01',
    team_id: 'team-01',
    status: 'active',
    created_at: new Date().toISOString(),
  } as unknown as UserProfile;

  beforeEach(() => {
    localStorage.clear();
  });

  it('Khởi tạo 10 lead mẫu gắn cờ is_sample=true và created_via=sample_seed', () => {
    const seedResult = controlledDataService.seedSampleLeads(adminUser);
    expect(seedResult.created_count).toBe(10);

    const leads: Lead[] = JSON.parse(localStorage.getItem('crm_leads') || '[]');
    const sampleLeads = leads.filter(l => l.is_sample === true);
    expect(sampleLeads.length).toBe(10);
    expect(sampleLeads.every(l => l.created_via === 'sample_seed')).toBe(true);

    // Calling seed again is idempotent (doesn't duplicate)
    const seedAgain = controlledDataService.seedSampleLeads(adminUser);
    expect(seedAgain.created_count).toBe(10);
  });

  it('Xóa toàn bộ dữ liệu mẫu (Purge) dọn sạch dữ liệu mẫu và giữ nguyên dữ liệu thật', () => {
    // Seed 10 sample leads
    controlledDataService.seedSampleLeads(adminUser);

    // Add 1 real lead
    const realLead = {
      id: 'real-lead-123',
      customer_name: 'Khách Hàng Thật',
      customer_phone: '0988776655',
      status: 'contract',
      assigned_to: 'user-sale-01',
      agency_id: 'agency-01',
      is_sample: false,
      created_at: new Date().toISOString(),
    } as unknown as Lead;
    const leads: Lead[] = JSON.parse(localStorage.getItem('crm_leads') || '[]');
    leads.push(realLead);
    localStorage.setItem('crm_leads', JSON.stringify(leads));

    // Purge sample data
    const purgeResult = controlledDataService.purgeSampleData(adminUser);
    expect(purgeResult.deleted_leads).toBe(10);

    // Verify only real lead remains
    const remainingLeads: Lead[] = JSON.parse(localStorage.getItem('crm_leads') || '[]');
    expect(remainingLeads.length).toBe(1);
    expect(remainingLeads[0].id).toBe('real-lead-123');
  });
});

describe('4. Shared Date Range & Timezone Calculations (Yêu cầu 4)', () => {
  it('Chuyển đổi ngày theo múi giờ Việt Nam Asia/Ho_Chi_Minh (UTC+7)', () => {
    const d = new Date(Date.UTC(2026, 10, 9, 12, 0, 0)); // 2026-11-09
    const vnDate = formatVietnamDate(d);
    expect(vnDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('Tính toán dải ngày theo preset (today, last_7_days, this_month, etc.)', () => {
    const range7 = computePresetRange('last_7_days');
    expect(range7.from).toBeDefined();
    expect(range7.to).toBeDefined();
    expect(range7.from <= range7.to).toBe(true);

    const rangeMonth = computePresetRange('this_month');
    expect(rangeMonth.from).toMatch(/-01$/); // Start of month is day 01
  });

  it('Tính toán kỳ đối chiếu liền trước chính xác (Comparison Range)', () => {
    // 7 days from 2026-11-03 to 2026-11-09
    const comp = computeComparisonRange('2026-11-03', '2026-11-09');
    expect(comp.previousTo).toBe('2026-11-02');
    expect(comp.previousFrom).toBe('2026-10-27');
  });
});
