// ========================================================
// SUPABASE EDGE FUNCTION: create-user
// Admin tạo tài khoản nhân sự mới (dùng SERVICE_ROLE KEY)
// Tắt đăng ký công khai, mật khẩu tạm bắt buộc đổi ở lần đầu
// ========================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { email, fullName, phone, role, agencyId, teamId } = await req.json();

    // Mật khẩu tạm thời ngẫu nhiên
    const tempPassword = `Pass@${Math.floor(100000 + Math.random() * 900000)}`;

    // 1. Tạo auth user
    const { data: user, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authError) throw authError;

    // 2. Tạo profile với cờ must_change_password = true
    const { error: profError } = await adminClient.from("profiles").insert({
      id: user.user.id,
      email,
      full_name: fullName,
      phone,
      role,
      agency_id: agencyId || null,
      team_id: teamId || null,
      status: "active",
      must_change_password: true,
    });

    if (profError) throw profError;

    return new Response(
      JSON.stringify({
        success: true,
        userId: user.user.id,
        tempPassword,
        message: "Tạo tài khoản thành công. Người dùng cần đổi mật khẩu ở lần đăng nhập đầu tiên.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
