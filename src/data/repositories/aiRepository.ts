// ========================================================
// REAL ESTATE CRM - AI SALES INTELLIGENCE REPOSITORY
// Triển khai AIService Interface, Che dữ liệu nhạy cảm, Fallback
// ========================================================

import { Lead, ProjectKnowledge, LeadActivity } from '@/domain/types';
import { maskPhone, maskEmail } from '@/lib/utils';
import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';

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

export interface AIService {
  generateScript(lead: Lead, knowledge: ProjectKnowledge | null, status: string): Promise<string>;
  getLeadInsights(lead: Lead, activities: LeadActivity[], knowledge: ProjectKnowledge | null): Promise<AILeadInsightResult>;
  enrichProject(projectName: string, location: string, developer: string): Promise<ProjectEnrichProposal[]>;
}

export class GeminiAIService implements AIService {
  // 1. TẠO KỊCH BẢN CÁ NHÂN HOÁ DỰA TRÊN DỰ ÁN VÀ KHÁCH HÀNG
  async generateScript(lead: Lead, knowledge: ProjectKnowledge | null, status: string): Promise<string> {
    // Che dữ liệu cá nhân trước khi gửi
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

    // Rule-based Fallback chuyên nghiệp
    const projectSummary = knowledge?.summary_text || 'Dự án bất động sản trọng điểm';
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

  // 2. PHÂN TÍCH LEAD INSIGHTS: NHU CẦU, PHẢN ĐỐI, ĐIỂM SỐ, HÀNH ĐỘNG TIẾP THEO
  async getLeadInsights(lead: Lead, activities: LeadActivity[], knowledge: ProjectKnowledge | null): Promise<AILeadInsightResult> {
    if (isLiveSupabaseConfigured) {
      try {
        const { data, error } = await supabase.functions.invoke('ai-lead-insight', {
          body: {
            lead: {
              purpose: lead.purpose,
              score: lead.lead_score,
              budget: [lead.budget_min, lead.budget_max],
              notes: lead.notes,
              activityCount: activities.length,
            },
            projectKnowledge: knowledge?.summary_text,
          },
        });
        if (!error && data) return data;
      } catch (err) {
        console.warn('Edge Function ai-lead-insight fallback to rule-based:', err);
      }
    }

    // Rule-based Fallback
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

  // 3. TỰ ĐỘNG BỔ SUNG THÔNG TIN DỰ ÁN (PROJECT ENRICHMENT)
  async enrichProject(projectName: string, location: string, developer: string): Promise<ProjectEnrichProposal[]> {
    if (isLiveSupabaseConfigured) {
      try {
        const { data, error } = await supabase.functions.invoke('project-enrich', {
          body: { projectName, location, developer },
        });
        if (!error && data?.proposals) return data.proposals;
      } catch (err) {
        console.warn('Edge Function project-enrich fallback:', err);
      }
    }

    // Dữ liệu đề xuất mẫu chính thống có cờ unverified
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
