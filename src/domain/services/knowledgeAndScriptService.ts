// ========================================================
// REAL ESTATE CRM - PROJECT KNOWLEDGE & CONTEXT SCRIPT SERVICE (PHASE 8)
// Kho tri thức có kiểm duyệt (Verified Knowledge),
// Thư viện Script 9 nhóm ngữ cảnh chuẩn BĐS,
// Bộ lọc tuân thủ quảng cáo (Compliance Linter),
// Đo lường hiệu quả chuyển đổi & Care Playbooks tôn trọng Consent
// ========================================================

import { 
  ProjectKnowledgeItem, 
  ScriptTemplate, 
  ScriptUsage, 
  CareTask, 
  ComplianceLintResult, 
  UserProfile, 
  KnowledgeCategory, 
  ScriptContextCode, 
  Customer 
} from '@/domain/types';

const STORAGE_KEY_PKI = 'crm_project_knowledge_items';
const STORAGE_KEY_SCRIPTS = 'crm_script_templates';
const STORAGE_KEY_SCRIPT_USAGES = 'crm_script_usages';
const STORAGE_KEY_CARE_TASKS = 'crm_care_tasks';
const STORAGE_KEY_CUSTOMERS = 'crm_customers';

// Danh sách cụm từ cấm theo Luật Kinh doanh BĐS & Luật Quảng cáo
const PROHIBITED_COMPLIANCE_TERMS = [
  { term: 'cam kết lợi nhuận', reason: 'Nghiêm cấm cam kết lợi nhuận cố định khi chưa có bảo lãnh ngân hàng', severity: 'error' as const },
  { term: 'chắc chắn tăng giá', reason: 'Cấm khẳng định biến động giá tương lai sai sự thật', severity: 'error' as const },
  { term: 'bao pháp lý 100%', reason: 'Cấm cam kết pháp lý tuyệt đối khi chưa có văn bản chấp thuận', severity: 'error' as const },
  { term: 'không thể lỗ', reason: 'Tuyên truyền sai lệch rủi ro đầu tư bất động sản', severity: 'error' as const },
  { term: 'lãi suất 0% trọn đời', reason: 'Quảng cáo sai lệch chính sách hỗ trợ lãi suất', severity: 'error' as const },
  { term: 'cam kết mua lại', reason: 'Cấm hứa hẹn mua lại không có điều kiện bảo chứng', severity: 'error' as const }
];

export class KnowledgeAndScriptService {
  constructor() {
    this.ensureInitialized();
  }

  private ensureInitialized() {
    if (!localStorage.getItem(STORAGE_KEY_PKI)) {
      localStorage.setItem(STORAGE_KEY_PKI, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEY_SCRIPTS)) {
      localStorage.setItem(STORAGE_KEY_SCRIPTS, JSON.stringify(this.getSeedScriptTemplates()));
    }
    if (!localStorage.getItem(STORAGE_KEY_SCRIPT_USAGES)) {
      localStorage.setItem(STORAGE_KEY_SCRIPT_USAGES, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEY_CARE_TASKS)) {
      localStorage.setItem(STORAGE_KEY_CARE_TASKS, JSON.stringify([]));
    }
  }

