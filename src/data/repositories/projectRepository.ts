// ========================================================
// REAL ESTATE CRM - PROJECT & KNOWLEDGE REPOSITORY
// Quản lý Dự án, Tri thức AI, Tóm tắt <= 3000 ký tự, Sales Scripts
// ========================================================

import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';
import { 
  Project, 
  ProjectKnowledge, 
  ProjectFaq, 
  SalesScript, 
  LeadStatus, 
  SoldProduct,
  ProjectCommissionPolicy,
  CommissionTier,
  RoleCommissionRate,
  ProjectUnit,
  UnitStatus
} from '@/domain/types';
import { INITIAL_PROJECTS, INITIAL_KNOWLEDGE, INITIAL_TRANSACTIONS, INITIAL_PROJECT_UNITS } from '../mockData';
import { JOURNEY_STAGES } from '@/domain/constants';
import { financialCalculationService, TimeRangeFilter } from '@/domain/services/financialCalculationService';
import { contractRepository } from './contractRepository';
import { AI_MASTER_STAGE_SCRIPTS, formatFullScriptMarkdown } from '@/data/aiSalesScripts';

const STORAGE_KEY_PROJECTS = 'crm_projects';
const STORAGE_KEY_KNOWLEDGE = 'crm_project_knowledge';
const STORAGE_KEY_SCRIPTS = 'crm_sales_scripts';
const STORAGE_KEY_FAQS = 'crm_project_faqs';
const STORAGE_KEY_POLICIES = 'crm_project_policies';
const STORAGE_KEY_UNITS = 'crm_project_units';

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
      commission_rate: project.commission_rate ?? 3.5,
      progressive_commission: project.progressive_commission ?? 'Đạt >= 5 căn: +0.3%, Đạt >= 10 căn: +0.6%',
      sale_commission_rate: project.sale_commission_rate ?? 1.5,
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

  async updateProjectCommission(
    projectId: string, 
    commission_rate: number, 
    progressive_commission: string, 
    sale_commission_rate: number
  ): Promise<Project> {
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase
        .from('projects')
        .update({
          commission_rate,
          progressive_commission,
          sale_commission_rate,
        })
        .eq('id', projectId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Project;
    }

    const projects = await this.getProjects();
    const idx = projects.findIndex(p => p.id === projectId);
    if (idx === -1) throw new Error('Dự án không tồn tại');
    projects[idx] = {
      ...projects[idx],
      commission_rate,
      progressive_commission,
      sale_commission_rate,
    };
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
    return projects[idx];
  }

  async getSoldProducts(projectId?: string): Promise<SoldProduct[]> {
    if (isLiveSupabaseConfigured) {
      let query = supabase
        .from('transactions')
        .select(`
          id,
          code,
          unit_code,
          deal_value,
          amount,
          commission_amount,
          sale_commission_amount,
          contract_code,
          contract_date,
          transaction_date,
          first_installment_paid,
          status,
          lead:leads!inner (
            id,
            project_id,
            assigned_to,
            customer:customers (
              full_name,
              phone
            ),
            project:projects (
              id,
              name,
              property_type
            ),
            agency:agencies (
              name
            ),
            team:teams (
              name
            ),
            assigned_user:profiles!leads_assigned_to_fkey (
              id,
              full_name
            )
          )
        `)
        .eq('type', 'contract')
        .eq('status', 'confirmed');

      if (projectId) {
        query = query.eq('lead.project_id', projectId);
      }

      const { data, error } = await query;
      if (!error && data) {
        return (data as any[]).map(item => {
          const l = item.lead || {};
          const c = l.customer || {};
          const p = l.project || {};
          const u = l.assigned_user || {};
          return {
            id: item.id,
            project_id: p.id || l.project_id,
            project_name: p.name || 'Dự án',
            unit_code: item.unit_code || 'Chưa định danh',
            property_type: p.property_type || 'Căn hộ',
            deal_value: Number(item.deal_value || item.amount || 0),
            contract_code: item.contract_code || item.code,
            sold_date: item.contract_date || item.transaction_date || item.created_at,
            sale_id: u.id || l.assigned_to || '',
            sale_name: u.full_name || 'Chuyên viên',
            team_name: l.team?.name,
            agency_name: l.agency?.name,
            customer_name: c.full_name || 'Khách hàng',
            customer_phone: c.phone || '',
            commission_amount: Number(item.commission_amount || 0),
            sale_commission_amount: Number(item.sale_commission_amount || 0),
            first_installment_paid: Boolean(item.first_installment_paid),
          };
        });
      }
    }

    // Local / Mock fallback
    const rawTxs = localStorage.getItem('crm_transactions');
    const txs: any[] = rawTxs ? JSON.parse(rawTxs) : INITIAL_TRANSACTIONS;
    const projects = await this.getProjects();
    const rawLeads = localStorage.getItem('crm_leads');
    const leads: any[] = rawLeads ? JSON.parse(rawLeads) : [];

    const contracts = txs.filter(t => t.type === 'contract' && t.status === 'confirmed');
    return contracts
      .filter(t => {
        if (!projectId) return true;
        const matchingLead = leads.find(l => l.id === t.lead_id);
        return matchingLead?.project_id === projectId || t.project_id === projectId;
      })
      .map(t => {
        const lead = (leads.find(l => l.id === t.lead_id) || {}) as any;
        const proj = (projects.find(p => p.id === (lead.project_id || t.project_id)) || {}) as Partial<Project>;
        return {
          id: t.id,
          project_id: proj.id || t.project_id || '33333333-1111-1111-1111-111111111111',
          project_name: proj.name || 'Vinhomes Grand Park',
          unit_code: t.unit_code || 'OG-S7.02-15.08',
          property_type: proj.property_type || 'Căn hộ',
          deal_value: Number(t.deal_value || t.amount || 3200000000),
          contract_code: t.contract_code || t.code || 'HĐMB-2026',
          sold_date: t.contract_date || t.transaction_date || new Date().toISOString(),
          sale_id: t.created_by || 'aaaaaaaa-6666-1111-1111-111111111111',
          sale_name: t.sale_name || 'Phạm Mai Anh',
          team_name: t.team_name || 'Team Eagle Q1',
          agency_name: t.agency_name || 'Sàn Giao Dịch Quận 1',
          customer_name: t.customer_name || 'Khách hàng',
          customer_phone: t.customer_phone || '',
          commission_amount: Number(t.commission_amount || 112000000),
          sale_commission_amount: Number(t.sale_commission_amount || 57600000),
          first_installment_paid: Boolean(t.first_installment_paid),
        };
      });
  }

  async getProjectPolicies(projectId: string): Promise<ProjectCommissionPolicy[]> {
    if (isLiveSupabaseConfigured) {
      const { data: polData, error: polErr } = await supabase
        .from('project_commission_policies')
        .select(`
          *,
          tiers:commission_tiers(*),
          role_rates:role_commission_rates(*)
        `)
        .eq('project_id', projectId)
        .order('valid_from', { ascending: false });

      if (!polErr && polData && polData.length > 0) {
        return polData as ProjectCommissionPolicy[];
      }
    }

    const raw = localStorage.getItem(STORAGE_KEY_POLICIES);
    let list: ProjectCommissionPolicy[] = raw ? JSON.parse(raw) : [];
    const projPolicies = list.filter(p => p.project_id === projectId);
    if (projPolicies.length > 0) return projPolicies;

    // Default policy fallback
    const proj = await this.getProjectById(projectId);
    const defaultPolicy: ProjectCommissionPolicy = {
      id: `pol-${projectId}`,
      project_id: projectId,
      company_commission_rate: proj?.commission_rate ?? 3.5,
      recognition_milestone: proj?.recognition_milestone ?? 'first_installment',
      valid_from: '2026-01-01',
      valid_to: '2026-12-31',
      is_active: true,
      notes: 'Chính sách mở bán Q4/2026',
      tiers: [
        {
          id: `t1-${projectId}`,
          policy_id: `pol-${projectId}`,
          tier_type: 'contract_count',
          min_threshold: 1,
          max_threshold: 4,
          bonus_rate: 0,
          target_role: 'all',
          is_active: true,
        },
        {
          id: `t2-${projectId}`,
          policy_id: `pol-${projectId}`,
          tier_type: 'contract_count',
          min_threshold: 5,
          max_threshold: 9,
          bonus_rate: 0.3,
          target_role: 'all',
          is_active: true,
        },
        {
          id: `t3-${projectId}`,
          policy_id: `pol-${projectId}`,
          tier_type: 'contract_count',
          min_threshold: 10,
          max_threshold: null,
          bonus_rate: 0.6,
          target_role: 'all',
          is_active: true,
        },
      ],
      role_rates: [
        { id: `r1-${projectId}`, policy_id: `pol-${projectId}`, role: 'sale_agent', default_rate: proj?.sale_commission_rate ?? 1.8 },
        { id: `r2-${projectId}`, policy_id: `pol-${projectId}`, role: 'team_leader', default_rate: 0.4 },
        { id: `r3-${projectId}`, policy_id: `pol-${projectId}`, role: 'sales_manager', default_rate: 0.3 },
        { id: `r4-${projectId}`, policy_id: `pol-${projectId}`, role: 'director', default_rate: 0.2 },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    list.push(defaultPolicy);
    localStorage.setItem(STORAGE_KEY_POLICIES, JSON.stringify(list));
    return [defaultPolicy];
  }

  async saveCommissionPolicy(policy: Partial<ProjectCommissionPolicy>): Promise<ProjectCommissionPolicy> {
    const newPolicy: ProjectCommissionPolicy = {
      id: policy.id || crypto.randomUUID(),
      project_id: policy.project_id!,
      company_commission_rate: policy.company_commission_rate ?? 3.5,
      recognition_milestone: policy.recognition_milestone ?? 'first_installment',
      valid_from: policy.valid_from || new Date().toISOString().slice(0, 10),
      valid_to: policy.valid_to || null,
      is_active: policy.is_active ?? true,
      notes: policy.notes || '',
      tiers: policy.tiers || [],
      role_rates: policy.role_rates || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isLiveSupabaseConfigured) {
      // Deactivate previous active policies for the project if this is active
      if (newPolicy.is_active) {
        await supabase
          .from('project_commission_policies')
          .update({ is_active: false })
          .eq('project_id', newPolicy.project_id);
      }

      await supabase.from('project_commission_policies').upsert({
        id: newPolicy.id,
        project_id: newPolicy.project_id,
        company_commission_rate: newPolicy.company_commission_rate,
        recognition_milestone: newPolicy.recognition_milestone,
        valid_from: newPolicy.valid_from,
        valid_to: newPolicy.valid_to,
        is_active: newPolicy.is_active,
        notes: newPolicy.notes,
        updated_at: new Date().toISOString(),
      });

      // Upsert tiers
      if (newPolicy.tiers.length > 0) {
        await supabase.from('commission_tiers').delete().eq('policy_id', newPolicy.id);
        const tiersToInsert = newPolicy.tiers.map(t => ({
          ...t,
          policy_id: newPolicy.id,
        }));
        await supabase.from('commission_tiers').insert(tiersToInsert);
      }

      // Also update project table cache
      await supabase
        .from('projects')
        .update({
          commission_rate: newPolicy.company_commission_rate,
          recognition_milestone: newPolicy.recognition_milestone,
          sale_commission_rate: newPolicy.role_rates.find(r => r.role === 'sale_agent')?.default_rate ?? 1.8,
        })
        .eq('id', newPolicy.project_id);
    }

    const raw = localStorage.getItem(STORAGE_KEY_POLICIES);
    let list: ProjectCommissionPolicy[] = raw ? JSON.parse(raw) : [];
    if (newPolicy.is_active) {
      list = list.map(p => p.project_id === newPolicy.project_id ? { ...p, is_active: false } : p);
    }
    const existingIdx = list.findIndex(p => p.id === newPolicy.id);
    if (existingIdx !== -1) {
      list[existingIdx] = newPolicy;
    } else {
      list.unshift(newPolicy);
    }
    localStorage.setItem(STORAGE_KEY_POLICIES, JSON.stringify(list));

    // Update project cache
    const projects = await this.getProjects();
    const pIdx = projects.findIndex(p => p.id === newPolicy.project_id);
    if (pIdx !== -1) {
      projects[pIdx].commission_rate = newPolicy.company_commission_rate;
      projects[pIdx].recognition_milestone = newPolicy.recognition_milestone;
      projects[pIdx].sale_commission_rate = newPolicy.role_rates.find(r => r.role === 'sale_agent')?.default_rate ?? 1.8;
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
    }

    return newPolicy;
  }

  async getProjectFinancialStats(projectId: string, timeFilter?: TimeRangeFilter): Promise<{
    total_contracts: number;
    total_revenue: number;
    total_commission: number;
    total_sale_commission: number;
    expected_commission: number;
    realized_commission: number;
    expected_sale_commission: number;
    realized_sale_commission: number;
    inventory: {
      totalUnits: number;
      soldUnits: number;
      depositUnits: number;
      bookingUnits: number;
      availableUnits: number;
    };
    sold_products: SoldProduct[];
    current_policy?: ProjectCommissionPolicy;
    policies: ProjectCommissionPolicy[];
  }> {
    const [project, allTransactions, policies] = await Promise.all([
      this.getProjectById(projectId),
      contractRepository.getTransactions({ projectId }),
      this.getProjectPolicies(projectId),
    ]);

    const activePolicy = policies.find(p => p.is_active) || policies[0];
    const projObj = project || {
      id: projectId,
      name: 'Dự án',
      code: 'PRJ',
      total_units: 500,
      recognition_milestone: activePolicy?.recognition_milestone || 'first_installment',
    } as Project;

    const aggregated = financialCalculationService.aggregateProjectSales(
      projObj,
      allTransactions,
      timeFilter
    );

    return {
      total_contracts: aggregated.totalContracts,
      total_revenue: aggregated.totalRevenue,
      total_commission: aggregated.expectedCompanyCommission,
      total_sale_commission: aggregated.expectedSaleCommission,
      expected_commission: aggregated.expectedCompanyCommission,
      realized_commission: aggregated.realizedCompanyCommission,
      expected_sale_commission: aggregated.expectedSaleCommission,
      realized_sale_commission: aggregated.realizedSaleCommission,
      inventory: aggregated.inventory,
      sold_products: aggregated.soldProducts,
      current_policy: activePolicy,
      policies,
    };
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

  // Lấy Sales Scripts của dự án theo 15 trạng thái (Áp dụng bộ kịch bản AI chuyên sâu)
  async getSalesScripts(projectId: string): Promise<SalesScript[]> {
    const raw = localStorage.getItem(`${STORAGE_KEY_SCRIPTS}_${projectId}`);
    const project = await this.getProjectById(projectId);
    const projectName = project?.name || 'Dự án Bất Động Sản';

    if (raw) {
      const parsed: SalesScript[] = JSON.parse(raw);
      // Tự động nâng cấp các kịch bản mẫu ngắn cũ lên nội dung kịch bản AI 5 phần chuyên sâu
      let needsUpdate = false;
      const upgraded = parsed.map(s => {
        if (!s.is_edited && (s.content.includes('Chào Anh/Chị, em liên hệ từ dự án bất động sản') || s.content.length < 250)) {
          const aiDetail = AI_MASTER_STAGE_SCRIPTS[s.status as LeadStatus];
          if (aiDetail) {
            needsUpdate = true;
            return {
              ...s,
              content: formatFullScriptMarkdown(aiDetail, projectName),
            };
          }
        }
        return s;
      });

      if (needsUpdate) {
        localStorage.setItem(`${STORAGE_KEY_SCRIPTS}_${projectId}`, JSON.stringify(upgraded));
        return upgraded;
      }
      return parsed;
    }

    // Khởi tạo mặc định 15 script cho 15 trạng thái với nội dung AI chuyên biệt thực chiến
    const defaultScripts: SalesScript[] = JOURNEY_STAGES.map(stage => {
      const aiDetail = AI_MASTER_STAGE_SCRIPTS[stage.id];
      return {
        id: crypto.randomUUID(),
        project_id: projectId,
        status: stage.id,
        title: `Kịch bản tư vấn: ${stage.label}`,
        content: aiDetail 
          ? formatFullScriptMarkdown(aiDetail, projectName)
          : `Chào Anh/Chị, em liên hệ từ dự án ${projectName}. Tại bước "${stage.label}", em xin gửi thông tin chi tiết và hỗ trợ giải đáp mọi thắc mắc của Anh/Chị.`,
        version: 1,
        is_auto: true,
        is_edited: false,
        updated_at: new Date().toISOString(),
      };
    });

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

  // Đặt lại kịch bản theo mẫu AI chuyên sâu mặc định
  async resetScriptToDefault(projectId: string, status: LeadStatus): Promise<SalesScript> {
    const project = await this.getProjectById(projectId);
    const projectName = project?.name || 'Dự án Bất Động Sản';
    const scripts = await this.getSalesScripts(projectId);
    const stage = JOURNEY_STAGES.find(s => s.id === status);
    const aiDetail = AI_MASTER_STAGE_SCRIPTS[status];
    
    const resetScript: SalesScript = {
      id: crypto.randomUUID(),
      project_id: projectId,
      status,
      title: `Kịch bản tư vấn: ${stage?.label || status}`,
      content: aiDetail
        ? formatFullScriptMarkdown(aiDetail, projectName)
        : `[Kịch bản Tiêu chuẩn]\nGiai đoạn: ${stage?.label}\nDự án: ${projectName}`,
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

  // ==========================================
  // QUẢN LÝ GIỎ HÀNG DỰ ÁN (PROJECT INVENTORY)
  // ==========================================
  async getProjectUnits(projectId?: string, status?: UnitStatus): Promise<ProjectUnit[]> {
    if (isLiveSupabaseConfigured) {
      let query = supabase.from('project_units').select('*').order('unit_code', { ascending: true });
      if (projectId) query = query.eq('project_id', projectId);
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (!error && data && data.length > 0) return data as ProjectUnit[];
    }

    const raw = localStorage.getItem(STORAGE_KEY_UNITS);
    let all: ProjectUnit[] = raw ? JSON.parse(raw) : INITIAL_PROJECT_UNITS;
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_UNITS, JSON.stringify(INITIAL_PROJECT_UNITS));
    }

    if (projectId) {
      all = all.filter(u => u.project_id === projectId);
    }
    if (status) {
      all = all.filter(u => u.status === status);
    }
    return all;
  }

  async getUnitById(id: string): Promise<ProjectUnit | null> {
    const units = await this.getProjectUnits();
    return units.find(u => u.id === id) || null;
  }

  async createProjectUnit(unit: Partial<ProjectUnit>): Promise<ProjectUnit> {
    const projects = await this.getProjects();
    const proj = projects.find(p => p.id === unit.project_id);

    const newUnit: ProjectUnit = {
      id: crypto.randomUUID(),
      project_id: unit.project_id || (projects[0]?.id || ''),
      project_name: proj?.name || unit.project_name || 'Dự án',
      unit_code: unit.unit_code || `CAN-${Date.now().toString().slice(-4)}`,
      property_type: unit.property_type || 'Căn hộ 2PN',
      block_tower: unit.block_tower || '',
      floor: unit.floor || 1,
      area_sqm: unit.area_sqm || 65,
      price: unit.price || 3000000000,
      direction: unit.direction || 'Đông Nam',
      status: unit.status || 'available',
      customer_name: unit.customer_name,
      sale_name: unit.sale_name,
      notes: unit.notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.from('project_units').insert(newUnit).select().maybeSingle();
      if (!error && data) return data as ProjectUnit;
    }

    const all = await this.getProjectUnits();
    all.unshift(newUnit);
    localStorage.setItem(STORAGE_KEY_UNITS, JSON.stringify(all));
    return newUnit;
  }

  async updateProjectUnit(id: string, updates: Partial<ProjectUnit>): Promise<ProjectUnit | null> {
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase
        .from('project_units')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .maybeSingle();
      if (!error && data) return data as ProjectUnit;
    }

    const all = await this.getProjectUnits();
    const index = all.findIndex(u => u.id === id);
    if (index === -1) return null;

    all[index] = {
      ...all[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY_UNITS, JSON.stringify(all));
    return all[index];
  }

  async updateUnitStatusByCode(
    projectId: string, 
    unitCode: string, 
    status: UnitStatus, 
    extra?: { customer_name?: string; sale_name?: string }
  ): Promise<boolean> {
    const all = await this.getProjectUnits();
    const target = all.find(u => u.project_id === projectId && u.unit_code.toLowerCase().trim() === unitCode.toLowerCase().trim());
    if (!target) return false;

    return !!(await this.updateProjectUnit(target.id, {
      status,
      customer_name: extra?.customer_name ?? target.customer_name,
      sale_name: extra?.sale_name ?? target.sale_name,
    }));
  }

  async deleteProjectUnit(id: string): Promise<boolean> {
    if (isLiveSupabaseConfigured) {
      await supabase.from('project_units').delete().eq('id', id);
    }
    const all = await this.getProjectUnits();
    const filtered = all.filter(u => u.id !== id);
    localStorage.setItem(STORAGE_KEY_UNITS, JSON.stringify(filtered));
    return true;
  }
}

export const projectRepository = new ProjectRepository();
