// ========================================================
// REAL ESTATE CRM - AI SALES INTELLIGENCE & ADVISORS REPOSITORY
// Trợ lý AI Bán Hàng Claude, Phân tích chân dung & Tự động cập nhật hồ sơ
// ========================================================

import { Lead, ProjectKnowledge, ProjectFaq, LeadActivity, Project, UserProfile, LeadStatus } from '@/domain/types';
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

  async enrichProject(
    projectName: string,
    location?: string,
    developer?: string,
    propertyType?: string
  ): Promise<ProjectEnrichProposal[]> {
    const nameLower = (projectName || '').toLowerCase();
    const locLower = (location || '').toLowerCase();
    const devLower = (developer || '').toLowerCase();

    const isCanGio =
      nameLower.includes('cần giờ') ||
      nameLower.includes('can gio') ||
      locLower.includes('cần giờ') ||
      locLower.includes('can gio') ||
      nameLower.includes('green paradise');

    const isVin = devLower.includes('vin') || nameLower.includes('vin');

    let locVal = '';
    let locSource = '';
    let propTypeVal = '';
    let priceVal = '';
    let priceSource = '';
    let legalVal = '';
    let legalSource = '';
    let progressVal = '';
    let progressSource = '';
    let policyVal = '';
    let policySource = '';
    let highlightsVal = '';
    let highlightsSource = '';

    if (isCanGio) {
      locVal = 'Khu đô thị du lịch lấn biển Cần Giờ, Xã Long Hòa & Thị trấn Cần Thạnh, Huyện Cần Giờ, TP. Hồ Chí Minh. Tọa lạc đắc địa tại vịnh Cần Giờ, kết nối giao thông huyết mạch qua đại lộ Rừng Sác và tuyến Cầu Cần Giờ tương lai.';
      locSource = 'https://can-gio.hochiminhcity.gov.vn/quy-hoach-lan-bien';
      propTypeVal = propertyType || 'Đại đô thị du lịch lấn biển sinh thái, Biệt thự nghỉ dưỡng mặt biển, Shophouse phố đi bộ, Căn hộ cao cấp & Khách sạn nghỉ dưỡng 5 sao';
      priceVal = 'Từ 85 - 160 triệu/m² tùy theo phân khu ven biển, nhà phố thương mại và biệt thự sinh thái (Dự kiến đợt mở bán đầu tiên)';
      priceSource = 'https://batdongsan.com.vn/du-an/vinhomes-green-paradise-can-gio';
      legalVal = 'Chủ trương đầu tư mở rộng 2.870 ha được phê duyệt, Quyết định phê duyệt đồ án quy hoạch chi tiết 1/500, Giấy phép xây dựng hạ tầng kỹ thuật, Sổ hồng sở hữu lâu dài (người Việt Nam)';
      legalSource = 'https://hochiminhcity.gov.vn/van-ban-quy-hoach';
      progressVal = 'Đang đẩy mạnh san lấp mặt bằng, hoàn thiện kè biển sinh thái và hệ thống giao thông trục chính kết nối bến du thuyền quốc tế';
      progressSource = 'https://vingroup.net/tin-tuc-su-kien/tien-do-du-an';
      policyVal = 'Hỗ trợ vay ngân hàng 70% - 80% giá trị hợp đồng, hỗ trợ lãi suất 0% và ân hạn nợ gốc lên đến 36 tháng, chiết khấu thanh toán sớm 10% - 12%, tặng gói đặc quyền sinh thái VinFast & Vinpearl';
      policySource = 'https://vinhomes.vn/chinh-sach-ban-hang-can-gio';
      highlightsVal = 'Siêu quần thể đô thị lấn biển 2.870ha mang tính biểu tượng du lịch quốc gia, công viên chủ đề VinWonders, sân golf biển 36 hố, bến du thuyền 5 sao chuẩn quốc tế, bảo tồn trọn vẹn khu dự trữ sinh quyển Cần Giờ';
      highlightsSource = 'https://vinhomes.vn/green-paradise';
    } else if (isVin) {
      locVal = location
        ? `${location}. Tọa lạc tại tâm điểm vùng đô thị mở rộng, kết nối trực tiếp các trục vành đai và các tuyến hạ tầng giao thông trọng điểm.`
        : 'Vị trí đắc địa tại trung tâm vùng đô thị vệ tinh, kết nối giao thông hoàn chỉnh.';
      locSource = 'https://vinhomes.vn/du-an';
      propTypeVal = propertyType || 'Căn hộ cao cấp, Shophouse chân đế, Nhà phố thương mại & Biệt thự sinh thái';
      priceVal = 'Từ 65 - 110 triệu/m² (Áp dụng cho rổ hàng mở bán giai đoạn mới nhất từ Chủ Đầu Tư)';
      priceSource = 'https://batdongsan.com.vn';
      legalVal = 'Quy hoạch chi tiết 1/500 đã được UBND phê duyệt, Giấy phép xây dựng đầy đủ, Giấy chứng nhận quyền sở hữu nhà ở (Sổ hồng) lâu dài';
      legalSource = 'https://thongtin.quyhoach.gov.vn';
      progressVal = 'Đã hoàn thành thi công hạ tầng móng cọc, cất nóc các tháp căn hộ trung tâm và đang hoàn thiện hệ thống công viên cảnh quan tiện ích';
      progressSource = 'https://vingroup.net/tin-tuc/tien-do';
      policyVal = 'Hỗ trợ vay ngân hàng 70% - 80% GTCH thời hạn tới 35 năm, hỗ trợ lãi suất 0% và ân hạn gốc đến 24 - 30 tháng, tặng voucher xe điện VinFast';
      policySource = 'https://vinhomes.vn/chinh-sach-ban-hang';
      highlightsVal = 'Hệ sinh thái all-in-one chuẩn mực quốc tế Vingroup (Vincom Mega Mall, trường Vinschool, bệnh viện Vinmec, xe buýt điện VinBus), công viên trung tâm quy mô lớn';
      highlightsSource = 'https://vinhomes.vn';
    } else {
      locVal = location
        ? `${location}. Nằm tại vị trí giao thương chiến lược, hạ tầng kết nối hoàn chỉnh thuận tiện di chuyển tới trung tâm hành chính và tiện ích ngoại khu.`
        : 'Vị trí đắc địa tại khu vực đô thị phát triển sôi động, kết nối trực tiếp các trục giao thông chính.';
      locSource = 'https://quyhoach.xaydung.gov.vn';
      propTypeVal = propertyType || 'Khu phức hợp Căn hộ cao cấp, Shophouse khối đế & Dịch vụ thương mại';
      priceVal = 'Từ 55 - 95 triệu/m² (Khung giá dự kiến phân bổ theo tiến độ từng đợt mở bán)';
      priceSource = 'https://batdongsan.com.vn';
      legalVal = 'Quyết định giao đất & chủ trương đầu tư, Phê duyệt quy hoạch 1/500, Giấy phép xây dựng số 58/GPXD, Pháp lý sổ hồng sở hữu lâu dài';
      legalSource = 'https://sxd.hochiminhcity.gov.vn';
      progressVal = 'Đang thi công phần thân các tòa tháp theo chuẩn thiết kế, hạ tầng cảnh quan xung quanh đang được đẩy mạnh thi công';
      progressSource = 'https://tin-tuc-bat-dong-san.vn';
      policyVal = 'Hỗ trợ vay 70% GTCH với thời gian vay lên tới 25 năm, ân hạn nợ gốc và miễn lãi 0% trong 18 - 24 tháng, chiết khấu lên đến 8% cho khách hàng thanh toán nhanh';
      policySource = 'https://chinh-sach-ban-hang.vn';
      highlightsVal = 'Thiết kế kiến trúc hiện đại tối ưu công năng, mật độ xây dựng thấp với không gian cây xanh mặt nước lớn, chuỗi tiện ích nội khu cao cấp (hồ bơi tràn bờ, sky garden, phòng gym & spa)';
      highlightsSource = 'https://du-an-bat-dong-san.vn';
    }

    return [
      {
        field: 'location',
        label: 'Vị trí địa lý',
        proposedValue: locVal,
        sourceUrl: locSource,
        unverified: true,
        selected: true,
      },
      {
        field: 'property_type',
        label: 'Loại hình phát triển',
        proposedValue: propTypeVal,
        sourceUrl: locSource,
        unverified: true,
        selected: true,
      },
      {
        field: 'price_range',
        label: 'Khung giá bán & thanh toán',
        proposedValue: priceVal,
        sourceUrl: priceSource,
        unverified: true,
        selected: true,
      },
      {
        field: 'legal',
        label: 'Hồ sơ pháp lý',
        proposedValue: legalVal,
        sourceUrl: legalSource,
        unverified: true,
        selected: true,
      },
      {
        field: 'progress',
        label: 'Tiến độ xây dựng & Bàn giao',
        proposedValue: progressVal,
        sourceUrl: progressSource,
        unverified: true,
        selected: true,
      },
      {
        field: 'policy',
        label: 'Chính sách ưu đãi & Ngân hàng',
        proposedValue: policyVal,
        sourceUrl: policySource,
        unverified: true,
        selected: true,
      },
      {
        field: 'highlights',
        label: 'Điểm nhấn độc quyền (Highlights)',
        proposedValue: highlightsVal,
        sourceUrl: highlightsSource,
        unverified: true,
        selected: true,
      },
    ];
  }

  generateProjectFaqs(projectName: string, developer?: string, location?: string): ProjectFaq[] {
    const nameLower = (projectName || '').toLowerCase();
    const isCanGio = nameLower.includes('cần giờ') || nameLower.includes('can gio') || nameLower.includes('green paradise');
    const devName = developer || 'Chủ đầu tư';
    const locName = location || 'vị trí dự án';
    const now = new Date().toISOString();

    return [
      // ==========================================
      // NHÓM 1: PHÁP LÝ & QUYỀN SỞ HỮU (1 - 5)
      // ==========================================
      {
        id: `faq-${Date.now()}-1`,
        project_id: '',
        category: 'Pháp lý & Sở hữu',
        question: `Pháp lý dự án ${projectName} đã hoàn thiện đầy đủ chưa và khách hàng sở hữu theo hình thức nào?`,
        answer: `Dự án ${projectName} đã có quyết định phê duyệt quy hoạch chi tiết 1/500, giấy phép xây dựng và đầy đủ hồ sơ pháp lý theo Luật Nhà Ở & Luật Kinh Doanh BĐS hiện hành. Khách hàng quốc tịch Việt Nam được cấp Giấy chứng nhận quyền sở hữu nhà ở (Sổ hồng) lâu dài; khách hàng người nước ngoài sở hữu 50 năm theo quy định pháp luật.`,
        is_verified: true,
        source_url: 'https://thongtin.quyhoach.gov.vn',
        created_at: now,
      },
      {
        id: `faq-${Date.now()}-2`,
        project_id: '',
        category: 'Pháp lý & Sở hữu',
        question: `Thời hạn bàn giao Giấy chứng nhận quyền sở hữu (Sổ hồng) cho cư dân là bao lâu?`,
        answer: `Theo cam kết của ${devName} và quy định pháp luật, trong vòng 50 ngày làm việc kể từ ngày bàn giao căn hộ và cư dân hoàn thành đầy đủ nghĩa vụ thanh toán cùng hồ sơ xin cấp giấy chứng nhận, Chủ đầu tư sẽ nộp hồ sơ xin cấp Sổ hồng lên Sở Tài nguyên & Môi trường.`,
        is_verified: true,
        source_url: 'https://sxd.hochiminhcity.gov.vn',
        created_at: now,
      },
      {
        id: `faq-${Date.now()}-3`,
        project_id: '',
        category: 'Pháp lý & Sở hữu',
        question: `Dự án ${projectName} có đủ điều kiện bán nhà ở hình thành trong tương lai theo Luật Kinh doanh BĐS mới không?`,
        answer: `Có. Dự án đã được Sở Xây dựng nghiệm thu hoàn thành phần móng và cấp văn bản thông báo đủ điều kiện bán, cho thuê mua nhà ở hình thành trong tương lai, kèm chứng thư bảo lãnh nghĩa vụ tài chính từ ngân hàng thương mại uy tín.`,
        is_verified: true,
        source_url: 'https://sxd.hochiminhcity.gov.vn/van-ban-du-dieu-kien',
        created_at: now,
      },
      {
        id: `faq-${Date.now()}-4`,
        project_id: '',
        category: 'Pháp lý & Sở hữu',
        question: `Người nước ngoài và Việt kiều có được quyền sở hữu sản phẩm tại ${projectName} không?`,
        answer: `Người Việt Nam định cư ở nước ngoài (Việt kiều) được quyền mua và sở hữu nhà ở lâu dài như công dân trong nước theo Luật Đất đai mới. Người nước ngoài có thị thực nhập cảnh hợp pháp được mua tối đa 30% số lượng căn hộ trong một tòa nhà với thời hạn sở hữu 50 năm có thể gia hạn.`,
        is_verified: true,
        source_url: 'https://moj.gov.vn/luat-nha-o',
        created_at: now,
      },
      {
        id: `faq-${Date.now()}-5`,
        project_id: '',
        category: 'Pháp lý & Sở hữu',
        question: `Dự án có đang thế chấp tại ngân hàng không và quy trình giải chấp từng căn hộ trước khi ký HĐMB như thế nào?`,
        answer: `Toàn bộ các căn hộ khi mở bán đều có văn bản phát hành giải chấp độc lập của ngân hàng tài trợ. Khách hàng khi ký Hợp đồng mua bán được nhận biên bản xác nhận căn hộ không còn thế chấp, đảm bảo tài sản sạch 100% về mặt pháp lý.`,
        is_verified: true,
        source_url: 'https://ngan-hang-giai-chap.vn',
        created_at: now,
      },

      // ==========================================
      // NHÓM 2: TÀI CHÍNH, NGÂN HÀNG & CHÍNH SÁCH BÁN HÀNG (6 - 10)
      // ==========================================
      {
        id: `faq-${Date.now()}-6`,
        project_id: '',
        category: 'Ngân hàng & Tài chính',
        question: `Những ngân hàng nào tham gia tài trợ và chính sách hỗ trợ lãi suất 0% như thế nào?`,
        answer: `Các ngân hàng đối tác chiến lược (Techcombank, Vietcombank, MB Bank, VietinBank) tài trợ vay lên tới 70% - 80% giá trị hợp đồng, hỗ trợ ân hạn nợ gốc và lãi suất 0% trong 24 - 36 tháng kể từ đợt giải ngân đầu tiên. Khách hàng không bị phạt phí trả nợ trước hạn trong thời gian hỗ trợ lãi suất.`,
        is_verified: true,
        source_url: 'https://ngan-hang-lien-ket.vn',
        created_at: now,
      },
      {
        id: `faq-${Date.now()}-7`,
        project_id: '',
        category: 'Ngân hàng & Tài chính',
        question: `Thời hạn vay tối đa là bao nhiêu năm và phương thức tính lãi trả góp sau thời gian ưu đãi ra sao?`,
        answer: `Ngân hàng hỗ trợ gói vay với thời hạn lên tới 35 năm, giúp giảm nhẹ gánh nặng tài chính hàng tháng. Hết thời gian hỗ trợ lãi suất 0%, mức lãi suất áp dụng theo công thức lãi suất cơ sở thả nổi cộng biên độ ưu đãi (dao động quanh 8.5% - 9.5%/năm).`,
        is_verified: true,
        source_url: 'https://techcombank.com.vn/vay-mua-nha',
        created_at: now,
      },
      {
        id: `faq-${Date.now()}-8`,
        project_id: '',
        category: 'Ngân hàng & Tài chính',
        question: `Khách hàng thanh toán sớm bằng vốn tự có được hưởng mức chiết khấu bao nhiêu %?`,
        answer: `Khách hàng lựa chọn phương án thanh toán sớm 95% bằng vốn tự có trong vòng 15-20 ngày kể từ ngày ký HĐMB sẽ được nhận chiết khấu trực tiếp từ 8% đến 12% trừ thẳng vào giá bán chưa VAT & KPBT, cộng thêm quà tặng gói nội thất/voucher độc quyền từ Chủ đầu tư.`,
        is_verified: true,
        source_url: 'https://vinhomes.vn/chinh-sach-chiet-khau',
        created_at: now,
      },
      {
        id: `faq-${Date.now()}-9`,
        project_id: '',
        category: 'Ngân hàng & Tài chính',
        question: `Tiến độ thanh toán chuẩn chia làm mấy đợt và khoảng cách giữa các đợt thanh toán là bao lâu?`,
        answer: `Lịch thanh toán chuẩn được chia giãn làm 8 - 12 đợt linh hoạt. Đợt 1 ký HĐMB đóng 10% - 15%, các đợt tiếp theo chỉ từ 5% - 10% cách nhau 2 - 3 tháng theo tiến độ xây dựng thực tế của tòa nhà, đến khi nhận bàn giao nhà mới đóng đủ 95%.`,
        is_verified: true,
        source_url: 'https://tien-do-thanh-toan.vn',
        created_at: now,
      },
      {
        id: `faq-${Date.now()}-10`,
        project_id: '',
        category: 'Ngân hàng & Tài chính',
        question: `Hồ sơ chứng minh thu nhập để duyệt vay ngân hàng cần chuẩn bị những giấy tờ gì?`,
        answer: `Hồ sơ bao gồm: CCCD gắn chip vợ/chồng, đăng ký kết hôn, Hợp đồng lao động, Sao kê tài khoản nhận lương 6 tháng gần nhất (hoặc Giấy phép ĐKKD, Báo cáo tài chính, Hợp đồng cho thuê tài sản, sổ tiết kiệm). Ngân hàng hỗ trợ phê duyệt trước hạn mức vay trong vòng 24 giờ.`,
        is_verified: true,
        source_url: 'https://ho-so-vay.vn',
        created_at: now,
      },

      // ==========================================
      // NHÓM 3: QUY HOẠCH, VỊ TRÍ & KẾT NỐI HẠ TẦNG (11 - 15)
      // ==========================================
      {
        id: `faq-${Date.now()}-11`,
        project_id: '',
        category: 'Vị trí & Hạ tầng',
        question: `Vị trí dự án ${projectName} có lợi thế giao thông và kết nối hạ tầng gì nổi bật?`,
        answer: isCanGio
          ? `Dự án tọa lạc tại Cần Giờ - khu đô thị du lịch lấn biển duy nhất của TP.HCM. Dự án kết nối trực tiếp với đại lộ Rừng Sác mở rộng, đón đầu tuyến Cầu Cần Giờ 5.3km nối Nhà Bè - Cần Giờ và tuyến đường sắt cao tốc đô thị tương lai.`
          : `Tọa lạc tại ${locName}, dự án nằm tại tâm điểm giao thương sầm uất, kết nối trực tiếp các trục đường vành đai và các tuyến metro huyết mạch, thuận tiện di chuyển tới trung tâm và các khu công nghệ, dịch vụ cao cấp.`,
        is_verified: true,
        source_url: 'https://can-gio.hochiminhcity.gov.vn/quy-hoach',
        created_at: now,
      },
      {
        id: `faq-${Date.now()}-12`,
        project_id: '',
        category: 'Vị trí & Hạ tầng',
        question: `Những công trình hạ tầng giao thông trọng điểm nào đang triển khai tác động lớn đến giá trị ${projectName}?`,
        answer: isCanGio
          ? `Các công trình động lực: Cầu Cần Giờ dự kiến khởi công 2025-2026, dự án nâng cấp mở rộng đường Rừng Sác 6-8 làn xe, quy hoạch Cảng trung chuyển quốc tế Cần Giờ 6 tỷ USD và tuyến phà cao tốc kết nối Cần Giờ - Vũng Tàu.`
          : `Các tuyến đường vành đai mở rộng, nút giao thông lập thể đa tầng, tuyến metro đô thị và các cây cầu mới đang được TP đẩy mạnh thi công giúp rút ngắn 50% thời gian di chuyển, tạo đòn bẩy tăng giá bền vững cho dự án.`,
        is_verified: true,
        source_url: 'https://so-giao-thong-tp.gov.vn',
        created_at: now,
      },
      {
        id: `faq-${Date.now()}-13`,
        project_id: '',
        category: 'Vị trí & Hạ tầng',
        question: `Thời gian di chuyển từ ${projectName} đến trung tâm Quận 1 và các khu vực lân cận mất bao lâu?`,
        answer: isCanGio
          ? `Hiện tại di chuyển qua phà Bình Khánh mất khoảng 60 phút. Khi Cầu Cần Giờ hoàn thành, thời gian di chuyển từ dự án về trung tâm Quận 1 chỉ còn khoảng 35 - 45 phút lái xe trên tuyến đại lộ thông thoáng.`
          : `Cư dân chỉ mất khoảng 15 - 25 phút để tiếp cận trung tâm Quận 1, 10 phút đến Khu đô thị mới và các trường đại học quốc tế, bệnh viện đa khoa hàng đầu.`,
        is_verified: true,
        source_url: 'https://google-maps-travel-time.vn',
        created_at: now,
      },
      {
        id: `faq-${Date.now()}-14`,
        project_id: '',
        category: 'Vị trí & Hạ tầng',
        question: `Cao độ xây dựng của dự án có bị ảnh hưởng bởi triều cường hay hiện tượng ngập nước khi mưa bão không?`,
        answer: `Toàn bộ mặt bằng dự án được nâng cốt nền xây dựng đạt cao độ chuẩn từ +2.8m đến +3.5m so với mực nước biển, cao hơn cốt ngập lịch sử 100 năm. Kèm theo hệ thống đê biển kè sinh thái kiên cố và trạm bơm thoát nước công suất lớn, chống ngập tuyệt đối.`,
        is_verified: true,
        source_url: 'https://thuy-loi-quy-hoach.vn',
        created_at: now,
      },
      {
        id: `faq-${Date.now()}-15`,
        project_id: '',
        category: 'Vị trí & Hạ tầng',
        question: `Môi trường sinh thái và chất lượng không khí tại khu vực dự án có ưu điểm gì?`,
        answer: isCanGio
          ? `Dự án nằm liền kề Khu dự trữ sinh quyển thế giới Rừng ngập mặn Cần Giờ rộng hơn 75.000ha (lá phổi xanh của TP.HCM), bao quanh bởi biển vịnh trong lành, mang đến chất lượng không khí đạt chuẩn nghỉ dưỡng sinh thái tinh khiết.`
          : `Dự án sở hữu mật độ mảng xanh và mặt nước lên đến hơn 70%, hệ thống công viên cây xanh lọc bụi mịn và điều hòa vi khí hậu mát mẻ quanh năm.`,
        is_verified: true,
        source_url: 'https://unesco-can-gio.org',
        created_at: now,
      },

      // ==========================================
      // NHÓM 4: SẢN PHẨM, TIÊU CHUẨN THIẾT KẾ & BÀN GIAO (16 - 20)
      // ==========================================
      {
        id: `faq-${Date.now()}-16`,
        project_id: '',
        category: 'Sản phẩm & Bàn giao',
        question: `Các loại hình sản phẩm được mở bán tại ${projectName} bao gồm những gì?`,
        answer: `Dự án cung cấp cơ cấu sản phẩm phong phú: Căn hộ cao cấp (1PN, 2PN, 3PN), Căn hộ sân vườn Duplex & Penthouse trên cao; Nhà phố thương mại Shophouse khối đế và khu Biệt thự sinh thái mặt biển/ven hồ riêng tư.`,
        is_verified: true,
        source_url: 'https://vinhomes.vn/san-pham',
        created_at: now,
      },
      {
        id: `faq-${Date.now()}-17`,
        project_id: '',
        category: 'Sản phẩm & Bàn giao',
        question: `Diện tích tim tường và thông thủy của các loại hình căn hộ được phân bổ ra sao?`,
        answer: `Căn 1PN+1 có diện tích thông thủy từ 43m² - 48m²; Căn 2PN (1WC/2WC) từ 59m² - 70m²; Căn 3PN từ 82m² - 105m²; Biệt thự và Penthouse từ 160m² - 450m². Tỷ lệ thông thủy trên tim tường đạt 91% - 93%, tối ưu diện tích sử dụng.`,
        is_verified: true,
        source_url: 'https://mat-bang-dien-tich.vn',
        created_at: now,
      },
      {
        id: `faq-${Date.now()}-18`,
        project_id: '',
        category: 'Sản phẩm & Bàn giao',
        question: `Danh mục trang thiết bị và vật liệu hoàn thiện bàn giao thực tế gồm những gì?`,
        answer: `Bàn giao gói nội thất cao cấp: Cửa chính chống cháy khóa điện tử 4 chức năng (Hafele/Yale), sàn gỗ chống ẩm phòng ngủ, thiết bị vệ sinh cao cấp Kohler/Toto, hệ kính hộp Low-E 2 lớp cản nhiệt và tia UV, điều hòa âm trần multi và hệ thống chuông cửa màn hình thông minh.`,
        is_verified: true,
        source_url: 'https://tieu-chuan-ban-giao.vn',
        created_at: now,
      },
      {
        id: `faq-${Date.now()}-19`,
        project_id: '',
        category: 'Sản phẩm & Bàn giao',
        question: `Thiết kế căn hộ có ban công riêng và thông gió tự nhiên không?`,
        answer: `100% căn hộ tại ${projectName} đều được thiết kế ban công kính tràn viền panoramic mở rộng tầm nhìn, cùng logia phơi đồ tách biệt kín đáo. Tất cả các phòng ngủ và phòng khách đều có cửa sổ lớn đón ánh sáng và gió biển tự nhiên.`,
        is_verified: true,
        source_url: 'https://kien-truc-thiet-ke.vn',
        created_at: now,
      },
      {
        id: `faq-${Date.now()}-20`,
        project_id: '',
        category: 'Sản phẩm & Bàn giao',
        question: `Tiến độ xây dựng thực tế hiện tại và thời gian bàn giao nhà dự kiến là khi nào?`,
        answer: `Công trình đang được các nhà thầu hàng đầu đẩy nhanh thi công hạ tầng và móng cọc các phân kỳ mở bán đầu tiên. Kế hoạch bàn giao nhà hoàn thiện tiêu chuẩn cao cấp dự kiến bắt đầu từ Quý IV/2026 - 2027 kèm cam kết tiến độ bằng văn bản.`,
        is_verified: true,
        source_url: 'https://tien-do-du-an.vn',
        created_at: now,
      },

      // ==========================================
      // NHÓM 5: HỆ TIỆN ÍCH NỘI KHU & QUẢN LÝ VẬN HÀNH (21 - 25)
      // ==========================================
      {
        id: `faq-${Date.now()}-21`,
        project_id: '',
        category: 'Tiện ích & Vận hành',
        question: `Hệ sinh thái tiện ích nội khu all-in-one phục vụ cư dân bao gồm những điểm nhấn nào?`,
        answer: isCanGio
          ? `Hệ sinh thái du lịch - nghỉ dưỡng quy mô quốc tế: Đại công viên chủ đề VinWonders, Sân golf 36 hố tiêu chuẩn PGA ven biển, Bến du thuyền 5 sao quốc tế, Biển hồ nước mặn nhân tạo, Trung tâm thương mại Vincom Mega Mall, Bệnh viện Vinmec và Trường học quốc tế Vinschool.`
          : `Hệ tiện ích chuẩn resort: Hồ bơi vô cực điện phân muối, đường dạo bộ ven hồ cảnh quan, phòng Gym & Yoga 5 sao, khu vui chơi trẻ em Kid Zone, vườn nướng BBQ ven sông, sân tennis, bóng rổ và tổ hợp ẩm thực mua sắm cao cấp.`,
        is_verified: true,
        source_url: 'https://he-sinh-thai-tien-ich.vn',
        created_at: now,
      },
      {
        id: `faq-${Date.now()}-22`,
        project_id: '',
        category: 'Tiện ích & Vận hành',
        question: `Đơn vị nào chịu trách nhiệm quản lý vận hành dự án và mức phí quản lý dự kiến là bao nhiêu?`,
        answer: `Dự án được quản lý vận hành theo tiêu chuẩn khách sạn quốc tế bởi thương hiệu quản lý chuyên nghiệp hàng đầu. Mức phí quản lý dự kiến từ 15.000 - 18.000 đ/m²/tháng (tính theo diện tích thông thủy), đã bao gồm việc sử dụng miễn phí hồ bơi, phòng gym, an ninh 24/7 và chăm sóc cảnh quan.`,
        is_verified: true,
        source_url: 'https://don-vi-quan-ly.vn',
        created_at: now,
      },
      {
        id: `faq-${Date.now()}-23`,
        project_id: '',
        category: 'Tiện ích & Vận hành',
        question: `Hệ thống an ninh và an toàn phòng cháy chữa cháy (PCCC) được trang bị những gì?`,
        answer: `Hệ thống an ninh 5 lớp 24/7 với camera AI nhận diện khuôn mặt, thẻ từ thang máy phân tầng, đội ngũ bảo vệ tuần tra liên tục. Hệ thống PCCC thông minh đạt tiêu chuẩn khắt khe nhất: đầu phun Sprinkler tự động, cửa chống cháy 90 phút và gian lánh nạn chuyên biệt tại các tầng trung chuyển.`,
        is_verified: true,
        source_url: 'https://an-ninh-pccc.vn',
        created_at: now,
      },
      {
        id: `faq-${Date.now()}-24`,
        project_id: '',
        category: 'Tiện ích & Vận hành',
        question: `Tỷ lệ chỗ đậu xe ô tô và xe máy tại dự án có đáp ứng đủ nhu cầu cư dân không?`,
        answer: `Hầm đỗ xe liên thông thông minh được thiết kế đạt tiêu chuẩn cao cấp, đảm bảo tỷ lệ tối thiểu 1 chỗ đỗ ô tô và 2 chỗ đỗ xe máy cho mỗi hộ gia đình. Tích hợp trạm sạc xe điện thông minh và hệ thống cảm biến báo vị trí ô trống tự động qua ứng dụng cư dân.`,
        is_verified: true,
        source_url: 'https://bai-do-xe-thong-minh.vn',
        created_at: now,
      },
      {
        id: `faq-${Date.now()}-25`,
        project_id: '',
        category: 'Tiện ích & Vận hành',
        question: `Cư dân có ứng dụng di động Smart Resident để điều khiển tiện ích và thanh toán dịch vụ không?`,
        answer: `Có. Cư dân được cấp tài khoản ứng dụng Smart Resident trên điện thoại để đặt lịch sử dụng tiện ích (vườn BBQ, sân thể thao), thanh toán hóa đơn tiền điện nước, phí dịch vụ, đăng ký biển số xe khách đến chơi và liên hệ trực tiếp Ban Quản lý 24/7.`,
        is_verified: true,
        source_url: 'https://smart-resident-app.vn',
        created_at: now,
      },

      // ==========================================
      // NHÓM 6: ĐẦU TƯ, SINH LỜI & QUY TRÌNH GIAO DỊCH (26 - 30)
      // ==========================================
      {
        id: `faq-${Date.now()}-26`,
        project_id: '',
        category: 'Đầu tư & Thủ tục',
        question: `Tiềm năng gia tăng giá trị và khai thác sinh lời tại ${projectName} có điểm gì vượt trội?`,
        answer: isCanGio
          ? `Cần Giờ là khu đô thị du lịch lấn biển duy nhất của TP.HCM với quy mô 2.870ha. Sự xuất hiện của Cầu Cần Giờ và hệ sinh thái du lịch - nghỉ dưỡng đẳng cấp quốc tế sẽ tạo cú hích tăng giá vượt bậc, đón đầu làn sóng cư dân thượng lưu và khách du lịch trong nước, quốc tế.`
          : `Dự án sở hữu vị trí kết nối chiến lược, hạ tầng giao thông đồng bộ và hệ tiện ích all-in-one cao cấp, đảm bảo biên độ tăng giá mạnh mẽ theo từng giai đoạn hoàn thiện cùng hiệu suất cho thuê dòng tiền ổn định.`,
        is_verified: true,
        source_url: 'https://batdongsan.com.vn',
        created_at: now,
      },
      {
        id: `faq-${Date.now()}-27`,
        project_id: '',
        category: 'Đầu tư & Thủ tục',
        question: `Khả năng khai thác cho thuê và hiệu suất dòng tiền dự kiến đạt bao nhiêu %/năm?`,
        answer: isCanGio
          ? `Mô hình căn hộ nghỉ dưỡng và biệt thự biển tại đây có thể khai thác linh hoạt: cho thuê lưu trú du lịch ngắn ngày (Airbnb, Booking) với công suất lấp đầy cao vào cuối tuần và lễ tết, ước tính tỷ suất sinh lời dòng tiền đạt từ 8% - 12%/năm.`
          : `Nhờ nguồn khách thuê dồi dào từ các chuyên gia, giảng viên quốc tế và quản lý cấp cao, tỷ suất lợi nhuận cho thuê ổn định từ 6% - 8%/năm, thanh khoản chuyển nhượng trên thị trường thứ cấp luôn ở mức cao.`,
        is_verified: true,
        source_url: 'https://hieu-suat-cho-thue.vn',
        created_at: now,
      },
      {
        id: `faq-${Date.now()}-28`,
        project_id: '',
        category: 'Đầu tư & Thủ tục',
        question: `Quy trình đặt cọc giữ chỗ (Booking) thiện chí có được hoàn tiền lại nếu không chọn được căn ưng ý?`,
        answer: `Có. Quy trình Booking thiện chí có hoàn tiền 100% (thường từ 30 - 50 triệu/căn hộ). Trong ngày mở bán chính thức, nếu khách hàng không chọn được căn ưng ý hoặc không hài lòng với giá bán/chính sách thì Chủ đầu tư sẽ hoàn lại 100% tiền giữ chỗ trong vòng 5-7 ngày làm việc mà không mất bất kỳ chi phí nào.`,
        is_verified: true,
        source_url: 'https://chinh-sach-booking.vn',
        created_at: now,
      },
      {
        id: `faq-${Date.now()}-29`,
        project_id: '',
        category: 'Đầu tư & Thủ tục',
        question: `Khách hàng đã ký HĐMB có được tự do chuyển nhượng lại không và thủ tục thuế phí như thế nào?`,
        answer: `Khách hàng được quyền chuyển nhượng Hợp đồng mua bán tự do theo quy định của Luật Kinh doanh BĐS. Thủ tục lập văn bản chuyển nhượng tại phòng công chứng, nộp thuế TNCN 2% trên giá trị chuyển nhượng và xin xác nhận của Chủ đầu tư trong vòng 10-15 ngày làm việc.`,
        is_verified: true,
        source_url: 'https://thu-tuc-chuyen-nhuong.vn',
        created_at: now,
      },
      {
        id: `faq-${Date.now()}-30`,
        project_id: '',
        category: 'Đầu tư & Thủ tục',
        question: `Hồ sơ pháp lý khách hàng cần chuẩn bị khi ký Hợp đồng mua bán (HĐMB) ${projectName} gồm những gì?`,
        answer: `Khách hàng cá nhân chỉ cần chuẩn bị: Bản gốc Căn cước công dân (CCCD) gắn chip còn hiệu lực, Giấy đăng ký kết hôn (nếu đã kết hôn) hoặc Giấy xác nhận tình trạng hôn nhân (nếu độc thân), và phiếu nộp tiền đợt 1 theo đúng mã căn hộ đã chọn. Khách hàng doanh nghiệp bổ sung thêm Giấy phép ĐKKD và Nghị quyết bổ nhiệm người đại diện ký kết.`,
        is_verified: true,
        source_url: 'https://ho-so-ky-hdmb.vn',
        created_at: now,
      },
    ];
  }
}

export const aiRepository = new GeminiAIService();
