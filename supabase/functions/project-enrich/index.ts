// ========================================================
// SUPABASE EDGE FUNCTION: project-enrich
// Bổ sung thông tin dự án tự động từ nguồn chính thống, cờ unverified
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
    const { projectName, location, developer } = await req.json();
    const apiKey = Deno.env.get("AI_API_KEY");

    if (!apiKey) {
      throw new Error("Missing AI_API_KEY in Supabase Secrets");
    }

    const systemPrompt = `Bạn là chuyên gia thẩm định và nghiên cứu thị trường bất động sản Việt Nam.
Nhiệm vụ: Cung cấp thông tin chuẩn xác, đáng tin cậy về dự án "${projectName}" của chủ đầu tư "${developer}" tại "${location}".
Quy tắc:
1. Ưu tiên nguồn chính thức: website chủ đầu tư, báo chí chính thống (VnExpress, Dân Trí, Cafef...).
2. Bỏ qua các nguồn ẩn danh, tin đồn, diễn đàn không kiểm chứng.
3. Nếu trường nào không có thông tin chắc chắn thì để trống, không tự suy đoán.
4. Mỗi trường PHẢI kèm link URL nguồn tham chiếu.

Trả về kết quả DUY NHẤT một mảng JSON các trường thông tin theo cấu trúc:
[
  {
    "field": "price_range",
    "label": "Khung giá bán",
    "proposedValue": "...",
    "sourceUrl": "https://...",
    "unverified": true
  },
  {
    "field": "legal",
    "label": "Pháp lý dự án",
    "proposedValue": "...",
    "sourceUrl": "https://...",
    "unverified": true
  },
  {
    "field": "progress",
    "label": "Tiến độ thi công",
    "proposedValue": "...",
    "sourceUrl": "https://...",
    "unverified": true
  },
  {
    "field": "policy",
    "label": "Chính sách bán hàng",
    "proposedValue": "...",
    "sourceUrl": "https://...",
    "unverified": true
  },
  {
    "field": "highlights",
    "label": "Điểm nhấn dự án",
    "proposedValue": "...",
    "sourceUrl": "https://...",
    "unverified": true
  }
]`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    });

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const proposals = JSON.parse(text);

    return new Response(JSON.stringify({ proposals }), {
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
