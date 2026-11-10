// ========================================================
// REAL ESTATE CRM - COMMISSION SERVICE
// SINGLE SOURCE OF TRUTH: Tính toán, phân bổ hoa hồng 5 tầng & tổng hợp thu nhập
// Áp dụng Largest Remainder Method (Làm tròn VND nguyên không lệch 1 đồng)
// ========================================================

import {
  CommissionTierRole,
  CommissionBaseMode,
  TeamSplitMode,
  CommissionEntryStatus,
  CommissionTierItem,
  CommissionCalculationResult,
  CommissionEntry,
  CommissionRun,
  IncomeSummary,
  UserProfile,
  Transaction,
  ProjectCommissionPolicy
} from '../types';

export interface CommissionChainInfo {
  sale?: { id?: string; name?: string };
  team?: { id?: string; name?: string; leaderId?: string; leaderName?: string };
  agencyDirector?: { id?: string; name?: string; agencyId?: string; agencyName?: string };
  regionalDirector?: { id?: string; name?: string; regionId?: string; regionName?: string };
  ceo?: { id?: string; name?: string; organizationId?: string };
  departmentHead?: { id?: string; name?: string };
  coSale?: { id?: string; name?: string; rate?: number };
}

export interface CalculateCommissionParams {
  dealValue: number;
  projectCommissionRate: number; // % hoa hồng CĐT chi cho Sàn (VD: 3.5)
  tiers?: Partial<Record<CommissionTierRole, number>>;
  baseMode?: CommissionBaseMode; // 'contract_value' (mặc định) | 'company_commission'
  teamSplitMode?: TeamSplitMode; // 'leader_only' (mặc định) | 'equal' | 'by_ratio'
  teamMembers?: { id: string; name: string; ratio?: number }[];
  chain?: CommissionChainInfo;
  withholdingRate?: number; // Thuế khấu trừ TNCN (%) (mặc định 0)
  policyVersion?: string;
  allowExceedPool?: boolean; // Manager+ override
}

export class CommissionService {
  /**
   * Tỷ lệ hoa hồng 5 tầng mẫu chuẩn theo đặc tả (Dùng cho seed/demo/fallback)
   * GTGD: 3.650.000.000 đ
   * Sàn: 3.5% = 127.750.000 đ
   * Sale: 1.5% = 54.750.000 đ
   * Nhóm: 0.3% = 10.950.000 đ
   * GĐ Sàn: 0.2% = 7.300.000 đ
   * GĐ Vùng: 0.1% = 3.650.000 đ
   * CEO: 0.05% = 1.825.000 đ
   * Tổng chia: 78.475.000 đ (2.15%)
   * Công ty giữ lại: 49.275.000 đ (1.35%)
   */
  public static readonly DEFAULT_DEMO_TIERS: Record<CommissionTierRole, number> = {
    sale: 1.5,
    team: 0.3,
    agency_director: 0.2,
    regional_director: 0.1,
    ceo: 0.05,
    department_head: 0,
    ops_fund: 0,
    co_sale: 0,
    referrer: 0,
    company_retained: 0,
  };

  /**
   * Nhãn tiếng Việt chuẩn cho từng tầng hoa hồng
   */
  public static readonly TIER_LABELS: Record<CommissionTierRole, string> = {
    sale: 'Chuyên viên tư vấn (Sale)',
    team: 'Đội nhóm (Team Leader)',
    agency_director: 'Giám đốc Sàn (Agency Director)',
    regional_director: 'Giám đốc Vùng (Regional Director)',
    ceo: 'Tổng Giám Đốc (CEO)',
    department_head: 'Trưởng phòng kinh doanh',
    ops_fund: 'Quỹ vận hành & thưởng nóng',
    co_sale: 'Đồng tư vấn (Co-sale)',
    referrer: 'Người giới thiệu (Referrer)',
    company_retained: 'Công ty giữ lại (Company Retained)',
  };

