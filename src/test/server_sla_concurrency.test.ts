import { describe, it, expect, beforeEach } from 'vitest';
import { AutoTransferService } from '@/domain/services/autoTransferService';
import { LeadRepository } from '@/data/repositories/leadRepository';
import { Lead, UserProfile } from '@/domain/types';

describe('P0.2 SLA 24H Chạy Server & Chống Trùng Khi Chạy Song Song (Concurrency Test)', () => {
  let autoService: AutoTransferService;
  let leadRepo: LeadRepository;

  const mockSales: UserProfile[] = [
    {
      id: 'sale-1',
      email: 'sale1@diaocvang.vn',
      full_name: 'Trần Thị Thu Thảo',
      phone: '0901111111',
      role: 'sale_agent',
      status: 'active',
      team_id: 'team-1',
      agency_id: 'agency-1',
      accepts_leads: true,
      on_leave: false,
      must_change_password: false,
      totp_enabled: false,
    },
    {
      id: 'sale-2',
      email: 'sale2@diaocvang.vn',
      full_name: 'Nguyễn Văn Nam',
      phone: '0902222222',
      role: 'sale_agent',
      status: 'active',
      team_id: 'team-1',
      agency_id: 'agency-1',
      accepts_leads: true,
      on_leave: false,
      must_change_password: false,
      totp_enabled: false,
    },
    {
      id: 'sale-on-leave',
      email: 'leave@diaocvang.vn',
      full_name: 'Lê Văn Nghỉ',
      phone: '0903333333',
      role: 'sale_agent',
      status: 'active',
      team_id: 'team-1',
      agency_id: 'agency-1',
      accepts_leads: true,
      on_leave: true, // Nghỉ phép -> Phải bỏ qua
      must_change_password: false,
      totp_enabled: false,
    },
    {
      id: 'sale-locked',
      email: 'locked@diaocvang.vn',
      full_name: 'Phạm Khóa',
      phone: '0904444444',
      role: 'sale_agent',
      status: 'locked', // Bị khóa -> Phải bỏ qua
      team_id: 'team-1',
      agency_id: 'agency-1',
      accepts_leads: true,
      on_leave: false,
      must_change_password: false,
      totp_enabled: false,
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    autoService = new AutoTransferService();
    leadRepo = new LeadRepository();
  });

  it('1. Chống chuyển lead trùng lặp khi 2 cron worker chạy song song (FOR UPDATE SKIP LOCKED Simulation)', async () => {
    const overdueLead: Lead = {
      id: 'lead-concurrency-1',
      customer_id: 'cust-1',
      customer_name: 'Khách Hàng Quá Hạn',
      customer_phone: '0901234567',
      project_id: 'proj-1',
      team_id: 'team-1',
      agency_id: 'agency-1',
      assigned_to: 'sale-1',
      assigned_name: 'Trần Thị Thu Thảo',
      status: 'qualifying',
      lead_score: 80,
      purpose: 'investment',
      created_at: new Date(Date.now() - 48 * 3600000).toISOString(),
      care_deadline_at: new Date(Date.now() - 2 * 3600000).toISOString(), // Quá hạn 2h
      auto_transfer_count: 0,
      previous_assigned_sales: [],
    };

    localStorage.setItem('crm_leads', JSON.stringify([overdueLead]));

    // 2 worker cùng quét lead-concurrency-1 song song
    const [resultWorker1, resultWorker2] = await Promise.all([
      autoService.runAutoTransferScan({
        allLeads: [overdueLead],
        allSales: mockSales,
        performedBy: 'Cron Worker 1',
      }),
      autoService.runAutoTransferScan({
        allLeads: [overdueLead],
        allSales: mockSales,
        performedBy: 'Cron Worker 2',
      }),
    ]);

    const totalTransferred = resultWorker1.transferredCount + resultWorker2.transferredCount;
    // Chỉ đúng 1 worker được xử lý chuyển lead, worker thứ hai SKIP LOCKED không chuyển lần thứ 2
    expect(totalTransferred).toBe(1);

    const history = await autoService.getLeadAssignmentHistory('lead-concurrency-1');
    expect(history.length).toBe(1);
    expect(history[0].to_sale_id).toBe('sale-2');
  });

  it('2. Vượt quá 3 lần chuyển không có chăm sóc -> Tự động đưa về Kho lead chung (Pool)', async () => {
    const thirdTimeOverdueLead: Lead = {
      id: 'lead-pool-test',
      customer_id: 'cust-pool',
      customer_name: 'Khách Đã Chuyển 3 Lần',
      customer_phone: '0919999999',
      project_id: 'proj-1',
      team_id: 'team-1',
      agency_id: 'agency-1',
      assigned_to: 'sale-2',
      assigned_name: 'Nguyễn Văn Nam',
      status: 'qualifying',
      lead_score: 70,
      purpose: 'investment',
      created_at: new Date(Date.now() - 100 * 3600000).toISOString(),
      care_deadline_at: new Date(Date.now() - 1000).toISOString(), // Quá hạn
      auto_transfer_count: 3, // Đã chuyển 3 lần trước đó
      previous_assigned_sales: ['sale-initial', 'sale-1', 'sale-2'],
    };

    localStorage.setItem('crm_leads', JSON.stringify([thirdTimeOverdueLead]));

    const scanResult = await autoService.runAutoTransferScan({
      allLeads: [thirdTimeOverdueLead],
      allSales: mockSales,
      performedBy: 'Server SLA Cron',
    });

    expect(scanResult.poolReclaimedCount).toBe(1);
    expect(scanResult.transferredCount).toBe(0);

    const leads: Lead[] = JSON.parse(localStorage.getItem('crm_leads') || '[]');
    const leadInPool = leads.find(l => l.id === 'lead-pool-test');
    expect(leadInPool?.assigned_to).toBeUndefined();
    expect(leadInPool?.assigned_name).toBe('Kho lead chung');
    expect(leadInPool?.auto_transfer_count).toBe(4);

    // Kiểm tra Outbox ghi nhận sự kiện cảnh báo quản lý 'pool_alert'
    const outbox = await autoService.getOutboxMessages();
    const poolAlert = outbox.find(m => m.event_type === 'pool_alert' && m.lead_id === 'lead-pool-test');
    expect(poolAlert).toBeDefined();
    expect(poolAlert.recipient_email).toBe('manager@crm-broker.vn');
  });

  it('3. Chế độ Dry-Run: Quét tính toán đầy đủ nhưng không làm thay đổi dữ liệu và không ghi Outbox', async () => {
    const overdueLead: Lead = {
      id: 'lead-dry-run',
      customer_id: 'cust-dry',
      customer_name: 'Khách Test Dry-Run',
      customer_phone: '0933333333',
      project_id: 'proj-1',
      team_id: 'team-1',
      agency_id: 'agency-1',
      assigned_to: 'sale-1',
      assigned_name: 'Trần Thị Thu Thảo',
      status: 'qualifying',
      lead_score: 85,
      purpose: 'residence',
      created_at: new Date(Date.now() - 48 * 3600000).toISOString(),
      care_deadline_at: new Date(Date.now() - 3600000).toISOString(),
      auto_transfer_count: 0,
      previous_assigned_sales: [],
    };

    localStorage.setItem('crm_leads', JSON.stringify([overdueLead]));

    const dryRunResult = await autoService.runAutoTransferScan({
      isDryRun: true,
      allLeads: [overdueLead],
      allSales: mockSales,
    });

    expect(dryRunResult.transferredCount).toBe(1);
    expect(dryRunResult.details[0].action).toBe('transferred');

    // Dữ liệu trong Database/Storage không hề bị thay đổi
    const leadsAfter: Lead[] = JSON.parse(localStorage.getItem('crm_leads') || '[]');
    expect(leadsAfter[0].assigned_to).toBe('sale-1');
    expect(leadsAfter[0].auto_transfer_count).toBe(0);

    // Không có outbox nào được ghi
    const outboxAfter = await autoService.getOutboxMessages();
    expect(outboxAfter.length).toBe(0);
  });

  it('4. Tạm dừng đồng hồ và không điều chuyển nếu Lead ở trạng thái dừng (Booking, Cọc, HĐMB, Xem dự án)', async () => {
    const bookingLead: Lead = {
      id: 'lead-booking-stop',
      customer_id: 'cust-bk',
      customer_name: 'Khách Đã Booking',
      customer_phone: '0944444444',
      project_id: 'proj-1',
      team_id: 'team-1',
      agency_id: 'agency-1',
      assigned_to: 'sale-1',
      assigned_name: 'Trần Thị Thu Thảo',
      status: 'booking', // Stop-clock status
      lead_score: 95,
      purpose: 'investment',
      created_at: new Date(Date.now() - 72 * 3600000).toISOString(),
      care_deadline_at: new Date(Date.now() - 24 * 3600000).toISOString(),
      auto_transfer_count: 0,
      previous_assigned_sales: [],
    };

    localStorage.setItem('crm_leads', JSON.stringify([bookingLead]));

    const result = await autoService.runAutoTransferScan({
      allLeads: [bookingLead],
      allSales: mockSales,
    });

    expect(result.stopClockSkippedCount).toBe(1);
    expect(result.transferredCount).toBe(0);

    const leadAfter = (await leadRepo.getLeads({}, { role: 'admin' } as any)).leads.find(l => l.id === 'lead-booking-stop');
    expect(leadAfter?.assigned_to).toBe('sale-1'); // Vẫn giữ nguyên sale
  });

  it('5. Ghi nhận outbox và lead_assignment_history đồng thời trong cùng một luồng chuyển lead', async () => {
    const overdueLead: Lead = {
      id: 'lead-outbox-sync',
      customer_id: 'cust-sync',
      customer_name: 'Khách Outbox Sync',
      customer_phone: '0955555555',
      project_id: 'proj-1',
      team_id: 'team-1',
      agency_id: 'agency-1',
      assigned_to: 'sale-1',
      assigned_name: 'Trần Thị Thu Thảo',
      status: 'qualifying',
      lead_score: 65,
      purpose: 'investment',
      created_at: new Date(Date.now() - 48 * 3600000).toISOString(),
      care_deadline_at: new Date(Date.now() - 3600000).toISOString(),
      auto_transfer_count: 0,
      previous_assigned_sales: [],
    };

    localStorage.setItem('crm_leads', JSON.stringify([overdueLead]));

    await autoService.runAutoTransferScan({
      allLeads: [overdueLead],
      allSales: mockSales,
    });

    const history = await autoService.getLeadAssignmentHistory('lead-outbox-sync');
    const outbox = await autoService.getOutboxMessages();

    expect(history.length).toBe(1);
    expect(history[0].reason).toBe('auto_overdue');

    // Kiểm tra outbox có đủ 2 thông báo: cho sale mới và sale cũ bị thu hồi
    const newSaleMsg = outbox.find(m => m.event_type === 'auto_transferred_new' && m.lead_id === 'lead-outbox-sync');
    const oldSaleMsg = outbox.find(m => m.event_type === 'auto_transferred_old' && m.lead_id === 'lead-outbox-sync');

    expect(newSaleMsg).toBeDefined();
    expect(oldSaleMsg).toBeDefined();
    expect(newSaleMsg.recipient_email).toBe('sale2@diaocvang.vn');
  });
});
