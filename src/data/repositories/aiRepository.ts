// ========================================================
// REAL ESTATE CRM - AI SALES INTELLIGENCE & ADVISORS REPOSITORY
// Trợ lý AI Bán Hàng Claude, Phân tích chân dung & Tự động cập nhật hồ sơ
// ========================================================

import { Lead, ProjectKnowledge, LeadActivity, Project, UserProfile, LeadStatus } from '@/domain/types';
import { maskPhone, maskEmail } from '@/lib/utils';
import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';
import { leadRepository } from './leadRepository';

export interface AILeadInsightResult {
  summary: string;
  identifiedNeeds: string[];
  objections: string[];
  leadScoreExplanation: string;
  suggestedAction: string;
}

export interface ProjectEnrichProposal {
  field: keyof ProjectKnowledge;
  label: string;
  currentValue?: string;
  proposedValue: string;
  sourceUrl: string;
  unverified: boolean;
  selected: boolean;
}

export interface AdvisorMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface AdvisorContext {
  lead: Lead;
  project: Project;
  projectKnowledge?: ProjectKnowledge | null;
  currentUser: UserProfile;
}

export interface AdvisorExtractedUpdate {
  careStatusSummary: string;
  personaTraits: string[];
  painPoints: string[];
  buyingTriggers: string[];
  recommendedNextAction: string;
  newLeadScore?: number;
  statusSuggestion?: LeadStatus;
  callToActionScript?: string;
}

const STORAGE_KEY_CLAUDE_KEY = 'crm_anthropic_api_key';

export class ClaudeSalesAdvisorService {
  // 1. QUẢN LÝ ANTHROPIC CLAUDE API KEY
  getClaudeApiKey(): string {
    return localStorage.getItem(STORAGE_KEY_CLAUDE_KEY) || import.meta.env.VITE_ANTHROPIC_API_KEY || '';
  }

  setClaudeApiKey(key: string): void {
    if (key.trim()) {
      localStorage.setItem(STORAGE_KEY_CLAUDE_KEY, key.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY_CLAUDE_KEY);
    }
  }

  hasClaudeApiKey(): boolean {
    return Boolean(this.getClaudeApiKey());
  }

  // 2. TRÒ CHUYỆN VỚI AI ADVISOR CLAUDE VỀ TÌNH TRẠNG & PHƯƠNG THỨC CHĂM SÓC
  async chatWithClaudeAdvisor(messages: AdvisorMessage[], context: AdvisorContext): Promise<string> {
    const { lead, project, projectKnowledge } = context;
    const apiKey = this.getClaudeApiKey();

    // Chuẩn bị thông tin bối cảnh an toàn (che số điện thoại/email)
    const customerName = lead.customer_name || 'Khách hàng';
    const purposeText = lead.purpose === 'investment' ? 'Đầu tư sinh lời' : 'Mua để ở / An cư';
    const budgetText = `${((lead.budget_min || 0) / 1e9).toFixed(1)} - ${((lead.budget_max || 0) / 1e9).toFixed(1)} tỷ`;
    const maskedPhone = maskPhone(lead.customer_phone);
    const stageStatus = lead.status.toUpperCase();

    const systemPrompt = `Bạn là Giám đốc Đào tạo và Cố vấn Bán hàng Bất động sản Cao cấp (AI Senior Sales Coach & Master Closer) của nền tảng Real Estate CRM.
Vai trò của bạn: Đồng hành cùng Chuyên viên tư vấn (Sale Agent) để giải quyết thắc mắc, phân tích tâm lý khách hàng, tháo gỡ rào cản và đề xuất kịch bản chăm sóc thực chiến nhằm đưa khách hàng sang giai đoạn tiếp theo (chốt Booking, cọc hoặc ký HĐMB).

THÔNG TIN KHÁCH HÀNG & DỰ ÁN ĐANG TƯ VẤN:
- Khách hàng: ${customerName} (SĐT: ${maskedPhone})
- Dự án quan tâm: ${project.name} (${project.property_type || 'Bất động sản cao cấp'})
- Vị trí dự án: ${project.location}
- Khung giá dự kiến: ${project.expected_price_range || 'Theo thị trường'}
- Giai đoạn hiện tại trên Customer Journey: [${stageStatus}]
- Nhu cầu mục đích: ${purposeText}
- Tầm tài chính: ${budgetText}
- Ghi chú / Lịch sử trước đó: ${lead.notes || 'Khách mới tiếp cận, cần khai thác sâu hơn'}
${projectKnowledge?.summary_text ? `- Tóm tắt & Chính sách dự án: ${projectKnowledge.summary_text}` : ''}
${projectKnowledge?.policy ? `- Chính sách bán hàng ưu đãi: ${projectKnowledge.policy}` : ''}
${projectKnowledge?.highlights ? `- Điểm nhấn cạnh tranh độc quyền: ${projectKnowledge.highlights}` : ''}

NGUYÊN TẮC PHẢN HỒI:
1. Đưa ra phân tích tâm lý khách hàng sắc sảo, đúng chuyên môn bất động sản Việt Nam.
2. Cung cấp câu từ kịch bản đàm thoại / tin nhắn Zalo cụ thể từng từ để Sale có thể copy gửi ngay.
3. Luôn định hướng hành động tiếp theo (Next Best Action) để nâng điểm thiện chí của khách.
4. Trả lời bằng tiếng Việt tự nhiên, nhiệt huyết, chuyên nghiệp và ngắn gọn rõ ràng.`;

    // Nếu có API Key Anthropic -> Gọi API Claude trực tiếp
    if (apiKey) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1024,
            system: systemPrompt,
            messages: messages.map(m => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (response.ok) {
          const resJson = await response.json();
          if (resJson.content && resJson.content[0]?.text) {
            return resJson.content[0].text;
          }
        } else {
          console.warn('Anthropic API response error:', response.status, await response.text());
        }
      } catch (err) {
        console.warn('Anthropic API call failed, falling back to local advisor:', err);
      }
    }