  /**
   * 1. HÀM THUẦN TÍNH TOÁN & PHÂN BỔ HOA HỒNG (calculate_commission)
   * Duy nhất một nguồn tính cho cả preview client và server RPC
   */
  public calculateCommission(params: CalculateCommissionParams): CommissionCalculationResult {
    const dealValue = Math.max(0, Math.round(params.dealValue || 0));
    const projectRate = Number(params.projectCommissionRate || 0);
    const baseMode = params.baseMode || 'contract_value';
    const teamSplitMode = params.teamSplitMode || 'leader_only';
    const withholdingRate = Math.max(0, Number(params.withholdingRate || 0));
    const policyVersion = params.policyVersion || '2026.v1';

    // Hoa hồng Sàn (CĐT chi) = Tổng quỹ hoa hồng
    const agencyCommissionAmount = Math.round(dealValue * (projectRate / 100));

    // Xác định cơ sở tính tiền (baseAmount)
    const baseAmount = baseMode === 'contract_value' ? dealValue : agencyCommissionAmount;

    // Thiết lập tỷ lệ cho các tầng
    const tierRates: Partial<Record<CommissionTierRole, number>> = {
      ...params.tiers,
    };

    // Nếu không có cấu hình tier thì dùng default demo
    if (Object.keys(tierRates).length === 0) {
      tierRates.sale = 1.5;
      tierRates.team = 0.3;
      tierRates.agency_director = 0.2;
      tierRates.regional_director = 0.1;
      tierRates.ceo = 0.05;
    }

    const items: CommissionTierItem[] = [];
    const chain = params.chain || {};

    // Thứ tự 5 tầng chính + các tầng phụ
    const orderedTiers: CommissionTierRole[] = [
      'sale',
      'team',
      'agency_director',
      'regional_director',
      'ceo',
      'department_head',
      'ops_fund',
      'co_sale',
      'referrer',
    ];

    let totalDistributedRate = 0;

    for (const tier of orderedTiers) {
      const rate = Number(tierRates[tier] || 0);
      if (rate <= 0) continue;

      totalDistributedRate += rate;

      // Xử lý tầng Nhóm với team_split_mode
      if (tier === 'team' && (teamSplitMode === 'equal' || teamSplitMode === 'by_ratio') && params.teamMembers && params.teamMembers.length > 0) {
        const totalTeamAmount = Math.round(baseAmount * (rate / 100));
        const subItems = this.splitTeamCommission(
          totalTeamAmount,
          rate,
          teamSplitMode,
          params.teamMembers,
          withholdingRate
        );
        items.push(...subItems);
        continue;
      }

      // Tầng đơn lẻ
      const rawAmount = baseAmount * (rate / 100);
      const amount = Math.round(rawAmount);

      const recipientInfo = this.resolveRecipientForTier(tier, chain);
      const taxAmount = withholdingRate > 0 ? Math.round(amount * (withholdingRate / 100)) : 0;
      const netAmount = amount - taxAmount;

      items.push({
        tier,
        label: CommissionService.TIER_LABELS[tier] || tier,
        rate,
        amount,
        recipient_id: recipientInfo.id,
        recipient_name: recipientInfo.name,
        recipient_role: recipientInfo.role,
        is_unassigned: recipientInfo.isUnassigned,
        pit_tax_amount: taxAmount,
        net_payable_amount: netAmount,
        notes: recipientInfo.isUnassigned ? `Chưa gán người nhận cho tầng ${CommissionService.TIER_LABELS[tier]}` : undefined,
      });
    }

    // Làm tròn kiểm tra tổng chia
    const totalDistributedAmount = items.reduce((sum, item) => sum + item.amount, 0);

    // Kiểm tra ràng buộc: Tổng % các tầng <= % hoa hồng Sàn
    const isExceedsPool = totalDistributedRate > projectRate + 0.0001;
    if (isExceedsPool && !params.allowExceedPool) {
      // Khi vượt quỹ, server/service đánh dấu cảnh báo
    }

    // Công ty giữ lại = Quỹ hoa hồng Sàn - Tổng các tầng
    const companyRetainedRate = Math.max(0, Number((projectRate - totalDistributedRate).toFixed(4)));
    const companyRetainedAmount = Math.max(0, agencyCommissionAmount - totalDistributedAmount);

    return {
      dealValue,
      baseMode,
      baseAmount,
      agencyCommissionRate: projectRate,
      agencyCommissionAmount,
      totalDistributedRate: Number(totalDistributedRate.toFixed(4)),
      totalDistributedAmount,
      companyRetainedRate,
      companyRetainedAmount,
      items,
      isExceedsPool,
      withholdingRate,
      policyVersion,
    };
  }

