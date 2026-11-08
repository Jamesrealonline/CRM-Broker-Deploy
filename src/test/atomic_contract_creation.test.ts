import { describe, it, expect, beforeEach } from 'vitest';
import { contractRepository } from '../data/repositories/contractRepository';
import { leadRepository } from '../data/repositories/leadRepository';
import { UserProfile } from '../domain/types';

describe('Atomic Contract Creation With Customer & Lead Sources', () => {
  const mockAdminUser: UserProfile = {
    id: 'admin-user-001',
    full_name: 'Quản Trị Viên',
    email: 'admin@crm-broker.vn',
    phone: '0901000001',
    role: 'admin',
    team_id: 'team-01',
    agency_id: 'agency-01',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const mockSaleUser1: UserProfile = {
    id: 'sale-user-001',
    full_name: 'Nguyễn Văn Sale 1',
    email: 'sale1@crm-broker.vn',
    phone: '0901000002',
    role: 'sale_agent',
    team_id: 'team-01',
    agency_id: 'agency-01',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const mockSaleUser2: UserProfile = {
    id: 'sale-user-002',
    full_name: 'Trần Thị Sale 2',
    email: 'sale2@crm-broker.vn',
    phone: '0901000003',
    role: 'sale_agent',
    team_id: 'team-02',
    agency_id: 'agency-01',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const mockMarketingUser: UserProfile = {
    id: 'marketing-user-001',
    full_name: 'Lê Marketing',
    email: 'marketing@crm-broker.vn',
    phone: '0901000004',
    role: 'marketing_manager',
    team_id: 'team-01',
    agency_id: 'agency-01',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('1. Tạo hợp đồng với khách hàng mới: nguyên tử (atomic), tạo đồng thời Customer, Lead, Transaction và chặn orphan records', async () => {
    const payload = {
      customerName: 'Phạm Nhật Vượng',
      customerPhone: '0988112233',
      customerEmail: 'vuong@example.com',
      identityCard: '001090123456',
      address: 'Hà Nội',
      consentObtained: true,
      projectId: 'proj-01',
      projectName: 'Vinhomes Grand Park',
      unitCode: 'VHM-B101',
      propertyType: 'Biệt thự Đơn lập',
      sourceId: 'facebook_ads',
      sourceDetail: 'Chiến dịch Mùa Thu 2026',
      dealValue: 10_000_000_000,
      contractCode: 'HĐMB-2026-VHM-01',
      contractDate: '2026-11-08',
      commissionRate: 3.5, // 350M
      saleCommissionRate: 1.5,   // 150M
      firstInstallmentAmount: 1_000_000_000,
      firstInstallmentDate: '2026-11-15',
      firstInstallmentPaid: true,
      paymentMethod: 'bank_transfer' as const,
      receiptCode: 'PT-2026-001',
      currentUser: mockAdminUser,
    };

    const result = await contractRepository.createContractWithCustomer(payload);
    expect(result.success).toBe(true);
    expect(result.customer_id).toBeDefined();
    expect(result.lead_id).toBeDefined();
    expect(result.transaction_id).toBeDefined();

    // Verify Lead created with source and detail
    const lead = await leadRepository.getLeadById(result.lead_id);
    expect(lead).toBeDefined();
    expect(lead?.customer_name).toBe('Phạm Nhật Vượng');
    expect(lead?.source_id).toBe('facebook_ads');
    expect(lead?.source_detail).toBe('Chiến dịch Mùa Thu 2026');
    expect(lead?.status).toBe('contract');

    // Verify Transaction created in pending status (maker-checker)
    const txs = await contractRepository.getTransactions();
    const tx = txs.find(t => t.id === result.transaction_id);
    expect(tx).toBeDefined();
    expect(tx?.status).toBe('pending');
    expect(tx?.contract_code).toBe('HĐMB-2026-VHM-01');
    expect(tx?.unit_code).toBe('VHM-B101');
  });

  it('2. Chống bán trùng căn: Nếu căn đang có hợp đồng hiệu lực (confirmed/pending) trong cùng dự án, từ chối giao dịch', async () => {
    // Contract 1: Unit TGC-A01
    await contractRepository.createContractWithCustomer({
      customerName: 'Khách A',
      customerPhone: '0912345678',
      consentObtained: true,
      projectId: 'proj-tgc',
      unitCode: 'TGC-A01',
      dealValue: 5_000_000_000,
      contractCode: 'HD-001',
      commissionRate: 3,
      saleCommissionRate: 1,
      currentUser: mockAdminUser,
    });

    // Contract 2: Cùng unit TGC-A01 tại cùng dự án proj-tgc
    await expect(
      contractRepository.createContractWithCustomer({
        customerName: 'Khách B',
        customerPhone: '0987654321',
        consentObtained: true,
        projectId: 'proj-tgc',
        unitCode: 'TGC-A01',
        dealValue: 5_200_000_000,
        contractCode: 'HD-002',
        commissionRate: 3,
        saleCommissionRate: 1,
        currentUser: mockAdminUser,
      })
    ).rejects.toThrow(/đã có hợp đồng\/giao dịch hiệu lực/);
  });

  it('3. Idempotency với requestId: Trả về kết quả giao dịch trước đó, không nhân đôi hợp đồng', async () => {
    const requestId = 'req-unique-uuid-12345';
    const payload = {
      customerName: 'Khách Trùng Gửi',
      customerPhone: '0933334455',
      consentObtained: true,
      projectId: 'proj-01',
      unitCode: 'CAN-IDEMP-01',
      dealValue: 3_000_000_000,
      contractCode: 'HD-IDEMP-01',
      commissionRate: 3,
      saleCommissionRate: 1,
      requestId,
      currentUser: mockAdminUser,
    };

    const res1 = await contractRepository.createContractWithCustomer(payload);
    expect(res1.success).toBe(true);

    // Call 2 with identical requestId
    const res2 = await contractRepository.createContractWithCustomer(payload);
    expect(res2.success).toBe(true);
    expect(res2.transaction_id).toBe(res1.transaction_id);

    // Only 1 transaction should exist
    const allTx = await contractRepository.getTransactions();
    const matches = allTx.filter((t) => t.contract_code === 'HD-IDEMP-01');
    expect(matches.length).toBe(1);
  });

  it('4. Server tính toán hoa hồng: DB/Server tự tính hoa hồng từ dealValue và %, không tin số tiền client gửi', async () => {
    const res = await contractRepository.createContractWithCustomer({
      customerName: 'Khách Hàng VIP',
      customerPhone: '0944445566',
      consentObtained: true,
      projectId: 'proj-01',
      unitCode: 'CAN-COMM-01',
      dealValue: 10_000_000_000, // 10 tỷ
      contractCode: 'HD-COMM-01',
      commissionRate: 3.5, // 3.5% = 350.000.000 VNĐ
      saleCommissionRate: 1.5,   // 1.5% = 150.000.000 VNĐ
      firstInstallmentAmount: 1_000_000_000,
      firstInstallmentDate: '2026-11-20',
      currentUser: mockAdminUser,
    });

    expect(res.commission_amount).toBe(350_000_000);
    expect(res.sale_commission_amount).toBe(150_000_000);

    const txs = await contractRepository.getTransactions();
    const tx = txs.find(t => t.id === res.transaction_id);
    expect(tx?.commission_amount).toBe(350_000_000);
    expect(tx?.sale_commission_amount).toBe(150_000_000);
  });

  it('5. Phân quyền vai trò: Sale Agent chỉ được tạo HĐ cho chính mình; Marketing Manager bị từ chối', async () => {
    // Marketing Manager attempts to create contract -> throws error
    await expect(
      contractRepository.createContractWithCustomer({
        customerName: 'Khách Của Marketing',
        customerPhone: '0911223344',
        consentObtained: true,
        projectId: 'proj-01',
        unitCode: 'CAN-MKT-01',
        dealValue: 2_000_000_000,
        contractCode: 'HD-MKT-01',
        commissionRate: 3,
        saleCommissionRate: 1,
        currentUser: mockMarketingUser,
      })
    ).rejects.toThrow(/Marketing Manager không có quyền/);

    // Sale 1 creates contract assigned to Sale 2 -> throws error
    await expect(
      contractRepository.createContractWithCustomer({
        customerName: 'Khách Sale Chéo',
        customerPhone: '0966778899',
        consentObtained: true,
        projectId: 'proj-01',
        unitCode: 'CAN-SALE-01',
        assignedTo: mockSaleUser2.id, // assigned to another sale
        dealValue: 2_000_000_000,
        contractCode: 'HD-SALE-01',
        commissionRate: 3,
        saleCommissionRate: 1,
        currentUser: mockSaleUser1,
      })
    ).rejects.toThrow(/Chuyên viên tư vấn chỉ được tạo hợp đồng cho chính mình/);
  });

  it('6. Bảo tồn nguồn lead (First-Touch Attribution): Khách hàng có sẵn không bị ghi đè nguồn ban đầu', async () => {
    // 1. First lead created with source hotline
    const createRes = await leadRepository.createLead({
      fullName: 'Trần Văn Đầu Tư',
      phone: '0977889900',
      projectId: 'proj-01',
      sourceCode: 'hotline',
      notes: 'Cuộc gọi tổng đài 1900',
      currentUser: mockAdminUser,
    });
    expect(createRes.success).toBe(true);
    const originalLead = createRes.lead!;

    // 2. Create contract referencing this existing lead & passing sourceId = 'direct_booth'
    const res = await contractRepository.createContractWithCustomer({
      leadId: originalLead.id,
      projectId: 'proj-01',
      unitCode: 'TGC-B202',
      dealValue: 4_500_000_000,
      contractCode: 'HD-FT-01',
      sourceId: 'direct_booth', // New touchpoint
      sourceDetail: 'Trực booth Aeon Mall',
      commissionRate: 3,
      saleCommissionRate: 1,
      currentUser: mockSaleUser1,
    });

    expect(res.success).toBe(true);

    // 3. Verify lead source retains the first touch: 'hotline'
    const updatedLead = await leadRepository.getLeadById(originalLead.id);
    expect(updatedLead?.source_id).toBe('src-hotline');
    expect(updatedLead?.status).toBe('contract');
  });

  it('7. Bảo hộ Lead & Phone Protection: Phát hiện trùng SĐT và bảo vệ dữ liệu PII không bị lộ cho Sale khác', async () => {
    // 1. Lead thuộc về Sale 1
    const createRes = await leadRepository.createLead({
      fullName: 'Bảo Vệ Độc Quyền',
      phone: '0919998877',
      projectId: 'proj-protect',
      sourceCode: 'sale_self',
      currentUser: mockSaleUser1, // will be assigned to Sale 1
    });
    expect(createRes.success).toBe(true);

    // 2. Sale 2 kiểm tra SĐT này trong cùng dự án proj-protect
    const checkSale2 = await leadRepository.checkCustomerPhoneProtection('0919998877', mockSaleUser2, 'proj-protect');
    expect(checkSale2.isDuplicate).toBe(true);
    expect(checkSale2.isProtected).toBe(true);
    expect(checkSale2.canUse).toBe(false);
    expect(checkSale2.existingCustomer?.phone).toBe('09xx xxx 877');

    // 3. Admin kiểm tra SĐT này (Admin có quyền xem và sử dụng)
    const checkAdmin = await leadRepository.checkCustomerPhoneProtection('0919998877', mockAdminUser, 'proj-protect');
    expect(checkAdmin.isDuplicate).toBe(true);
    expect(checkAdmin.isProtected).toBe(false);
    expect(checkAdmin.canUse).toBe(true);
    expect(checkAdmin.existingCustomer?.phone).toBe('0919998877');
  });
});
