// ========================================================
// REAL ESTATE CRM - MODULE 6 & MODULE 7 COMPREHENSIVE TESTS
// 1. Đồng hồ 24 giờ liên tục (Wall-clock real time)
// 2. Tạm dừng đồng hồ (Stop-clock statuses, lịch hẹn, miễn chuyển)
// 3. Chống vòng lặp (previous_assigned_sales loại trừ A -> B -> A)
// 4. Giới hạn 3 lần chuyển -> Thu hồi về Kho lead chung (Pool)
// 5. Gộp email phân bổ hàng loạt (Bulk Assign Digest)
// 6. Chống gửi trùng lặp (Idempotency Key deduplication)
// 7. Quét tự động định kỳ (Scanner Dry-run & Real run)
// ========================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { autoTransferService, DEFAULT_AUTO_TRANSFER_CONFIG } from '../domain/services/autoTransferService';
import { notificationService } from '../domain/services/notificationService';
import { Lead, UserProfile, AutoTransferConfig } from '../domain/types';

const makeLead = (overrides: Partial<Lead>): Lead => ({
  id: 'lead-test',
  customer_id: 'cust-test',
  customer_name: 'Test Customer',
  project_id: 'proj-1',
  status: 'new',
  purpose: 'investment',
  created_at: new Date().toISOString(),
  lead_score: 50,
  ...overrides,
});

const makeUser = (overrides: Partial<UserProfile>): UserProfile => ({
  id: 'user-test',
  full_name: 'Test User',
  email: 'test@crm.vn',
  phone: '0900000000',
  role: 'sale_agent',
  status: 'active',
  must_change_password: false,
  totp_enabled: false,
  accepts_leads: true,
  on_leave: false,
  ...overrides,
});