  /**
   * 2. PHÂN BỔ TẦNG NHÓM (TEAM SPLIT) BẰNG PHƯƠNG PHÁP PHẦN DƯ LỚN NHẤT
   */
  private splitTeamCommission(
    totalTeamAmount: number,
    teamRate: number,
    splitMode: 'equal' | 'by_ratio',
    members: { id: string; name: string; ratio?: number }[],
    withholdingRate: number
  ): CommissionTierItem[] {
    const n = members.length;
    if (n === 0) return [];

    let allocations: { member: { id: string; name: string }; rawAmount: number; intAmount: number; rem: number; rate: number }[] = [];

    if (splitMode === 'equal') {
      const shareRate = Number((teamRate / n).toFixed(4));
      const exactPerMember = totalTeamAmount / n;
      allocations = members.map(m => {
        const intAmount = Math.floor(exactPerMember);
        return {
          member: m,
          rawAmount: exactPerMember,
          intAmount,
          rem: exactPerMember - intAmount,
          rate: shareRate,
        };
      });
    } else {
      // by_ratio
      const totalRatio = members.reduce((sum, m) => sum + (m.ratio || 1), 0);
      allocations = members.map(m => {
        const memberRatio = (m.ratio || 1) / totalRatio;
        const memberRate = Number((teamRate * memberRatio).toFixed(4));
        const rawAmount = totalTeamAmount * memberRatio;
        const intAmount = Math.floor(rawAmount);
        return {
          member: m,
          rawAmount,
          intAmount,
          rem: rawAmount - intAmount,
          rate: memberRate,
        };
      });
    }

    // Largest Remainder Method: Tính phần thiếu và phân bổ cho các remainder lớn nhất
    const sumInt = allocations.reduce((sum, a) => sum + a.intAmount, 0);
    let diff = totalTeamAmount - sumInt;

    // Sắp xếp giảm dần theo remainder
    const sorted = [...allocations].sort((a, b) => b.rem - a.rem);
    for (let i = 0; i < diff; i++) {
      if (i < sorted.length) {
        sorted[i].intAmount += 1;
      }
    }

    return allocations.map(a => {
      const tax = withholdingRate > 0 ? Math.round(a.intAmount * (withholdingRate / 100)) : 0;
      return {
        tier: 'team',
        label: `Thành viên nhóm: ${a.member.name}`,
        rate: a.rate,
        amount: a.intAmount,
        recipient_id: a.member.id,
        recipient_name: a.member.name,
        recipient_role: 'team_member',
        is_unassigned: false,
        pit_tax_amount: tax,
        net_payable_amount: a.intAmount - tax,
        notes: `Phân bổ hoa hồng nhóm (${splitMode === 'equal' ? 'chia đều' : 'theo tỷ lệ'})`,
      };
    });
  }

