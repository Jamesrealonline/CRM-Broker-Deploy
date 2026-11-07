import { describe, it, expect, beforeEach } from 'vitest';
import { claudeAdvisorService, AdvisorContext } from '@/data/repositories/aiRepository';
import { leadRepository } from '@/data/repositories/leadRepository';
import { Lead, Project, UserProfile, LeadActivity } from '@/domain/types';

describe('AI Sales Advisors (Claude AI Service)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const mockProject: Project = {
    id: 'proj-1',
    organization_id: 'org-1',
    name: 'Vinhomes Grand Park',
    code: 'VHGP',
    developer: 'Vingroup',
    location: 'TP. Thủ Đức',
    property_type: 'Căn hộ cao cấp',
    status: 'opening',
  };

  const mockUser: UserProfile = {
    id: 'user-1',
    email: 'sale@diaocvang.vn',
    full_name: 'Phạm Mai Anh',
    phone: '0911000006',
    role: 'sale_agent',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  it('Quản lý lưu và đọc Anthropic Claude API Key', () => {
    expect(claudeAdvisorService.hasClaudeApiKey()).toBe(false);

    claudeAdvisorService.setClaudeApiKey('sk-ant-api03-testkey123');
    expect(claudeAdvisorService.hasClaudeApiKey()).toBe(true);
    expect(claudeAdvisorService.getClaudeApiKey()).toBe('sk-ant-api03-testkey123');

    claudeAdvisorService.setClaudeApiKey('');
    expect(claudeAdvisorService.hasClaudeApiKey()).toBe(false);
  });

  it('Trò chuyện tư vấn kịch bản xử lý phản hồi khách hàng (Local Advisor Engine)', async () => {
    const mockLead: Lead = {
      id: 'lead-1',
      customer_id: 'cust-1',
      customer_name: 'Nguyễn Văn Hùng',
      customer_phone: '0912345678',
      project_id: mockProject.id,
      project_name: mockProject.name,
      status: 'consulted',
      lead_score: 65,
      budget_min: 3000000000,
      budget_max: 4500000000,
      purpose: 'investment',
      created_at: new Date().toISOString(),
    };

    const context: AdvisorContext = {
      lead: mockLead,
      project: mockProject,
      currentUser: mockUser,
    };

    // 1. Hỏi về giá cao
    const responsePrice = await claudeAdvisorService.chatWithClaudeAdvisor(
      [{ role: 'user', content: 'Khách chê giá đắt hơn so với phân khu cũ, xử lý thế nào?' }],
      context
    );
    expect(responsePrice).toContain('giá');
    expect(responsePrice).toContain('Nguyễn Văn Hùng');

    // 2. Hỏi về không nghe máy
    const responseNoAnswer = await claudeAdvisorService.chatWithClaudeAdvisor(
      [{ role: 'user', content: 'Khách không nghe máy, soạn tin Zalo khơi gợi?' }],
      context
    );
    expect(responseNoAnswer).toContain('Zalo');
    expect(responseNoAnswer).toContain('Vinhomes Grand Park');
  });

  it('Trích xuất chân dung khách hàng và tự động cập nhật vào hồ sơ Lead & nhật ký chăm sóc', async () => {
    // 1. Tạo một lead thực tế trong repository
    const createRes = await leadRepository.createLead({
      fullName: 'Trần Thị Mai',
      phone: '0988112233',
      projectId: mockProject.id,
      budgetMin: 2500000000,
      budgetMax: 3500000000,
      purpose: 'residence',
      currentUser: mockUser,
    });
    expect(createRes.success).toBe(true);
    const lead = createRes.lead!;

    const context: AdvisorContext = {
      lead,
      project: mockProject,
      currentUser: mockUser,
    };

    const chatHistory = [
      { role: 'user' as const, content: 'Khách nói cần xem thực tế nhà mẫu và lo lắng về lãi suất vay ngân hàng.' },
      { role: 'assistant' as const, content: 'Hãy lập bảng tính dòng tiền và mời khách đi site-visit vào cuối tuần.' },
    ];

    // 2. Trích xuất chân dung
    const extracted = await claudeAdvisorService.extractPersonaAndCareUpdate(chatHistory, context);
    expect(extracted.careStatusSummary).toBeTruthy();
    expect(extracted.personaTraits.length).toBeGreaterThan(0);
    expect(extracted.recommendedNextAction).toBeTruthy();

    // 3. Áp dụng cập nhật vào Lead
    const updateRes = await claudeAdvisorService.applyAdvisorUpdateToLead(lead.id, extracted, mockUser);
    expect(updateRes.success).toBe(true);

    // Kiểm tra dữ liệu trong Lead sau khi cập nhật
    const updatedLead = await leadRepository.getLeadById(lead.id);
    expect(updatedLead?.notes).toContain('AI Advisor Claude');
    expect(updatedLead?.notes).toContain(extracted.careStatusSummary);
    expect(updatedLead?.lead_score).toBe(extracted.newLeadScore);

    // Kiểm tra activity được ghi lại
    const activities: LeadActivity[] = await leadRepository.getLeadActivities(lead.id);
    const advisorActivity = activities.find(a => a.title.includes('AI Claude Advisor'));
    expect(advisorActivity).toBeDefined();
  });
});
