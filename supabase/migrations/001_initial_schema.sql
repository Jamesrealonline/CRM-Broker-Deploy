-- ========================================================
-- REAL ESTATE CRM - SALES & MARKETING INTELLIGENCE PLATFORM
-- MIGRATION 001: INITIAL SCHEMA
-- PostgreSQL on Supabase
-- ========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TỔ CHỨC (ORGANIZATIONS, AGENCIES, PROJECTS)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    tax_number VARCHAR(50),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    developer VARCHAR(255) NOT NULL, -- Chủ đầu tư
    location TEXT NOT NULL,
    property_type VARCHAR(100) NOT NULL, -- Căn hộ, Nhà phố, Biệt thự, Shophouse...
    expected_price_range VARCHAR(100),
    scale TEXT, -- Quy mô (số toà, số căn, diện tích...)
    status VARCHAR(50) DEFAULT 'opening' CHECK (status IN ('upcoming', 'opening', 'sold_out', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agency_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agency_id, project_id)
);

-- 2. NHÂN SỰ VÀ PHÂN QUYỀN (TEAMS, PROFILES, ROLE_PERMISSIONS, USER_PROJECTS)
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    leader_id UUID, -- Sẽ trỏ tới profiles(id) sau khi tạo profiles
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agency_id, code)
);

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    avatar_url TEXT,
    role VARCHAR(50) NOT NULL CHECK (role IN (
        'admin', 
        'director', 
        'marketing_manager', 
        'sales_manager', 
        'team_leader', 
        'sale_agent'
    )),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'locked')),
    must_change_password BOOLEAN DEFAULT true,
    totp_enabled BOOLEAN DEFAULT false,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Thêm foreign key leader_id vào teams
ALTER TABLE teams 
    ADD CONSTRAINT fk_teams_leader 
    FOREIGN KEY (leader_id) REFERENCES profiles(id) ON DELETE SET NULL;

CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

CREATE TABLE user_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, project_id)
);

CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role VARCHAR(50) NOT NULL,
    resource VARCHAR(100) NOT NULL, -- dashboard, leads, journey, distribution, projects, scripts, admin, reports...
    action VARCHAR(50) NOT NULL, -- view, create, edit, delete, export, assign...
    is_allowed BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role, resource, action)
);

-- 3. KHÁCH HÀNG & LEAD (CUSTOMERS, LEADS, SOURCES, CAMPAIGNS, ASSIGNMENTS)
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    phone_normalized VARCHAR(20) NOT NULL, -- Chuẩn hoá 84... hoặc 0...
    email VARCHAR(100),
    identity_card VARCHAR(50), -- CCCD/CMND
    address TEXT,
    consent_obtained BOOLEAN DEFAULT true, -- Tuân thủ Nghị định 13/2023/NĐ-CP
    consent_date TIMESTAMPTZ DEFAULT NOW(),
    anonymized_at TIMESTAMPTZ, -- Cho quyền xoá/ẩn dữ liệu cá nhân
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_customers_phone_normalized ON customers(phone_normalized);

CREATE TABLE lead_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL, -- Website Form, Facebook Ads, Google Search, Zalo, Giới thiệu, Hotline...
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    source_id UUID REFERENCES lead_sources(id) ON DELETE SET NULL,
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    budget NUMERIC(15, 2) DEFAULT 0,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15 TRẠNG THÁI CUSTOMER JOURNEY
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    source_id UUID REFERENCES lead_sources(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN (
        'new',              -- Mới tiếp nhận
        'unreachable',      -- Không nghe máy
        'invalid',          -- Sai số / Không nhu cầu
        'contacted',        -- Đã liên hệ
        'qualifying',       -- Xác định nhu cầu
        'doc_sent',         -- Gửi tài liệu
        'appointment_set',  -- Đặt hẹn
        'consulted',        -- Đã gặp tư vấn
        'site_visit',       -- Đi xem dự án
        'considering',      -- Đang cân nhắc
        'booking',          -- Booking giữ chỗ (bắt buộc mã Booking)
        'deposit',          -- Đặt cọc (bắt buộc số tiền, ngày cọc)
        'contract',         -- Ký HĐMB (bắt buộc mã HĐMB)
        'after_sales',      -- Chăm sóc sau bán
        'lost'              -- Thất bại / Đóng
    )),
    lead_score INT DEFAULT 50 CHECK (lead_score BETWEEN 0 AND 100),
    budget_min NUMERIC(15, 2),
    budget_max NUMERIC(15, 2),
    purpose VARCHAR(50) DEFAULT 'investment' CHECK (purpose IN ('residence', 'investment', 'both', 'undecided')),
    preferred_property_type VARCHAR(100),
    notes TEXT,
    lost_reason TEXT,
    last_action_at TIMESTAMPTZ DEFAULT NOW(),
    next_follow_up TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_project_id ON leads(project_id);
