// ========================================================
// REAL ESTATE CRM - MARKETING INTELLIGENCE SERVICE (PHASE 6)
// Quản lý chiến dịch, chi phí hàng ngày, tính toán CPL, CAC, ROI,
// và bảo vệ dữ liệu PII cho vai trò Marketing
// ========================================================

import { Campaign, CampaignDailyCost, MarketingMetrics, UserProfile, Lead, Transaction } from '@/domain/types';
import { maskPhone, maskEmail } from '@/lib/utils';

const STORAGE_KEY_CAMPAIGNS = 'crm_campaigns';
const STORAGE_KEY_DAILY_COSTS = 'crm_campaign_daily_costs';
const STORAGE_KEY_LEADS = 'crm_leads';
const STORAGE_KEY_CONTRACTS = 'crm_contracts';

export class MarketingService {
  private ensureInitialized() {
    if (!localStorage.getItem(STORAGE_KEY_CAMPAIGNS)) {
      localStorage.setItem(STORAGE_KEY_CAMPAIGNS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEY_DAILY_COSTS)) {
      localStorage.setItem(STORAGE_KEY_DAILY_COSTS, JSON.stringify([]));
    }
  }

  // ========================================================
  // 1. QUẢN LÝ CHIẾN DỊCH (CAMPAIGN MANAGEMENT)
  // ========================================================
  createCampaign(payload: Omit<Campaign, 'id' | 'created_at' | 'updated_at'>, currentUser: UserProfile): Campaign {
    if (!['admin', 'director', 'marketing_manager'].includes(currentUser.role)) {
      throw new Error('Chỉ Marketing Manager, Director hoặc Admin mới có quyền tạo chiến dịch.');
    }

    if (!payload.name || !payload.channel || payload.budget < 0) {
      throw new Error('Tên chiến dịch, kênh tiếp thị và ngân sách hợp lệ là bắt buộc.');
    }

    this.ensureInitialized();
    const campaigns: Campaign[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CAMPAIGNS) || '[]');
    
    const newCampaign: Campaign = {
      id: `camp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: payload.name.trim(),
      channel: payload.channel.trim(),
      budget: Number(payload.budget),
      start_date: payload.start_date || new Date().toISOString(),
      end_date: payload.end_date,
      utm_source: payload.utm_source,
      utm_campaign: payload.utm_campaign,
      status: payload.status || 'active',
      created_by: currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    campaigns.push(newCampaign);
    localStorage.setItem(STORAGE_KEY_CAMPAIGNS, JSON.stringify(campaigns));
    return newCampaign;
  }

  getCampaigns(): Campaign[] {
    this.ensureInitialized();
    return JSON.parse(localStorage.getItem(STORAGE_KEY_CAMPAIGNS) || '[]');
  }

  // ========================================================
  // 2. CHI PHÍ TIẾP THỊ THEO NGÀY (DAILY COSTS)
  // ========================================================
  recordDailyCost(
    campaignId: string, 
    costDate: string, 
    amount: number, 
    notes?: string, 
    currentUser?: UserProfile
  ): CampaignDailyCost {
    if (currentUser && !['admin', 'director', 'marketing_manager'].includes(currentUser.role)) {
      throw new Error('Không có quyền ghi nhận chi phí tiếp thị.');
    }

    if (amount < 0) {
      throw new Error('Số tiền chi phí không được âm.');
    }

    this.ensureInitialized();
    const costs: CampaignDailyCost[] = JSON.parse(localStorage.getItem(STORAGE_KEY_DAILY_COSTS) || '[]');
    
    // Check if entry for campaign and date already exists
    const existingIndex = costs.findIndex(c => c.campaign_id === campaignId && c.cost_date === costDate);
    if (existingIndex >= 0) {
      costs[existingIndex].amount = amount;
      if (notes) costs[existingIndex].notes = notes;
      localStorage.setItem(STORAGE_KEY_DAILY_COSTS, JSON.stringify(costs));
      return costs[existingIndex];
    }

    const newCost: CampaignDailyCost = {
      id: `cost-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      campaign_id: campaignId,
      cost_date: costDate,
      amount: Number(amount),
      notes,
      created_at: new Date().toISOString()
    };

