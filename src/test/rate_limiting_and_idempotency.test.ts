import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, assertRateLimit, clearRateLimits } from '@/lib/rateLimiter';
import { LeadRepository } from '@/data/repositories/leadRepository';
import { ContractRepository } from '@/data/repositories/contractRepository';
import { UserProfile } from '@/domain/types';

describe('P1.3 Rate Limiting & Idempotency Toàn Diện (Edge & API Hardening)', () => {
  let leadRepo: LeadRepository;
  let contractRepo: ContractRepository;

  const mockUser: UserProfile = {
    id: 'user-rate-test-01',
    organization_id: 'org-01',
    email: 'test.rate@crm-broker.vn',
    full_name: 'Trần Kiểm Thử Tải',
    phone: '0901999888',
    role: 'sales_manager',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    localStorage.clear();
    clearRateLimits();
    leadRepo = new LeadRepository();
    contractRepo = new ContractRepository();
  });

  describe('1. Sliding Window Rate Limiter Cơ Bản', () => {
    it('Cho phép các request trong ngưỡng limit và giảm dần remaining', () => {
      const res1 = checkRateLimit('user-1', 'test-endpoint', 3, 10000);
      expect(res1.allowed).toBe(true);
      expect(res1.remaining).toBe(2);

      const res2 = checkRateLimit('user-1', 'test-endpoint', 3, 10000);
      expect(res2.allowed).toBe(true);
      expect(res2.remaining).toBe(1);

      const res3 = checkRateLimit('user-1', 'test-endpoint', 3, 10000);
      expect(res3.allowed).toBe(true);
      expect(res3.remaining).toBe(0);

      // Request thứ 4 vượt ngưỡng
      const res4 = checkRateLimit('user-1', 'test-endpoint', 3, 10000);
      expect(res4.allowed).toBe(false);
      expect(res4.remaining).toBe(0);
      expect(res4.resetTimeMs).toBeGreaterThan(0);
    });

    it('assertRateLimit ném lỗi HTTP 429 khi bị vượt ngưỡng', () => {
      for (let i = 0; i < 5; i++) {
        checkRateLimit('user-2', 'api/heavy-action', 5, 60000);
      }

      expect(() => {
        assertRateLimit('user-2', 'api/heavy-action', 5, 60000);
      }).toThrow('HTTP 429 Too Many Requests');
    });
  });

  describe('2. Idempotency Key Trên Tạo Lead Mới', () => {
    it('Tạo lead với idempotencyKey: Gọi lại lần 2 trả về kết quả đã cache, không tạo duplicate lead', async () => {
      const idempotencyKey = 'lead-idem-uuid-001';

      // Lần gọi 1: Tạo lead mới
      const res1 = await leadRepo.createLead({
        fullName: 'Nguyễn Văn Nhất Quán',
        phone: '0981112233',
        projectId: 'proj-01',
        currentUser: mockUser,
        idempotencyKey,
      });

      expect(res1.success).toBe(true);
      expect(res1.lead?.id).toBeDefined();

      // Kiểm tra trong database mock chỉ có 1 lead mới
      const listBefore = JSON.parse(localStorage.getItem('crm_leads') || '[]');
      const countBefore = listBefore.filter((l: any) => l.customer_phone === '0981112233').length;
      expect(countBefore).toBe(1);

      // Lần gọi 2: Gửi lại cùng idempotencyKey và payload
      const res2 = await leadRepo.createLead({
        fullName: 'Nguyễn Văn Nhất Quán',
        phone: '0981112233',
        projectId: 'proj-01',
        currentUser: mockUser,
        idempotencyKey,
      });

      expect(res2.success).toBe(true);
      expect(res2.lead?.id).toBe(res1.lead?.id);

      // Không có bản ghi nào bị tạo thêm (Không trùng lead)
      const listAfter = JSON.parse(localStorage.getItem('crm_leads') || '[]');
      const countAfter = listAfter.filter((l: any) => l.customer_phone === '0981112233').length;
      expect(countAfter).toBe(1);
    });

    it('Phát hiện xung đột (Conflict) khi dùng cùng idempotencyKey cho payload khác nhau', async () => {
      const idempotencyKey = 'lead-idem-uuid-conflict';

      await leadRepo.createLead({
        fullName: 'Khách A',
        phone: '0982223344',
        projectId: 'proj-01',
        currentUser: mockUser,
        idempotencyKey,
      });

      // Gửi lại cùng idempotencyKey nhưng đổi tên khách sang Khách B (payload khác)
      await expect(
        leadRepo.createLead({
          fullName: 'Khách B (Đổi payload)',
          phone: '0982223344',
          projectId: 'proj-01',
          currentUser: mockUser,
          idempotencyKey,
        })
      ).rejects.toThrow('Idempotency Key conflict');
    });
  });

  describe('3. Idempotency Key Trên Giao Dịch Hợp Đồng Tài Chính', () => {
    it('Chống tạo trùng lặp hợp đồng tài chính khi client retry với cùng idempotencyKey', async () => {
      const idempotencyKey = 'tx-idem-uuid-002';

      // Lần 1: Tạo giao dịch
      const tx1 = await contractRepo.createContractTransaction({
        lead_id: 'lead-idem-1',
        amount: 500000000,
        deal_value: 5000000000,
        code: 'HD-IDEM-001',
        created_by: mockUser.id,
        idempotencyKey,
      });

      expect(tx1.id).toBeDefined();

      const txsBefore = JSON.parse(localStorage.getItem('crm_transactions') || '[]');
      const countBefore = txsBefore.filter((t: any) => t.code === 'HD-IDEM-001').length;
      expect(countBefore).toBe(1);

      // Lần 2: Client mạng lag gửi lại
      const tx2 = await contractRepo.createContractTransaction({
        lead_id: 'lead-idem-1',
        amount: 500000000,
        deal_value: 5000000000,
        code: 'HD-IDEM-001',
        created_by: mockUser.id,
        idempotencyKey,
      });

      expect(tx2.id).toBe(tx1.id);

      const txsAfter = JSON.parse(localStorage.getItem('crm_transactions') || '[]');
      const countAfter = txsAfter.filter((t: any) => t.code === 'HD-IDEM-001').length;
      expect(countAfter).toBe(1); // Không nhân đôi giao dịch
    });
  });

  describe('4. Rate Limiting Cưỡng Chế Trên Tạo Giao Dịch', () => {
    it('Vượt quá 20 giao dịch / phút bị chặn đứng bởi Rate Limiter', async () => {
      // Giả lập gửi liên tục 20 giao dịch hợp lệ
      for (let i = 0; i < 20; i++) {
        await contractRepo.createContractTransaction({
          lead_id: `lead-bulk-${i}`,
          amount: 10000000,
          created_by: mockUser.id,
        });
      }

      // Lần thứ 21 phải bị ném lỗi HTTP 429
      await expect(
        contractRepo.createContractTransaction({
          lead_id: 'lead-bulk-21',
          amount: 10000000,
          created_by: mockUser.id,
        })
      ).rejects.toThrow('HTTP 429 Too Many Requests');
    });
  });
});