  /**
   * 3. PHÂN GIẢI NGƯỜI NHẬN CHO TỪNG TẦNG TỪ CHUỖI TRỰC THUỘC (v_sale_chain)
   */
  private resolveRecipientForTier(
    tier: CommissionTierRole,
    chain: CommissionChainInfo
  ): { id: string; name: string; role: string; isUnassigned: boolean } {
    switch (tier) {
      case 'sale':
        if (chain.sale?.id) {
          return { id: chain.sale.id, name: chain.sale.name || 'Chuyên viên tư vấn', role: 'sale_agent', isUnassigned: false };
        }
        return { id: 'unassigned', name: 'Chưa gán Sale', role: 'sale_agent', isUnassigned: true };

      case 'team':
        if (chain.team?.leaderId) {
          return { id: chain.team.leaderId, name: chain.team.leaderName || 'Trưởng Nhóm', role: 'team_leader', isUnassigned: false };
        }
        return { id: 'unassigned', name: 'Chưa gán Trưởng Nhóm', role: 'team_leader', isUnassigned: true };

      case 'agency_director':
        if (chain.agencyDirector?.id) {
          return { id: chain.agencyDirector.id, name: chain.agencyDirector.name || 'Giám Đốc Sàn', role: 'director', isUnassigned: false };
        }
        return { id: 'unassigned', name: 'Chưa gán Giám Đốc Sàn', role: 'director', isUnassigned: true };

      case 'regional_director':
        if (chain.regionalDirector?.id) {
          return { id: chain.regionalDirector.id, name: chain.regionalDirector.name || 'Giám Đốc Vùng', role: 'regional_director', isUnassigned: false };
        }
        return { id: 'unassigned', name: 'Chưa gán Giám Đốc Vùng', role: 'regional_director', isUnassigned: true };

      case 'ceo':
        if (chain.ceo?.id) {
          return { id: chain.ceo.id, name: chain.ceo.name || 'Tổng Giám Đốc', role: 'ceo', isUnassigned: false };
        }
        return { id: 'unassigned', name: 'Chưa gán Tổng Giám Đốc', role: 'ceo', isUnassigned: true };

      case 'department_head':
        if (chain.departmentHead?.id) {
          return { id: chain.departmentHead.id, name: chain.departmentHead.name || 'Trưởng Phòng', role: 'sales_manager', isUnassigned: false };
        }
        return { id: 'unassigned', name: 'Chưa gán Trưởng Phòng', role: 'sales_manager', isUnassigned: true };

      case 'co_sale':
        if (chain.coSale?.id) {
          return { id: chain.coSale.id, name: chain.coSale.name || 'Đồng Sale', role: 'co_sale', isUnassigned: false };
        }
        return { id: 'unassigned', name: 'Chưa có Co-sale', role: 'co_sale', isUnassigned: true };

      default:
        return { id: 'unassigned', name: 'Chưa xác định', role: tier, isUnassigned: true };
    }
  }

