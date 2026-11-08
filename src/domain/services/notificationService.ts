// ========================================================
// REAL ESTATE CRM - NOTIFICATION & EMAIL QUEUE SERVICE (MODULE 6)
// Xử lý gửi email thông báo bất đồng bộ, gộp hàng loạt (digest),
// chống gửi trùng (idempotency), retry tự động & nhật ký notification_logs
// ========================================================

import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';
import { 
  NotificationLog, 
  NotificationEventType, 
  EmailNotificationConfig, 
  Lead, 
  UserProfile 
} from '@/domain/types';

const STORAGE_KEY_CONFIG = 'crm_email_notification_config';
const STORAGE_KEY_LOGS = 'crm_notification_logs';

export const DEFAULT_EMAIL_CONFIG: EmailNotificationConfig = {
  enabled: true,
  enable_new_assign: true,
  enable_transfer: true,
  enable_revoke: true,
  enable_overdue_warning: true,
  cc_manager: true,
  dispatch_mode: 'google_apps_script',
  provider: 'google_apps_script',
  smtp_host: 'smtp.gmail.com',
  smtp_port: 465,
  smtp_from_name: 'CRM Bất Động Sản',
  smtp_from_email: '',
  smtp_user: '',
  smtp_pass: '',
  google_apps_script_url: 'https://script.google.com/macros/s/AKfycby8wtscDERlWoZaN8t_qTynz23GFYsrf-r5tIeKMD93tjc6By68ufik5TLuVu0zK7M/exec',
};

export interface ClientDispatchInfo {
  subject: string;
  plainBody: string;
  zaloText: string;
  gmailUrl: string;
  mailtoUrl: string;
  zaloUrl?: string;
  leadUrl: string;
}

