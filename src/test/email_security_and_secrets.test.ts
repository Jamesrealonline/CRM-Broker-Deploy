import { describe, it, expect, beforeEach } from 'vitest';
import emailHandler from '../../api/send-email';
import { NotificationService, escapeHtml } from '@/domain/services/notificationService';

// Helper mock tạo VercelRequest và VercelResponse
function createMockHttp(reqOptions: {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
}) {
  const req = {
    method: reqOptions.method || 'POST',
    headers: reqOptions.headers || {},
    body: reqOptions.body || {},
    socket: { remoteAddress: '127.0.0.1' },
  } as any;

  let statusCode = 200;
  let jsonResponse: any = null;

  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: any) {
      jsonResponse = data;
      return res;
    },
  } as any;

  return { req, res, getStatus: () => statusCode, getJson: () => jsonResponse };
}

describe('P0.3 Bảo Vệ Kênh Email, Secret & Chống Tấn Công (Email Security)', () => {
  let notifService: NotificationService;

  beforeEach(() => {
    localStorage.clear();
    notifService = new NotificationService();
  });

  it('1. Gọi /api/send-email không có token hoặc token sai -> Trả 401 Unauthorized', async () => {
    const { req, res, getStatus, getJson } = createMockHttp({
      method: 'POST',
      headers: {}, // Không có Authorization
      body: {
        to: 'sale@diaocvang.vn',
        subject: 'Test Subject',
        html: '<p>Test</p>',
      },
    });

    await emailHandler(req, res);
    expect(getStatus()).toBe(401);
    expect(getJson().error).toContain('Unauthorized');
  });

  it('2. Chặn tấn công CRLF Header Injection trong tiêu đề hoặc người nhận -> Trả 400 Bad Request', async () => {
    const { req, res, getStatus, getJson } = createMockHttp({
      method: 'POST',
      headers: {
        authorization: 'Bearer test-mock-token-admin',
      },
      body: {
        to: 'sale@diaocvang.vn',
        subject: 'Header Injection\r\nBcc: victim@hacker.com\r\nInjected-Header: evil',
        html: '<p>Test Injection</p>',
      },
    });

    await emailHandler(req, res);
    expect(getStatus()).toBe(400);
    expect(getJson().error).toContain('CRLF Injection');
  });

  it('3. Chặn số lượng người nhận vượt quá giới hạn an toàn (> 10 người nhận)', async () => {
    const elevenRecipients = Array.from({ length: 11 }, (_, i) => `user${i}@diaocvang.vn`);

    const { req, res, getStatus, getJson } = createMockHttp({
      method: 'POST',
      headers: {
        authorization: 'Bearer test-mock-token-admin',
      },
      body: {
        to: elevenRecipients,
        subject: 'Spam Mass Email',
        html: '<p>Test</p>',
      },
    });

    await emailHandler(req, res);
    expect(getStatus()).toBe(400);
    expect(getJson().error).toContain('Vượt quá số lượng người nhận tối đa');
  });

  it('4. Chặn nội dung HTML vượt quá dung lượng tối đa 500KB', async () => {
    const hugeHtml = '<p>' + 'A'.repeat(500001) + '</p>';

    const { req, res, getStatus, getJson } = createMockHttp({
      method: 'POST',
      headers: {
        authorization: 'Bearer test-mock-token-admin',
      },
      body: {
        to: 'sale@diaocvang.vn',
        subject: 'Huge Email Payload',
        html: hugeHtml,
      },
    });

    await emailHandler(req, res);
    expect(getStatus()).toBe(400);
    expect(getJson().error).toContain('Dung lượng nội dung email vượt quá giới hạn');
  });

  it('5. Vượt rate limit (30 request/phút từ cùng một IP/User) -> Trả 429 Too Many Requests', async () => {
    const userId = 'rate-limit-test-user';
    let lastStatus = 200;

    // Gửi liên tiếp 32 request
    for (let i = 0; i < 32; i++) {
      const { req, res, getStatus } = createMockHttp({
        method: 'POST',
        headers: {
          authorization: `Bearer test-mock-token-${userId}`,
          'x-forwarded-for': '192.168.1.100',
        },
        body: {
          to: 'sale@diaocvang.vn',
          subject: `Test Rate Limit ${i}`,
          html: '<p>Test</p>',
        },
      });

      await emailHandler(req, res);
      lastStatus = getStatus();
      if (lastStatus === 429) break;
    }

    expect(lastStatus).toBe(429);
  });

  it('6. Idempotency Key: Thư có cùng idempotencyKey chỉ được gửi 1 lần, lần 2 trả về deduplicated: true', async () => {
    const idempotencyKey = `idem-test-${Date.now()}`;

    const { req: req1, res: res1, getStatus: getStatus1, getJson: getJson1 } = createMockHttp({
      method: 'POST',
      headers: { authorization: 'Bearer test-mock-token-admin' },
      body: {
        to: 'sale@diaocvang.vn',
        subject: 'Idempotency First Send',
        html: '<p>Content</p>',
        idempotencyKey,
      },
    });

    await emailHandler(req1, res1);
    // Lần đầu thực thi bình thường (hoặc yêu cầu config nếu thiếu provider)
    
    // Lần thứ hai gửi cùng key
    const { req: req2, res: res2, getStatus: getStatus2, getJson: getJson2 } = createMockHttp({
      method: 'POST',
      headers: { authorization: 'Bearer test-mock-token-admin' },
      body: {
        to: 'sale@diaocvang.vn',
        subject: 'Idempotency Second Send',
        html: '<p>Content</p>',
        idempotencyKey,
      },
    });

    await emailHandler(req2, res2);
    expect(getStatus2()).toBe(200);
    expect(getJson2().deduplicated).toBe(true);
  });

  it('7. XSS Sanitization: renderEmailTemplate thoát toàn bộ thẻ HTML độc hại trong dữ liệu người dùng', () => {
    const maliciousPayload = {
      ten_sale: 'Sale <script>alert("XSS")</script>',
      ten_khach_hang: 'Khách <img src="x" onerror="alert(1)"> Hacker',
      so_dien_thoai: '0901234567',
      du_an: 'Vinhomes <b onmouseover="evil()">Grand Park</b>',
      ghi_chu: 'Nhu cầu <iframe src="evil.com"></iframe> đầu tư',
      muc_dich: 'Mua ở & Đầu tư',
      ngan_sach: '3 - 5 tỷ',
      buoc_kich_ban: 'Bước 1',
      ai_script: 'Kịch bản AI',
      han_cham_soc: '24 giờ',
      lead_id: 'lead-123',
    };

    const rendered = notifService.renderEmailTemplate('new_assign', maliciousPayload);

    // Không được chứa các thẻ nguy hiểm ở dạng raw HTML
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).not.toContain('<img');
    expect(rendered.html).not.toContain('<iframe');

    // Phải được chuyển đổi thành HTML entities an toàn
    expect(rendered.html).toContain('&lt;script&gt;');
    expect(rendered.html).toContain('&lt;img');
    expect(rendered.html).toContain('&lt;iframe');
  });

  it('8. Bảo vệ Secret: saveEmailConfig không ghi đè khi UI truyền secret dạng che (••••)', async () => {
    // Lưu cấu hình mật khẩu ban đầu
    await notifService.saveEmailConfig({
      smtp_pass: 'real-secret-app-password-16',
      resend_api_key: 're_original_key_123',
    });

    const initial = await notifService.getEmailConfig();
    expect(initial.smtp_pass).toBe('real-secret-app-password-16');

    // UI gửi lại cấu hình với password được che ••••••••
    await notifService.saveEmailConfig({
      smtp_from_name: 'Tên Mới Được Đổi',
      smtp_pass: '••••••••••••••••',
      resend_api_key: 're_••••••••••••••••',
    });

    const updated = await notifService.getEmailConfig();
    expect(updated.smtp_from_name).toBe('Tên Mới Được Đổi');
    // Secret thật vẫn được bảo toàn nguyên vẹn, không bị ghi đè thành chuỗi ••••
    expect(updated.smtp_pass).toBe('real-secret-app-password-16');
    expect(updated.resend_api_key).toBe('re_original_key_123');
  });
});
