// ========================================================
// REAL ESTATE CRM - PROJECT & KNOWLEDGE REPOSITORY
// Quản lý Dự án, Tri thức AI, Tóm tắt <= 3000 ký tự, Sales Scripts
// ========================================================

import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';
import { Project, ProjectKnowledge, ProjectFaq, SalesScript, LeadStatus } from '@/domain/types';
import { INITIAL_PROJECTS, INITIAL_KNOWLEDGE } from '../mockData';
import { JOURNEY_STAGES } from '@/domain/constants';

const STORAGE_KEY_PROJECTS = 'crm_projects';
const STORAGE_KEY_KNOWLEDGE = 'crm_project_knowledge';
const STORAGE_KEY_SCRIPTS = 'crm_sales_scripts';
const STORAGE_KEY_FAQS = 'crm_project_faqs';

export class ProjectRepository {
  async getProjects(): Promise<Project[]> {
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data as Project[];
    }
    const projects = localStorage.getItem(STORAGE_KEY_PROJECTS);
    if (!projects) {
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(INITIAL_PROJECTS));
      return INITIAL_PROJECTS;
    }
    return JSON.parse(projects);
  }

  async getProjectById(id: string): Promise<Project | null> {
    const list = await this.getProjects();
    return list.find(p => p.id === id) || null;
  }

  async createProject(project: Partial<Project>): Promise<Project> {
    const newProj: Project = {
      id: crypto.randomUUID(),
      organization_id: '11111111-1111-1111-1111-111111111111',
      name: project.name || 'Dự án mới',
      code: project.code || `PRJ-${Date.now().toString().slice(-4)}`,
      developer: project.developer || '',
      location: project.location || '',
      property_type: project.property_type || 'Căn hộ',
      expected_price_range: project.expected_price_range || '',
      scale: project.scale || '',
      status: 'upcoming',
      created_at: new Date().toISOString(),
    };

    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.from('projects').insert(newProj).select().single();
      if (error) throw new Error(error.message);
      return data;
    }

    const projects = await this.getProjects();
    projects.unshift(newProj);
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
    return newProj;
  }

  async getProjectKnowledge(projectId: string): Promise<ProjectKnowledge | null> {
    if (isLiveSupabaseConfigured) {
      const { data } = await supabase
        .from('project_knowledge')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();
      return data;
    }

    const allKnowledge = JSON.parse(localStorage.getItem(STORAGE_KEY_KNOWLEDGE) || JSON.stringify(INITIAL_KNOWLEDGE));
    return allKnowledge[projectId] || {
      id: crypto.randomUUID(),
      project_id: projectId,
      summary_text: '',
      updated_at: new Date().toISOString(),
    };
  }

  // Cập nhật tóm tắt văn bản và tự động điền các trường Nhãn: nội dung
  async updateKnowledgeSummary(projectId: string, summaryText: string): Promise<ProjectKnowledge> {
    // Parser tự động tìm các dòng Nhãn: nội dung
    const extracted = this.parseSummaryText(summaryText);
    const existing = await this.getProjectKnowledge(projectId);

    const updated: ProjectKnowledge = {
      ...(existing || {}),
      id: existing?.id || crypto.randomUUID(),
      project_id: projectId,
      summary_text: summaryText.slice(0, 3000), // Ràng buộc tối đa 3000 ký tự
      location: extracted.location || existing?.location,
      property_type: extracted.property_type || existing?.property_type,
      price_range: extracted.price_range || existing?.price_range,
      legal: extracted.legal || existing?.legal,
      progress: extracted.progress || existing?.progress,
      policy: extracted.policy || existing?.policy,
      highlights: extracted.highlights || existing?.highlights,
      updated_at: new Date().toISOString(),
    };

    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase
        .from('project_knowledge')
        .upsert(updated)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }

    const allKnowledge = JSON.parse(localStorage.getItem(STORAGE_KEY_KNOWLEDGE) || JSON.stringify(INITIAL_KNOWLEDGE));
    allKnowledge[projectId] = updated;
    localStorage.setItem(STORAGE_KEY_KNOWLEDGE, JSON.stringify(allKnowledge));

    // Kích hoạt tự động cập nhật Sales Script Tự động (chỉ cập nhật những script chưa bị sửa tuỳ chỉnh)
    await this.refreshAutoScripts(projectId, updated);

    return updated;
  }

  // Parser: trích xuất các dòng dạng "Vị trí: ...", "Giá: ...", "Pháp lý: ..."
  parseSummaryText(text: string): Partial<ProjectKnowledge> {
    const result: Partial<ProjectKnowledge> = {};
    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      const lower = trimmed.toLowerCase();

      if (lower.startsWith('vị trí:') || lower.startsWith('vi tri:')) {
        result.location = trimmed.split(':')[1]?.trim();
      } else if (lower.startsWith('loại hình:') || lower.startsWith('loai hinh:')) {
        result.property_type = trimmed.split(':')[1]?.trim();
      } else if (lower.startsWith('giá:') || lower.startsWith('gia:')) {
        result.price_range = trimmed.split(':')[1]?.trim();
      } else if (lower.startsWith('pháp lý:') || lower.startsWith('phap ly:')) {
        result.legal = trimmed.split(':')[1]?.trim();
      } else if (lower.startsWith('tiến độ:') || lower.startsWith('tien do:')) {
        result.progress = trimmed.split(':')[1]?.trim();
      } else if (lower.startsWith('chính sách:') || lower.startsWith('chinh sach:')) {
        result.policy = trimmed.split(':')[1]?.trim();
      } else if (lower.startsWith('điểm nhấn:') || lower.startsWith('diem nhan:')) {
        result.highlights = trimmed.split(':')[1]?.trim();
      }
    }

    return result;
  }

  // Tự động làm mới kịch bản (Script Tự động)
  private async refreshAutoScripts(projectId: string, knowledge: ProjectKnowledge) {
    const scripts = await this.getSalesScripts(projectId);
    const updated = scripts.map(s => {
      // Nếu là script tùy chỉnh (is_edited = true) thì giữ nguyên bản đã sửa
      if (s.is_edited) return s;

      // Nếu là script Tự động (is_auto = true), tái tạo nội dung theo tóm tắt mới
      return {
        ...s,
        content: `[Kịch bản Tự động v${s.version + 1}]\n` +
                 `Giai đoạn: ${s.status.toUpperCase()}\n` +
                 `Thông tin dự án: ${knowledge.property_type || 'Bất động sản'} tại ${knowledge.location || 'khu vực'}.\n` +
                 `Mức giá: ${knowledge.price_range || 'Đang cập nhật'}. Chính sách: ${knowledge.policy || 'Ưu đãi'}.\n` +
                 `Điểm nhấn thuyết phục khách: ${knowledge.highlights || 'Vị trí đắc địa, tiềm năng sinh lời cao.'}`,
        version: s.version + 1,
        updated_at: new Date().toISOString(),
      };
    });

    localStorage.setItem(`${STORAGE_KEY_SCRIPTS}_${projectId}`, JSON.stringify(updated));
  }

  // Lấy Sales Scripts của dự án theo 15 trạng thái
  async getSalesScripts(projectId: string): Promise<SalesScript[]> {
    const raw = localStorage.getItem(`${STORAGE_KEY_SCRIPTS}_${projectId}`);
    if (raw) return JSON.parse(raw);

    // Khởi tạo mặc định 15 script cho 15 trạng thái
    const defaultScripts: SalesScript[] = JOURNEY_STAGES.map(stage => ({
      id: crypto.randomUUID(),
      project_id: projectId,
      status: stage.id,
      title: `Kịch bản tư vấn: ${stage.label}`,
      content: `Chào Anh/Chị, em liên hệ từ dự án bất động sản. Tại bước "${stage.label}", em xin gửi thông tin chi tiết và hỗ trợ giải đáp mọi thắc mắc của Anh/Chị.`,
      version: 1,
      is_auto: true,
      is_edited: false,
      updated_at: new Date().toISOString(),
    }));

    localStorage.setItem(`${STORAGE_KEY_SCRIPTS}_${projectId}`, JSON.stringify(defaultScripts));
    return defaultScripts;
  }

  // Lưu chỉnh sửa kịch bản (đánh dấu is_edited = true)
  async saveSalesScript(script: SalesScript): Promise<void> {
    const scripts = await this.getSalesScripts(script.project_id);
    const idx = scripts.findIndex(s => s.status === script.status);
    if (idx !== -1) {
      scripts[idx] = {
        ...script,
        is_edited: true,
        version: scripts[idx].version + 1,
        updated_at: new Date().toISOString(),
      };
    } else {
      scripts.push(script);
    }
    localStorage.setItem(`${STORAGE_KEY_SCRIPTS}_${script.project_id}`, JSON.stringify(scripts));
  }

  // Đặt lại kịch bản theo mẫu mặc định
  async resetScriptToDefault(projectId: string, status: LeadStatus): Promise<SalesScript> {
    const knowledge = await this.getProjectKnowledge(projectId);
    const scripts = await this.getSalesScripts(projectId);
    const stage = JOURNEY_STAGES.find(s => s.id === status);
    
    const resetScript: SalesScript = {
      id: crypto.randomUUID(),
      project_id: projectId,
      status,
      title: `Kịch bản tư vấn: ${stage?.label || status}`,
      content: `[Kịch bản Tiêu chuẩn]\nGiai đoạn: ${stage?.label}\nDự án: ${knowledge?.property_type || 'Căn hộ'}\nĐiểm cốt lõi: ${knowledge?.highlights || 'Ưu đãi và vị trí đẹp'}.`,
      version: 1,
      is_auto: true,
      is_edited: false,
      updated_at: new Date().toISOString(),
    };

    const idx = scripts.findIndex(s => s.status === status);
    if (idx !== -1) scripts[idx] = resetScript;
    localStorage.setItem(`${STORAGE_KEY_SCRIPTS}_${projectId}`, JSON.stringify(scripts));
    return resetScript;
  }

  // Quản lý FAQs
  async getProjectFaqs(projectId: string): Promise<ProjectFaq[]> {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY_FAQS) || '[]');
    const filtered = all.filter((f: ProjectFaq) => f.project_id === projectId);
    if (filtered.length > 0) return filtered;

    // Default FAQs
    const defaults: ProjectFaq[] = [
      {
        id: 'faq1',
        project_id: projectId,
        question: 'Dự án đã có giấy phép xây dựng và pháp lý sổ hồng như thế nào?',
        answer: 'Dự án đã hoàn thiện 100% hồ sơ pháp lý, phê duyệt 1/500 và giấy phép xây dựng. Khách hàng người Việt Nam được cấp sổ hồng sở hữu lâu dài.',
        is_verified: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'faq2',
        project_id: projectId,
        question: 'Ngân hàng nào bảo lãnh và hỗ trợ giải ngân lãi suất 0%?',
        answer: 'Ngân hàng Techcombank, MB Bank và Vietcombank hỗ trợ giải ngân tối đa 70% giá trị hợp đồng, ân hạn nợ gốc và miễn lãi trong 24 tháng.',
        is_verified: true,
        created_at: new Date().toISOString(),
      },
    ];
    return defaults;
  }
}

export const projectRepository = new ProjectRepository();
