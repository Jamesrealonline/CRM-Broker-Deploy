// ========================================================
// SUPABASE EDGE FUNCTION: lead-webhook
// Nhận Lead tự động từ Website Form, xác thực chữ ký bảo mật
// ========================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const authHeader = req.headers.get("x-lead-secret");
    const webhookSecret = Deno.env.get("LEAD_WEBHOOK_SECRET");

    if (!webhookSecret || authHeader !== webhookSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized Webhook Signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { fullName, phone, email, projectCode, notes, sourceCode } = await req.json();

    if (!fullName || !phone) {
      return new Response(JSON.stringify({ error: "Thiếu họ tên hoặc số điện thoại." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Chuẩn hóa số điện thoại
    const cleanPhone = phone.replace(/\D/g, "");

    // 1. Tìm hoặc tạo Customer
    let { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("phone_normalized", cleanPhone)
      .maybeSingle();

    if (!customer) {
      const { data: newCust, error: cErr } = await supabase
        .from("customers")
        .insert({
          organization_id: "11111111-1111-1111-1111-111111111111",
          full_name: fullName,
          phone: phone,
          phone_normalized: cleanPhone,
          email: email || null,
          consent_obtained: true,
        })
        .select()
        .single();
      if (cErr) throw cErr;
      customer = newCust;
    }

    // 2. Tìm Project
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("code", projectCode || "VHGP")
      .maybeSingle();

    const projectId = project?.id || "33333333-1111-1111-1111-111111111111";

    // 3. Tạo Lead
    const { data: lead, error: lErr } = await supabase
      .from("leads")
      .insert({
        customer_id: customer.id,
        project_id: projectId,
        status: "new",
        notes: notes || "Tiếp nhận tự động qua Website Form Webhook",
      })
      .select()
      .single();

    if (lErr) throw lErr;

    // 4. Kích hoạt Round Robin RPC tự động
    await supabase.rpc("assign_lead_round_robin", {
      p_lead_id: lead.id,
      p_project_id: projectId,
    });

    return new Response(JSON.stringify({ success: true, leadId: lead.id }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