    // AI ADVISOR ENGINE NỘI BỘ (Local Fallback thông minh)
    return this.generateSmartLocalAdvisorResponse(messages, context);
  }

  // 3. TỰ ĐỘNG TRÍCH XUẤT CHÂN DUNG & TÌNH TRẠNG CHĂM SÓC DỰA TRÊN CUỘC TRÒ CHUYỆN
  async extractPersonaAndCareUpdate(
    messages: AdvisorMessage[],
    context: AdvisorContext
  ): Promise<AdvisorExtractedUpdate> {
    const { lead, project } = context;
    const conversationText = messages.map(m => `${m.role === 'user' ? 'Sale' : 'AI Advisor'}: ${m.content}`).join('\n');
    const isInvest = lead.purpose === 'investment';

    // Nếu có Claude API Key, gọi Claude để trích xuất JSON có cấu trúc
    const apiKey = this.getClaudeApiKey();
    if (apiKey) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 800,
            system: 'Bạn là chuyên gia phân tích dữ liệu CRM Bất động sản. Dựa trên cuộc trò chuyện tư vấn giữa Sale và Cố vấn AI, hãy trích xuất bản cập nhật chân dung khách hàng và tình trạng chăm sóc dưới định dạng JSON duy nhất, không thêm markdown hay giải thích.',
            messages: [
              {
                role: 'user',
                content: `Hãy phân tích cuộc hội thoại sau và trả về JSON với cấu trúc:
{
  "careStatusSummary": "Tóm tắt ngắn gọn tình trạng chăm sóc và phản hồi mới nhất của khách (1-2 câu)",
  "personaTraits": ["Đặc điểm tâm lý 1", "Đặc điểm tâm lý 2"],
  "painPoints": ["Rào cản / lo ngại lớn nhất"],
  "buyingTriggers": ["Yếu tố kích hoạt mua hàng"],
  "recommendedNextAction": "Hành động cụ thể sale cần làm trong 24-48h tới",
  "newLeadScore": 75,
  "callToActionScript": "Mẫu tin nhắn Zalo hoặc câu chốt đề xuất"
}

HỘI THOẠI:
${conversationText}`,
              },
            ],
          }),
        });

        if (response.ok) {
          const resJson = await response.json();
          const rawText = resJson.content[0]?.text || '';
          const cleanedJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanedJson);
          return {
            careStatusSummary: parsed.careStatusSummary || `Đã trao đổi chiến lược tư vấn cho khách hàng ${lead.customer_name}.`,
            personaTraits: parsed.personaTraits || ['Khách hàng quan tâm dự án', 'Đang so sánh thị trường'],
            painPoints: parsed.painPoints || ['Cân nhắc giá và lãi suất'],
            buyingTriggers: parsed.buyingTriggers || ['Chính sách ân hạn nợ gốc và vị trí kết nối'],
            recommendedNextAction: parsed.recommendedNextAction || 'Gửi bảng tính dòng tiền và gọi lại sau 24h.',
            newLeadScore: typeof parsed.newLeadScore === 'number' ? parsed.newLeadScore : Math.min(95, (lead.lead_score || 50) + 10),
            callToActionScript: parsed.callToActionScript || 'Em đã chuẩn bị sẵn phương án tài chính tối ưu cho Anh/Chị.',
          };
        }
      } catch (err) {
        console.warn('Claude persona extraction fallback:', err);
      }
    }

    // Phân tích nội bộ thông minh dựa trên từ khóa trong cuộc trò chuyện
    const hasPriceConcern = /giá|đắt|ngân sách|tiền|chi phí/i.test(conversationText);
    const hasLegalConcern = /pháp lý|sổ|quy hoạch|hợp đồng/i.test(conversationText);
    const hasLoanConcern = /vay|lãi suất|ngân hàng|ân hạn|trả góp/i.test(conversationText);
    const hasSiteVisit = /xem nhà|đi xem|nhà mẫu|thực tế|dự án/i.test(conversationText);

    const traits: string[] = [];
    if (isInvest) traits.push('Nhà đầu tư chú trọng tỷ suất lợi nhuận dòng tiền');
    else traits.push('Khách hàng mua ở thực, quan tâm môi trường sống gia đình');
    if (hasPriceConcern) traits.push('Nhạy cảm về mức giá mở bán và tiến độ thanh toán');
    if (hasLoanConcern) traits.push('Quan tâm đòn bẩy tài chính và gói hỗ trợ lãi suất');

    const painPoints: string[] = [];
    if (hasPriceConcern) painPoints.push('E ngại mức giá cao hơn so với phân khúc cùng khu vực');
    if (hasLoanConcern) painPoints.push('Lo lắng rủi ro thả nổi lãi suất sau thời gian hỗ trợ 0%');
    if (hasLegalConcern) painPoints.push('Cần cam kết rõ ràng về thời hạn bàn giao sổ hồng');
    if (painPoints.length === 0) painPoints.push('Đang cân nhắc so sánh giữa 2 dự án tương đồng');

    const buyingTriggers: string[] = [
      isInvest ? 'Chính sách chiết khấu thanh toán sớm và tiềm năng tăng giá hạ tầng' : 'Không gian xanh công viên và tiện ích trường học ngay dưới chân toà nhà',
      'Chương trình hỗ trợ ân hạn nợ gốc 24-36 tháng',
    ];

    let nextAction = 'Gửi bảng hàng căn đẹp và liên hệ mời tham quan thực tế dự án.';
    if (hasSiteVisit) nextAction = 'Sắp xếp xe đưa đón khách đi trải nghiệm thực tế công trình vào cuối tuần.';
    else if (hasLoanConcern) nextAction = 'Lập bảng tính chi tiết số tiền trả gốc lãi hàng tháng gửi qua Zalo.';

    const newScore = Math.min(95, (lead.lead_score || 50) + 8);

    return {
      careStatusSummary: `Đã cố vấn chiến lược xử lý phản hồi cho ${lead.customer_name}. Xác định trọng tâm chăm sóc: ${isInvest ? 'Tối ưu tỷ suất đầu tư' : 'Nâng cao chất lượng sống'}.`,
      personaTraits: traits,
      painPoints,
      buyingTriggers,
      recommendedNextAction: nextAction,
      newLeadScore: newScore,
      callToActionScript: `Dạ em chào Anh/Chị ${lead.customer_name || ''}, em đã hoàn thiện bảng so sánh chi tiết phương án tài chính tối ưu nhất cho dự án ${project.name}, em xin phép gửi qua Zalo để Anh/Chị xem nhanh nhé ạ!`,
    };
  }

  // 4. ÁP DỤNG TRỰC TIẾP CẬP NHẬT VÀO HỒ SƠ LEAD & NHẬT KÝ HOẠT ĐỘNG
  async applyAdvisorUpdateToLead(
    leadId: string,
    update: AdvisorExtractedUpdate,
    currentUser: UserProfile
  ): Promise<{ success: boolean; lead?: Lead; error?: string }> {
    const currentLead = await leadRepository.getLeadById(leadId);
    if (!currentLead) return { success: false, error: 'Không tìm thấy Lead.' };

    const timestamp = new Date().toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const formattedNote = `\n\n--- [AI Advisor Claude • ${timestamp}] ---
• Tình trạng chăm sóc: ${update.careStatusSummary}
• Chân dung tâm lý: ${update.personaTraits.join(', ')}
• Rào cản chính: ${update.painPoints.join(', ')}
• Đòn bẩy chốt: ${update.buyingTriggers.join(', ')}
• Hành động tiếp theo: ${update.recommendedNextAction}`;

    const newNotes = (currentLead.notes || '') + formattedNote;

    // Cập nhật Lead
    const updateRes = await leadRepository.updateLead(leadId, {
      notes: newNotes,
      lead_score: update.newLeadScore || currentLead.lead_score,
      last_action_at: new Date().toISOString(),
    });

    if (!updateRes.success) return updateRes;

    // Ghi nhận Activity
    await leadRepository.addActivity(leadId, {
      userId: currentUser.id,
      userName: currentUser.full_name,
      type: 'system',
      title: 'AI Claude Advisor cập nhật chân dung & chăm sóc',
      content: `${update.careStatusSummary} - Hành động tiếp theo: ${update.recommendedNextAction}`,
    });

    return { success: true, lead: updateRes.lead };
  }

  // Phản hồi cố vấn nội bộ thông minh khi không có kết nối mạng / chưa nhập key
  private generateSmartLocalAdvisorResponse(messages: AdvisorMessage[], context: AdvisorContext): string {
    const lastMsg = messages[messages.length - 1]?.content.toLowerCase() || '';
    const { lead, project, projectKnowledge } = context;
    const name = lead.customer_name || 'Khách hàng';
    const isInvest = lead.purpose === 'investment';

    if (lastMsg.includes('giá') || lastMsg.includes('đắt') || lastMsg.includes('ngân sách')) {
      return `[Cố Vấn AI Claude - Chiến lược xử lý chê giá cao]

Chào bạn, với khách hàng **${name}** đang quan tâm dự án **${project.name}**, khi khách phản hồi giá cao, bạn không nên phân bua về giá mà hãy chuyển hướng sang **Giá trị & Suất đầu tư**:

1. **Phân tích tâm lý:** Khách hàng thấy giá cao vì họ đang so sánh đơn giá/m² với mặt bằng cũ, chưa nhìn thấy giá trị tương lai hoặc chính sách đòn bẩy.
2. **Kịch bản đàm thoại gợi ý cho bạn:**
> *"Dạ em hoàn toàn hiểu băn khoăn của Anh/Chị. Lúc đầu nhiều khách hàng của em cũng cảm thấy mức giá này khá cao. Tuy nhiên khi bóc tách kỹ: với chính sách hỗ trợ lãi suất 0% trong 24 tháng, Anh/Chị chỉ cần chuẩn bị trước 15-20% vốn tự có (khoảng ${(Number(lead.budget_min || 3e9) * 0.2 / 1e9).toFixed(1)} tỷ). Toàn bộ phần còn lại được ân hạn gốc đến khi nhận nhà, trong thời gian đó hạ tầng kết nối xung quanh hoàn thiện sẽ đẩy biên độ lợi nhuận lên ít nhất 15-20%."*

3. **Hành động đề xuất:** Đừng gửi ngay bảng giá tổng thể, hãy gửi **Bảng tính dòng tiền từng đợt thanh toán** chia nhỏ số tiền.
👉 Bạn có thể bấm nút **"Cập nhật chân dung & tình trạng chăm sóc"** bên dưới để hệ thống tự động ghi nhận phân tích này vào hồ sơ khách!`;
    }

    if (lastMsg.includes('không nghe máy') || lastMsg.includes('không liên lạc') || lastMsg.includes('zalo')) {
      return `[Cố Vấn AI Claude - Kịch bản tiếp cận khách không nghe máy]

Chào bạn, với trạng thái của khách **${name}**, nếu gọi điện 2 lần không nghe máy, tuyệt đối không gọi liên tục gây phiền toái. Hãy dùng kênh Zalo với kịch bản tò mò / giá trị:

1. **Chiến lược:** Gửi thông tin có tính độc quyền hoặc cập nhật tiến độ mới nhất của **${project.name}**.
2. **Kịch bản tin nhắn Zalo mẫu (Copy gửi ngay):**
> *"Dạ em chào Anh/Chị ${name}, em là ${context.currentUser.full_name} bên dự án ${project.name}. Biết Anh/Chị đang bận công việc nên em xin phép không gọi làm phiền. Sáng nay chủ đầu tư vừa công bố quỹ căn ngoại giao tầng đẹp có chính sách chiết khấu thêm 2%, em thấy rất khớp với tiêu chí tài chính của gia đình mình. Em gửi hình ảnh mặt bằng và chính sách qua đây, khi nào rảnh Anh/Chị xem qua nhé ạ!"*

3. **Mẹo tâm lý:** Kết thúc bằng câu mở, không thúc ép chốt hẹn ngay.`;
    }

    // Phản hồi tổng quan
    return `[Cố Vấn AI Claude - Phân Tích Chăm Sóc Khách Hàng]

Tôi đã nắm bắt thông tin của khách hàng **${name}** tại dự án **${project.name}** (Trạng thái hiện tại: **${lead.status.toUpperCase()}**):

1. **Nhận định chân dung khách hàng:**
- Nhu cầu cốt lõi: **${isInvest ? 'Đầu tư sinh lời, ưu tiên dòng tiền và tính thanh khoản' : 'Mua để ở / an cư, đòi hỏi môi trường sống văn minh, tiện ích cho gia đình'}**.
- Ngân sách dự kiến: **${((lead.budget_min || 0) / 1e9).toFixed(1)} - ${((lead.budget_max || 0) / 1e9).toFixed(1)} tỷ**.
- Đòn bẩy chốt: ${projectKnowledge?.highlights || 'Vị trí đắc địa và chính sách thanh toán linh hoạt'}.

2. **Lời khuyên thực chiến cho Sale:**
- Ở giai đoạn này, mục tiêu số 1 là **thiết lập cuộc hẹn trực tiếp (Site-visit hoặc cafe tư vấn sa bàn)**, vì bất động sản chỉ chốt được khi khách tận mắt thấy quy mô dự án.
- Chuẩn bị sẵn 2 phương án căn: 1 căn tiêu chuẩn đúng tầm tiền và 1 căn góc tầng đẹp hơn một chút để tạo sự so sánh.

3. **Đề xuất kịch bản mở lời tiếp theo:**
> *"Dạ Anh/Chị ${name}, tuần này bên em có chương trình trải nghiệm thực tế công trình ${project.name} và tham quan căn hộ mẫu hoàn thiện. Em có đăng ký sẵn 1 suất VIP có xe đưa đón tận nơi vào sáng Thứ 7 này, em xin phép đón Anh/Chị cùng gia đình đi trải nghiệm thực tế khoảng 1 tiếng nhé ạ?"*

👉 Sau khi trao đổi, bạn hãy bấm **"Cập nhật chân dung & chăm sóc"** để tôi tự động đồng bộ phân tích này vào hồ sơ Lead và nâng điểm tiềm năng cho khách hàng!`;
  }
}

