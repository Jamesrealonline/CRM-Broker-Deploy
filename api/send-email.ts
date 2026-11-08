import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Chỉ chấp nhận phương thức POST' });
  }

  try {
    const { 
      to, 
      subject, 
      html, 
      cc,
      fromName,
      fromEmail,
      config 
    } = req.body || {};

    if (!to || !subject || !html) {
      return res.status(400).json({ 
        success: false, 
        error: 'Thiếu thông tin người nhận (to), tiêu đề (subject) hoặc nội dung (html).' 
      });
    }

    const provider = config?.provider || 'gmail_smtp';
    const smtpUser = config?.smtp_user || process.env.GMAIL_SMTP_USER;
    const smtpPass = config?.smtp_pass || process.env.GMAIL_SMTP_PASS;
    const resendApiKey = config?.resend_api_key || process.env.RESEND_API_KEY;

    // 1. GỬI QUA RESEND API NẾU ĐƯỢC CHỌN
    if (provider === 'resend' || (resendApiKey && !smtpPass)) {
      if (!resendApiKey) {
        return res.status(400).json({
          success: false,
          error: 'Chưa cấu hình RESEND_API_KEY để gửi email.',
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

      return res.status(200).json({
        success: true,
        provider: 'resend',
        id: resendData.id,
      });
    }

    // 2. GỬI QUA GMAIL SMTP (HOẶC CUSTOM SMTP)
    if (!smtpUser || !smtpPass) {
      return res.status(400).json({
        success: false,
        error: 'Chưa cấu hình Email Gmail (Username) và Mật khẩu ứng dụng 16 ký tự (App Password). Vui lòng vào Cấu hình Hệ thống -> Email để thiết lập.',
      });
    }

    // Làm sạch mật khẩu ứng dụng 16 ký tự (xóa khoảng trắng nếu user dán 'abcd efgh ijkl mnop')
    const cleanPass = smtpPass.replace(/\s+/g, '');

    const transporter = nodemailer.createTransport({
      host: config?.smtp_host || 'smtp.gmail.com',
      port: Number(config?.smtp_port) || 465,
      secure: Number(config?.smtp_port) === 465 || !config?.smtp_port, // true cho port 465, false cho 587
      auth: {
        user: smtpUser,
        pass: cleanPass,
      },
      tls: {
        rejectUnauthorized: false, // Tránh lỗi self-signed cert trong một số môi trường
      },
    });

    const info = await transporter.sendMail({
      from: `"${fromName || 'CRM Bất Động Sản'}" <${smtpUser}>`,
      to,
      cc: cc || undefined,
      subject,
      html,
    });

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
