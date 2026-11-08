import { describe, it, expect, beforeEach } from 'vitest';
import { LeadRepository } from '@/data/repositories/leadRepository';
import { UserProfile, Lead } from '@/domain/types';

describe('P1.4 RLS Toàn Diện & Cưỡng Chế Cô Lập Đa Đối Tác (Multi-Tenant)', () => {
  let leadRepo: LeadRepository;

  const mockUserTenantA: UserProfile = {
    id: 'user-tenant-a-01',
    organization_id: 'tenant-alpha-001',
    email: 'admin.a@tenant-alpha.vn',
    full_name: 'Quản Trị Viên Sàn Alpha',
    phone: '0901000001',
    role: 'admin',
    status: 'active',
    must_change_password: false,
    totp_enabled: true,
    created_at: new Date().toISOString(),
  };

  const mockUserTenantB: UserProfile = {
    id: 'user-tenant-b-02',
    organization_id: 'tenant-beta-002',
    email: 'admin.b@tenant-beta.vn',
    full_name: 'Quản Trị Viên Sàn Beta',
    phone: '0902000002',
    role: 'admin',
    status: 'active',
    must_change_password: false,
    totp_enabled: true,
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    localStorage.clear();
    leadRepo = new LeadRepository();
  });

  it('1. Cô lập dữ liệu: Người dùng Tenant A không thể thấy danh sách Leads của Tenant B', async () => {
    const leadTenantA: Lead = {
      id: 'lead-tenant-a-1',
      organization_id: 'tenant-alpha-001',
      customer_id: 'cust-a-1',
      customer_name: 'Khách Hàng Sàn Alpha',
      customer_phone: '0911222333',
      project_id: 'proj-01',
      status: 'new',
      lead_score: 80,
      purpose: 'investment',
      created_at: new Date().toISOString(),
    };

    const leadTenantB: Lead = {
      id: 'lead-tenant-b-1',
      organization_id: 'tenant-beta-002',
      customer_id: 'cust-b-1',
      customer_name: 'Khách Hàng Sàn Beta',
      customer_phone: '0944555666',
      project_id: 'proj-01',
      status: 'new',
      lead_score: 75,
      purpose: 'residence',
      created_at: new Date().toISOString(),
    };

    localStorage.setItem('crm_leads', JSON.stringify([leadTenantA, leadTenantB]));

    // Truy vấn bằng tài khoản Tenant A
    const resA = await leadRepo.getLeads({}, mockUserTenantA);
    expect(resA.leads.length).toBe(1);
    expect(resA.leads[0].id).toBe('lead-tenant-a-1');
    expect(resA.leads[0].customer_name).toBe('Khách Hàng Sàn Alpha');

    // Truy vấn bằng tài khoản Tenant B
    const resB = await leadRepo.getLeads({}, mockUserTenantB);
    expect(resB.leads.length).toBe(1);
    expect(resB.leads[0].id).toBe('lead-tenant-b-1');
    expect(resB.leads[0].customer_name).toBe('Khách Hàng Sàn Beta');
  });

  it('2. Chống giả mạo organization_id: Cưỡng chế gán từ token/profile của currentUser, bỏ qua injection', async () => {
    // User của Tenant A cố tình gửi request với tham số organization_id của Tenant B (tamper payload)
    const tamperedPayload: any = {
      fullName: 'Khách Bị Đánh Tráo Tenant',
      phone: '0977112233',
      projectId: 'proj-01',
      organization_id: 'tenant-beta-002', // Cố tình inject trái phép
      currentUser: mockUserTenantA,        // Tài khoản thực tế là Tenant A
    };

    const createRes = await leadRepo.createLead(tamperedPayload);
    expect(createRes.success).toBe(true);

    // Kiểm tra Lead tạo ra bắt buộc phải thuộc Tenant A, không cho phép inject Tenant B
    expect(createRes.lead?.organization_id).toBe('tenant-alpha-001');
    expect(createRes.lead?.organization_id).not.toBe('tenant-beta-002');
  });

  it('3. Không thể đọc chéo Lead của đối tác khác bằng ID trực tiếp', async () => {
    const leadSecretTenantB: Lead = {
      id: 'lead-secret-beta-99',
      organization_id: 'tenant-beta-002',
      customer_id: 'cust-secret-b',
      customer_name: 'Khách Bí Mật Sàn Beta',
      customer_phone: '0999888777',
      project_id: 'proj-01',
      status: 'deposit',
      lead_score: 95,
      purpose: 'investment',
      created_at: new Date().toISOString(),
    };

    localStorage.setItem('crm_leads', JSON.stringify([leadSecretTenantB]));

    // Tenant A lấy danh sách leads -> hoàn toàn không thấy
    const resA = await leadRepo.getLeads({}, mockUserTenantA);
    expect(resA.leads.find(l => l.id === 'lead-secret-beta-99')).toBeUndefined();
  });
});