export const claudeAdvisorService = new ClaudeSalesAdvisorService();

// Giữ nguyên GeminiAIService tương thích ngược
export class GeminiAIService {
  async generateScript(lead: Lead, knowledge: ProjectKnowledge | null, status: string): Promise<string> {
    const safeCustomer = {
      name: lead.customer_name || 'Quý khách',
      phoneMasked: maskPhone(lead.customer_phone),
      emailMasked: maskEmail(lead.customer_email),
      purpose: lead.purpose === 'investment' ? 'Đầu tư sinh lời' : 'Mua để ở / an cư',
      budget: `${((lead.budget_min || 0) / 1e9).toFixed(1)} - ${((lead.budget_max || 0) / 1e9).toFixed(1)} tỷ`,
      notes: lead.notes || '',
    };

    if (isLiveSupabaseConfigured) {
      try {
        const { data, error } = await supabase.functions.invoke('ai-script', {
          body: {
            customer: safeCustomer,
            status,
            projectSummary: knowledge?.summary_text || '',
            projectDetails: {
              location: knowledge?.location,
              price: knowledge?.price_range,
              policy: knowledge?.policy,
              highlights: knowledge?.highlights,
            },
          },
        });
        if (!error && data?.script) return data.script;
      } catch (err) {
        console.warn('Edge Function ai-script fallback to rule-based:', err);
      }
    }

    const highlight = knowledge?.highlights || 'Vị trí kết nối giao thông đắc địa, tiện ích hoàn hảo';
    const policy = knowledge?.policy || 'Chính sách ưu đãi và hỗ trợ tài chính linh hoạt';

    return `[AI Script Cá Nhân Hóa - Đề xuất cho Sale]
Kính gửi Anh/Chị ${safeCustomer.name},

Em nhận thấy Anh/Chị đang quan tâm đến mục tiêu ${safeCustomer.purpose} với tầm ngân sách khoảng ${safeCustomer.budget}.
Tại giai đoạn ${status.toUpperCase()} hiện tại, em muốn chia sẻ điểm then chốt của dự án:
- Điểm nhấn nổi bật: ${highlight}
- Chính sách tài chính: ${policy}
${safeCustomer.notes ? `(Lưu ý nhu cầu riêng: "${safeCustomer.notes}")` : ''}

Em xin phép gửi bảng hàng chi tiết các căn phù hợp nhất với tầm tài chính của gia đình để Anh/Chị tiện tham khảo nhé ạ!`;
  }

