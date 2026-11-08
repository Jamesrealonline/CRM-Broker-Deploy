import { describe, it, expect, beforeEach } from 'vitest';
import { LeadRepository } from '@/data/repositories/leadRepository';
import { ContractRepository } from '@/data/repositories/contractRepository';
import { UserProfile, Lead } from '@/domain/types';

describe('P0.1 Cưỡng Chế Chuyển Trạng Thái & Ràng Buộc Tài Chính (DB & Server Rules)', () => {
  let leadRepo: LeadRepository;
  let contractRepo: ContractRepository;

  const adminUser: UserProfile = {
    id: 'user-admin',
    email: 'admin@diaocvang.vn',
    full_name: 'Quản Trị Viên',
    phone: '0900000000',
    role: 'admin',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const saleUser1: UserProfile = {
    id: 'aaaaaaaa-6666-1111-1111-111111111111',
    email: 'sale1@diaocvang.vn',
    full_name: 'Phạm Mai Anh',
    phone: '0912345678',
    role: 'sale_agent',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const saleUser2: UserProfile = {
    id: 'sale-user-other',
    email: 'sale2@diaocvang.vn',
    full_name: 'Nguyễn Văn Nam',
    phone: '0987654321',
    role: 'sale_agent',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  beforeEach(() => {
    localStorage.clear();
    leadRepo = new LeadRepository();
    contractRepo = new ContractRepository();
  });

  it('1. Chặn gọi trực tiếp bỏ qua UI khi thiếu mã Booking', async () => {
    const res = await leadRepo.updateLeadStageWithTransaction({
      leadId: 'lead-1',
      newStatus: 'booking',
      currentUser: adminUser,
      txCode: '',
      txAmount: 50000000,
      unitCode: 'CAN-A101',
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Mã Booking là bắt buộc');
  });

  it('2. Chặn chuyển sang Đặt cọc nếu số tiền đặt cọc <= 0 hoặc trống', async () => {
    const res = await leadRepo.updateLeadStageWithTransaction({
      leadId: 'lead-1',
      newStatus: 'deposit',
      currentUser: adminUser,
      txCode: 'DC-9999',
      txAmount: 0,
      unitCode: 'CAN-A101',
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Số tiền đặt cọc hợp lệ (> 0) là bắt buộc');
  });

  it('3. Chặn chuyển sang Ký HĐMB nếu thiếu mã hợp đồng', async () => {
    const res = await leadRepo.updateLeadStageWithTransaction({
      leadId: 'lead-1',
      newStatus: 'contract',
      currentUser: adminUser,
      txCode: '',
      txAmount: 3000000000,
      unitCode: 'CAN-A101',
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Mã hợp đồng (HĐMB) là bắt buộc');
  });

  it('4. Chặn khi mã căn hộ / sản phẩm để trống trong giao dịch tài chính', async () => {
    const res = await leadRepo.updateLeadStageWithTransaction({
      leadId: 'lead-1',
      newStatus: 'booking',
      currentUser: adminUser,
      txCode: 'BK-VALID-123',
      txAmount: 50000000,
      unitCode: '   ',
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Mã căn hộ / sản phẩm không được để trống');
  });

  it('5. Chặn bán trùng / đặt cọc trùng một căn hộ trong cùng dự án (Unique Unit Check)', async () => {
    // Lấy thông tin lead-1 và lead-2, đồng bộ chung 1 dự án để kiểm tra va chạm giỏ hàng
    const lead1 = await leadRepo.getLeadById('lead-1');
    const lead2 = await leadRepo.getLeadById('lead-2');
    expect(lead1).toBeDefined();
    expect(lead2).toBeDefined();

    // Đưa lead-2 về cùng project_id với lead-1
    await leadRepo.updateLead('lead-2', { project_id: lead1!.project_id });

    // Bước 1: Khách hàng 1 cọc thành công căn C-08.15 ở dự án của lead-1
    const res1 = await leadRepo.updateLeadStageWithTransaction({
      leadId: 'lead-1',
      newStatus: 'booking',
      currentUser: adminUser,
      txCode: 'BK-FIRST-111',
      txAmount: 50000000,
      unitCode: 'C-08.15',
    });
    expect(res1.success).toBe(true);

    // Bước 2: Chuyển lead-2 theo đúng quy trình từ 'unreachable' -> 'contacted' -> 'qualifying' -> 'consulted'
    await leadRepo.updateLeadStageWithTransaction({
      leadId: 'lead-2',
      newStatus: 'contacted',
      currentUser: adminUser,
    });
    await leadRepo.updateLeadStageWithTransaction({
      leadId: 'lead-2',
      newStatus: 'qualifying',
      currentUser: adminUser,
    });
    await leadRepo.updateLeadStageWithTransaction({
      leadId: 'lead-2',
      newStatus: 'consulted',
      currentUser: adminUser,
    });

    // Bước 3: Khách hàng 2 (cùng dự án) cố tình booking căn C-08.15 -> Phải bị chặn do trùng căn
    const res2 = await leadRepo.updateLeadStageWithTransaction({
      leadId: 'lead-2',
      newStatus: 'booking',
      currentUser: adminUser,
      txCode: 'BK-SECOND-222',
      txAmount: 50000000,
      unitCode: 'c-08.15 ', // Kiểm tra không phân biệt hoa thường và khoảng trắng
    });
    expect(res2.success).toBe(false);
    expect(res2.error).toContain('Xung đột giỏ hàng: Căn "c-08.15" đã có hợp đồng/giao dịch hiệu lực từ trước trong dự án!');
  });

  it('6. Chặn bước chuyển trạng thái không hợp lệ theo ma trận quy trình (State Machine)', async () => {
    // Đưa lead về trạng thái 'lost'
    await leadRepo.updateLeadStageWithTransaction({
      leadId: 'lead-1',
      newStatus: 'lost',
      currentUser: adminUser,
    });

    // Thử chuyển từ 'lost' nhảy cóc thẳng sang 'contract' -> Bị từ chối
    const res = await leadRepo.updateLeadStageWithTransaction({
      leadId: 'lead-1',
      newStatus: 'contract',
      currentUser: adminUser,
      txCode: 'HDMB-ILLEGAL',
      txAmount: 3000000000,
      unitCode: 'CAN-TEST',
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Quy trình không hợp lệ: Không được phép chuyển từ trạng thái "lost" sang "contract"');
  });

  it('7. Chặn chuyên viên tư vấn (sale_agent) thực hiện thao tác vượt quyền (Role Check)', async () => {
    // Chuyển lead sang trạng thái 'deposit' trước
    await leadRepo.updateLeadStageWithTransaction({
      leadId: 'lead-1',
      newStatus: 'deposit',
      currentUser: adminUser,
      txCode: 'DC-VALID-001',
      txAmount: 100000000,
      unitCode: 'B-10.02',
    });

    // Chuyên viên sale_agent cố tình chuyển từ 'deposit' sang 'contract' (quy định chỉ Quản lý/Admin)
    const res = await leadRepo.updateLeadStageWithTransaction({
      leadId: 'lead-1',
      newStatus: 'contract',
      currentUser: saleUser1,
      txCode: 'HDMB-SALE-TRY',
      txAmount: 2500000000,
      unitCode: 'B-10.02',
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Từ chối thao tác: Vai trò "sale_agent" không có quyền');
  });

  it('8. Chặn chuyên viên tư vấn cập nhật Lead của chuyên viên khác (Ownership Check)', async () => {
    // lead-1 được gán cho saleUser1 ('aaaaaaaa-6666-1111-1111-111111111111')
    // saleUser2 ('sale-user-other') cố tình thay đổi trạng thái của lead-1
    const res = await leadRepo.updateLeadStageWithTransaction({
      leadId: 'lead-1',
      newStatus: 'contacted',
      currentUser: saleUser2,
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Từ chối thao tác: Chuyên viên tư vấn chỉ được cập nhật trạng thái Lead được giao cho chính mình');
  });

  it('9. Chuyển trạng thái giao dịch hợp lệ -> Tạo transaction, cập nhật trạng thái và dừng SLA', async () => {
    const res = await leadRepo.updateLeadStageWithTransaction({
      leadId: 'lead-1',
      newStatus: 'booking',
      currentUser: saleUser1,
      txCode: 'BK-SUCCESS-999',
      txAmount: 50000000,
      unitCode: 'C-22.08',
      notes: 'Khách hàng chốt cọc căn đẹp view sông',
    });

    expect(res.success).toBe(true);

    const lead = await leadRepo.getLeadById('lead-1');
    expect(lead?.status).toBe('booking');
    expect(lead?.notes).toBe('Khách hàng chốt cọc căn đẹp view sông');
    // Trạng thái booking nằm trong STOP_CLOCK_STATUSES -> care_deadline_at là undefined (null)
    expect(lead?.care_deadline_at).toBeUndefined();

    // Kiểm tra transaction được tạo trong kho dữ liệu
    const txs = await contractRepo.getTransactions({ leadId: 'lead-1' });
    expect(txs.length).toBeGreaterThanOrEqual(1);
    expect(txs[0].code).toBe('BK-SUCCESS-999');
    expect(txs[0].unit_code).toBe('C-22.08');
    expect(txs[0].amount).toBe(50000000);
  });

  it('10. Không thể vượt qua RPC bằng cách gọi updateLead trực tiếp để đổi status', async () => {
    // Cố tình truyền status vào updateLead
    const res = await leadRepo.updateLead('lead-1', {
      status: 'contract' as any,
      notes: 'Cố tình đổi status qua updateLead',
    });

    expect(res.success).toBe(true);
    // Lead vẫn giữ nguyên status cũ ('new' hoặc đã cập nhật trước đó), không bị đổi thành 'contract'
    const lead = await leadRepo.getLeadById('lead-1');
    expect(lead?.status).not.toBe('contract');
    expect(lead?.notes).toBe('Cố tình đổi status qua updateLead');
  });
});
