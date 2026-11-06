-- ========================================================
-- REAL ESTATE CRM - SALES & MARKETING INTELLIGENCE PLATFORM
-- MIGRATION 004: SECURE ADMIN USER CREATION RPC
-- Cho phép Admin tạo tài khoản người dùng an toàn
-- ========================================================

CREATE OR REPLACE FUNCTION public.create_user_by_admin(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_phone TEXT,
    p_role TEXT,
    p_agency_id UUID DEFAULT NULL,
    p_team_id UUID DEFAULT NULL,
    p_must_change_password BOOLEAN DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_clean_email TEXT := lower(trim(p_email));
    v_caller_role TEXT;
    v_org_id UUID;
    v_result JSONB;
BEGIN
    -- 1. Kiểm tra quyền caller: Phải là Admin hoặc service_role
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF auth.role() <> 'service_role' AND (v_caller_role IS NULL OR v_caller_role <> 'admin') THEN
        RAISE EXCEPTION 'Chỉ quản trị viên hệ thống (Admin) mới có quyền tạo người dùng mới!';
    END IF;

    -- 2. Kiểm tra email đã tồn tại chưa
    IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_clean_email) THEN
        RAISE EXCEPTION 'Email % đã tồn tại trên hệ thống!', v_clean_email;
    END IF;

    -- Lấy organization_id mặc định
    SELECT id INTO v_org_id FROM public.organizations LIMIT 1;
    v_user_id := gen_random_uuid();

    -- 3. Tạo tài khoản trong auth.users
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change_token_current,
        email_change,
        phone_change,
        phone_change_token,
        reauthentication_token,
        raw_user_meta_data,
        raw_app_meta_data,
        aud,
        role,
        created_at,
        updated_at
    )
    VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000'::uuid,
        v_clean_email,
        crypt(COALESCE(p_password, 'password123'), gen_salt('bf', 10)),
        now(),
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        jsonb_build_object('full_name', p_full_name),
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        'authenticated',
        'authenticated',
        now(),
        now()
    );

    -- 4. Tạo bản ghi định danh trong auth.identities
    INSERT INTO auth.identities (
        id,
        user_id,
        provider_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
    )
    VALUES (
        gen_random_uuid(),
        v_user_id,
        v_user_id::text,
        jsonb_build_object('sub', v_user_id::text, 'email', v_clean_email),
        'email',
        now(),
        now(),
        now()
    );

    -- 5. Tạo profile trong public.profiles
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        phone,
        role,
        organization_id,
        agency_id,
        team_id,
        status,
        must_change_password,
        created_at,
        updated_at
    )
    VALUES (
        v_user_id,
        v_clean_email,
        p_full_name,
        p_phone,
        p_role,
        v_org_id,
        p_agency_id,
        p_team_id,
        'active',
        p_must_change_password,
        now(),
        now()
    );

    -- 6. Ghi nhật ký kiểm toán (audit_logs)
    INSERT INTO public.audit_logs (
        id,
        user_id,
        action,
        entity_name,
        entity_id,
        details,
        created_at
    )
    VALUES (
        gen_random_uuid(),
        auth.uid(),
        'create_user',
        'profiles',
        v_user_id,
        jsonb_build_object('email', v_clean_email, 'role', p_role, 'full_name', p_full_name),
        now()
    );

    SELECT to_jsonb(p) INTO v_result FROM public.profiles p WHERE p.id = v_user_id;
    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_user_by_admin TO authenticated;
