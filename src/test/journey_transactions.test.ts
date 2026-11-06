import { describe, it, expect, beforeEach } from 'vitest';
import { LeadRepository } from '@/data/repositories/leadRepository';
import { ProjectRepository } from '@/data/repositories/projectRepository';
import { UserProfile, SalesScript } from '@/domain/types';

describe('Giao Dịch Bắt Buộc & Tri Thức Script (Journey & Scripts)', () => {
  let leadRepo: LeadRepository;
  let projectRepo: ProjectRepository;

  const mockUser: UserProfile = {
    id: 'user-admin',
    email: 'admin@diaocvang.vn',
    full_name: 'Quản Trị Viên',
    phone: '0900000000',
    role: 'admin',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  beforeEach(() => {
    localStorage.clear();
    leadRepo = new LeadRepository();
    projectRepo = new ProjectRepository();
  });

  it('Chặn chuyển trạng thái Booking nếu thiếu mã Booking', async () => {
    const res = await leadRepo.updateLeadStageWithTransaction({
      leadId: 'lead-1',
      newStatus: 'booking',
      currentUser: mockUser,
      txCode: '', // Thiếu mã
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Mã Booking là bắt buộc');
  });

  it('Chặn chuyển trạng thái Đặt cọc nếu số tiền cọc <= 0 hoặc trống', async () => {
    const res = await leadRepo.updateLeadStageWithTransaction({
      leadId: 'lead-1',
      newStatus: 'deposit',
      currentUser: mockUser,
      txAmount: 0,
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Số tiền đặt cọc hợp lệ (> 0) là bắt buộc');
  });

  it('Chặn chuyển trạng thái Ký HĐMB nếu thiếu mã hợp đồng', async () => {
    const res = await leadRepo.updateLeadStageWithTransaction({
      leadId: 'lead-1',
      newStatus: 'contract',
      currentUser: mockUser,
      txCode: '',
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Mã hợp đồng (HĐMB) là bắt buộc');
  });

  it('Chuyển trạng thái Booking thành công khi có đủ mã Booking và tiền cọc', async () => {
    const res = await leadRepo.updateLeadStageWithTransaction({
      leadId: 'lead-1',
      newStatus: 'booking',
      currentUser: mockUser,
      txCode: 'BK-TEST-9999',
      txAmount: 50000000,
    });
    expect(res.success).toBe(true);

    const updated = await leadRepo.getLeadById('lead-1');
    expect(updated?.status).toBe('booking');
  });

  it('Tự động parse các dòng Nhãn: nội dung khi lưu tóm tắt văn bản dự án', async () => {
    const projectId = '33333333-1111-1111-1111-111111111111';
    const sampleText = `Vị trí: 123 Nguyễn Thị Thập, Quận 7
Loại hình: Shophouse thương mại
Giá: 85 - 120 triệu/m²
Pháp lý: Sổ đỏ từng căn
Tiến độ: Bàn giao quý 1/2027
Chính sách: Chiết khấu 9% khi thanh toán sớm
Điểm nhấn: Mặt tiền đại lộ thương mại sầm uất`;

    const updated = await projectRepo.updateKnowledgeSummary(projectId, sampleText);
    expect(updated.location).toBe('123 Nguyễn Thị Thập, Quận 7');
    expect(updated.property_type).toBe('Shophouse thương mại');
    expect(updated.price_range).toBe('85 - 120 triệu/m²');
    expect(updated.legal).toBe('Sổ đỏ từng căn');
    expect(updated.policy).toBe('Chiết khấu 9% khi thanh toán sớm');
  });

  it('Khi tóm tắt dự án thay đổi: Script Tự động cập nhật, Script Tùy chỉnh giữ nguyên', async () => {
    const projectId = '33333333-1111-1111-1111-111111111111';
    const scripts = await projectRepo.getSalesScripts(projectId);
    const newScript = scripts.find(s => s.status === 'new')!;

    // Biên soạn script Tùy chỉnh
    const customContent = 'Nội dung riêng biệt do Sale tự biên soạn - Không được ghi đè!';
    await projectRepo.saveSalesScript({
      ...newScript,
      content: customContent,
    });

    // Thay đổi tóm tắt dự án
    await projectRepo.updateKnowledgeSummary(projectId, 'Vị trí: Thủ Thiêm, TP. Thủ Đức\nGiá: 180 triệu/m²');

    const refreshedScripts = await projectRepo.getSalesScripts(projectId);
    const customScriptRefreshed = refreshedScripts.find(s => s.status === 'new')!;
    const autoScriptRefreshed = refreshedScripts.find(s => s.status === 'contacted')!;

    // Script Tùy chỉnh vẫn giữ nguyên nội dung
    expect(customScriptRefreshed.content).toBe(customContent);
    expect(customScriptRefreshed.is_edited).toBe(true);

    // Script Tự động được làm mới
    expect(autoScriptRefreshed.content).toContain('Thủ Thiêm');
  });
});