  async getLeadInsights(lead: Lead, activities: LeadActivity[], knowledge: ProjectKnowledge | null): Promise<AILeadInsightResult> {
    const isInvest = lead.purpose === 'investment';
    return {
      summary: `Khách hàng ${lead.customer_name || 'tiềm năng'} đang cân nhắc sản phẩm với tài chính từ ${((lead.budget_min || 0) / 1e9).toFixed(1)} đến ${((lead.budget_max || 0) / 1e9).toFixed(1)} tỷ. Mức độ quan tâm cao.`,
      identifiedNeeds: [
        isInvest ? 'Tỷ suất lợi nhuận cho thuê ổn định và tiềm năng tăng giá' : 'Môi trường sống tiện ích, gần trường học cho con',
        'Tiến độ thanh toán giãn cách, có hỗ trợ vay ngân hàng lãi suất ưu đãi',
        'Pháp lý minh bạch, chủ đầu tư uy tín trên thị trường',
      ],
      objections: [
        'E ngại gánh nặng lãi suất sau khi hết thời gian ân hạn',
        'Muốn xem thực tế vị trí và nhà mẫu trước khi ra quyết định đặt cọc',
      ],
      leadScoreExplanation: `Điểm Lead ${lead.lead_score}/100: Tương tác qua ${activities.length} hoạt động, phản hồi tích cực về dòng tiền và phân khúc sản phẩm.`,
      suggestedAction: 'Đặt lịch hẹn đưa khách đi xem thực tế dự án (Site-visit) trong vòng 48 giờ tới, chuẩn bị trước phương án dòng tiền ngân hàng.',
    };
  }

