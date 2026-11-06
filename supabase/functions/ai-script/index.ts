// ========================================================
// SUPABASE EDGE FUNCTION: ai-script
// Tạo kịch bản bán hàng cá nhân hóa theo dự án và khách hàng
// ========================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { customer, status, projectSummary, projectDetails } = await req.json();

    const apiKey = Deno.env.get("AI_API_KEY");
    if (!apiKey) {
      throw new Error("Missing AI_API_KEY in Supabase Secrets");
    }

    const systemPrompt = `Bạn là Senior Real Estate Sales Coach chuyên nghiệp tại Việt Nam.
Nhiệm vụ: Soạn một kịch bản tư vấn bán hàng (tin nhắn hoặc lời thoại gọi điện) cá nhân hóa cho khách hàng tại bước "${status}".
Quy tắc quan trọng:
1. CHỈ dựa trên thông tin dự án được cung cấp dưới đây. Nếu thiếu thông tin giá, pháp lý hay tiến độ thì nói rõ chưa có thông tin chính thức, KHÔNG ĐƯỢC TỰ BỊA ĐẶT SỐ LIỆU.
2. Tôn trọng mục tiêu của khách (${customer.purpose}), ngân sách (${customer.budget}).
3. Giữ giọng điệu lịch sự, chuyên nghiệp, tạo niềm tin cao, tập trung giải quyết nhu cầu thực tế.

Thông tin dự án:
- Tóm tắt: ${projectSummary}
- Vị trí: ${projectDetails?.location || "Đang cập nhật"}
- Giá: ${projectDetails?.price || "Đang cập nhật"}
- Chính sách: ${projectDetails?.policy || "Đang cập nhật"}
- Điểm nhấn: ${projectDetails?.highlights || "Đang cập nhật"}

Thông tin khách hàng (đã ẩn danh bảo vệ dữ liệu cá nhân):
- Tên: ${customer.name}
- Nhu cầu/Ghi chú: ${customer.notes || "Không có ghi chú"}
`;

    // Gọi Gemini API từ phía máy chủ
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 800,
        },
      }),
    });

    const data = await response.json();
    const generatedScript = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Không tạo được kịch bản.";

    return new Response(JSON.stringify({ script: generatedScript }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
