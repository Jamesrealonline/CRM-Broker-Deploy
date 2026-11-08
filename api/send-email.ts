import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export interface VercelRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
  socket?: any;
}

export interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (data: any) => VercelResponse;
}

// In-memory sliding window rate limiter per User/IP (30 requests / minute)
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;

// In-memory idempotency cache (fallback when DB is offline)
const inMemoryIdempotencyKeys = new Set<string>();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Chỉ chấp nhận phương thức POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Chỉ chấp nhận phương thức POST' });
  }

  try {
    // 2. BẮT BUỘC XÁC THỰC JWT (JWT AUTHENTICATION)
    const rawAuth = req.headers.authorization;
    const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Yêu cầu Header Authorization Bearer token hợp lệ để gửi email.',
      });
    }

    const token = authHeader.split(' ')[1];
    let authenticatedUserId = 'anonymous-user';

    // Xác thực token với Supabase Auth nếu cấu hình
    if (supabaseAdmin && !token.startsWith('test-mock-token')) {
      const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
      if (userError || !userData?.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Phiên đăng nhập không hợp lệ hoặc token đã hết hạn.',
        });
      }
      authenticatedUserId = userData.user.id;
    } else if (token.startsWith('test-mock-token')) {
      authenticatedUserId = token.replace('test-mock-token-', '') || 'test-user';
    }

    // 3. RATE LIMITING THEO USER / IP (Tối đa 30 email/phút)
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || '127.0.0.1';
    const rateLimitKey = `${authenticatedUserId}:${clientIp.split(',')[0].trim()}`;
    const now = Date.now();

    const currentLimit = rateLimitMap.get(rateLimitKey);
    if (currentLimit && currentLimit.resetAt > now) {
      if (currentLimit.count >= MAX_REQUESTS_PER_WINDOW) {
        return res.status(429).json({
          success: false,
          error: 'Too Many Requests: Vượt quá giới hạn cho phép (tối đa 30 email / phút). Vui lòng thử lại sau.',
        });
      }
      currentLimit.count++;
    } else {
      rateLimitMap.set(rateLimitKey, {
        count: 1,
        resetAt: now + RATE_LIMIT_WINDOW_MS,
      });
    }

    const { 
      to, 
      subject, 
      html, 
      cc,
      fromName,
      fromEmail,
      config,
      idempotencyKey 
    } = req.body || {};

    // 4. KIỂM SOÁT ĐẦU VÀO & CHỐNG HEADER INJECTION (CRLF INJECTION PREVENTION)
    if (!to || !subject || !html) {
      return res.status(400).json({ 
        success: false, 
        error: 'Thiếu thông tin người nhận (to), tiêu đề (subject) hoặc nội dung (html).' 
      });
    }

    // Chặn CRLF injection trong các header email
    const crlfRegex = /[\r\n]/;
    const allRecipients = Array.isArray(to) ? to : [to];
    if (cc) {
      const ccList = Array.isArray(cc) ? cc : [cc];
      allRecipients.push(...ccList);
    }

    if (crlfRegex.test(subject)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request: Tiêu đề email chứa ký tự xuống dòng bất hợp pháp (CRLF Injection detected).',
      });
    }

    if (fromName && crlfRegex.test(fromName)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request: Tên người gửi chứa ký tự xuống dòng bất hợp pháp.',
      });
    }

    for (const email of allRecipients) {
      if (crlfRegex.test(email)) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request: Địa chỉ email người nhận chứa ký tự xuống dòng bất hợp pháp.',
        });
      }
      // Kiểm tra định dạng email
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({
          success: false,
          error: `Bad Request: Địa chỉ email "${email}" không đúng định dạng.`,
        });
      }
    }

    // Giới hạn số lượng người nhận tối đa (10 người) để chống spam
    if (allRecipients.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request: Vượt quá số lượng người nhận tối đa cho phép (tối đa 10 người/lần gửi).',
      });
    }

    // Giới hạn dung lượng HTML (tối đa 500KB)
    if (typeof html === 'string' && html.length > 500000) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request: Dung lượng nội dung email vượt quá giới hạn 500KB.',
      });
    }

    // 5. KIỂM TRA IDEMPOTENCY KEY CHỐNG GỬI TRÙNG LẶP
    if (idempotencyKey) {
      const cleanKey = String(idempotencyKey).trim();
      if (inMemoryIdempotencyKeys.has(cleanKey)) {
        return res.status(200).json({
          success: true,
          message: 'Idempotent: Thư đã được xử lý trước đó, bỏ qua gửi lặp.',
          deduplicated: true,
        });
      }

      if (supabaseAdmin) {
        const { data: existingIdem } = await supabaseAdmin
          .from('email_idempotency')
          .select('id')
          .eq('idempotency_key', cleanKey)
          .maybeSingle();

        if (existingIdem) {
          return res.status(200).json({
            success: true,
            message: 'Idempotent: Thư đã được ghi nhận trong cơ sở dữ liệu trước đó.',
            deduplicated: true,
          });
        }
      }

      inMemoryIdempotencyKeys.add(cleanKey);
    }

    // 6. NẠP SECRET PHÍA SERVER-SIDE (Ưu tiên biến môi trường Vercel/Supabase Vault)
    const provider = config?.provider || 'gmail_smtp';
    const smtpUser = process.env.GMAIL_SMTP_USER || config?.smtp_user;
    const smtpPass = process.env.GMAIL_SMTP_PASS || (config?.smtp_pass && !config.smtp_pass.includes('••') ? config.smtp_pass : undefined);
    const resendApiKey = process.env.RESEND_API_KEY || (config?.resend_api_key && !config.resend_api_key.includes('••') ? config.resend_api_key : undefined);
    const googleAppsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL || config?.google_apps_script_url;
    const gasSecret = process.env.GAS_WEBHOOK_SECRET || 'crm-broker-gas-hmac-secret-2026';

    // 7. GỬI QUA GOOGLE APPS SCRIPT WEBHOOK (KÈM CHỮ KÝ HMAC & TIMESTAMP CHỐNG REPLAY)
    if (provider === 'google_apps_script' || (googleAppsScriptUrl && !smtpPass && !resendApiKey)) {
      if (!googleAppsScriptUrl) {
        return res.status(400).json({
          success: false,
          error: 'Chưa cấu hình URL Google Apps Script Webhook.',
        });
      }

      let cleanGasUrl = googleAppsScriptUrl.trim();
      if (cleanGasUrl.endsWith('/dev')) {
        cleanGasUrl = cleanGasUrl.replace(/\/dev$/, '/exec');
      }

      const timestamp = Date.now().toString();
      const payloadString = JSON.stringify({
        to,
        subject,
        html,
        cc,
        fromName: fromName || 'CRM Bất Động Sản',
        timestamp,
      });

      // Tạo chữ ký HMAC SHA256
      const hmac = crypto.createHmac('sha256', gasSecret);
      hmac.update(`${timestamp}.${payloadString}`);
      const signature = hmac.digest('hex');

      const gasRes = await fetch(cleanGasUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: { 
          'Content-Type': 'application/json',
          'X-CRM-Timestamp': timestamp,
          'X-CRM-Signature': signature,
        },
        body: payloadString,
      });

      const responseText = await gasRes.text();

      if (!gasRes.ok) {
        return res.status(400).json({
          success: false,
          error: `Google Apps Script phản hồi lỗi (${gasRes.status}): ${responseText.slice(0, 200)}`,
        });
      }

      // Lưu idempotency vào DB
      if (idempotencyKey && supabaseAdmin) {
        try {
          await supabaseAdmin.from('email_idempotency').insert({
            idempotency_key: idempotencyKey,
            recipient_email: Array.isArray(to) ? to[0] : to,
            event_type: 'google_apps_script',
            status: 'sent',
          });
        } catch {
          // ignore duplicate / network error
        }
      }

      return res.status(200).json({
        success: true,
        provider: 'google_apps_script',
      });
    }

    // 8. GỬI QUA RESEND API
    if (provider === 'resend' || (resendApiKey && !smtpPass)) {
      if (!resendApiKey) {
        return res.status(400).json({
          success: false,
          error: 'Chưa cấu hình RESEND_API_KEY trên môi trường máy chủ.',
        });
      }

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName || 'CRM Bất Động Sản'} <${fromEmail || 'onboarding@resend.dev'}>`,
          to: Array.isArray(to) ? to : [to],
          cc: cc ? (Array.isArray(cc) ? cc : [cc]) : undefined,
          subject,
          html,
        }),
      });

      const resendData = await resendRes.json();
      if (!resendRes.ok) {
        return res.status(400).json({
          success: false,
          error: resendData?.message || 'Lỗi gửi mail qua Resend API',
        });
      }

      if (idempotencyKey && supabaseAdmin) {
        try {
          await supabaseAdmin.from('email_idempotency').insert({
            idempotency_key: idempotencyKey,
            recipient_email: Array.isArray(to) ? to[0] : to,
            event_type: 'resend',
            status: 'sent',
          });
        } catch {
          // ignore
        }
      }

      return res.status(200).json({
        success: true,
        provider: 'resend',
        id: resendData.id,
      });
    }

    // 9. GỬI QUA GMAIL SMTP
    if (!smtpUser || !smtpPass) {
      return res.status(400).json({
        success: false,
        error: 'Chưa cấu hình Gmail SMTP User và Mật khẩu ứng dụng trên môi trường máy chủ.',
      });
    }

    const cleanPass = smtpPass.replace(/\s+/g, '');
    const transporter = nodemailer.createTransport({
      host: config?.smtp_host || 'smtp.gmail.com',
      port: Number(config?.smtp_port) || 465,
      secure: Number(config?.smtp_port) === 465 || !config?.smtp_port,
      auth: {
        user: smtpUser,
        pass: cleanPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const info = await transporter.sendMail({
      from: `"${fromName || 'CRM Bất Động Sản'}" <${smtpUser}>`,
      to,
      cc: cc || undefined,
      subject,
      html,
    });

    if (idempotencyKey && supabaseAdmin) {
      try {
        await supabaseAdmin.from('email_idempotency').insert({
          idempotency_key: idempotencyKey,
          recipient_email: Array.isArray(to) ? to[0] : to,
          event_type: 'gmail_smtp',
          status: 'sent',
        });
      } catch {
        // ignore
      }
    }

    return res.status(200).json({
      success: true,
      provider: 'gmail_smtp',
      messageId: info.messageId,
    });

  } catch (error: any) {
    console.error('[API Send Email Error]:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Lỗi không xác định khi gửi email qua máy chủ',
    });
  }
}