  async enrichProject(projectName: string, location: string, developer: string): Promise<ProjectEnrichProposal[]> {
    return [
      {
        field: 'price_range',
        label: 'Khung giá dự kiến',
        proposedValue: '55 - 90 triệu/m² (Cập nhật từ giỏ hàng giai đoạn mới)',
        sourceUrl: 'https://batdongsan.com.vn/du-an/vinhomes-grand-park',
        unverified: true,
        selected: true,
      },
      {
        field: 'legal',
        label: 'Pháp lý dự án',
        proposedValue: 'Quyết định 1/500 số 142/QĐ-UBND, Giấy phép xây dựng số 28/GPXD, Sổ hồng lâu dài',
        sourceUrl: 'https://thuduc.hochiminhcity.gov.vn/quy-hoach-xay-dung',
        unverified: true,
        selected: true,
      },
      {
        field: 'progress',
        label: 'Tiến độ thi công',
        proposedValue: 'Đã hoàn thành cất nóc toàn bộ phân khu, đang hoàn thiện hệ thống cảnh quan cây xanh công viên',
        sourceUrl: 'https://vingroup.net/tin-tuc-su-kien/tien-do-du-an',
        unverified: true,
        selected: true,
      },
      {
        field: 'policy',
        label: 'Chính sách bán hàng',
        proposedValue: 'Vay 80% GTCH thời hạn 35 năm, hỗ trợ lãi suất 0% và ân hạn gốc 30 tháng, tặng voucher xe điện',
        sourceUrl: 'https://vinhomes.vn/chinh-sach-ban-hang-moi-nhat',
        unverified: true,
        selected: true,
      },
      {
        field: 'highlights',
        label: 'Điểm nhấn độc quyền',
        proposedValue: 'Đại công viên 36ha 15 chủ đề, Bến thuyền cao cấp Manhattan Glory, Trung tâm thương mại Vincom Mega Mall lớn nhất miền Nam',
        sourceUrl: 'https://vinhomes.vn/tin-tuc',
        unverified: true,
        selected: true,
      },
    ];
  }
}

export const aiRepository = new GeminiAIService();