CREATE INDEX idx_leads_agency_id ON leads(agency_id);
CREATE INDEX idx_leads_team_id ON leads(team_id);
CREATE INDEX idx_leads_status ON leads(status);

CREATE TABLE lead_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    previous_assignee UUID REFERENCES profiles(id) ON DELETE SET NULL,
    new_assignee UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    method VARCHAR(50) NOT NULL CHECK (method IN ('round_robin', 'manual', 'performance', 'reclaim')),
    reason TEXT,
    assigned_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CHĂM SÓC (ACTIVITIES, STATUS_HISTORY, APPOINTMENTS, TASKS)
CREATE TABLE lead_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('call', 'meeting', 'site_visit', 'zalo_message', 'email', 'note', 'system')),
    title VARCHAR(255) NOT NULL,
    content TEXT,
    result VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE lead_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL,
    location TEXT,
    type VARCHAR(50) DEFAULT 'meeting' CHECK (type IN ('meeting', 'site_visit', 'online_call')),
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
    result_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. GIAO DỊCH (DEALS, TRANSACTIONS)
CREATE TABLE deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    unit_code VARCHAR(100), -- Mã căn hộ/lô đất
    deal_value NUMERIC(15, 2) NOT NULL,
    commission_rate NUMERIC(5, 2) DEFAULT 0,
    commission_amount NUMERIC(15, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('booking', 'deposit', 'contract')),
    code VARCHAR(100) NOT NULL, -- Mã Booking / Mã Cọc / Mã Hợp đồng
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payment_method VARCHAR(50) DEFAULT 'bank_transfer',
    status VARCHAR(50) DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'refunded', 'cancelled')),
    contract_code VARCHAR(100), -- Điền khi type = 'contract'
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_transactions_lead_id ON transactions(lead_id);
CREATE INDEX idx_transactions_type ON transactions(type);

-- 6. TRI THỨC VÀ AI (PROJECT_KNOWLEDGE, PROJECT_SOURCES, FAQ, SCRIPTS, AI_SCRIPTS, PERSONAS)
CREATE TABLE project_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title VARCHAR(255) NOT NULL,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    is_approved BOOLEAN DEFAULT false
);

CREATE TABLE project_knowledge (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    location TEXT,
    location_source TEXT,
    location_unverified BOOLEAN DEFAULT false,
    
    property_type TEXT,
    property_type_source TEXT,
    property_type_unverified BOOLEAN DEFAULT false,
    
    price_range TEXT,
    price_range_source TEXT,
    price_range_unverified BOOLEAN DEFAULT false,
    
    legal TEXT,
    legal_source TEXT,
    legal_unverified BOOLEAN DEFAULT false,
    
    progress TEXT,
    progress_source TEXT,
    progress_unverified BOOLEAN DEFAULT false,
    
    policy TEXT,
    policy_source TEXT,
    policy_unverified BOOLEAN DEFAULT false,
    
    highlights TEXT,
    highlights_source TEXT,
    highlights_unverified BOOLEAN DEFAULT false,
    
    comparison TEXT,
    comparison_source TEXT,
    comparison_unverified BOOLEAN DEFAULT false,
    
    products TEXT,
    products_source TEXT,
    products_unverified BOOLEAN DEFAULT false,
    
    summary_text VARCHAR(3000), -- Giới hạn 3000 ký tự theo yêu cầu
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE project_faq (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT true,
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sales_scripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL, -- 15 trạng thái Customer Journey
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    version INT DEFAULT 1,
    is_auto BOOLEAN DEFAULT true, -- Tự sinh dựa vào summary_text
    is_edited BOOLEAN DEFAULT false, -- Người dùng đã can thiệp tuỳ chỉnh
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, status)
);

CREATE TABLE customer_personas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL, -- Ví dụ: Nhà đầu tư lướt sóng, Gia đình trẻ an cư, Việt kiều...
    traits TEXT,
    pain_points TEXT,
    buying_triggers TEXT,
    objection_handling TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_scripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    generated_content TEXT NOT NULL,
    is_used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. HỆ THỐNG VÀ BẢO MẬT (AUDIT_LOGS, SYSTEM_SETTINGS, LOGIN_ATTEMPTS, AI_USAGE)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- login, logout, password_change, account_locked, lead_assign, export_csv, permission_change, role_impersonate
    entity_name VARCHAR(100),
    entity_id UUID,
    details JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    ip_address VARCHAR(50),
    failed_attempts INT DEFAULT 1,
    locked_until TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_login_attempts_email ON login_attempts(email);

CREATE TABLE ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    function_name VARCHAR(100) NOT NULL, -- ai-script, ai-lead-insight, project-enrich
    tokens_used INT DEFAULT 0,
    cost_estimated NUMERIC(10, 4) DEFAULT 0,
    called_at TIMESTAMPTZ DEFAULT NOW()
);