    costs.push(newCost);
    localStorage.setItem(STORAGE_KEY_DAILY_COSTS, JSON.stringify(costs));
    return newCost;
  }

  getCampaignDailyCosts(campaignId: string): CampaignDailyCost[] {
    this.ensureInitialized();
    const costs: CampaignDailyCost[] = JSON.parse(localStorage.getItem(STORAGE_KEY_DAILY_COSTS) || '[]');
    return costs.filter(c => c.campaign_id === campaignId);
  }

  // ========================================================
  // 3. TÍNH TOÁN HIỆU QUẢ MARKETING (CPL, CAC, ROI)
  // ========================================================
  calculateMarketingMetrics(campaignId?: string): MarketingMetrics {
    this.ensureInitialized();
    const costs: CampaignDailyCost[] = JSON.parse(localStorage.getItem(STORAGE_KEY_DAILY_COSTS) || '[]');
    const leads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');
    const contracts: Transaction[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CONTRACTS) || '[]');

    // 1. Filter Costs
    const relevantCosts = campaignId ? costs.filter(c => c.campaign_id === campaignId) : costs;
    const totalSpent = relevantCosts.reduce((acc, c) => acc + (c.amount || 0), 0);

    // 2. Filter Leads
    let relevantLeads = leads;
    if (campaignId) {
      const campaign = this.getCampaigns().find(c => c.id === campaignId);
      relevantLeads = leads.filter(l => 
        (l as any).campaign_id === campaignId || 
        (campaign && (l.source_detail === campaign.utm_campaign || l.source_id === campaign.channel))
      );
    }

    const leadsCount = relevantLeads.length;
    const contactsCount = relevantLeads.filter(l => !['new', 'unreachable', 'invalid'].includes(l.status)).length;
    const depositsCount = relevantLeads.filter(l => ['deposit', 'contract'].includes(l.status)).length;

    // 3. Contracts and Revenue
    const leadIds = new Set(relevantLeads.map(l => l.id));
    const relevantContracts = contracts.filter(c => c.lead_id && leadIds.has(c.lead_id));
    const contractsCount = relevantContracts.length;
    const totalRevenue = relevantContracts.reduce((acc, c) => acc + (c.deal_value || 0), 0);
    // Giả định doanh thu sàn = 3% GTGD
    const grossFloorRevenue = totalRevenue * 0.03;

    // 4. Metrics
    const cpl = leadsCount > 0 ? Math.round(totalSpent / leadsCount) : 0;
    const cac = depositsCount > 0 ? Math.round(totalSpent / depositsCount) : 0;
    const contactRate = leadsCount > 0 ? Number(((contactsCount / leadsCount) * 100).toFixed(2)) : 0;
    const depositRate = leadsCount > 0 ? Number(((depositsCount / leadsCount) * 100).toFixed(2)) : 0;
    const roi = totalSpent > 0 ? Number((((grossFloorRevenue - totalSpent) / totalSpent) * 100).toFixed(2)) : 0;

    return {
      totalSpent,
      leadsCount,
      contactsCount,
      depositsCount,
      contractsCount,
      totalRevenue,
      cpl,
      cac,
      contactRate,
      depositRate,
      roi
    };
  }

  // ========================================================
  // 4. BẢO VỆ PII CHO MARKETING (PII MASKING)
  // ========================================================
  getMaskedLeadsForMarketing(campaignId?: string): Array<Partial<Lead>> {
    const leads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');
    let filtered = leads;
    if (campaignId) {
      filtered = leads.filter(l => (l as any).campaign_id === campaignId);
    }

    return filtered.map(lead => ({
      id: lead.id,
      customer_id: lead.customer_id,
      status: lead.status,
      budget_min: lead.budget_min,
      budget_max: lead.budget_max,
      source_id: lead.source_id,
      source_detail: lead.source_detail,
      assigned_to: lead.assigned_to,
      created_at: lead.created_at,
      // PII masked
      customer_name: lead.customer_name ? `${lead.customer_name.charAt(0)}***` : '***',
      customer_phone: lead.customer_phone ? maskPhone(lead.customer_phone) : '***',
      customer_email: lead.customer_email ? maskEmail(lead.customer_email) : '***'
    }));
  }
}

export const marketingService = new MarketingService();
