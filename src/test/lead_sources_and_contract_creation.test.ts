// ========================================================
// TEST SUITE: LEAD SOURCES, PROGRESSIVE BONUS & CONTRACT CREATION
// Nghiệm thu tính năng:
// 1. Quản lý nguồn Lead (Lead Sources): 9 nguồn mặc định + thêm nguồn mới
// 2. Phí thưởng luỹ tiến khi tạo dự án (Progressive Commission Bonus)
// 3. Tạo hợp đồng với khách hàng mới và chọn nguồn lead tương ứng
// ========================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { leadRepository } from '../data/repositories/leadRepository';
import { projectRepository } from '../data/repositories/projectRepository';
import { contractRepository } from '../data/repositories/contractRepository';
import { UserProfile } from '../domain/types';

const mockAdminUser: UserProfile = {
  id: 'aaaaaaaa-1111-1111-1111-111111111111',
  organization_id: '11111111-1111-1111-1111-111111111111',
  full_name: 'Quản Trị Viên Hệ Thống',
  email: 'admin@crm-broker.vn',
  role: 'admin',
  phone: '0901000001',
  status: 'active',
  must_change_password: false,
  totp_enabled: false,
};

describe('Quản Lý Nguồn Lead, Phí Thưởng Luỹ Tiến & Tạo Hợp Đồng Khách Mới', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('1. Danh sách nguồn Lead ban đầu có đủ 9 nguồn chuẩn', async () => {
    const sources = await leadRepository.getLeadSources();
    expect(sources.length).toBeGreaterThanOrEqual(9);

    const codes = sources.map(s => s.code);
    expect(codes).toContain('hotline');
    expect(codes).toContain('facebook');
    expect(codes).toContain('truc_nha_mau');
    expect(codes).toContain('to_roi');
    expect(codes).toContain('email');
    expect(codes).toContain('zalo');
    expect(codes).toContain('tiktok');
    expect(codes).toContain('truc_quan_cafe');
    expect(codes).toContain('nguon_cua_sale');
  });

  it('2. Cho phép thêm mới nguồn Lead tùy chỉnh trên giao diện và lưu trữ thành công', async () => {
    const initialSources = await leadRepository.getLeadSources();
    const newSource = await leadRepository.createLeadSource('Hội thảo Bất động sản 2026');

    expect(newSource).toBeDefined();
    expect(newSource.name).toBe('Hội thảo Bất động sản 2026');
    expect(newSource.code).toBe('hoi_thao_bat_dong_san_2026');
    expect(newSource.is_active).toBe(true);

    const updatedSources = await leadRepository.getLeadSources();
    expect(updatedSources.length).toBe(initialSources.length + 1);
    expect(updatedSources.find(s => s.id === newSource.id)).toBeDefined();
  });

  it('3. Tạo Lead với nguồn lead tương ứng và lưu trữ source_id, source_name chính xác', async () => {
    const sources = await leadRepository.getLeadSources();
    const tiktokSource = sources.find(s => s.code === 'tiktok') || sources[0];

    const res = await leadRepository.createLead({
      fullName: 'Trương Hoàng Nam',
      phone: '0938123456',
      email: 'nam.truong@example.com',
      projectId: 'prj-1',
      sourceId: tiktokSource.id,
      sourceName: tiktokSource.name,
      notes: 'Khách xem video phân tích dự án qua kênh TikTok',
      currentUser: mockAdminUser,
    });

    expect(res.success).toBe(true);
    expect(res.lead).toBeDefined();
    expect(res.lead?.source_id).toBe(tiktokSource.id);
    expect(res.lead?.source_name).toBe(tiktokSource.name);

    // Kiểm tra lấy lại trong danh sách
    const list = await leadRepository.getLeads({}, mockAdminUser);
    const found = list.leads.find(l => l.id === res.lead?.id);
    expect(found).toBeDefined();
    expect(found?.source_name).toBe(tiktokSource.name);
  });

  it('4. Tạo Dự án mới với % phí dự án, % hoa hồng sale và chính sách thưởng luỹ tiến', async () => {
    const createdProject = await projectRepository.createProject({
      name: 'Vinhomes Royal Island Vũ Yên',
      code: 'VH-ROYAL',
      developer: 'Vingroup',
      commission_rate: 4.0,
      sale_commission_rate: 2.0,
      progressive_commission: 'Đạt >= 3 căn: +0.2%, Đạt >= 7 căn: +0.5%, Đạt >= 12 căn: +0.8%',
    });

    expect(createdProject).toBeDefined();
    expect(createdProject.commission_rate).toBe(4.0);
    expect(createdProject.sale_commission_rate).toBe(2.0);
    expect(createdProject.progressive_commission).toBe(
      'Đạt >= 3 căn: +0.2%, Đạt >= 7 căn: +0.5%, Đạt >= 12 căn: +0.8%'
    );

    const projects = await projectRepository.getProjects();
    const retrieved = projects.find(p => p.id === createdProject.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.progressive_commission).toContain('Đạt >= 3 căn: +0.2%');
  });

  it('5. Khởi tạo Hợp đồng với khách hàng mới: Tự sinh Customer, Lead có nguồn chỉ định và Transaction liên kết', async () => {
    const sources = await leadRepository.getLeadSources();
    const cafeSource = sources.find(s => s.code === 'truc_quan_cafe') || sources[0];

    // Mô phỏng luồng tạo khách hàng mới ngay trong modal hợp đồng
    const createLeadRes = await leadRepository.createLead({
      fullName: 'Bùi Quốc Cường',
      phone: '0918889999',
      email: 'cuong.bui@gmail.com',
      projectId: 'prj-1',
      sourceId: cafeSource.id,
      sourceName: cafeSource.name,
      notes: 'HĐMB căn TH-01. CCCD: 079090001122',
      currentUser: mockAdminUser,
    });

    expect(createLeadRes.success).toBe(true);
    const newLead = createLeadRes.lead!;
    expect(newLead.source_name).toBe(cafeSource.name);

    // Tạo hợp đồng giao dịch cho khách vừa tạo
    const contract = await contractRepository.createContractTransaction({
      lead_id: newLead.id,
      project_id: 'prj-1',
      project_name: 'The Global City',
      type: 'contract',
      code: 'HD-999001',
      contract_code: 'HĐMB-2026-9901',
      unit_code: 'TH-01',
      amount: 8500000000,
      deal_value: 8500000000,
      commission_amount: 297500000, // 3.5%
      sale_commission_rate: 1.5,
      sale_commission_amount: 127500000, // 1.5%
      deposit_date: new Date().toISOString(),
      contract_date: new Date().toISOString(),
      first_installment_amount: 850000000,
      first_installment_date: new Date(Date.now() + 14 * 86400000).toISOString(),
      first_installment_paid: false,
      notes: 'Hợp đồng The Global City - Căn TH-01',
      created_by: mockAdminUser.id,
    });

    expect(contract).toBeDefined();
    expect(contract.lead_id).toBe(newLead.id);
    expect(contract.contract_code).toBe('HĐMB-2026-9901');
    expect(contract.deal_value).toBe(8500000000);
    expect(contract.commission_amount).toBe(297500000);
    expect(contract.sale_commission_amount).toBe(127500000);

    // Kiểm tra danh sách hợp đồng
    const transactions = await contractRepository.getTransactions({ projectId: 'prj-1' });
    const foundTx = transactions.find(t => t.id === contract.id);
    expect(foundTx).toBeDefined();
    expect(foundTx?.unit_code).toBe('TH-01');
  });
});