  // ========================================================
  // 1. KHO TRI THỨC DỰ ÁN & QUY TẮC TIN CẬY
  // ========================================================
  createKnowledgeItem(
    item: Omit<ProjectKnowledgeItem, 'id' | 'version' | 'created_at' | 'updated_at'>, 
    operator: UserProfile
  ): ProjectKnowledgeItem {
    if (!['admin', 'director', 'marketing_manager'].includes(operator.role)) {
      throw new Error('Chỉ Admin, Giám đốc Sàn hoặc Marketing Manager mới có quyền tạo mục tri thức dự án.');
    }

    const items: ProjectKnowledgeItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY_PKI) || '[]');
    const newItem: ProjectKnowledgeItem = {
      ...item,
      id: `pki-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      version: 1,
      created_by: operator.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    items.push(newItem);
    localStorage.setItem(STORAGE_KEY_PKI, JSON.stringify(items));
    return newItem;
  }

  verifyKnowledgeItem(itemId: string, operator: UserProfile, validDays = 90): ProjectKnowledgeItem {
    if (!['admin', 'director', 'marketing_manager'].includes(operator.role)) {
      throw new Error('Chỉ cấp Quản lý mới có thẩm quyền xác minh và phê duyệt thông tin tri thức dự án.');
    }

    const items: ProjectKnowledgeItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY_PKI) || '[]');
    const idx = items.findIndex(i => i.id === itemId);
    if (idx === -1) {
      throw new Error(`Không tìm thấy mục tri thức với ID: ${itemId}`);
    }

    const expiresAt = new Date(Date.now() + validDays * 24 * 3600 * 1000).toISOString();
    items[idx] = {
      ...items[idx],
      status: 'published',
      verified_by: operator.id,
      verified_at: new Date().toISOString(),
      expires_at: expiresAt,
      version: items[idx].version + 1,
      updated_at: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY_PKI, JSON.stringify(items));
    return items[idx];
  }

  getKnowledgeForSales(projectId: string): Array<ProjectKnowledgeItem & { needs_confirmation?: boolean; warning?: string }> {
    this.ensureInitialized();
    const items: ProjectKnowledgeItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY_PKI) || '[]');
    const projectItems = items.filter(i => i.project_id === projectId && i.status === 'published');
    const now = Date.now();

    const sensitiveCategories: KnowledgeCategory[] = ['price_policy', 'legal', 'construction_progress'];

    return projectItems.map(item => {
      const isSensitive = sensitiveCategories.includes(item.category);
      const isExpired = item.expires_at ? new Date(item.expires_at).getTime() < now : true;
      const isUnverified = !item.verified_at;

      if (isSensitive && (isUnverified || isExpired)) {
        return {
          ...item,
          needs_confirmation: true,
          warning: 'Thông tin này chưa được xác minh chính thức hoặc đã quá hạn hiệu lực. Cần xác nhận lại với Chủ đầu tư trước khi cam kết với khách hàng.'
        };
      }

      return item;
    });
  }

  // ========================================================
  // 2. BỘ LỌC TUÂN THỦ (COMPLIANCE LINTER)
  // ========================================================
  lintCompliance(content: string): ComplianceLintResult {
    const lower = content.toLowerCase();
    const violations: ComplianceLintResult['violations'] = [];

    for (const termObj of PROHIBITED_COMPLIANCE_TERMS) {
      if (lower.includes(termObj.term.toLowerCase())) {
        violations.push({
          term: termObj.term,
          reason: termObj.reason,
          severity: termObj.severity
        });
      }
    }

    return {
      isCompliant: violations.length === 0,
      violations
    };
  }

  // ========================================================
  // 3. THƯ VIỆN SCRIPT ĐA NGỮ CẢNH & THAY THẾ BIẾN
  // ========================================================
  createScriptTemplate(
    payload: Omit<ScriptTemplate, 'id' | 'version' | 'created_at' | 'updated_at'>, 
    operator: UserProfile
  ): ScriptTemplate {
    if (!['admin', 'director', 'marketing_manager'].includes(operator.role)) {
      throw new Error('Chỉ Quản lý mới có quyền tạo mẫu kịch bản bán hàng chuẩn.');
    }

    // Kiểm tra tuân thủ trước khi xuất bản
    const lintResult = this.lintCompliance(`${payload.title} ${payload.opening} ${payload.main_content} ${payload.cta}`);
    if (!lintResult.isCompliant && payload.status === 'published') {
      const errorTerms = lintResult.violations.map(v => `"${v.term}": ${v.reason}`).join('; ');
      throw new Error(`Kịch bản vi phạm quy định tuân thủ tư vấn BĐS và bị chặn xuất bản: ${errorTerms}`);
    }

    const scripts: ScriptTemplate[] = JSON.parse(localStorage.getItem(STORAGE_KEY_SCRIPTS) || '[]');
    const newScript: ScriptTemplate = {
      ...payload,
      id: `script-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      version: 1,
      created_by: operator.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    scripts.push(newScript);
    localStorage.setItem(STORAGE_KEY_SCRIPTS, JSON.stringify(scripts));
    return newScript;
  }

  getScriptsByContext(contextCode: ScriptContextCode, channel?: string): ScriptTemplate[] {
    this.ensureInitialized();
    const scripts: ScriptTemplate[] = JSON.parse(localStorage.getItem(STORAGE_KEY_SCRIPTS) || '[]');
    return scripts.filter(s => 
      s.context_code === contextCode && 
      s.status === 'published' &&
      (!channel || s.channel === channel)
    );
  }

  renderScript(template: ScriptTemplate, variables: Record<string, string>): {
    title: string;
    opening: string;
    main_content: string;
    cta: string;
  } {
    const defaultReplacements: Record<string, string> = {
      ten_khach: 'Anh/Chị',
      ten_du_an: 'dự án',
      ten_sale: 'em',
      gia_tu: 'mức giá ưu đãi',
      ...variables
    };

    const replaceVars = (text: string): string => {
      let res = text;
      // Thay thế các biến khớp
      for (const [k, v] of Object.entries(defaultReplacements)) {
        res = res.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
      }
      // Dọn sạch mọi biến {{...}} còn sót, thay bằng chuỗi an toàn
      res = res.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, '');
      return res.trim();
    };

    return {
      title: replaceVars(template.title),
      opening: replaceVars(template.opening),
      main_content: replaceVars(template.main_content),
      cta: replaceVars(template.cta)
    };
  }

  // ========================================================
  // 4. THEO DÕI SỬ DỤNG VÀ HIỆU QUẢ CHUYỂN ĐỔI SCRIPT
  // ========================================================
  recordScriptUsage(
    scriptId: string, 
    leadId: string, 
    saleId: string, 
    channel: string, 
    outcome?: ScriptUsage['outcome'], 
    rating?: number, 
    feedback?: string
  ): ScriptUsage {
    const usages: ScriptUsage[] = JSON.parse(localStorage.getItem(STORAGE_KEY_SCRIPT_USAGES) || '[]');
    const newUsage: ScriptUsage = {
      id: `use-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      script_id: scriptId,
      lead_id: leadId,
      sale_id: saleId,
      channel,
      outcome,
      rating,
      feedback,
      created_at: new Date().toISOString()
    };

    usages.push(newUsage);
    localStorage.setItem(STORAGE_KEY_SCRIPT_USAGES, JSON.stringify(usages));
    return newUsage;
  }

  getScriptEffectiveness(scriptId: string): {
    totalUsages: number;
    advancedStagesCount: number;
    conversionRate: number;
    averageRating: number;
  } {
    const usages: ScriptUsage[] = JSON.parse(localStorage.getItem(STORAGE_KEY_SCRIPT_USAGES) || '[]');
    const relevant = usages.filter(u => u.script_id === scriptId);
    const totalUsages = relevant.length;

    if (totalUsages === 0) {
      return { totalUsages: 0, advancedStagesCount: 0, conversionRate: 0, averageRating: 0 };
    }

    const advancedStagesCount = relevant.filter(u => u.outcome === 'stage_advanced' || u.outcome === 'appointment_set').length;
    const conversionRate = Number(((advancedStagesCount / totalUsages) * 100).toFixed(1));

    const ratedUsages = relevant.filter(u => u.rating && u.rating > 0);
    const averageRating = ratedUsages.length > 0 
      ? Number((ratedUsages.reduce((sum, u) => sum + (u.rating || 0), 0) / ratedUsages.length).toFixed(1))
      : 0;

    return {
      totalUsages,
      advancedStagesCount,
      conversionRate,
      averageRating
    };
  }

  // ========================================================
  // 5. CARE PLAYBOOKS & TÔN TRỌNG CONSENT
  // ========================================================
  createCareTask(
    leadId: string, 
    customerId: string, 
    saleId: string, 
    title: string, 
    dueDate: string, 
    scriptId?: string
  ): CareTask {
    // BẮT BUỘC KIỂM TRA QUYỀN RIÊNG TƯ & CONSENT
    const customers: Customer[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CUSTOMERS) || '[]');
    const customer = customers.find(c => c.id === customerId);
    if (customer && customer.do_not_contact) {
      throw new Error('Khách hàng đã yêu cầu Không làm phiền (Do Not Contact). Hệ thống chặn tự động tạo tác vụ tiếp thị chăm sóc.');
    }

    const tasks: CareTask[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CARE_TASKS) || '[]');
    const newTask: CareTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      lead_id: leadId,
      sale_id: saleId,
      title,
      due_date: dueDate,
      status: 'pending',
      script_id: scriptId,
      created_at: new Date().toISOString()
    };

    tasks.push(newTask);
    localStorage.setItem(STORAGE_KEY_CARE_TASKS, JSON.stringify(tasks));
    return newTask;
  }

  reassignCareTasks(leadId: string, newSaleId: string): void {
    const tasks: CareTask[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CARE_TASKS) || '[]');
    let updated = false;

    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i].lead_id === leadId && tasks[i].status === 'pending') {
        tasks[i].sale_id = newSaleId;
        updated = true;
      }
    }

    if (updated) {
      localStorage.setItem(STORAGE_KEY_CARE_TASKS, JSON.stringify(tasks));
    }
  }

  getCareTasks(saleId: string): CareTask[] {
    const tasks: CareTask[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CARE_TASKS) || '[]');
    return tasks.filter(t => t.sale_id === saleId && t.status === 'pending');
  }

  // ========================================================
  // 6. SEED TOÀN DIỆN 9 BỘ NGỮ CẢNH KỊCH BẢN CHUẨN
  // ========================================================
  private getSeedScriptTemplates(): ScriptTemplate[] {
    return [
      {
        id: 'seed-approach-01',
        context_code: 'approach',
        journey_stage: 'new',
        channel: 'call',
        tone: 'professional',
        title: 'Cuộc gọi tiếp cận khách đăng ký Facebook Ads',
        objective: 'Kết nối và xác nhận nhu cầu ban đầu của khách hàng',
        opening: 'Dạ em chào {{ten_khach}}, em là {{ten_sale}} gọi từ Ban Quản Lý dự án {{ten_du_an}}.',
        questions: 'Dạ em thấy {{ten_khach}} có để lại thông tin quan tâm căn hộ, không biết mình đang tìm hiểu để ở hay đầu tư ạ?',
        main_content: 'Dự án {{ten_du_an}} hiện đang mở bán giai đoạn 1 với giá chỉ từ {{gia_tu}} cùng chính sách ân hạn nợ gốc rất tốt.',
        cta: 'Em xin phép gửi bảng giá chi tiết qua Zalo số này để {{ten_khach}} xem trước nhé ạ?',
        status: 'published',
        version: 1
      },
      {
        id: 'seed-qualifying-01',
        context_code: 'qualifying',
        journey_stage: 'qualifying',
        channel: 'call',
        tone: 'friendly',
        title: 'Khai thác mục đích và khoảng ngân sách đầu tư',
        objective: 'Làm rõ tầm tài chính và thời điểm dự kiến xuống tiền',
        opening: 'Chào {{ten_khach}}, em {{ten_sale}} gửi thông tin dự án {{ten_du_an}} hôm qua ạ.',
        questions: 'Anh/chị dự kiến mức vốn ban đầu khoảng bao nhiêu và có cần hỗ trợ gói vay ngân hàng không ạ?',
        main_content: 'Bên em đang có các căn 2 phòng ngủ diện tích tối ưu, vốn ban đầu chỉ cần khoảng 30% giá trị căn hộ.',
        cta: 'Em chọn ra 3 căn đẹp nhất trong tầm tài chính của mình gửi anh/chị xem nhé.',
        status: 'published',
        version: 1
      },
      {
        id: 'seed-introduction-01',
        context_code: 'introduction',
        journey_stage: 'doc_sent',
        channel: 'zalo',
        tone: 'concise',
        title: 'Giới thiệu dự án nhanh 30 giây qua Zalo',
        objective: 'Tạo ấn tượng về 3 ưu điểm vượt trội (USP) của dự án',
        opening: 'Dạ em gửi {{ten_khach}} thông tin tóm tắt dự án {{ten_du_an}}:',
        main_content: '1. Vị trí trung tâm kết nối thuận tiện.\n2. Tiện ích chuẩn resort nghỉ dưỡng.\n3. Giá khởi điểm từ {{gia_tu}} kèm chiết khấu 5%.',
        cta: 'Anh/chị xem qua hình ảnh thực tế đính kèm nhé ạ.',
        status: 'published',
        version: 1
      },
      {
        id: 'seed-appointment-01',
        context_code: 'appointment',
        journey_stage: 'appointment_set',
        channel: 'call',
        tone: 'professional',
        title: 'Mời trải nghiệm thực tế nhà mẫu dự án',
        objective: 'Chốt lịch hẹn tham quan nhà mẫu vào cuối tuần',
        opening: 'Dạ {{ten_khach}} ơi, thứ Bảy này bên em có chương trình trải nghiệm sa bàn và nhà mẫu {{ten_du_an}}.',
        main_content: 'Sẽ có xe đưa đón tận nơi và quà tặng bốc thăm may mắn cho khách tham quan.',
        cta: 'Em đăng ký vé mời cho gia đình mình vào sáng thứ Bảy lúc 9h00 được không ạ?',
        status: 'published',
        version: 1
      },
      {
        id: 'seed-objection-01',
        context_code: 'objection',
        journey_stage: 'consulted',
        channel: 'call',
        tone: 'professional',
        title: 'Xử lý từ chối: Khách chê giá cao so với khu vực',
        objective: 'Làm rõ giá trị tương xứng và tiềm năng hạ tầng',
        opening: 'Dạ em rất hiểu băn khoăn của {{ten_khach}} về mức giá của {{ten_du_an}}.',
        main_content: 'Tuy nhiên mức giá này đã bao gồm bàn giao gói nội thất cao cấp chuẩn châu Âu và tuyến đường vành đai sắp thông xe giúp tăng giá trị trong 2 năm tới.',
        cta: 'Em làm một bảng so sánh chi tiết suất đầu tư giữa các dự án lân cận để anh/chị đánh giá khách quan nhé.',
        status: 'published',
        version: 1
      },
      {
        id: 'seed-closing-01',
        context_code: 'closing',
        journey_stage: 'booking',
        channel: 'in_person',
        tone: 'professional',
        title: 'Hướng dẫn giữ chỗ (Booking) có hoàn tiền',
        objective: 'Thúc đẩy khách giữ căn đẹp trước khi giỏ hàng đóng',
        opening: 'Dạ thưa {{ten_khach}}, căn góc view công viên này hiện chỉ còn duy nhất 1 suất.',
        main_content: 'Khoản giữ chỗ 50 triệu là hoàn toàn có hoàn lại 100% nếu ngày mở bán mình không ưng ý mức giá chính thức.',
        cta: 'Em hỗ trợ anh/chị làm phiếu đăng ký ưu tiên để giữ căn này ngay hôm nay nhé ạ.',
        status: 'published',
        version: 1
      },
      {
        id: 'seed-post-contract-01',
        context_code: 'post_contract',
        journey_stage: 'contract',
        channel: 'zalo',
        tone: 'friendly',
        title: 'Chúc mừng ký HĐMB và nhắc lịch thanh toán',
        objective: 'Chăm sóc hậu mãi và xây dựng niềm tin lâu dài',
        opening: 'Chúc mừng {{ten_khach}} đã chính thức ký kết Hợp đồng mua bán căn hộ tại {{ten_du_an}}!',
        main_content: 'Em {{ten_sale}} sẽ đồng hành cùng anh/chị trong suốt quá trình xây dựng, thanh toán và nhận bàn giao nhà.',
        cta: 'Dạ em xin gửi file lịch trình thanh toán đợt kế tiếp để mình tiện theo dõi ạ.',
        status: 'published',
        version: 1
      },
      {
        id: 'seed-re-engage-01',
        context_code: 're_engage',
        journey_stage: 'recycled',
        channel: 'sms',
        tone: 'concise',
        title: 'Nuôi dưỡng và tái kích hoạt lead nguội mốc 30 ngày',
        objective: 'Mở lại cuộc trò chuyện khi có chính sách mới',
        opening: 'Kính gửi {{ten_khach}}, dự án {{ten_du_an}} vừa công bố giỏ hàng ngoại giao đợt mới.',
        main_content: 'Ưu đãi tặng ngay 1 lượng vàng cho 10 khách hàng đầu tiên trong tháng này.',
        cta: 'Liên hệ lại em {{ten_sale}} để nhận thông tin chi tiết.',
        status: 'published',
        version: 1
      },
      {
        id: 'seed-special-01',
        context_code: 'special',
        journey_stage: 'contacted',
        channel: 'zalo',
        tone: 'professional',
        title: 'Chào đón khi tiếp nhận Lead được bàn giao mới',
        objective: 'Xây dựng thiện cảm khi thay đổi chuyên viên tư vấn (không nhắc đến lý do điều chuyển)',
        opening: 'Dạ em chào {{ten_khach}}, em là {{ten_sale}}, chuyên viên tư vấn cao cấp phụ trách dự án {{ten_du_an}}.',
        main_content: 'Từ hôm nay em sẽ là người trực tiếp hỗ trợ giải đáp mọi thông tin, thủ tục và cập nhật bảng giá mới nhất cho anh/chị.',
        cta: 'Rất vui được đồng hành cùng anh/chị, em xin phép gửi thông tin liên hệ của em ạ!',
        status: 'published',
        version: 1
      }
    ];
  }
}

export const knowledgeAndScriptService = new KnowledgeAndScriptService();
