// ========================================================
// SUPABASE EDGE FUNCTION: ai-lead-insight
// Phân tích nhu cầu khách hàng, phản đối, giải thích điểm số Lead
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
    const { lead, projectKnowledge } = await req.json();
    const apiKey = Deno.env.get("AI_API_KEY");

    if (!apiKey) {
      throw new Error("Missing AI_API_KEY in Supabase Secrets");
    }

    const prompt = `Phân tích hồ sơ khách hàng bất động sản và trả về JSON:
Hồ sơ:
- Mục đích: ${lead.purpose}
- Điểm Lead: ${lead.score}/100
- Ngân sách: ${lead.budget?.[0]} - ${lead.budget?.[1]}
- Ghi chú: ${lead.notes}
- Số lần tương tác: ${lead.activityCount}
Dự án: ${projectKnowledge}

Yêu cầu trả về DUY NHẤT một chuỗi JSON hợp lệ với cấu trúc sau:
{
  "summary": "Tóm tắt chân dung 2-3 câu",
  "identifiedNeeds": ["nhu cầu 1", "nhu cầu 2", "nhu cầu 3"],
  "objections": ["phản đối 1", "phản đối 2"],
  "leadScoreExplanation": "Lý giải số điểm lead",
  "suggestedAction": "Hành động cụ thể khuyến nghị cho Sale trong 48h tới"
}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    });

    const data = await response.json();
    const jsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(jsonText);

    return new Response(JSON.stringify(parsed), {
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
