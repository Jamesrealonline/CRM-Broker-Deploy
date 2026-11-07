-- ========================================================
-- MIGRATION 007: LEAD AUTO-TRANSFER & EMAIL NOTIFICATION QUEUE
-- Quy tắc 24 giờ liên tục (Wall-clock), chống vòng lặp,
-- kho lead chung, notification_logs và lead_assignment_history
-- ========================================================

-- 1. Bổ sung các cột phục vụ hạn chăm sóc 24h trên LEADS
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS care_deadline_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_care_updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS auto_transfer_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS previous_assigned_sales JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_exempt_auto_transfer BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS extended_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS extension_reason TEXT;

-- Cập nhật deadline 24h mặc định cho các lead đang có
UPDATE leads 
SET care_deadline_at = COALESCE(care_deadline_at, created_at + INTERVAL '24 hours'),
    last_care_updated_at = COALESCE(last_care_updated_at, created_at)
WHERE care_deadline_at IS NULL;

-- Index tối ưu truy vấn quét batch quá hạn
CREATE INDEX IF NOT EXISTS idx_leads_care_deadline ON leads(care_deadline_at);
CREATE INDEX IF NOT EXISTS idx_leads_last_care_updated ON leads(last_care_updated_at);
CREATE INDEX IF NOT EXISTS idx_leads_exempt ON leads(is_exempt_auto_transfer);

-- 2. Bổ sung trạng thái nhận lead & thông báo trên PROFILES
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS accepts_leads BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS on_leave BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT true;

-- 3. Tạo bảng LỊCH SỬ ĐIỀU CHUYỂN LEAD (lead_assignment_history)
CREATE TABLE IF NOT EXISTS lead_assignment_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    from_sale_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    from_sale_name VARCHAR(255),
    to_sale_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    to_sale_name VARCHAR(255),
    reason VARCHAR(50) NOT NULL CHECK (reason IN (
        'new_assign',          -- Giao mới
        'manual_transfer',     -- Quản lý chuyển thủ công
        'auto_overdue',        -- Hệ thống tự chuyển quá hạn 24h
        'bulk_assign',         -- Giao hàng loạt
        'round_robin',         -- Chia tự động round robin
        'pool_reclaim'         -- Hết lượt thu hồi về kho chung
    )),
    transfer_count INT DEFAULT 0,
    notes TEXT,
    created_by VARCHAR(255) DEFAULT 'system',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_assign_hist_lead ON lead_assignment_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_assign_hist_created ON lead_assignment_history(created_at DESC);

-- 4. Tạo bảng NHẬT KÝ THÔNG BÁO & EMAIL (notification_logs)
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    recipient_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'new_assign',           -- Giao lead mới
        'lead_transferred',     -- Chuyển cho sale mới
        'lead_revoked',         -- Thu hồi khỏi sale cũ
        'bulk_assign',          -- Giao hàng loạt (digest email)
        'overdue_warning',      -- Cảnh báo trước 4h
        'auto_transferred_new', -- Sale mới nhận do quá hạn
        'auto_transferred_old', -- Sale cũ bị thu hồi do quá hạn
        'pool_alert'            -- Cảnh báo lead về kho chung
    )),
    channel VARCHAR(20) DEFAULT 'email' CHECK (channel IN ('email', 'in_app', 'both')),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    retry_count INT DEFAULT 0,
    error_message TEXT,
    idempotency_key VARCHAR(255),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_logs_idempotency ON notification_logs(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_notif_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notif_logs_recipient ON notification_logs(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notif_logs_created ON notification_logs(created_at DESC);

-- 5. Cấu hình mặc định cho Module 7 và Module 6 trong system_settings
INSERT INTO system_settings (key, value, description)
VALUES 
(
    'lead_auto_transfer_config',
    jsonb_build_object(
        'enabled', true,
        'deadline_hours', 24,
        'pre_warning_hours', 20,
        'max_transfer_count', 3,
        'stop_clock_statuses', jsonb_build_array(
            'appointment_set',
            'consulted',
            'site_visit',
            'considering',
            'booking',
            'deposit',
            'contract',
            'after_sales'
        ),
        'quiet_hours_enabled', false,
        'quiet_hours_start', '22:00',
        'quiet_hours_end', '07:00',
        'priority_same_team', true,
        'cc_manager', true
    ),
    'Cấu hình tự động chuyển lead quá hạn 24 giờ liên tục'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;

INSERT INTO system_settings (key, value, description)
VALUES 
(
    'email_notification_config',
    jsonb_build_object(
        'enabled', true,
        'enable_new_assign', true,
        'enable_transfer', true,
        'enable_revoke', true,
        'enable_overdue_warning', true,
        'cc_manager', true,
        'smtp_host', 'smtp.gmail.com',
        'smtp_port', 587,
        'smtp_from_name', 'Hệ Thống CRM Bất Động Sản',
        'smtp_from_email', 'no-reply@crm-broker.vn'
    ),
    'Cấu hình gửi email thông báo phân bổ và điều chuyển lead'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;