describe('Module 7: Tự Động Chuyển Lead Quá Hạn 24 Giờ Liên Tục (Wall-Clock)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('Tính toán hạn chót 24 giờ liên tục (Wall-clock real time, không phụ thuộc ngày lễ/giờ làm việc)', () => {
    const startTime = '2026-11-01T10:00:00.000Z';
    const deadline = autoTransferService.computeCareDeadline(startTime, 24);

    const startMs = new Date(startTime).getTime();
    const deadlineMs = new Date(deadline).getTime();

    // Đúng 24 * 3600 * 1000 ms
    expect(deadlineMs - startMs).toBe(24 * 3600 * 1000);
    expect(new Date(deadline).toISOString()).toBe('2026-11-02T10:00:00.000Z');
  });

  it('Tính chính xác số giờ còn lại, cảnh báo ở mốc 20h và báo quá hạn khi hết 24h', () => {
    const now = Date.now();
    const config: AutoTransferConfig = {
      ...DEFAULT_AUTO_TRANSFER_CONFIG,
      deadline_hours: 24,
      pre_warning_hours: 20, // cảnh báo khi còn 4h
    };

    // Case 1: Mới giao cách đây 2h -> còn 22h -> Green
    const leadFresh = makeLead({
      id: 'lead-fresh',
      customer_name: 'Nguyễn Văn An',
      assigned_to: 'sale-1',
      assigned_name: 'Sale A',
      created_at: new Date(now - 2 * 3600000).toISOString(),
      care_deadline_at: new Date(now + 22 * 3600000).toISOString(),
      lead_score: 70,
    });
    const resFresh = autoTransferService.getCareRemainingHours(leadFresh, config);
    expect(resFresh.hoursRemaining).toBeCloseTo(22, 0);
    expect(resFresh.isOverdue).toBe(false);
    expect(resFresh.isWarning).toBe(false);
    expect(resFresh.badgeColor).toBe('green');

    // Case 2: Đã trôi qua 21h -> còn 3h -> Warning (Red < 4h)
    const leadWarning = makeLead({
      id: 'lead-warn',
      customer_name: 'Lê Văn Bình',
      assigned_to: 'sale-1',
      assigned_name: 'Sale A',
      created_at: new Date(now - 21 * 3600000).toISOString(),
      care_deadline_at: new Date(now + 3 * 3600000).toISOString(),
      lead_score: 65,
    });
    const resWarn = autoTransferService.getCareRemainingHours(leadWarning, config);
    expect(resWarn.hoursRemaining).toBeCloseTo(3, 0);
    expect(resWarn.isOverdue).toBe(false);
    expect(resWarn.isWarning).toBe(true);
    expect(resWarn.badgeColor).toBe('red');

    // Case 3: Đã trôi qua 26h -> quá hạn 2h -> Red Overdue
    const leadOverdue = makeLead({
      id: 'lead-overdue',
      customer_name: 'Trần Thị Cúc',
      assigned_to: 'sale-1',
      assigned_name: 'Sale A',
      created_at: new Date(now - 26 * 3600000).toISOString(),
      care_deadline_at: new Date(now - 2 * 3600000).toISOString(),
      lead_score: 55,
    });
    const resOverdue = autoTransferService.getCareRemainingHours(leadOverdue, config);
    expect(resOverdue.hoursRemaining).toBeLessThanOrEqual(0);
    expect(resOverdue.isOverdue).toBe(true);
    expect(resOverdue.badgeColor).toBe('red');
    expect(resOverdue.badgeLabel).toContain('Quá hạn');
  });

  it('Tạm dừng đồng hồ (Stop-Clock) ở các trạng thái đặt cọc, ký HĐMB hoặc có lịch hẹn', () => {
    const now = Date.now();
    const config = DEFAULT_AUTO_TRANSFER_CONFIG;

    // Trạng thái deposit (đặt cọc)
    const leadDeposit = makeLead({
      id: 'lead-dep',
      customer_name: 'Hoàng Nam',
      status: 'deposit',
      assigned_to: 'sale-1',
      assigned_name: 'Sale A',
      created_at: new Date(now - 48 * 3600000).toISOString(),
      care_deadline_at: new Date(now - 24 * 3600000).toISOString(),
      lead_score: 90,
    });
    const resDeposit = autoTransferService.getCareRemainingHours(leadDeposit, config);
    expect(resDeposit.isPaused).toBe(true);
    expect(resDeposit.isOverdue).toBe(false);
    expect(resDeposit.badgeColor).toBe('gray');
    expect(resDeposit.badgeLabel).toBe('Tạm dừng đồng hồ');

    // Có lịch hẹn tương lai hợp lệ
    const leadAppointment = makeLead({
      id: 'lead-app',
      customer_name: 'Phạm Minh',
      status: 'new',
      assigned_to: 'sale-1',
      assigned_name: 'Sale A',
      created_at: new Date(now - 30 * 3600000).toISOString(),
      next_follow_up: new Date(now + 48 * 3600000).toISOString(),
      lead_score: 80,
    });
    const resApp = autoTransferService.getCareRemainingHours(leadAppointment, config);
    expect(resApp.isPaused).toBe(true);
    expect(resApp.badgeColor).toBe('gray');
    expect(resApp.badgeLabel).toContain('Hẹn đến');

    // Được quản lý miễn chuyển tự động
    const leadExempt = makeLead({
      id: 'lead-ex',
      customer_name: 'Khách VIP Ngoại Giao',
      status: 'new',
      assigned_to: 'sale-1',
      assigned_name: 'Sale A',
      is_exempt_auto_transfer: true,
      extension_reason: 'Khách VIP của Tổng Giám Đốc',
      created_at: new Date(now - 100 * 3600000).toISOString(),
      lead_score: 95,
    });
    const resExempt = autoTransferService.getCareRemainingHours(leadExempt, config);
    expect(resExempt.isPaused).toBe(true);
    expect(resExempt.badgeLabel).toBe('Miễn chuyển');
  });

  it('Thuật toán Round-Robin loại trừ các Sale đã từng giữ lead (Chống lặp A -> B -> A)', () => {
    const lead = makeLead({
      id: 'lead-cycle',
      customer_name: 'Đặng Tuấn',
      team_id: 'team-1',
      status: 'new',
      assigned_to: 'sale-b',
      assigned_name: 'Sale B',
      previous_assigned_sales: ['sale-a'], // Sale A đã từng giữ trước đó
      auto_transfer_count: 1,
      created_at: new Date().toISOString(),
      lead_score: 60,
    });

    const candidates: UserProfile[] = [
      makeUser({ id: 'sale-a', full_name: 'Sale A', email: 'salea@crm.vn', role: 'sale_agent', team_id: 'team-1' }),
      makeUser({ id: 'sale-b', full_name: 'Sale B', email: 'saleb@crm.vn', role: 'sale_agent', team_id: 'team-1' }),
      makeUser({ id: 'sale-c', full_name: 'Sale C', email: 'salec@crm.vn', role: 'sale_agent', team_id: 'team-1' }),
      makeUser({ id: 'sale-d', full_name: 'Sale D (Nghỉ phép)', email: 'saled@crm.vn', role: 'sale_agent', team_id: 'team-1', on_leave: true }),
    ];

    // Chỉ có Sale C là đủ điều kiện (Sale A đã từng giữ, Sale B là hiện tại, Sale D nghỉ phép)
    const nextSale = autoTransferService.selectNextSale(lead, candidates, DEFAULT_AUTO_TRANSFER_CONFIG);
    expect(nextSale).not.toBeNull();
    expect(nextSale?.id).toBe('sale-c');
    expect(nextSale?.full_name).toBe('Sale C');
  });

  it('Vượt quá 3 lần chuyển không có chăm sóc -> Tự động đưa về Kho lead chung (Pool)', async () => {
    const lead = makeLead({
      id: 'lead-max-transfers',
      customer_name: 'Vũ Quốc Bảo',
      status: 'new',
      assigned_to: 'sale-c',
      assigned_name: 'Sale C',
      auto_transfer_count: 3, // Đã chuyển 3 lần
      previous_assigned_sales: ['sale-a', 'sale-b'],
      created_at: new Date().toISOString(),
      lead_score: 50,
    });

    const saleNext = makeUser({
      id: 'sale-d',
      full_name: 'Sale D',
      email: 'saled@crm.vn',
      role: 'sale_agent',
    });

    // Khi chuyển lần thứ 4 (3 + 1 > max 3), phải đưa về Kho lead chung
    const result = await autoTransferService.transferLead(
      lead,
      saleNext,
      'auto_overdue',
      'Hệ thống tự động quét 24h'
    );

    expect(result.success).toBe(true);
    expect(result.lead.assigned_to).toBeUndefined();
    expect(result.lead.assigned_name).toBe('Kho lead chung');
    expect(result.lead.auto_transfer_count).toBe(4);
    expect(result.lead.previous_assigned_sales).toContain('sale-c');
  });

  it('Quét tự động định kỳ (Scanner Dry-run) phát hiện lead quá hạn mà không sửa đổi dữ liệu', async () => {
    const now = Date.now();
    const testLeads: Lead[] = [
      makeLead({
        id: 'l-overdue',
        customer_name: 'Khách Quá Hạn',
        status: 'new',
        assigned_to: 'sale-1',
        assigned_name: 'Sale 1',
        care_deadline_at: new Date(now - 2 * 3600000).toISOString(), // Quá hạn 2h
        auto_transfer_count: 1,
        previous_assigned_sales: [],
        created_at: new Date(now - 26 * 3600000).toISOString(),
        lead_score: 60,
      }),
      makeLead({
        id: 'l-warn',
        customer_name: 'Khách Cảnh Báo 20h',
        status: 'new',
        assigned_to: 'sale-1',
        assigned_name: 'Sale 1',
        care_deadline_at: new Date(now + 2 * 3600000).toISOString(), // Còn 2h (mốc 20-24h)
        auto_transfer_count: 0,
        previous_assigned_sales: [],
        created_at: new Date(now - 22 * 3600000).toISOString(),
        lead_score: 70,
      }),
      makeLead({
        id: 'l-deposit',
        customer_name: 'Khách Đã Cọc (Dừng)',
        status: 'deposit',
        assigned_to: 'sale-1',
        assigned_name: 'Sale 1',
        care_deadline_at: new Date(now - 10 * 3600000).toISOString(),
        created_at: new Date(now - 40 * 3600000).toISOString(),
        lead_score: 90,
      }),
    ];

    const testSales: UserProfile[] = [
      makeUser({ id: 'sale-1', full_name: 'Sale 1', email: 'sale1@crm.vn', role: 'sale_agent' }),
      makeUser({ id: 'sale-2', full_name: 'Sale 2', email: 'sale2@crm.vn', role: 'sale_agent' }),
    ];

    const scanResult = await autoTransferService.runAutoTransferScan({
      isDryRun: true,
      allLeads: testLeads,
      allSales: testSales,
      performedBy: 'Hệ thống kiểm thử',
    });

    expect(scanResult.scannedCount).toBe(3);
    expect(scanResult.transferredCount).toBe(1); // l-overdue
    expect(scanResult.warnedCount).toBe(1);      // l-warn
    expect(scanResult.stopClockSkippedCount).toBe(1); // l-deposit

    // Dữ liệu ban đầu không bị thay đổi trong dry-run
    expect(testLeads[0].assigned_to).toBe('sale-1');
  });
});

