import { describe, it, expect, beforeEach } from 'vitest';
import { aiRepository } from '@/data/repositories/aiRepository';
import { projectRepository } from '@/data/repositories/projectRepository';

describe('AI Bổ Sung Đầy Đủ Thông Tin Dự Án & Cơ Sở Tri Thức (Project Knowledge Enrichment)', () => {
  const projectId = 'test-proj-enrich-01';

  beforeEach(() => {
    localStorage.clear();
  });

  it('1. aiRepository.enrichProject sinh đầy đủ 7 trường thông tin dự án', async () => {
    const proposals = await aiRepository.enrichProject(
      'Vinhomes Green Paradise Cần Giờ',
      'Cần Giờ, TP.HCM',
      'Vingroup',
      'Đại đô thị lấn biển'
    );

    expect(proposals.length).toBe(7);
    const fields = proposals.map(p => p.field);
    expect(fields).toContain('location');
    expect(fields).toContain('property_type');
    expect(fields).toContain('price_range');
    expect(fields).toContain('legal');
    expect(fields).toContain('progress');
    expect(fields).toContain('policy');
    expect(fields).toContain('highlights');

    const locProposal = proposals.find(p => p.field === 'location');
    expect(locProposal?.proposedValue).toContain('Cần Giờ');
    expect(locProposal?.selected).toBe(true);
    expect(locProposal?.unverified).toBe(true);

    const highlightsProposal = proposals.find(p => p.field === 'highlights');
    expect(highlightsProposal?.proposedValue).toContain('2.870ha');
  });

  it('2. aiRepository.generateProjectFaqs tạo sẵn 4 câu hỏi trọng tâm sát với dự án', () => {
    const faqs = aiRepository.generateProjectFaqs('Vinhomes Green Paradise Cần Giờ', 'Vingroup', 'Cần Giờ');
    expect(faqs.length).toBe(4);
    expect(faqs[0].question.toLowerCase()).toContain('pháp lý');
    expect(faqs[1].question.toLowerCase()).toContain('ngân hàng');
    expect(faqs[2].question.toLowerCase()).toContain('tiến độ');
    expect(faqs[3].question.toLowerCase()).toContain('tiềm năng');
    expect(faqs[3].answer).toContain('Cần Giờ');
  });

  it('3. projectRepository.saveProjectKnowledge lưu trực tiếp và cập nhật đầy đủ các trường tri thức', async () => {
    const saved = await projectRepository.saveProjectKnowledge(projectId, {
      location: 'Cần Giờ, TP.HCM',
      property_type: 'Biệt thự biển & Shophouse',
      price_range: '85 - 160 triệu/m²',
      legal: 'Quy hoạch 1/500, GPXD, Sổ hồng',
      progress: 'Đang hoàn thiện hạ tầng',
      policy: 'Vay 80% ân hạn 36 tháng',
      highlights: 'Quần thể lấn biển 2.870ha',
      summary_text: 'Tóm tắt thông tin dự án Cần Giờ',
    });

    expect(saved.project_id).toBe(projectId);
    expect(saved.location).toBe('Cần Giờ, TP.HCM');
    expect(saved.property_type).toBe('Biệt thự biển & Shophouse');
    expect(saved.price_range).toBe('85 - 160 triệu/m²');
    expect(saved.highlights).toBe('Quần thể lấn biển 2.870ha');

    const fetched = await projectRepository.getProjectKnowledge(projectId);
    expect(fetched?.legal).toBe('Quy hoạch 1/500, GPXD, Sổ hồng');
    expect(fetched?.policy).toBe('Vay 80% ân hạn 36 tháng');
  });

  it('4. projectRepository.saveProjectFaqs lưu danh sách câu hỏi đáp trọng tâm', async () => {
    const faqs = aiRepository.generateProjectFaqs('Dự án Mẫu', 'Chủ đầu tư ABC');
    const savedFaqs = await projectRepository.saveProjectFaqs(projectId, faqs);

    expect(savedFaqs.length).toBe(4);
    const loaded = await projectRepository.getProjectFaqs(projectId);
    expect(loaded.length).toBe(4);
    expect(loaded[0].question).toContain('Pháp lý dự án Dự án Mẫu');
  });

  it('5. updateKnowledgeSummary hỗ trợ văn bản tóm tắt lên tới 30.000 ký tự', async () => {
    const longSummary = 'Vị trí: Cần Giờ\n' + 'Nội dung chi tiết '.repeat(1000); // ~ 3000 * 5 = 15000+ chars
    expect(longSummary.length).toBeGreaterThan(5000);

    const saved = await projectRepository.updateKnowledgeSummary(projectId, longSummary);
    expect(saved.summary_text?.length).toBeGreaterThan(5000);
    expect(saved.location).toBe('Cần Giờ');
  });
});