export class NotificationService {
  /**
   * 0.1 KHỞI TẠO NỘI DUNG VÀ LIÊN KẾT GỬI NHANH 1-CLICK TỪ TRÌNH DUYỆT (GMAIL WEB, ZALO, MAILTO)
   * Giúp gửi trực tiếp từ máy người dùng mà không cần Google App Password hay cấu hình SMTP.
   */
  buildClientDispatchInfo(params: {
    leadTitle: string;
    leadPhone: string;
    projectName: string;
    notes?: string;
    saleName: string;
    saleEmail: string;
    salePhone?: string;
    managerName?: string;
    leadId: string;
    reason?: string;
  }): ClientDispatchInfo {
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://crm-broker-platform.vercel.app';
    const leadUrl = `${siteUrl}/leads/${params.leadId}`;
    const subject = `[CRM Broker] Bàn giao Lead khách hàng: ${params.leadTitle} - ${params.projectName}`;

    const plainBody = `Xin chào ${params.saleName},

Bạn vừa được ${params.managerName || 'Hệ thống'} bàn giao tiếp nhận Lead khách hàng mới:
- Khách hàng: ${params.leadTitle}
- Số điện thoại: ${params.leadPhone}
- Dự án quan tâm: ${params.projectName}
- Nhu cầu / Ghi chú: ${params.notes || 'Khách quan tâm dự án, cần tư vấn thêm'}
- Lý do điều chuyển: ${params.reason || 'Bàn giao phụ trách chăm sóc'}
- Hạn cập nhật SLA: Trong vòng 24 giờ kể từ thời điểm bàn giao.

👉 Bấm vào liên kết này để mở hồ sơ Lead trên hệ thống CRM:
${leadUrl}

Trân trọng,
${params.managerName || 'Phòng Kinh Doanh'}`;

    const zaloText = `🏢 [CRM BROKER] THÔNG BÁO BÀN GIAO LEAD MỚI
Xin chào ${params.saleName},
Bạn vừa được bàn giao chăm sóc khách hàng:
👤 Khách hàng: ${params.leadTitle}
📞 SĐT: ${params.leadPhone}
🏢 Dự án: ${params.projectName}
📝 Nhu cầu: ${params.notes || 'Cần liên hệ tư vấn'}
⏱ Hạn cập nhật (SLA 24h): Trong vòng 24 giờ
👉 Link hồ sơ CRM: ${leadUrl}`;

    const cleanPhone = (params.salePhone || '').replace(/[^0-9]/g, '');
    const zaloUrl = cleanPhone ? `https://zalo.me/${cleanPhone}` : undefined;

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(params.saleEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`;
    const mailtoUrl = `mailto:${encodeURIComponent(params.saleEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`;

    return {
      subject,
      plainBody,
      zaloText,
      gmailUrl,
      mailtoUrl,
      zaloUrl,
      leadUrl,
    };
  }

  /**
   * 0.2 TỔNG HỢP DANH SÁCH BULK LEADS GỬI NHANH QUA GMAIL WEB / ZALO
   */
  buildBulkClientDispatchInfo(params: {
    leads: Array<{ id: string; full_name: string; phone: string; project_name?: string }>;
    saleName: string;
    saleEmail: string;
    salePhone?: string;
    managerName?: string;
    reason?: string;
  }): ClientDispatchInfo {
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://crm-broker-platform.vercel.app';
    const leadUrl = `${siteUrl}/leads`;
    const subject = `[CRM Broker] Tổng hợp bàn giao ${params.leads.length} Lead mới cho bạn`;

    const leadListPlain = params.leads
      .map((l, idx) => `${idx + 1}. ${l.full_name} | SĐT: ${l.phone} | Dự án: ${l.project_name || 'Chung'}`)
      .join('\n');

    const plainBody = `Xin chào ${params.saleName},

Quản lý ${params.managerName || 'Hệ thống'} vừa phân bổ ${params.leads.length} khách hàng tiềm năng mới cho bạn:

${leadListPlain}

⏱ Lưu ý quy tắc SLA 24h: Vui lòng liên hệ và cập nhật tình trạng chăm sóc trước hạn để tránh bị tự động thu hồi.
Lý do: ${params.reason || 'Phân bổ hàng loạt theo kế hoạch kinh doanh'}

👉 Xem toàn bộ danh sách lead của bạn tại:
${leadUrl}

Trân trọng,
${params.managerName || 'Phòng Kinh Doanh'}`;

    const zaloText = `🏢 [CRM BROKER] BÀN GIAO ${params.leads.length} LEAD MỚI
Xin chào ${params.saleName},
Quản lý ${params.managerName || 'Hệ thống'} vừa giao cho bạn ${params.leads.length} khách hàng mới:
${leadListPlain}
⏱ Hạn SLA 24h: Vui lòng liên hệ và cập nhật trạng thái chăm sóc.
👉 Link CRM: ${leadUrl}`;

    const cleanPhone = (params.salePhone || '').replace(/[^0-9]/g, '');
    const zaloUrl = cleanPhone ? `https://zalo.me/${cleanPhone}` : undefined;

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(params.saleEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`;
    const mailtoUrl = `mailto:${encodeURIComponent(params.saleEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`;

    return {
      subject,
      plainBody,
      zaloText,
      gmailUrl,
      mailtoUrl,
      zaloUrl,
      leadUrl,
    };
  }
  /**
   * 1. LẤY CẤU HÌNH THÔNG BÁO EMAIL
   */
  async getEmailConfig(): Promise<EmailNotificationConfig> {
    if (isLiveSupabaseConfigured) {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'email_notification_config')
        .maybeSingle();

      if (data && data.value) {
        return { ...DEFAULT_EMAIL_CONFIG, ...data.value };
      }
    }

    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    return raw ? { ...DEFAULT_EMAIL_CONFIG, ...JSON.parse(raw) } : DEFAULT_EMAIL_CONFIG;
  }

  /**
   * 2. LƯU CẤU HÌNH THÔNG BÁO EMAIL
   */
  async saveEmailConfig(config: Partial<EmailNotificationConfig>): Promise<EmailNotificationConfig> {
    const current = await this.getEmailConfig();
    const updated = { ...current, ...config };

    if (isLiveSupabaseConfigured) {
      await supabase
        .from('system_settings')
        .upsert({
          key: 'email_notification_config',
          value: updated,
          description: 'Cấu hình gửi email thông báo phân bổ và điều chuyển lead',
        });
    }

    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(updated));
    return updated;
  }

  /**
   * 3. TEMPLATE EMAIL HTML CHUẨN TIẾNG VIỆT RESPONSIVE
   */
  renderEmailTemplate(
    eventType: NotificationEventType,
    variables: Record<string, string>,
    isBulk: boolean = false
  ): { title: string; html: string } {
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://crm-broker-platform.vercel.app';
    const primaryColor = '#2563eb';

    // Header chung
    const headerHtml = `
      <div style="background: linear-gradient(135deg, #1e293b, #0f172a); padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          🏢 HỆ THỐNG CRM QUẢN LÝ BẤT ĐỘNG SẢN
        </h1>
        <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 12px;">Thông Báo Điều Phối & Chăm Sóc Khách Hàng</p>
      </div>
    `;

    // Footer chung
    const footerHtml = `
      <div style="background-color: #f8fafc; padding: 18px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b;">
        <p style="margin: 0;">Email được gửi tự động từ Hệ thống CRM Bất Động Sản.</p>
        <p style="margin: 4px 0 0 0;">Bạn có thể bật/tắt nhận email thông báo trong phần Hồ Sơ Cá Nhân hoặc liên hệ Trưởng phòng kinh doanh.</p>
      </div>
    `;

    // Nút CTA
    const buttonHtml = (url: string, text: string) => `
      <div style="text-align: center; margin: 25px 0;">
        <a href="${url}" style="background-color: ${primaryColor}; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 13px; display: inline-block; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
          ${text} →
        </a>
      </div>
    `;

    let title = '';
    let bodyContent = '';

    if (isBulk) {
      title = `[CRM Broker] Tổng hợp giao ${variables.lead_count || ''} Lead mới cho bạn`;
      bodyContent = `
        <h3 style="color: #0f172a; font-size: 16px; margin-top: 0;">Xin chào ${variables.ten_sale},</h3>
        <p style="color: #334155; line-height: 1.6; font-size: 13px;">
          Quản lý <strong>${variables.nguoi_giao || 'Hệ thống'}</strong> vừa phân bổ <strong>${variables.lead_count} khách hàng tiềm năng</strong> mới cho bạn vào lúc ${variables.thoi_gian}.
        </p>
        <div style="margin: 16px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          ${variables.lead_table_html || ''}
        </div>
        <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 12px 16px; margin: 18px 0; border-radius: 4px; font-size: 12px; color: #1e40af;">
          ⏱ <strong>Quy tắc SLA 24 giờ liên tục:</strong> Vui lòng liên hệ và cập nhật tình trạng chăm sóc hoặc ghi nhận hoạt động cho các Lead trước hạn để tránh bị hệ thống tự động thu hồi.
        </div>
        ${buttonHtml(`${siteUrl}/leads`, 'Xem Danh Sách Lead Của Bạn')}
      `;
    } else if (eventType === 'new_assign' || eventType === 'lead_transferred' || eventType === 'auto_transferred_new') {
      title = `[CRM Broker] Bàn giao Lead khách hàng: ${variables.ten_khach_hang || 'Khách hàng'} - ${variables.du_an || 'Dự án'}`;
      bodyContent = `
        <h3 style="color: #0f172a; font-size: 16px; margin-top: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          Xin chào ${variables.ten_sale || 'bạn'},
        </h3>
        <p style="color: #334155; line-height: 1.6; font-size: 13px;">
          Bạn vừa được bàn giao phụ trách khách hàng tiềm năng <strong>${variables.ten_khach_hang}</strong> quan tâm dự án <strong>${variables.du_an}</strong>. Dưới đây là thông tin liên hệ, chân dung khách hàng, bước kịch bản hiện tại và gợi ý tư vấn từ Trợ lý AI:
        </p>

        <!-- BẢNG THÔNG TIN KHÁCH HÀNG -->
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 14px; color: #64748b; width: 140px; font-weight: 500;">👤 Khách hàng:</td>
            <td style="padding: 10px 14px; font-weight: bold; color: #0f172a;">${variables.ten_khach_hang}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 14px; color: #64748b; font-weight: 500;">📞 Số điện thoại:</td>
            <td style="padding: 10px 14px; font-weight: bold; color: #2563eb; font-size: 14px;">${variables.so_dien_thoai}</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; color: #64748b; font-weight: 500;">🏢 Dự án quan tâm:</td>
            <td style="padding: 10px 14px; font-weight: bold; color: #0f172a;">${variables.du_an}</td>
          </tr>
        </table>

        <!-- KHỐI 1: CHÂN DUNG KHÁCH HÀNG (CUSTOMER PERSONA) -->
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <div style="font-weight: bold; color: #1e293b; font-size: 13px; margin-bottom: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
            🎯 CHÂN DUNG & NHU CẦU KHÁCH HÀNG
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; line-height: 1.6;">
            <tr>
              <td style="padding: 4px 0; color: #64748b; width: 140px;">Mục đích sở hữu:</td>
              <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${variables.muc_dich || 'Đầu tư sinh lời / Mua an cư'}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Ngân sách dự kiến:</td>
              <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${variables.ngan_sach || 'Theo tầm giá phân khúc dự án'}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Loại BĐS ưu tiên:</td>
              <td style="padding: 4px 0; color: #334155;">${variables.loai_bds || 'Căn hộ cao cấp / Nhà phố liền kề'}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b; vertical-align: top;">Ghi chú & Nhu cầu:</td>
              <td style="padding: 4px 0; color: #334155; font-style: italic;">"${variables.ghi_chu || 'Khách đang tìm hiểu dự án, cần tư vấn giỏ hàng và phương án tài chính.'}"</td>
            </tr>
          </table>
        </div>

        <!-- KHỐI 2: BƯỚC TRONG KỊCH BẢN BÁN HÀNG -->
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; margin: 16px 0;">
          <div style="font-weight: bold; color: #166534; font-size: 12px; margin-bottom: 4px;">
            📍 GIAI ĐOẠN TRONG KỊCH BẢN BÁN HÀNG (SALES SCRIPT STAGE)
          </div>
          <p style="margin: 0; color: #15803d; font-size: 13px; font-weight: 600;">
            ${variables.buoc_kich_ban || 'Bước 1: Tiếp cận ban đầu & Khai thác nhu cầu cốt lõi'}
          </p>
        </div>

        <!-- KHỐI 3: GỢI Ý KỊCH BẢN TƯ VẤN TỪ TRỢ LÝ AI (AI SALES SCRIPT) -->
        <div style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <div style="font-weight: bold; color: #6b21a8; font-size: 12px; margin-bottom: 8px;">
            ✨ GỢI Ý KỊCH BẢN TƯ VẤN PHÙ HỢP (TRỢ LÝ AI)
          </div>
          <div style="background-color: #ffffff; border: 1px dashed #d8b4fe; border-radius: 6px; padding: 12px; font-size: 12px; color: #3b0764; line-height: 1.6; font-style: italic;">
            "${variables.ai_script || 'Dạ em chào Anh/Chị! Em là chuyên viên tư vấn dự án... Em vừa nhận được thông tin Anh/Chị đang quan tâm căn hộ/nhà phố phù hợp tầm tài chính. Em xin phép chia sẻ 2 phương án căn đẹp nhất đợt này nhé ạ!'}"
          </div>
        </div>

        <!-- KHỐI 4: HẠN CHÓT SLA 24 GIỜ -->
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 18px 0; border-radius: 4px; font-size: 12px; color: #991b1b;">
          ⏱ <strong>Hạn chót chăm sóc (SLA 24 giờ):</strong> ${variables.han_cham_soc || 'Trong vòng 24 giờ kể từ thời điểm nhận'}.<br/>
          <span style="font-size: 11px; color: #7f1d1d;">Lưu ý: Vui lòng liên hệ và cập nhật tình trạng chăm sóc hoặc ghi nhận cuộc gọi/lịch hẹn trước thời hạn để giữ Lead.</span>
        </div>

        ${buttonHtml(`${siteUrl}/leads/${variables.lead_id}`, 'Xem Chi Tiết Lead & Trợ Lý AI Tư Vấn')}
      `;
    } else if (eventType === 'lead_revoked' || eventType === 'auto_transferred_old') {
      title = `[CRM Broker] Thông báo thu hồi Lead: ${variables.ten_khach_hang}`;
      bodyContent = `
        <h3 style="color: #0f172a; font-size: 16px; margin-top: 0;">Xin chào ${variables.ten_sale},</h3>
        <p style="color: #334155; line-height: 1.6; font-size: 13px;">
          Hệ thống thông báo Lead <strong>${variables.ten_khach_hang}</strong> (${variables.du_an}) đã được thu hồi và điều chuyển cho nhân sự khác ${eventType === 'auto_transferred_old' ? 'do quá hạn 24 giờ liên tục không có hoạt động chăm sóc' : 'theo yêu cầu của Trưởng phòng kinh doanh'}.
        </p>
        <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 18px 0; border-radius: 4px; font-size: 12px; color: #92400e;">
          💡 <strong>Mẹo:</strong> Hãy luôn cập nhật tình trạng chăm sóc hoặc tạo lịch hẹn tương lai để giữ Lead và tối ưu tỷ lệ chuyển đổi.
        </div>
      `;
    } else if (eventType === 'overdue_warning') {
      title = `[Cảnh báo gấp] Lead ${variables.ten_khach_hang} sắp bị chuyển sau 4 giờ`;
      bodyContent = `
        <h3 style="color: #dc2626; font-size: 16px; margin-top: 0;">⚠️ CẢNH BÁO SẮP HẾT HẠN CHĂM SÓC LEAD</h3>
        <p style="color: #334155; line-height: 1.6; font-size: 13px;">
          Xin chào <strong>${variables.ten_sale}</strong>, Lead <strong>${variables.ten_khach_hang}</strong> (${variables.du_an}) đã qua <strong>20 giờ</strong> chưa được cập nhật chăm sóc.
        </p>
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px; margin: 16px 0; font-size: 13px;">
          <p style="margin: 0 0 6px 0; color: #991b1b; font-weight: bold;">
            Thời gian còn lại: Khoảng 4 giờ (Hạn chót: ${variables.han_cham_soc})
          </p>
          <p style="margin: 0; color: #475569; font-size: 12px;">
            Nếu bạn không đổi trạng thái hoặc ghi nhận 1 cuộc gọi/lịch hẹn, Lead sẽ bị tự động chuyển sang Sale tiếp theo theo quy tắc công bằng.
          </p>
        </div>
        ${buttonHtml(`${siteUrl}/leads/${variables.lead_id}`, 'Cập Nhật Lead Ngay')}
      `;
    } else if (eventType === 'pool_alert') {
      title = `[Cảnh báo Quản lý] Lead ${variables.ten_khach_hang} đã chuyển về Kho Lead Chung`;
      bodyContent = `
        <h3 style="color: #b91c1c; font-size: 16px; margin-top: 0;">Thông Báo Dành Cho Quản Lý</h3>
        <p style="color: #334155; line-height: 1.6; font-size: 13px;">
          Lead <strong>${variables.ten_khach_hang}</strong> thuộc dự án <strong>${variables.du_an}</strong> đã chuyển qua <strong>${variables.transfer_count || 3} chuyên viên tư vấn</strong> nhưng đều quá hạn chăm sóc.
        </p>
        <p style="color: #334155; font-size: 13px;">
          Lead hiện đã được đưa về <strong>Kho Lead Chung (Pool)</strong> để Trưởng phòng / Giám đốc sàn trực tiếp can thiệp hoặc chỉ định nhân sự chuyên biệt.
        </p>
        ${buttonHtml(`${siteUrl}/distribution`, 'Vào Trung Tâm Điều Phối Lead')}
      `;
    }

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 20px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; overflow: hidden;">
          ${headerHtml}
          <div style="padding: 24px;">
            ${bodyContent}
          </div>
          ${footerHtml}
        </div>
      </body>
      </html>
    `;

    return { title, html: fullHtml };
  }

  /**
   * 4. GỬI THÔNG BÁO / EMAIL (IDEMPOTENCY & QUEUE RETRY)
   */
  async sendNotification(options: {
    leadId?: string;
    recipientId?: string;
    recipientEmail: string;
    recipientName?: string;
    eventType: NotificationEventType;
    channel?: 'email' | 'in_app' | 'both';
    variables: Record<string, string>;
    isBulk?: boolean;
    leadTableHtml?: string;
  }): Promise<{ success: boolean; logId?: string; error?: string }> {
    const config = await this.getEmailConfig();
    if (!config.enabled) {
      return { success: false, error: 'Thông báo email đang bị tắt trong hệ thống.' };
    }

    // Kiểm tra cấu hình theo loại sự kiện
    if (options.eventType === 'new_assign' && !config.enable_new_assign) return { success: true };
    if ((options.eventType === 'lead_transferred' || options.eventType === 'auto_transferred_new') && !config.enable_transfer) return { success: true };
    if ((options.eventType === 'lead_revoked' || options.eventType === 'auto_transferred_old') && !config.enable_revoke) return { success: true };
    if (options.eventType === 'overdue_warning' && !config.enable_overdue_warning) return { success: true };

    // Gửi tín hiệu bổ sung tới Custom Webhook (Zalo / Telegram / Make / Zapier) nếu cấu hình
    if (config.custom_webhook_url && typeof window !== 'undefined') {
      try {
        fetch(config.custom_webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: options.eventType,
            lead_id: options.leadId,
            recipient_email: options.recipientEmail,
            recipient_name: options.recipientName,
            timestamp: new Date().toISOString(),
            ...options.variables,
          }),
        }).catch(e => console.warn('[Custom Webhook Dispatch Error]:', e));
      } catch (err) {
        console.warn('[Custom Webhook Exception]:', err);
      }
    }

    // Kiểm tra email người nhận hợp lệ
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!options.recipientEmail || !emailRegex.test(options.recipientEmail)) {
      console.warn(`[NotificationService] Bỏ qua gửi email do địa chỉ không hợp lệ: ${options.recipientEmail}`);
      return { success: false, error: `Email không hợp lệ: ${options.recipientEmail}` };
    }

    // Idempotency key: chống gửi lặp cùng 1 lead + 1 sale + 1 sự kiện trong cùng 1 khoảng thời gian
    const hourKey = new Date().toISOString().slice(0, 13); // Chu kỳ 1 giờ
    const idempotencyKey = `${options.leadId || 'bulk'}_${options.recipientId || options.recipientEmail}_${options.eventType}_${hourKey}`;

    // Kiểm tra xem đã gửi chưa
    const existingLog = await this.findLogByIdempotency(idempotencyKey);
    if (existingLog && existingLog.status === 'sent') {
      return { success: true, logId: existingLog.id };
    }

    const { title, html } = this.renderEmailTemplate(
      options.eventType,
      options.variables,
      options.isBulk
    );

    const logId = crypto.randomUUID();
    const newLog: NotificationLog = {
      id: logId,
      lead_id: options.leadId,
      recipient_id: options.recipientId,
      recipient_email: options.recipientEmail,
      recipient_name: options.recipientName,
      event_type: options.eventType,
      channel: options.channel || 'email',
      title,
      content: html,
      status: 'pending',
      retry_count: 0,
      idempotency_key: idempotencyKey,
      created_at: new Date().toISOString(),
    };

    await this.saveNotificationLog(newLog);

    // Xử lý gửi bất đồng bộ (Non-blocking)
    return this.dispatchEmailWithRetry(newLog);
  }

  /**
   * 4.5 XÂY DỰNG CHÂN DUNG KHÁCH HÀNG & GỢI Ý KỊCH BẢN AI
   */
  buildLeadPersonaAndScript(lead: Partial<Lead>): {
    mucDich: string;
    nganSach: string;
    loaiBds: string;
    ghiChu: string;
    buocKichBan: string;
    aiScript: string;
  } {
    const isInvest = lead.purpose === 'investment';
    const mucDich = isInvest 
      ? 'Đầu tư sinh lời (ưu tiên dòng tiền cho thuê & tiềm năng tăng giá)' 
      : (lead.purpose === 'residence' ? 'Mua để ở / an cư (ưu tiên tiện ích, trường học & môi trường sống gia đình)' : 'Đầu tư kết hợp an cư');

    const nganSach = (lead.budget_min && lead.budget_max)
      ? `${((lead.budget_min || 0) / 1e9).toFixed(1)} - ${((lead.budget_max || 0) / 1e9).toFixed(1)} tỷ`
      : (lead.budget_min ? `Từ ${((lead.budget_min || 0) / 1e9).toFixed(1)} tỷ` : 'Khoảng 3.5 - 6.0 tỷ (theo phân khúc dự án)');

    const loaiBds = lead.preferred_property_type || 'Căn hộ cao cấp 2PN / Nhà phố liền kề';
    const ghiChu = lead.notes || 'Khách quan tâm phân khu mới, cần tư vấn bảng giá và tiến độ thanh toán chi tiết.';

    let buocKichBan = 'Bước 1: Tiếp cận ban đầu & Khai thác nhu cầu cốt lõi';
    let aiScript = `Dạ em chào Anh/Chị ${lead.customer_name || (lead as any).customer?.full_name || 'Quý khách'}! Em là chuyên viên phụ trách dự án ${lead.project_name || (lead as any).project?.name || 'bất động sản'}. Em được biết Anh/Chị đang tìm hiểu sản phẩm phù hợp nhu cầu ${isInvest ? 'đầu tư sinh lời' : 'an cư'} với tầm tài chính ${nganSach}. Em vừa lọc được giỏ hàng 2 căn đẹp nhất đợt này có chiết khấu tốt, em xin phép gửi thông tin chi tiết qua Zalo để Anh/Chị tham khảo nhé ạ!`;

    if (lead.status === 'contacted' || lead.status === 'qualifying' || lead.status === 'doc_sent') {
      buocKichBan = 'Bước 2: Phân tích giỏ hàng & Tư vấn chính sách tài chính';
      aiScript = `Dạ Anh/Chị ${lead.customer_name || (lead as any).customer?.full_name || 'Quý khách'}, tiếp nối trao đổi lần trước, bên em đang có gói hỗ trợ ân hạn gốc lãi rất tối ưu cho bài toán ${isInvest ? 'dòng tiền đầu tư' : 'nhận nhà sớm'}. Em đã chuẩn bị sẵn bảng tính dòng tiền chi tiết cho căn phù hợp ngân sách ${nganSach} để gửi Anh/Chị nhé ạ!`;
    } else if (lead.status === 'appointment_set' || lead.status === 'consulted' || lead.status === 'site_visit') {
      buocKichBan = 'Bước 3: Thiết lập cuộc hẹn xem Sa bàn & Căn hộ mẫu thực tế';
      aiScript = `Dạ Anh/Chị ${lead.customer_name || (lead as any).customer?.full_name || 'Quý khách'}, dự án ${lead.project_name || (lead as any).project?.name || ''} tuần này đang mở cửa đón khách VIP tham quan nhà mẫu hoàn thiện. Em đã đăng ký sẵn cho gia đình 1 suất VIP có xe đón tận nơi vào Thứ 7 này, em xin phép đón Anh/Chị ghé trải nghiệm thực tế nhé ạ?`;
    } else if (lead.status === 'considering' || lead.status === 'booking' || lead.status === 'deposit' || lead.status === 'contract') {
      buocKichBan = 'Bước 4: Xử lý từ chối & Đàm phán chốt cọc / Ký HĐMB';
      aiScript = `Dạ Anh/Chị ${lead.customer_name || (lead as any).customer?.full_name || 'Quý khách'}, căn Anh/Chị đang quan tâm hiện đang có mức ưu đãi tốt nhất đợt này. Nếu Anh/Chị quyết định trong tuần này, em sẽ xin Giám đốc sàn suất quà tặng gói nội thất đặc biệt để tối ưu tài chính cho gia đình mình nhé ạ!`;
    }

    return { mucDich, nganSach, loaiBds, ghiChu, buocKichBan, aiScript };
  }

  /**
   * 5. GỬI EMAIL GỘP HÀNG LOẠT (BULK ASSIGN DIGEST)
   * Thay vì gửi 10 email cho 1 sale khi giao 10 lead, chỉ gửi duy nhất 1 email tổng hợp!
   */
  async sendBulkAssignDigest(
    sale: UserProfile,
    leads: Lead[],
    assignerName: string
  ): Promise<{ success: boolean; error?: string }> {
    if (leads.length === 0) return { success: true };

    // Tạo bảng HTML danh sách các lead được giao - đảm bảo không bị undefined
    const rows = leads.map((l, idx) => {
      const customerName = l.customer_name || (l as any).full_name || (l as any).customer?.full_name || 'Khách hàng';
      const customerPhone = l.customer_phone || (l as any).phone || (l as any).customer?.phone || '---';
      const projectName = l.project_name || (l as any).project?.name || 'Dự án';
      const notes = l.notes || '---';

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 10px 12px; font-weight: bold; color: #0f172a;">${idx + 1}. ${customerName}</td>
          <td style="padding: 10px 12px; color: #2563eb; font-weight: bold;">${customerPhone}</td>
          <td style="padding: 10px 12px; color: #334155;">${projectName}</td>
          <td style="padding: 10px 12px; color: #64748b; font-size: 11px;">${notes}</td>
        </tr>
      `;
    }).join('');

    const leadTableHtml = `
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="background-color: #f1f5f9; text-align: left; color: #475569; font-weight: bold; border-bottom: 2px solid #cbd5e1;">
            <th style="padding: 8px 12px;">Khách Hàng</th>
            <th style="padding: 8px 12px;">Số Điện Thoại</th>
            <th style="padding: 8px 12px;">Dự Án</th>
            <th style="padding: 8px 12px;">Ghi Chú</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;

    return this.sendNotification({
      recipientId: sale.id,
      recipientEmail: sale.email,
      recipientName: sale.full_name,
      eventType: 'bulk_assign',
      isBulk: true,
      leadTableHtml,
      variables: {
        ten_sale: sale.full_name,
        nguoi_giao: assignerName,
        lead_count: String(leads.length),
        thoi_gian: new Date().toLocaleString('vi-VN'),
        lead_table_html: leadTableHtml,
      },
    });
  }

  /**
   * 6. DISPATCHER GỬI EMAIL VỚI RETRY (TỐI ĐA 3 LẦN)
   */
  private async dispatchEmailWithRetry(log: NotificationLog): Promise<{ success: boolean; logId: string; error?: string }> {
    let attempts = 0;
    const maxRetries = 3;
    const config = await this.getEmailConfig();
    const hasLiveCredentials = (config.smtp_user && config.smtp_pass) || config.resend_api_key || config.google_apps_script_url;

    while (attempts < maxRetries) {
      try {
        attempts++;
        console.log(`[NotificationService] Đang gửi email "${log.title}" tới ${log.recipient_email} (Lần thử ${attempts}/${maxRetries})...`);

        // Nếu đã cấu hình tài khoản Gmail, Apps Script hoặc Resend, gọi API serverless thực để gửi ra ngoài
        if (hasLiveCredentials && typeof window !== 'undefined') {
          const res = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: log.recipient_email,
              subject: log.title,
              html: log.content,
              fromName: config.smtp_from_name || 'CRM Bất Động Sản',
              fromEmail: config.smtp_from_email || config.smtp_user,
              config: {
                provider: config.provider || (config.google_apps_script_url ? 'google_apps_script' : 'gmail_smtp'),
                smtp_host: config.smtp_host || 'smtp.gmail.com',
                smtp_port: config.smtp_port || 465,
                smtp_user: config.smtp_user,
                smtp_pass: config.smtp_pass,
                resend_api_key: config.resend_api_key,
                google_apps_script_url: config.google_apps_script_url,
              },
            }),
          });

          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || 'Lỗi khi gửi email qua SMTP Gateway');
          }
        }

        // Đánh dấu gửi thành công
        log.status = 'sent';
        log.sent_at = new Date().toISOString();
        log.retry_count = attempts;
        log.error_message = undefined;
        await this.updateNotificationLog(log);

        return { success: true, logId: log.id };
      } catch (err: any) {
        console.error(`[NotificationService] Lỗi gửi email lần ${attempts}:`, err);
        log.retry_count = attempts;
        log.error_message = err?.message || 'Lỗi không xác định khi kết nối dịch vụ Email';
        if (attempts >= maxRetries) {
          log.status = 'failed';
          await this.updateNotificationLog(log);
          return { success: false, logId: log.id, error: log.error_message };
        }
        // Exponential backoff: chờ trước khi retry
        await new Promise(r => setTimeout(r, 500 * attempts));
      }
    }

    return { success: false, logId: log.id, error: 'Vượt quá số lần thử lại tối đa' };
  }

  /**
   * 6.1 GỬI THỬ EMAIL (TEST CONNECTION)
   */
  async sendTestEmail(targetEmail: string, customConfig?: Partial<EmailNotificationConfig>): Promise<{ success: boolean; error?: string }> {
    const savedConfig = await this.getEmailConfig();
    const config = { ...savedConfig, ...(customConfig || {}) };

    // Tự động chuẩn hóa Google Apps Script URL (trim và đổi /dev thành /exec)
    if (config.google_apps_script_url) {
      config.google_apps_script_url = config.google_apps_script_url.trim();
      if (config.google_apps_script_url.endsWith('/dev')) {
        config.google_apps_script_url = config.google_apps_script_url.replace(/\/dev$/, '/exec');
      }
    }

    if (!config.smtp_user || !config.smtp_pass) {
      if (!config.resend_api_key && !config.google_apps_script_url) {
        return { 
          success: false, 
          error: 'Vui lòng điền URL Google Apps Script Webhook, Resend API hoặc Mật khẩu ứng dụng trước khi gửi thử.' 
        };
      }
    }

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: targetEmail,
          subject: '[CRM Broker] Xác Nhận Kết Nối Email Thành Công 🎉',
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 520px; margin: 20px auto; background-color: #ffffff;">
              <div style="text-align: center; margin-bottom: 20px;">
                <h1 style="color: #16a34a; font-size: 22px; margin: 0;">🎉 Kết Nối Email Thành Công!</h1>
                <p style="color: #64748b; font-size: 13px; margin: 6px 0 0 0;">Hệ thống CRM Quản Lý Bất Động Sản</p>
              </div>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; font-size: 13px; line-height: 1.6; color: #334155;">
                <p style="margin: 0 0 8px 0;">Xin chào,</p>
                <p style="margin: 0 0 8px 0;">Email này được gửi thử từ hệ thống CRM Broker qua tài khoản gửi: <strong>${config.smtp_user || config.smtp_from_email || 'Google Apps Script / Resend'}</strong>.</p>
                <p style="margin: 0;">Cấu hình cổng gửi email đã hoạt động chính xác. Từ bây giờ các Sale sẽ nhận được email ngay cả khi hệ thống tự động đảo lead lúc nửa đêm!</p>
              </div>
              <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
                Thời gian gửi: ${new Date().toLocaleString('vi-VN')}
              </div>
            </div>
          `,
          fromName: config.smtp_from_name || 'CRM Bất Động Sản',
          fromEmail: config.smtp_from_email || config.smtp_user,
          config: {
            provider: config.provider || (config.google_apps_script_url ? 'google_apps_script' : 'gmail_smtp'),
            smtp_host: config.smtp_host || 'smtp.gmail.com',
            smtp_port: config.smtp_port || 465,
            smtp_user: config.smtp_user,
            smtp_pass: config.smtp_pass,
            resend_api_key: config.resend_api_key,
            google_apps_script_url: config.google_apps_script_url,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Gửi thử thất bại' };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Không thể kết nối đến API Gateway gửi mail' };
    }
  }

  /**
   * 7. LƯU VÀ CẬP NHẬT LOGS
   */
  private async saveNotificationLog(log: NotificationLog): Promise<void> {
    if (isLiveSupabaseConfigured) {
      await supabase.from('notification_logs').insert(log);
      return;
    }

    const logs = this.getLocalLogs();
    logs.unshift(log);
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs.slice(0, 300)));
  }

  private async updateNotificationLog(log: NotificationLog): Promise<void> {
    if (isLiveSupabaseConfigured) {
      await supabase
        .from('notification_logs')
        .update({
          status: log.status,
          retry_count: log.retry_count,
          error_message: log.error_message,
          sent_at: log.sent_at,
        })
        .eq('id', log.id);
      return;
    }

    const logs = this.getLocalLogs();
    const idx = logs.findIndex(l => l.id === log.id);
    if (idx !== -1) {
      logs[idx] = log;
      localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));
    }
  }

  private async findLogByIdempotency(key: string): Promise<NotificationLog | null> {
    if (isLiveSupabaseConfigured) {
      const { data } = await supabase
        .from('notification_logs')
        .select('*')
        .eq('idempotency_key', key)
        .maybeSingle();
      return data as NotificationLog | null;
    }

    const logs = this.getLocalLogs();
    return logs.find(l => l.idempotency_key === key) || null;
  }

  async getNotificationLogs(limit: number = 50): Promise<NotificationLog[]> {
    if (isLiveSupabaseConfigured) {
      const { data } = await supabase
        .from('notification_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      return (data || []) as NotificationLog[];
    }

    return this.getLocalLogs().slice(0, limit);
  }

  async retryNotification(logId: string): Promise<{ success: boolean; error?: string }> {
    const logs = await this.getNotificationLogs(100);
    const target = logs.find(l => l.id === logId);
    if (!target) return { success: false, error: 'Không tìm thấy log thông báo.' };

    target.status = 'pending';
    target.error_message = undefined;
    return this.dispatchEmailWithRetry(target);
  }

  private getLocalLogs(): NotificationLog[] {
    const raw = localStorage.getItem(STORAGE_KEY_LOGS);
    return raw ? JSON.parse(raw) : [];
  }
}

export const notificationService = new NotificationService();
