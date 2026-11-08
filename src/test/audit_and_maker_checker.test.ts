import { describe, it, expect, beforeEach } from 'vitest';
import { AuditRepository } from '@/data/repositories/auditRepository';
import { ContractRepository } from '@/data/repositories/contractRepository';
import { UserProfile, Transaction } from '@/domain/types';

describe('P1.2 Audit Log Append-Only (Hash Chain) & Maker-Checker Giao Dịch', () => {
  let auditRepo: AuditRepository;
  let contractRepo: ContractRepository;

  const mockMakerSalesManager: UserProfile = {
    id: 'user-maker-sm-01',
    organization_id: 'org-01',
    email: 'manager.hung@crm-broker.vn',
    full_name: 'Nguyễn Văn Hùng (Trưởng Phòng)',
    phone: '0901234567',
    role: 'sales_manager',
    status: 'active',
    must_change_password: false,
    totp_enabled: true,
    created_at: new Date().toISOString(),
  };

  const mockCheckerDirector: UserProfile = {
    id: 'user-checker-dir-02',
    organization_id: 'org-01',
    email: 'director.nam@crm-broker.vn',
    full_name: 'Trần Hải Nam (Giám Đốc Khối)',
    phone: '0902345678',
    role: 'director',
    status: 'active',
    must_change_password: false,
    totp_enabled: true,
    created_at: new Date().toISOString(),
  };

  const mockSaleAgent: UserProfile = {
    id: 'user-sale-03',
    organization_id: 'org-01',
    email: 'sale.hoa@crm-broker.vn',
    full_name: 'Lê Thị Hoa (Chuyên Viên)',
    phone: '0903456789',
    role: 'sale_agent',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    localStorage.clear();
    auditRepo = new AuditRepository();
    contractRepo = new ContractRepository();
  });

  describe('1. Audit Log Append-Only & Hash Chain (Toàn Vẹn Kiểm Toán)', () => {
    it('Mỗi bản ghi log mới đều được sinh prev_hash và current_hash chuẩn SHA-256', async () => {
      const log1 = await auditRepo.logAction('user-01', 'Admin', 'login', { ip: '127.0.0.1' });
      expect(log1.current_hash).toBeDefined();
      expect(log1.current_hash?.length).toBe(64);
      expect(log1.prev_hash).toBe('0000000000000000000000000000000000000000000000000000000000000000');
    });

    it('Chuỗi liên kết các bản ghi audit (Hash Chaining) liên tục và hợp lệ', async () => {
      const log1 = await auditRepo.logAction('user-01', 'Admin', 'action_1');
      const log2 = await auditRepo.logAction('user-01', 'Admin', 'action_2');
      const log3 = await auditRepo.logAction('user-01', 'Admin', 'action_3');

      // Hash của log trước phải được làm prev_hash của log kế tiếp
      expect(log2.prev_hash).toBe(log1.current_hash);
      expect(log3.prev_hash).toBe(log2.current_hash);

      const verification = await auditRepo.verifyAuditLogChain();
      expect(verification.isValid).toBe(true);
      expect(verification.totalLogs).toBe(3);
    });

    it('Phát hiện ngay lập tức hành vi sửa đổi nội dung nhật ký kiểm toán (Tamper Detection)', async () => {
      await auditRepo.logAction('user-01', 'Admin', 'action_1');
      await auditRepo.logAction('user-01', 'Admin', 'action_2');
      await auditRepo.logAction('user-01', 'Admin', 'action_3');

      // Giả lập kẻ gian sửa đổi nội dung bản ghi action_2 trong database/storage
      const logs = JSON.parse(localStorage.getItem('crm_audit_logs') || '[]');
      logs[1].action = 'action_tampered_malicious';
      localStorage.setItem('crm_audit_logs', JSON.stringify(logs));

      // Quét kiểm tra toàn vẹn
      const verification = await auditRepo.verifyAuditLogChain();
      expect(verification.isValid).toBe(false);
      expect(verification.brokenAtId).toBe(logs[1].id);
    });

    it('Chặn đứng mọi phương thức sửa hoặc xóa trên bảng audit_logs', async () => {
      await expect(auditRepo.updateLog()).rejects.toThrow('Bảo mật kiểm toán nghiêm ngặt: Bảng audit_logs là append-only');
      await expect(auditRepo.deleteLog()).rejects.toThrow('Bảo mật kiểm toán nghiêm ngặt: Bảng audit_logs là append-only');
    });
  });

  describe('2. Maker-Checker: Phê Duyệt Hợp Đồng & Hoa Hồng', () => {
    it('Chặn Maker tự duyệt hợp đồng do chính mình tạo ra (Maker != Checker)', async () => {
      // 1. Maker (Trưởng phòng Hùng) tạo hợp đồng mới
      const newContract = await contractRepo.createContractTransaction({
        lead_id: 'lead-01',
        project_id: 'proj-01',
        code: 'HD-TEST-001',
        deal_value: 3500000000,
        amount: 3500000000,
        unit_code: 'A-12.05',
        created_by: mockMakerSalesManager.id,
      });

      // 2. Trưởng phòng Hùng cố tình tự duyệt hợp đồng của chính mình -> Phải bị từ chối
      await expect(
        contractRepo.approveContractTransaction(newContract.id, mockMakerSalesManager)
      ).rejects.toThrow('Maker-Checker vi phạm: Người lập hợp đồng/hoa hồng không được phép tự duyệt cho chính mình.');
    });

    it('Người duyệt độc lập (Checker) duyệt thành công và ghi nhận lịch sử kiểm toán', async () => {
      const newContract = await contractRepo.createContractTransaction({
        lead_id: 'lead-02',
        project_id: 'proj-01',
        code: 'HD-TEST-002',
        deal_value: 4000000000,
        created_by: mockMakerSalesManager.id,
      });

      // Giám đốc Nam (Checker độc lập) phê duyệt
      const approveRes = await contractRepo.approveContractTransaction(newContract.id, mockCheckerDirector);
      expect(approveRes.success).toBe(true);
      expect(approveRes.transaction?.approval_status).toBe('approved');
      expect(approveRes.transaction?.approved_by).toBe(mockCheckerDirector.id);

      // Kiểm tra ghi nhận audit_log
      const auditLogs = JSON.parse(localStorage.getItem('crm_audit_logs') || '[]');
      const lastAudit = auditLogs.find((l: any) => l.action === 'contract_approved');
      expect(lastAudit).toBeDefined();
      expect(lastAudit.actor_id).toBe(mockCheckerDirector.id);
    });

    it('Vai trò không có thẩm quyền (Sale Agent) không thể phê duyệt hợp đồng', async () => {
      const newContract = await contractRepo.createContractTransaction({
        lead_id: 'lead-03',
        project_id: 'proj-01',
        code: 'HD-TEST-003',
        created_by: mockMakerSalesManager.id,
      });

      await expect(
        contractRepo.approveContractTransaction(newContract.id, mockSaleAgent)
      ).rejects.toThrow('không có quyền phê duyệt hợp đồng/hoa hồng');
    });

    it('Khóa sửa đổi giá trị hợp đồng khi đã được phê duyệt', async () => {
      const newContract = await contractRepo.createContractTransaction({
        lead_id: 'lead-04',
        project_id: 'proj-01',
        code: 'HD-TEST-004',
        deal_value: 5000000000,
        created_by: mockMakerSalesManager.id,
      });

      // Phê duyệt hợp đồng
      await contractRepo.approveContractTransaction(newContract.id, mockCheckerDirector);

      // Cố tình sửa giá trị deal_value của hợp đồng đã duyệt -> Bị chặn
      await expect(
        contractRepo.updateContractMilestone(newContract.id, {
          deal_value: 6000000000,
        })
      ).rejects.toThrow('Hợp đồng đã được phê duyệt và bị khóa sửa đổi giá trị tài chính');
    });
  });

  describe('3. Chặn Xóa Giao Dịch Đã Xác Nhận & Tạo Giao Dịch Bù Trừ (Reversal)', () => {
    it('Chặn đứng hành vi xóa giao dịch tài chính đã confirmed hoặc approved', async () => {
      const contract = await contractRepo.createContractTransaction({
        lead_id: 'lead-05',
        code: 'HD-TEST-005',
        status: 'confirmed',
      });

      await expect(
        contractRepo.deleteTransaction(contract.id)
      ).rejects.toThrow('Giao dịch tài chính đã xác nhận/phê duyệt bị khóa xóa. Vui lòng lập giao dịch bù trừ (offsetting/reversal).');
    });

    it('Tạo giao dịch bù trừ (Reversal Transaction) với giá trị âm đối ứng chính xác', async () => {
      const originalTx = await contractRepo.createContractTransaction({
        lead_id: 'lead-06',
        project_id: 'proj-01',
        project_name: 'Vinhomes Grand Park',
        code: 'HD-TEST-006',
        amount: 100000000,
        deal_value: 2000000000,
        commission_amount: 70000000,
        unit_code: 'S1-05.02',
        status: 'confirmed',
      });

      // Lập giao dịch bù trừ (hủy cọc do khách đổi ý)
      const reversalTx = await contractRepo.createReversalTransaction(
        originalTx.id,
        'Khách hàng rút cọc do chuyển công tác nước ngoài',
        mockCheckerDirector
      );

      expect(reversalTx.id).toBeDefined();
      expect(reversalTx.is_reversal).toBe(true);
      expect(reversalTx.reversal_of_id).toBe(originalTx.id);
      expect(reversalTx.amount).toBe(-100000000);
      expect(reversalTx.deal_value).toBe(-2000000000);
      expect(reversalTx.commission_amount).toBe(-70000000);
      expect(reversalTx.code).toBe('REV-HD-TEST-006');

      // Chặn tạo bù trừ đè lên một giao dịch bù trừ
      await expect(
        contractRepo.createReversalTransaction(reversalTx.id, 'Thử bù trừ lần 2', mockCheckerDirector)
      ).rejects.toThrow('Không thể tạo giao dịch bù trừ trên một giao dịch đã là bù trừ.');
    });
  });
});