  /**
   * 4. PHÂN QUYỀN TRUY VẬN THU NHẬP (Scoping Matrix)
   * Kiểm tra quyền xem dòng hoa hồng cụ thể của người dùng
   */
  public canUserViewCommissionEntry(
    currentUser: UserProfile | null | undefined,
    entry: CommissionEntry,
    options?: { directorGlobalScope?: boolean; managersSeeSubordinateIncome?: boolean }
  ): boolean {
    if (!currentUser) return false;

    // 1. Quản trị viên (admin): Toàn quyền xem toàn hệ thống (isGlobalViewer)
    if (currentUser.role === 'admin') {
      return true;
    }

    // 1b. Tổng Giám Đốc (CEO): Chỉ xem hoa hồng thuộc nhánh/doanh nghiệp của mình, KHÔNG xem của CEO khác
    if (currentUser.role === 'ceo') {
      // Chặn xem dòng của CEO khác
      if (entry.tier === 'ceo' && entry.recipient_id !== currentUser.id) {
        return false;
      }
      // Chặn xem nếu entry thuộc organization khác
      if (entry.organization_id && currentUser.organization_id && entry.organization_id !== currentUser.organization_id) {
        return false;
      }
      // Đối soát qua region nếu có
      if (entry.region_id && currentUser.organization_id && typeof localStorage !== 'undefined') {
        const rawRegs = localStorage.getItem('crm_regions');
        if (rawRegs) {
          const regions = JSON.parse(rawRegs);
          const reg = regions.find((r: any) => r.id === entry.region_id);
          if (reg && reg.organization_id && reg.organization_id !== currentUser.organization_id) {
            return false;
          }
        }
      }
      return true;
    }

    // 2. Marketing Manager và HR Admin: Tuyệt đối KHÔNG xem hoa hồng nhân sự
    if (currentUser.role === 'marketing_manager' || currentUser.role === 'hr_admin') {
      return false;
    }

    // 3. Mọi nhân sự luôn xem được dòng của chính mình
    if (entry.recipient_id === currentUser.id) {
      return true;
    }

    // 4. Giám đốc Vùng: Xem được các dòng thuộc các sàn trong vùng của mình
    if (currentUser.role === 'regional_director') {
      if (!currentUser.region_id) return true;
      return entry.region_id === currentUser.region_id;
    }

    // 5. Giám đốc Sàn: Xem được các dòng thuộc sàn của mình (hoặc toàn công ty nếu có cờ director_global_scope)
    if (currentUser.role === 'director') {
      if (options?.directorGlobalScope) return true;
      if (!currentUser.agency_id) return true;
      return entry.agency_id === currentUser.agency_id;
    }

    // 6. Trưởng phòng / Trưởng nhóm:
    // Mặc định chỉ xem được dòng của mình, trừ khi cờ managers_see_subordinate_income = true
    if (currentUser.role === 'sales_manager' || currentUser.role === 'team_leader') {
      if (options?.managersSeeSubordinateIncome) {
        return true;
      }
      return entry.recipient_id === currentUser.id;
    }

    // 7. Chuyên viên tư vấn (sale_agent): CHỈ xem phần của mình
    if (currentUser.role === 'sale_agent') {
      return entry.recipient_id === currentUser.id;
    }

    return false;
  }

  /**
   * 5. LỌC DANH SÁCH SỔ CÁI THEO PHẠM VI QUYỀN
   */
  public filterCommissionEntriesByScope(
    entries: CommissionEntry[],
    currentUser: UserProfile | null | undefined,
    options?: { directorGlobalScope?: boolean; managersSeeSubordinateIncome?: boolean }
  ): CommissionEntry[] {
    if (!currentUser) return [];
    if (currentUser.role === 'marketing_manager' || currentUser.role === 'hr_admin') {
      return [];
    }
    return entries.filter(e => this.canUserViewCommissionEntry(currentUser, e, options));
  }

