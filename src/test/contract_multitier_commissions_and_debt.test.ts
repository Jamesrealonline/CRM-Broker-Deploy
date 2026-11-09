import { describe, it, expect, beforeEach } from 'vitest';
import { contractRepository } from '@/data/repositories/contractRepository';
import { UserProfile } from '@/domain/types';

describe('Giai đoạn 3: Hợp Đồng, Hoa Hồng Đa Tầng, Vòng Đời Hợp Đồng & Công Nợ', () => {
  const saleUser1: UserProfile = {
    id: 'sale-001',
    full_name: 'Nguyễn Văn Sale 1',
    email: 'sale1@diaocvang.vn',
    phone: '0901234567',
    role: 'sale_agent',
    agency_id: 'agency-1',
    team_id: 'team-1',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const saleUser2: UserProfile = {
    id: 'sale-002',
    full_name: 'Trần Thị CoSale',
    email: 'cosale@diaocvang.vn',
    phone: '0901234568',
    role: 'sale_agent',
    agency_id: 'agency-1',
    team_id: 'team-1',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const managerUser: UserProfile = {
    id: 'mgr-001',
    full_name: 'Trưởng Phòng Kinh Doanh',
    email: 'manager@diaocvang.vn',
    phone: '0901234569',
    role: 'sales_manager',
    agency_id: 'agency-1',
    team_id: 'team-1',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. Hoa Hồng Đa Tầng (Snapshot) & Đồng Sale (Co-sale)', () => {
    it('Tính toán snapshot hoa hồng đa tầng chính xác (Sàn, Sale, Trưởng nhóm, Trưởng phòng, Giám đốc)', () => {
      const dealValue = 3000000000; // 3 tỷ
      const snapshot = contractRepository.calculateMultiTierCommissions({
        dealValue,
        agencyRate: 3.0, // 3%
        saleRate: 1.2,   // 1.2%
      });

      expect(snapshot.agencyAmount).toBe(90000000); // 90 triệu
      expect(snapshot.saleAmount).toBe(36000000);   // 36 triệu
      expect(snapshot.teamLeaderAmount).toBe(6000000); // 0.2% = 6 triệu
      expect(snapshot.salesManagerAmount).toBe(3000000); // 0.1% = 3 triệu
      expect(snapshot.directorAmount).toBe(3000000); // 0.1% = 3 triệu
      expect(snapshot.policyVersion).toBe('2026.v1');
    });

    it('Phân bổ hoa hồng Đồng Sale (Co-sale) chuẩn xác: tổng phần chia sale = 100% phần hoa hồng sale', () => {
      const dealValue = 5000000000; // 5 tỷ
      // Sale 1.5% = 75 triệu, chia Co-sale 40% (30 triệu) và Sale chính 60% (45 triệu)
      const snapshot = contractRepository.calculateMultiTierCommissions({
        dealValue,
        agencyRate: 3.5,
        saleRate: 1.5,
        coSaleUserId: saleUser2.id,
        coSaleUserName: saleUser2.full_name,
        coSaleRate: 40,
      });

      expect(snapshot.saleAmount).toBe(45000000); // 60% của 75 triệu
      expect(snapshot.coSaleAmount).toBe(30000000); // 40% của 75 triệu
      expect(snapshot.saleAmount + (snapshot.coSaleAmount || 0)).toBe(75000000); // Khớp chính xác 100%
      expect(snapshot.coSaleUserId).toBe(saleUser2.id);
    });

    it('Chặn chuyên viên tư vấn vượt trần hoa hồng của dự án (>2.0%), chỉ Quản lý mới được override kèm lý do', async () => {
      // 1. Sale cố tình tăng % hoa hồng lên 2.5%
      await expect(
        contractRepository.createContractWithCustomer({
          projectId: 'proj-1',
          unitCode: 'CAN-RATE-01',
          customerName: 'Khách Test Rate',
          customerPhone: '0912345678',
          dealValue: 2000000000,
          saleCommissionRate: 2.5,
          currentUser: saleUser1,
        })
      ).rejects.toThrow('forbidden_rate: Chuyên viên tư vấn không được phép vượt tỷ lệ hoa hồng tối đa (2.0%) của dự án!');

      // 2. Manager tăng lên 2.5% nhưng không nhập lý do
      await expect(
        contractRepository.createContractWithCustomer({
          projectId: 'proj-1',
          unitCode: 'CAN-RATE-02',
          customerName: 'Khách Test Rate 2',
          customerPhone: '0912345679',
          dealValue: 2000000000,
          saleCommissionRate: 2.5,
          currentUser: managerUser,
        })
      ).rejects.toThrow('missing_override_reason: Bắt buộc nhập lý do phê duyệt khi điều chỉnh hoa hồng vượt định mức!');

      // 3. Manager tăng lên 2.5% kèm lý do hợp lệ -> Thành công
      const res = await contractRepository.createContractWithCustomer({
        projectId: 'proj-1',
        unitCode: 'CAN-RATE-03',
        customerName: 'Khách Test Rate 3',
        customerPhone: '0912345680',
        dealValue: 2000000000,
        saleCommissionRate: 2.5,
        overrideReason: 'Dự án áp dụng chính sách thưởng nóng tuần khai xuân cho căn đặc biệt',
        currentUser: managerUser,
      });

      expect(res.success).toBe(true);
      expect(res.deal_value).toBe(2000000000);
    });
  });

  describe('2. Lịch Thanh Toán Các Đợt & Sổ Cái Hoa Hồng Kèm Khấu Trừ Thuế TNCN', () => {
    it('Tạo đầy đủ 6 đợt thanh toán có tổng bằng chính xác giá trị hợp đồng', async () => {
      const dealVal = 4000000000; // 4 tỷ
      const res = await contractRepository.createContractWithCustomer({
        projectId: 'proj-1',
        unitCode: 'CAN-INST-01',
        customerName: 'Khách Lịch Trình',
        customerPhone: '0988888881',
        dealValue: dealVal,
        firstInstallmentPaid: true,
        receiptCode: 'PT-TEST-01',
        currentUser: saleUser1,
      });

      const installments = await contractRepository.getContractInstallments(res.transaction_id);
      expect(installments.length).toBe(6);

      const totalInst = installments.reduce((acc, cur) => acc + cur.amount, 0);
      expect(totalInst).toBe(dealVal);

      // Đợt 1 được đánh dấu đã thanh toán
      expect(installments[0].status).toBe('paid');
      expect(installments[0].paid_amount).toBe(installments[0].amount);
      expect(installments[0].receipt_code).toBe('PT-TEST-01');

      // Đợt 2 ở trạng thái chờ
      expect(installments[1].status).toBe('pending');
      expect(installments[1].paid_amount).toBe(0);
    });

    it('Tạo các bút toán hoa hồng (Commission Ledger) và khấu trừ thuế TNCN 10%', async () => {
      const res = await contractRepository.createContractWithCustomer({
        projectId: 'proj-1',
        unitCode: 'CAN-COMM-01',
        customerName: 'Khách Bút Toán',
        customerPhone: '0988888882',
        dealValue: 2000000000, // 2 tỷ
        saleCommissionRate: 1.5, // 30 triệu
        currentUser: saleUser1,
      });

      const ledger = await contractRepository.getCommissionLedger(res.transaction_id);
      expect(ledger.length).toBeGreaterThanOrEqual(4); // Sale, Team Leader, Sales Manager, Director

      const saleEntry = ledger.find(e => e.recipient_role === 'sale_agent')!;
      expect(saleEntry.amount).toBe(30000000); // 30 triệu
      expect(saleEntry.pit_tax_percent).toBe(10);
      expect(saleEntry.pit_tax_amount).toBe(3000000); // 10% = 3 triệu
      expect(saleEntry.net_payable_amount).toBe(27000000); // Thực nhận = 27 triệu
      expect(saleEntry.status).toBe('pending_eligibility');
    });
  });

  describe('3. Vòng Đời Hợp Đồng, Maker-Checker & Thu Hồi Hoa Hồng (Clawback)', () => {
    it('Chặn người tạo yêu cầu điều chỉnh hợp đồng tự duyệt cho chính mình (Maker-Checker Violation)', async () => {
      const contract = await contractRepository.createContractWithCustomer({
        projectId: 'proj-1',
        unitCode: 'CAN-REV-01',
        customerName: 'Khách Đổi Căn',
        customerPhone: '0988888883',
        dealValue: 2500000000,
        currentUser: managerUser,
      });

      // Manager tạo yêu cầu đổi căn
      const rev = await contractRepository.requestContractRevision({
        contractId: contract.transaction_id,
        revisionType: 'unit_change',
        newData: { unit_code: 'CAN-REV-02' },
        reason: 'Khách hàng đổi ý muốn chuyển sang căn tầng cao view hồ',
        currentUser: managerUser,
      });

      expect(rev.status).toBe('pending');

      // Manager cố tình tự duyệt cho yêu cầu của chính mình
      await expect(
        contractRepository.approveContractRevision({
          revisionId: rev.id,
          approverUser: managerUser,
          action: 'approved',
        })
      ).rejects.toThrow('maker_checker_violation: Người tạo yêu cầu không được phép tự duyệt!');
    });

    it('Duyệt hủy hợp đồng (cancellation) tự động giải phóng căn và sinh bút toán Clawback âm', async () => {
      const contract = await contractRepository.createContractWithCustomer({
        projectId: 'proj-1',
        unitCode: 'CAN-CANCEL-01',
        customerName: 'Khách Hủy Cọc',
        customerPhone: '0988888884',
        dealValue: 3000000000,
        currentUser: saleUser1,
      });

      // Sale yêu cầu hủy hợp đồng
      const rev = await contractRepository.requestContractRevision({
        contractId: contract.transaction_id,
        revisionType: 'cancellation',
        reason: 'Khách hàng gặp sự cố tài chính đột xuất, không thể tiếp tục thực hiện hợp đồng',
        currentUser: saleUser1,
      });

      // Manager phê duyệt hủy hợp đồng
      const approveRes = await contractRepository.approveContractRevision({
        revisionId: rev.id,
        approverUser: managerUser,
        action: 'approved',
        notes: 'Đã xác nhận biên bản hủy với chủ đầu tư',
      });

      expect(approveRes.success).toBe(true);

      // 1. Kiểm tra trạng thái hợp đồng đã thành 'cancelled'
      const txs = await contractRepository.getTransactions();
      const updatedTx = txs.find(t => t.id === contract.transaction_id)!;
      expect(updatedTx.status).toBe('cancelled');

      // 2. Kiểm tra bút toán Clawback âm trong sổ cái hoa hồng
      const ledger = await contractRepository.getCommissionLedger(contract.transaction_id);
      const clawbacks = ledger.filter(e => e.status === 'clawback');
      expect(clawbacks.length).toBeGreaterThanOrEqual(1);

      // Bút toán clawback của sale phải mang giá trị âm
      const saleClawback = clawbacks.find(e => e.recipient_role === 'sale_agent')!;
      expect(saleClawback.amount).toBeLessThan(0);
      expect(saleClawback.clawback_source_id).toBeDefined();
    });
  });

  describe('4. Báo Cáo Aging Công Nợ & Đối Soát Sao Kê Ngân Hàng', () => {
    it('Phân loại tuổi nợ chính xác (Chưa đến hạn, 1-30 ngày, 31-60 ngày, >60 ngày)', async () => {
      const contract = await contractRepository.createContractWithCustomer({
        projectId: 'proj-aging',
        unitCode: 'CAN-AGING-01',
        customerName: 'Khách Công Nợ',
        customerPhone: '0988888885',
        dealValue: 1000000000, // 1 tỷ
        firstInstallmentPaid: false, // Chưa thanh toán
        currentUser: saleUser1,
      });

      // Giả lập một đợt quá hạn 40 ngày (rơi vào nhóm 31-60 ngày)
      const installments = await contractRepository.getContractInstallments(contract.transaction_id);
      installments[1].due_date = new Date(Date.now() - 40 * 86400000).toISOString();
      localStorage.setItem('crm_contract_installments', JSON.stringify(installments));

      const agingReports = await contractRepository.getDebtAgingReport('proj-aging');
      expect(agingReports.length).toBe(1);

      const report = agingReports[0];
      expect(report.aging.overdue31To60).toBe(installments[1].amount);
      expect(report.aging.totalReceivable).toBe(1000000000);
    });

    it('Đối soát sao kê ngân hàng tự động khớp phiếu thu và chặn mã giao dịch trùng lặp', async () => {
      const contract = await contractRepository.createContractWithCustomer({
        projectId: 'proj-bank',
        unitCode: 'CAN-BANK-01',
        customerName: 'Khách Chuyển Khoản',
        customerPhone: '0988888886',
        dealValue: 2000000000,
        firstInstallmentAmount: 200000000, // 200 triệu
        firstInstallmentPaid: false,
        contractCode: 'HDMB-BANK-99',
        currentUser: saleUser1,
      });

      // 1. Nhập sao kê ngân hàng khớp đúng số tiền và mã hợp đồng
      const reconRes = await contractRepository.reconcileBankStatement({
        statement: {
          bank_ref_code: 'VCB-20260301-8899',
          trans_date: new Date().toISOString(),
          amount: 200000000,
          description: 'KHACH HANG CHUYEN TIEN DOT 1 CAN-BANK-01 HDMB-BANK-99',
        },
        currentUser: managerUser,
      });

      expect(reconRes.matched).toBe(true);
      expect(reconRes.statement.status).toBe('matched');
      expect(reconRes.installment?.status).toBe('paid');

      // 2. Cố tình nhập lại cùng mã giao dịch ngân hàng -> Bị từ chối chống trùng
      await expect(
        contractRepository.reconcileBankStatement({
          statement: {
            bank_ref_code: 'VCB-20260301-8899',
            trans_date: new Date().toISOString(),
            amount: 200000000,
            description: 'KHACH HANG CHUYEN TIEN DOT 1 CAN-BANK-01 HDMB-BANK-99',
          },
          currentUser: managerUser,
        })
      ).rejects.toThrow('duplicate_statement: Mã giao dịch ngân hàng này đã được nhập trước đó!');
    });
  });
});