describe('Module 6: Thông Báo Email Phân Bổ Lead & Chống Trùng Lặp', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('Gộp phân bổ hàng loạt (Bulk Assign) thành 1 email Digest tổng hợp bảng HTML', async () => {
    const sale = makeUser({
      id: 'sale-bulk',
      full_name: 'Đoàn Thị Hà',
      email: 'sale.ha@crm-broker.vn',
      role: 'sale_agent',
    });

    const assignedLeads: Lead[] = [
      makeLead({ id: 'lead-1', customer_name: 'Nguyễn Văn Minh', customer_phone: '0901234567', project_name: 'Vinhomes Grand Park', status: 'new', lead_score: 80 }),
      makeLead({ id: 'lead-2', customer_name: 'Trần Thị Hằng', customer_phone: '0912345678', project_name: 'Masteri Centre Point', status: 'new', lead_score: 75 }),
      makeLead({ id: 'lead-3', customer_name: 'Lê Hoàng Long', customer_phone: '0987654321', project_name: 'The Beverly', status: 'new', lead_score: 85 }),
    ];

    const result = await notificationService.sendBulkAssignDigest(
      sale,
      assignedLeads,
      'Nguyễn Giám Đốc'
    );

    expect(result.success).toBe(true);

    // Kiểm tra nhật ký thông báo
    const logs = await notificationService.getNotificationLogs();
    const bulkLog = logs.find(l => l.event_type === 'bulk_assign');

    expect(bulkLog).toBeDefined();
    expect(bulkLog?.recipient_email).toBe('sale.ha@crm-broker.vn');
    expect(bulkLog?.title).toContain('Tổng hợp giao 3 Lead mới');
    expect(bulkLog?.content).toContain('Nguyễn Văn Minh');
    expect(bulkLog?.content).toContain('Masteri Centre Point');
    expect(bulkLog?.content).toContain('The Beverly');
  });

  it('Idempotency Key chống gửi trùng lặp email cho cùng 1 sự kiện trong vòng 1 giờ', async () => {
    const payload = {
      leadId: 'lead-dup-test',
      recipientId: 'sale-1',
      recipientEmail: 'sale1@crm.vn',
      recipientName: 'Sale 1',
      eventType: 'overdue_warning' as const,
      channel: 'both' as const,
      variables: {
        ten_khach_hang: 'Khách Trùng',
        du_an: 'Dự án Test',
      },
    };

    // Lần gửi 1: thành công
    const res1 = await notificationService.sendNotification(payload);
    expect(res1.success).toBe(true);
    expect(res1.logId).toBeDefined();

    // Lần gửi 2 (ngay sau đó cho cùng lead + sale + sự kiện): tái sử dụng logId, không tạo log mới
    const res2 = await notificationService.sendNotification(payload);
    expect(res2.success).toBe(true);
    expect(res2.logId).toBe(res1.logId);

    const allLogs = await notificationService.getNotificationLogs();
    const dupLogs = allLogs.filter(l => l.lead_id === 'lead-dup-test');
    expect(dupLogs.length).toBe(1); // Không tạo thêm bản ghi trùng
  });

  it('Kiểm tra email hợp lệ, ghi log lỗi an toàn mà không làm sập luồng điều chuyển', async () => {
    const errorLog = await notificationService.sendNotification({
      leadId: 'lead-fail',
      recipientEmail: 'invalid-email-format',
      recipientName: 'Invalid User',
      eventType: 'new_assign',
      channel: 'email',
      variables: {
        ten_khach_hang: 'Khách Lỗi',
        du_an: 'Dự Án',
      },
    });

    // Thao tác trả về lỗi có kiểm soát, không throw crash ứng dụng
    expect(errorLog.success).toBe(false);
    expect(errorLog.error).toContain('Email không hợp lệ');
  });
});

