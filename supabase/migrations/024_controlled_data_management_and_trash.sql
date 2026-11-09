-- ========================================================
-- MIGRATION 024: CONTROLLED DATA MANAGEMENT & TRASH BIN (PHASE 7)
-- ========================================================

-- 1. THÊM CỘT PHỤC VỤ KHÓA LẠC QUAN & XÓA MỀM VÀO BẢNG LEADS
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS delete_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_deleted_at ON public.leads(deleted_at);

-- 2. THÊM CỘT VÀO BẢNG TRANSACTIONS (HỢP ĐỒNG / GIAO DỊCH)
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS delete_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_transactions_deleted_at ON public.transactions(deleted_at);

-- 3. THÊM CỘT VÀO BẢNG TEAMS (ĐỘI NHÓM)
ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS delete_reason TEXT;

-- 4. BẢNG TRASH_BINS (THÙNG RÁC QUẢN TRỊ)
CREATE TABLE IF NOT EXISTS public.trash_bins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'draft_contract', 'team', 'agency', 'employee')),
    entity_id TEXT NOT NULL,
    agency_id UUID,
    entity_name TEXT,
    payload JSONB NOT NULL,
    delete_reason TEXT NOT NULL,
    deleted_by UUID NOT NULL REFERENCES public.profiles(id),
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    restored_at TIMESTAMPTZ,
    restored_by UUID REFERENCES public.profiles(id),
    purge_due_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_trash_bins_agency ON public.trash_bins(agency_id);
CREATE INDEX IF NOT EXISTS idx_trash_bins_entity ON public.trash_bins(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_trash_bins_deleted_at ON public.trash_bins(deleted_at);

-- 5. BẬT RLS CHO TRASH_BINS
ALTER TABLE public.trash_bins ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_trash_bins_select ON public.trash_bins
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND (role = 'admin' OR (role = 'director' AND agency_id = trash_bins.agency_id))
        )
    );
