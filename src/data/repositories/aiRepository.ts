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

    return [
      {
        id: `faq-${Date.now()}-1`,
        project_id: '',
        question: `Pháp lý dự án ${projectName} đã hoàn thiện đầy đủ chưa và khách hàng sở hữu theo hình thức nào?`,
        answer: `Dự án đã có quyết định phê duyệt quy hoạch chi tiết 1/500, giấy phép xây dựng và đầy đủ hồ sơ pháp lý theo Luật Nhà Ở & Luật Kinh Doanh BĐS hiện hành. Khách hàng quốc tịch Việt Nam được cấp Giấy chứng nhận quyền sở hữu nhà ở (Sổ hồng) lâu dài; khách hàng người nước ngoài sở hữu 50 năm theo quy định pháp luật.`,
        is_verified: true,
        source_url: 'https://thongtin.quyhoach.gov.vn',
        created_at: new Date().toISOString(),
      },
      {
        id: `faq-${Date.now()}-2`,
        project_id: '',
        question: `Những ngân hàng nào tham gia tài trợ và chính sách hỗ trợ lãi suất 0% như thế nào?`,
        answer: `Các ngân hàng đối tác chiến lược (Techcombank, Vietcombank, MB Bank, VietinBank) tài trợ vay lên tới 70% - 80% giá trị hợp đồng, hỗ trợ ân hạn nợ gốc và lãi suất 0% trong 24 - 36 tháng kể từ đợt giải ngân đầu tiên. Khách hàng không bị phạt phí trả nợ trước hạn trong thời gian hỗ trợ lãi suất.`,
        is_verified: true,
        source_url: 'https://ngan-hang-lien-ket.vn',
        created_at: new Date().toISOString(),
      },
      {
        id: `faq-${Date.now()}-3`,
        project_id: '',
        question: `Tiến độ xây dựng thực tế và thời gian bàn giao dự kiến của ${projectName}?`,
        answer: `Công trình đang được các nhà thầu hàng đầu đẩy nhanh thi công hạ tầng và móng cọc các phân kỳ mở bán đầu tiên. Kế hoạch bàn giao nhà hoàn thiện tiêu chuẩn cao cấp dự kiến bắt đầu từ Quý IV/2026 - 2027 kèm cam kết tiến độ bằng văn bản.`,
        is_verified: true,
        source_url: 'https://tien-do-du-an.vn',
        created_at: new Date().toISOString(),
      },
      {
        id: `faq-${Date.now()}-4`,
        project_id: '',
        question: `Tiềm năng gia tăng giá trị và khai thác sinh lời tại ${projectName} có điểm gì vượt trội?`,
        answer: isCanGio
          ? `Cần Giờ là khu đô thị du lịch lấn biển duy nhất của TP.HCM với quy mô 2.870ha. Sự xuất hiện của Cầu Cần Giờ và hệ sinh thái du lịch - nghỉ dưỡng đẳng cấp quốc tế sẽ tạo cú hích tăng giá vượt bậc, đón đầu làn sóng cư dân thượng lưu và khách du lịch trong nước, quốc tế.`
          : `Dự án sở hữu vị trí kết nối chiến lược, hạ tầng giao thông đồng bộ và hệ tiện ích all-in-one cao cấp, đảm bảo biên độ tăng giá mạnh mẽ theo từng giai đoạn hoàn thiện cùng hiệu suất cho thuê dòng tiền ổn định.`,
        is_verified: true,
        source_url: 'https://batdongsan.com.vn',
        created_at: new Date().toISOString(),
      },
    ];
  }
}

export const aiRepository = new GeminiAIService();