  /**
   * 6. TÍNH TOÁN BÁO CÁO THU NHẬP (get_income_summary)
   * Tổng hợp thu nhập theo người dùng, tầng nhận, trạng thái và mốc thời gian
   */
  public calculateIncomeSummary(params: {
    entries: CommissionEntry[];
    userIds?: string[];
    tiers?: CommissionTierRole[];
    statuses?: CommissionEntryStatus[];
    dateBasis?: 'sign_date' | 'eligible_at' | 'paid_at';
    dateFrom?: string;
    dateTo?: string;
    projectId?: string;
    regionId?: string;
    agencyId?: string;
    currentUser: UserProfile;
    options?: { directorGlobalScope?: boolean; managersSeeSubordinateIncome?: boolean };
  }): {
    overall: {
      totalGrossIncome: number;
      totalNetIncome: number;
      totalTaxAmount: number;
      paidIncome: number;
      eligibleIncome: number;
      expectedIncome: number;
      clawbackIncome: number;
      unassignedIncome: number;
      entryCount: number;
    };
    userSummaries: IncomeSummary[];
    tierBreakdown: Record<string, number>;
    statusBreakdown: Record<string, number>;
    chartData: { date: string; amount: number; paid: number; eligible: number; expected: number }[];
    filteredEntries: CommissionEntry[];
  } {
    // 1. Lọc theo quyền RLS
    let list = this.filterCommissionEntriesByScope(params.entries, params.currentUser, params.options);

    // 2. Lọc theo danh sách người dùng (nếu có chọn cụ thể)
    if (params.userIds && params.userIds.length > 0 && !params.userIds.includes('all')) {
      const uSet = new Set(params.userIds);
      list = list.filter(e => uSet.has(e.recipient_id));
    }

    // 3. Lọc theo tầng nhận (tiers)
    if (params.tiers && params.tiers.length > 0) {
      const tSet = new Set(params.tiers);
      list = list.filter(e => e.tier && tSet.has(e.tier));
    }

    // 4. Lọc theo trạng thái hoa hồng (statuses)
    if (params.statuses && params.statuses.length > 0) {
      const sSet = new Set(params.statuses);
      list = list.filter(e => sSet.has(e.status));
    }

    // 5. Lọc theo Dự án, Vùng, Sàn
    if (params.projectId && params.projectId !== 'all') {
      list = list.filter(e => e.project_id === params.projectId);
    }
    if (params.regionId && params.regionId !== 'all') {
      list = list.filter(e => e.region_id === params.regionId);
    }
    if (params.agencyId && params.agencyId !== 'all') {
      list = list.filter(e => e.agency_id === params.agencyId);
    }

    // 6. Lọc theo mốc thời gian (dateBasis: 'sign_date' | 'eligible_at' | 'paid_at')
    const basis = params.dateBasis || 'sign_date';
    if (params.dateFrom || params.dateTo) {
      const start = params.dateFrom ? new Date(params.dateFrom).getTime() : 0;
      const end = params.dateTo ? new Date(params.dateTo).setHours(23, 59, 59, 999) : Infinity;

      list = list.filter(e => {
        let targetDateStr = e.sign_date || e.created_at;
        if (basis === 'eligible_at') targetDateStr = e.eligible_at || e.created_at;
        if (basis === 'paid_at') targetDateStr = e.paid_at || e.created_at;

        if (!targetDateStr) return false;
        const time = new Date(targetDateStr).getTime();
        return time >= start && time <= end;
      });
    }

    // 7. Tổng hợp số liệu
    let totalGrossIncome = 0;
    let totalTaxAmount = 0;
    let paidIncome = 0;
    let eligibleIncome = 0;
    let expectedIncome = 0;
    let clawbackIncome = 0;
    let unassignedIncome = 0;

    const tierBreakdown: Record<string, number> = {};
    const statusBreakdown: Record<string, number> = {};
    const userMap = new Map<string, IncomeSummary>();
    const chartMap = new Map<string, { date: string; amount: number; paid: number; eligible: number; expected: number }>();

    for (const e of list) {
      const amt = Number(e.amount || 0);
      const tax = Number(e.pit_tax_amount || 0);

      if (e.status === 'clawback') {
        clawbackIncome += Math.abs(amt);
        // Trừ khỏi tổng gross
        totalGrossIncome -= Math.abs(amt);
      } else if (e.status === 'unassigned') {
        unassignedIncome += amt;
      } else {
        totalGrossIncome += amt;
        totalTaxAmount += tax;

        if (e.status === 'paid') {
          paidIncome += amt;
        } else if (e.status === 'eligible') {
          eligibleIncome += amt;
        } else {
          expectedIncome += amt;
        }
      }

      // Tier Breakdown
      const tierKey = e.tier || e.recipient_role || 'other';
      tierBreakdown[tierKey] = (tierBreakdown[tierKey] || 0) + amt;

      // Status Breakdown
      statusBreakdown[e.status] = (statusBreakdown[e.status] || 0) + amt;

      // User Breakdown
      if (e.recipient_id && e.recipient_id !== 'unassigned') {
        let uSummary = userMap.get(e.recipient_id);
        if (!uSummary) {
          uSummary = {
            userId: e.recipient_id,
            userName: e.recipient_name || 'Nhân sự',
            userRole: e.recipient_role || 'sale_agent',
            agencyName: e.agency_name,
            regionName: e.region_name,
            totalGrossIncome: 0,
            totalNetIncome: 0,
            totalTaxAmount: 0,
            paidIncome: 0,
            eligibleIncome: 0,
            expectedIncome: 0,
            clawbackIncome: 0,
            tierBreakdown: {},
            projectBreakdown: {},
            entryCount: 0,
          };
          userMap.set(e.recipient_id, uSummary);
        }

        uSummary.entryCount += 1;
        if (e.status === 'clawback') {
          uSummary.clawbackIncome += Math.abs(amt);
          uSummary.totalGrossIncome -= Math.abs(amt);
          uSummary.totalNetIncome -= Math.abs(amt - tax);
        } else {
          uSummary.totalGrossIncome += amt;
          uSummary.totalTaxAmount += tax;
          uSummary.totalNetIncome += amt - tax;

          if (e.status === 'paid') uSummary.paidIncome += amt;
          else if (e.status === 'eligible') uSummary.eligibleIncome += amt;
          else uSummary.expectedIncome += amt;
        }

        uSummary.tierBreakdown[tierKey] = (uSummary.tierBreakdown[tierKey] || 0) + amt;
        if (e.project_id) {
          const pKey = e.project_id;
          if (!uSummary.projectBreakdown[pKey]) {
            uSummary.projectBreakdown[pKey] = {
              projectName: e.project_name || 'Dự án',
              amount: 0,
              count: 0,
            };
          }
          uSummary.projectBreakdown[pKey].amount += amt;
          uSummary.projectBreakdown[pKey].count += 1;
        }
      }

      // Chart Data theo ngày
      const dateKey = (e.sign_date || e.created_at || '').slice(0, 10) || '2026-01-01';
      let cItem = chartMap.get(dateKey);
      if (!cItem) {
        cItem = { date: dateKey, amount: 0, paid: 0, eligible: 0, expected: 0 };
        chartMap.set(dateKey, cItem);
      }
      cItem.amount += amt;
      if (e.status === 'paid') cItem.paid += amt;
      else if (e.status === 'eligible') cItem.eligible += amt;
      else if (e.status !== 'clawback') cItem.expected += amt;
    }

    const chartData = Array.from(chartMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return {
      overall: {
        totalGrossIncome,
        totalNetIncome: totalGrossIncome - totalTaxAmount,
        totalTaxAmount,
        paidIncome,
        eligibleIncome,
        expectedIncome,
        clawbackIncome,
        unassignedIncome,
        entryCount: list.length,
      },
      userSummaries: Array.from(userMap.values()),
      tierBreakdown,
      statusBreakdown,
      chartData,
      filteredEntries: list,
    };
  }

  /**
   * 7. XUẤT CSV BÁO CÁO THU NHẬP
   * Loại trừ PII nhạy cảm (không xuất CCCD, số tài khoản)
   */
  public exportIncomeToCsv(entries: CommissionEntry[]): string {
    const headers = [
      'Mã Bút Toán',
      'Mã Hợp Đồng',
      'Dự Án',
      'Khách Hàng',
      'Người Nhận',
      'Tầng Hoa Hồng',
      'Tỷ Lệ (%)',
      'Số Tiền Gross (VND)',
      'Thuế TNCN (VND)',
      'Thực Nhận Net (VND)',
      'Trạng Thái',
      'Ngày Ký HĐMB',
      'Ghi Chú',
    ];

    const rows = entries.map(e => [
      e.id,
      e.contract_code || '',
      `"${(e.project_name || '').replace(/"/g, '""')}"`,
      `"${(e.customer_name || '').replace(/"/g, '""')}"`,
      `"${(e.recipient_name || '').replace(/"/g, '""')}"`,
      CommissionService.TIER_LABELS[e.tier as CommissionTierRole] || e.tier || e.recipient_role,
      e.rate_percent || e.percent || 0,
      e.amount || 0,
      e.pit_tax_amount || 0,
      e.net_payable_amount || e.amount || 0,
      e.status,
      e.sign_date || e.created_at?.slice(0, 10) || '',
      `"${(e.notes || '').replace(/"/g, '""')}"`,
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}

export const commissionService = new CommissionService();
