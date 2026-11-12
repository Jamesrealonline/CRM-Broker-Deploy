-- ========================================================
-- MIGRATION 031: SOFT DELETE & USER MANAGEMENT EXTENSIONS
-- ========================================================

-- 1. Thêm các cột phục vụ xóa mềm (Soft Delete) vào bảng profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS delete_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON public.profiles(deleted_at);

-- 2. Cập nhật constraint profiles_status_check hỗ trợ đầy đủ các trạng thái
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check CHECK (
    status IN ('active', 'inactive', 'locked', 'on_leave', 'terminated')
);

-- 3. Đảm bảo RLS cho phép truy cập theo phân quyền hiện tại
-- Các policy đã có trên profiles (p_profiles_admin_all, p_profiles_read_all, p_profiles_company_admin_all)
-- tiếp tục áp dụng cho mọi thao tác SELECT/UPDATE/DELETE.
