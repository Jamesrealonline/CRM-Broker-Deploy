import { describe, it, expect, beforeEach } from 'vitest';
import { ContractRepository } from '@/data/repositories/contractRepository';
import { ProjectRepository } from '@/data/repositories/projectRepository';
import { INITIAL_TRANSACTIONS, INITIAL_PROJECTS, INITIAL_AGENCIES } from '@/data/mockData';

describe('Quản Lý Hợp Đồng, Hiệu Suất Sàn & Bảng Thi Đua (Financials & Competitions)', () => {
  let contractRepo: ContractRepository;
  let projectRepo: ProjectRepository;

  beforeEach(() => {
    localStorage.clear();
    contractRepo = new ContractRepository();
    projectRepo = new ProjectRepository();
  });

  describe('1. Module Thông tin Dự án, Hoa hồng & Sản phẩm đã bán', () => {
    it('Lấy danh sách dự án kèm tỷ lệ hoa hồng CĐT và Sale', async () => {
      const projects = await projectRepo.getProjects();
      expect(projects.length).toBeGreaterThan(0);
      const vhgp = projects.find(p => p.code === 'VHGP');
      expect(vhgp).toBeDefined();
      expect(vhgp?.commission_rate).toBe(3.5);
      expect(vhgp?.sale_commission_rate).toBe(1.8);
      expect(vhgp?.progressive_commission).toContain('Đạt >= 5 căn');
    });

    it('Cập nhật chính sách hoa hồng của dự án thành công', async () => {
      const projects = await projectRepo.getProjects();
      const firstProj = projects[0];
      const updated = await projectRepo.updateProjectCommission(
        firstProj.id,
        4.2,
        'Đạt >= 5 căn: +0.5%',
        2.1
      );
      expect(updated.commission_rate).toBe(4.2);
      expect(updated.sale_commission_rate).toBe(2.1);
      expect(updated.progressive_commission).toBe('Đạt >= 5 căn: +0.5%');
    });

    it('Tính toán hiệu suất tài chính dự án và danh sách sản phẩm bán được', async () => {
      const stats = await projectRepo.getProjectFinancialStats('33333333-1111-1111-1111-111111111111');
      expect(stats.total_contracts).toBeGreaterThanOrEqual(1);
      expect(stats.total_revenue).toBeGreaterThan(0);
      expect(stats.total_commission).toBeGreaterThan(0);
      expect(stats.sold_products.length).toBe(stats.total_contracts);
      expect(stats.sold_products[0].unit_code).toBeDefined();
    });
  });

  describe('2. Giao dịch & Hợp đồng Khách hàng (Cọc, Ký HĐMB, Đóng tiền Đợt 1)', () => {
    it('Tạo hợp đồng giao dịch mới với đầy đủ tính toán hoa hồng Sàn & Sale', async () => {
      const newContract = await contractRepo.createContractTransaction({
        lead_id: 'lead-test-01',
        unit_code: 'OG-S9.02-18.04',
        deal_value: 4000000000,
        contract_code: 'HĐMB-2026-TEST',
        sale_commission_rate: 2.0,
        first_installment_paid: false,
      });

      expect(newContract.id).toBeDefined();
      expect(newContract.deal_value).toBe(4000000000);
      expect(newContract.commission_amount).toBe(140000000); // 3.5% của 4 tỷ
      expect(newContract.sale_commission_amount).toBe(80000000); // 2.0% của 4 tỷ
      expect(newContract.first_installment_paid).toBe(false);
      expect(newContract.first_installment_amount).toBe(400000000); // 10% của 4 tỷ
    });

    it('Cập nhật tiến độ đóng tiền Đợt 1 cho hợp đồng giao dịch', async () => {
      const created = await contractRepo.createContractTransaction({
        lead_id: 'lead-test-02',
        unit_code: 'OG-S10.01-05.02',
        deal_value: 3000000000,
        first_installment_paid: false,
      });

      const updated = await contractRepo.updateContractMilestone(created.id, {
        first_installment_paid: true,
        notes: 'Đã thanh toán đủ đợt 1 qua Vietcombank',
      });
      expect(updated).toBe(true);

      const all = await contractRepo.getTransactions({ search: 'OG-S10.01-05.02' });
      expect(all.length).toBe(1);
      expect(all[0].first_installment_paid).toBe(true);
      expect(all[0].notes).toBe('Đã thanh toán đủ đợt 1 qua Vietcombank');
    });

    it('Lọc hợp đồng theo từng dự án hoặc trạng thái', async () => {
      const txs = await contractRepo.getTransactions({ type: 'contract' });
      expect(txs.every(t => t.type === 'contract')).toBe(true);
    });
  });

  describe('3. Doanh số & Hoa hồng của Sale theo từng hợp đồng', () => {
    it('Tổng hợp đúng doanh số và hoa hồng theo từng hợp đồng của sale', async () => {
      const res = await contractRepo.getSaleCommissions('aaaaaaaa-6666-1111-1111-111111111111');
      expect(res.totalContracts).toBeGreaterThanOrEqual(1);
      expect(res.totalRevenue).toBeGreaterThan(0);
      expect(res.totalCommission).toBeGreaterThan(0);
      expect(res.transactions.every(t => t.type === 'contract')).toBe(true);
    });
  });

  describe('4. Hiệu suất của các Sàn Giao Dịch', () => {
    it('Lấy chi tiết hiệu suất sàn gồm nhân sự, vai trò, leads theo tình trạng chăm sóc và doanh số', async () => {
      const agencyDetail = await contractRepo.getAgencyPerformanceDetail('22222222-1111-1111-1111-111111111111');
      expect(agencyDetail.agency_id).toBe('22222222-1111-1111-1111-111111111111');
      expect(agencyDetail.agency_name).toBeDefined();
      expect(agencyDetail.total_members).toBeGreaterThan(0);
      expect(agencyDetail.members.length).toBe(agencyDetail.total_members);
      expect(agencyDetail.lead_status_counts).toBeDefined();
      expect(agencyDetail.lead_status_counts.contract).toBeGreaterThanOrEqual(0);
      expect(agencyDetail.total_revenue).toBeGreaterThanOrEqual(0);
      expect(agencyDetail.total_commission).toBeGreaterThanOrEqual(0);
    });
  });

  describe('5. Bảng Thi Đua Doanh Số, HĐMB & Hoa Hồng (Leaderboards)', () => {
    it('Xếp hạng thi đua giữa các Sàn giao dịch với Top 1 doanh số cao nhất', async () => {
      const rankings = await contractRepo.getLeaderboard({ type: 'agency' });
      expect(rankings.length).toBeGreaterThan(0);
      expect(rankings[0].rank).toBe(1);
      // Đảm bảo được sắp xếp giảm dần theo doanh số
      for (let i = 0; i < rankings.length - 1; i++) {
        expect(rankings[i].revenue).toBeGreaterThanOrEqual(rankings[i + 1].revenue);
      }
    });

    it('Xếp hạng thi đua giữa các Chuyên viên tư vấn (Sale Agents)', async () => {
      const rankings = await contractRepo.getLeaderboard({ type: 'sale_agent' });
      expect(rankings.length).toBeGreaterThan(0);
      expect(rankings[0].revenue).toBeGreaterThan(0);
      expect(rankings[0].contracts_count).toBeGreaterThan(0);
      expect(rankings[0].commission).toBeGreaterThan(0);
    });

    it('Hỗ trợ lọc thi đua theo từng dự án cụ thể', async () => {
      const allRankings = await contractRepo.getLeaderboard({ type: 'agency' });
      const filteredRankings = await contractRepo.getLeaderboard({
        type: 'agency',
        projectId: '33333333-1111-1111-1111-111111111111',
      });

      expect(allRankings).toBeDefined();
      expect(filteredRankings).toBeDefined();
    });
  });
});
