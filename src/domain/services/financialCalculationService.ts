// ========================================================
// REAL ESTATE CRM - FINANCIAL CALCULATION SERVICE
// SINGLE SOURCE OF TRUTH (Dịch vụ tính toán tập trung duy nhất)
// Đảm bảo Doanh số, HĐMB, Hoa hồng khớp 100% trên toàn hệ thống
// ========================================================

import { 
  Transaction, 
  Project, 
  ProjectCommissionPolicy, 
  CommissionTier, 
  SoldProduct, 
  AgencyPerformanceDetail,
  LeaderboardItem,
  UserRole,
  UserProfile,
  LeadStatus
} from '@/domain/types';
import { JOURNEY_STAGES } from '@/domain/constants';

export interface TimeRangeFilter {
  preset?: 'all' | 'week' | 'month' | 'quarter' | 'custom';
  startDate?: string;
  endDate?: string;
}

export interface CalculatedCommissionResult {
  dealValue: number;
  companyCommissionRate: number;
  companyCommissionAmount: number;
  baseSaleRate: number;
  progressiveBonusRate: number;
  totalSaleRate: number;
  totalSaleCommissionAmount: number;
  isEligible: boolean;
  commissionStatus: 'pending' | 'eligible' | 'paid';
  recognitionMilestone: string;
}

export class FinancialCalculationService {
  /**
   * 1. KIỂM TRA ĐIỀU KIỆN GHI NHẬN HOA HỒNG (RECOGNITION MILESTONE)
   * Hoa hồng chỉ chuyển trạng thái 'eligible' khi đạt đúng mốc cấu hình theo dự án
   */
  isCommissionEligible(
    tx: Partial<Transaction>,
    recognitionMilestone: 'deposit' | 'contract' | 'first_installment' = 'first_installment'
  ): boolean {
    if (tx.status === 'cancelled' || tx.status === 'refunded') return false;

    if (recognitionMilestone === 'deposit') {
      return Boolean(tx.deposit_date) || tx.type === 'deposit' || tx.type === 'contract';
    }

    if (recognitionMilestone === 'contract') {
      return tx.type === 'contract' && Boolean(tx.contract_code || tx.contract_date);
    }

    // Default: 'first_installment' (Đóng tiền đợt 1 thành công)
    return Boolean(tx.first_installment_paid);
  }

  /**
   * 2. TÍNH BẬC LŨY TIẾN & HOA HỒNG CHO MỘT GIAO DỊCH
   */
  calculateTransactionCommission(
    tx: Partial<Transaction>,
    policy?: ProjectCommissionPolicy | null,
    saleRole: UserRole = 'sale_agent',
    saleAchievedCount: number = 1,
    saleAchievedVolume: number = 0
  ): CalculatedCommissionResult {
    const dealVal = Number(tx.deal_value || tx.amount || 0);
    const compRate = Number(policy?.company_commission_rate ?? tx.sale_commission_rate ?? 3.5);
    const compAmt = Math.round(dealVal * (compRate / 100));

    // Tìm tỷ lệ hoa hồng cơ bản theo cấp bậc
    let baseSaleRate = 1.8;
    if (policy?.role_rates && policy.role_rates.length > 0) {
      const matchRole = policy.role_rates.find(r => r.role === saleRole);
      if (matchRole) baseSaleRate = matchRole.default_rate;
    } else if (tx.sale_commission_rate) {
      baseSaleRate = tx.sale_commission_rate;
    }

    // Tính hoa hồng lũy tiến theo bậc
    let progressiveBonus = 0;
    if (policy?.tiers && policy.tiers.length > 0) {
      const activeTiers = policy.tiers.filter(t => t.is_active);
      for (const tier of activeTiers) {
        if (tier.target_role !== 'all' && tier.target_role !== saleRole) continue;

        if (tier.tier_type === 'contract_count') {
          const matchMin = saleAchievedCount >= tier.min_threshold;
          const matchMax = tier.max_threshold === null || tier.max_threshold === undefined || saleAchievedCount <= tier.max_threshold;
          if (matchMin && matchMax) {
            progressiveBonus = Math.max(progressiveBonus, Number(tier.bonus_rate));
          }
        } else if (tier.tier_type === 'deal_value') {
          const matchMin = saleAchievedVolume >= tier.min_threshold;
          const matchMax = tier.max_threshold === null || tier.max_threshold === undefined || saleAchievedVolume <= tier.max_threshold;
          if (matchMin && matchMax) {
            progressiveBonus = Math.max(progressiveBonus, Number(tier.bonus_rate));
          }
        }
      }
    }

    const totalSaleRate = baseSaleRate + progressiveBonus;
    const totalSaleCommissionAmount = Math.round(dealVal * (totalSaleRate / 100));

    const milestone = policy?.recognition_milestone || 'first_installment';
    const isEligible = this.isCommissionEligible(tx as Transaction, milestone);

    return {
      dealValue: dealVal,
      companyCommissionRate: compRate,
      companyCommissionAmount: compAmt,
      baseSaleRate,
      progressiveBonusRate: progressiveBonus,
      totalSaleRate,
      totalSaleCommissionAmount,
      isEligible,
      commissionStatus: isEligible ? 'eligible' : 'pending',
      recognitionMilestone: milestone,
    };
  }

  /**
   * 3. LỌC GIAO DỊCH THEO KHOẢNG THỜI GIAN CHUẨN
   */
  filterTransactionsByTime(transactions: Transaction[], timeFilter?: TimeRangeFilter): Transaction[] {
    if (!timeFilter || !timeFilter.preset || timeFilter.preset === 'all') {
      return transactions;
    }

    const now = new Date();
    let start = new Date(0);
    let end = new Date(now.getTime() + 86400000);

    if (timeFilter.preset === 'week') {
      const dayOfWeek = now.getDay() || 7;
      start = new Date(now);
      start.setDate(now.getDate() - dayOfWeek + 1);
      start.setHours(0, 0, 0, 0);
    } else if (timeFilter.preset === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (timeFilter.preset === 'quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), qMonth, 1);
    } else if (timeFilter.preset === 'custom' && timeFilter.startDate) {
      start = new Date(timeFilter.startDate);
      if (timeFilter.endDate) {
        end = new Date(timeFilter.endDate);
        end.setHours(23, 59, 59, 999);
      }
    }

    return transactions.filter(t => {
      const dateStr = t.contract_date || t.transaction_date || t.created_at;
      if (!dateStr) return true;
      const tDate = new Date(dateStr);
      return tDate >= start && tDate <= end;
    });
  }

  /**
   * 4. TỔNG HỢP HIỆU SUẤT BÁN HÀNG CỦA DỰ ÁN
   * Thống kê: HĐMB, Doanh số, Sản phẩm bán/tồn/giữ chỗ/cọc, Hoa hồng dự kiến & thực nhận
   */
  aggregateProjectSales(
    project: Project,
    transactions: Transaction[],
    timeFilter?: TimeRangeFilter
  ): {
    totalContracts: number;
    totalRevenue: number;
    expectedCompanyCommission: number;
    realizedCompanyCommission: number;
    expectedSaleCommission: number;
    realizedSaleCommission: number;
    soldProducts: SoldProduct[];
    inventory: {
      totalUnits: number;
      soldUnits: number;
      depositUnits: number;
      bookingUnits: number;
      availableUnits: number;
    };
  } {
    const projectTxs = transactions.filter(t => t.project_id === project.id);
    const filteredTxs = this.filterTransactionsByTime(projectTxs, timeFilter);

    const contracts = filteredTxs.filter(t => t.type === 'contract' && t.status === 'confirmed');
    const deposits = filteredTxs.filter(t => t.type === 'deposit' && t.status === 'confirmed');
    const bookings = filteredTxs.filter(t => t.type === 'booking' && t.status === 'confirmed');

    const totalContracts = contracts.length;
    const totalRevenue = contracts.reduce((sum, t) => sum + (t.deal_value || t.amount || 0), 0);

    let expectedCompanyCommission = 0;
    let realizedCompanyCommission = 0;
    let expectedSaleCommission = 0;
    let realizedSaleCommission = 0;

    const soldProducts: SoldProduct[] = contracts.map(c => {
      const expComp = c.commission_amount || Math.round((c.deal_value || c.amount) * 0.035);
      const expSale = c.sale_commission_amount || Math.round((c.deal_value || c.amount) * 0.018);
      const isEligible = this.isCommissionEligible(c, project.recognition_milestone || 'first_installment');

      expectedCompanyCommission += expComp;
      expectedSaleCommission += expSale;

      if (isEligible) {
        realizedCompanyCommission += expComp;
        realizedSaleCommission += expSale;
      }

      return {
        id: c.id,
        project_id: project.id,
        project_name: project.name,
        unit_code: c.unit_code || 'Chưa định danh',
        property_type: project.property_type || 'Căn hộ',
        deal_value: c.deal_value || c.amount || 0,
        contract_code: c.contract_code || c.code,
        sold_date: c.contract_date || c.transaction_date || c.created_at || new Date().toISOString(),
        sale_id: c.sale_id || c.created_by || '',
        sale_name: c.sale_name || 'Chuyên viên',
        team_name: c.team_name,
        agency_name: c.agency_name,
        customer_name: c.customer_name || 'Khách hàng',
        customer_phone: c.customer_phone,
        commission_amount: expComp,
        sale_commission_amount: expSale,
        first_installment_paid: Boolean(c.first_installment_paid),
      };
    });

    const totalUnits = project.total_units || 500;
    const soldUnits = totalContracts;
    const depositUnits = deposits.length;
    const bookingUnits = bookings.length;
    const availableUnits = Math.max(0, totalUnits - soldUnits - depositUnits - bookingUnits);

    return {
      totalContracts,
      totalRevenue,
      expectedCompanyCommission,
      realizedCompanyCommission,
      expectedSaleCommission,
      realizedSaleCommission,
      soldProducts,
      inventory: {
        totalUnits,
        soldUnits,
        depositUnits,
        bookingUnits,
        availableUnits,
      },
    };
  }

  /**
   * 5. TỔNG HỢP GIAO DỊCH CỦA KHÁCH HÀNG (TIMELINE & NHIỀU SẢN PHẨM)
   */
  aggregateCustomerDeals(
    leadId: string,
    transactions: Transaction[],
    policy?: ProjectCommissionPolicy | null
  ): {
    deals: Array<{
      tx: Transaction;
      calculated: CalculatedCommissionResult;
      timeline: {
        booking?: { code: string; date: string; amount: number; status: string };
        deposit?: { code: string; date: string; amount: number; status: string };
        contract?: { code: string; date: string; amount: number; status: string };
        firstInstallment?: { amount: number; date: string; paid: boolean };
      };
    }>;
    totalProducts: number;
    totalDealValue: number;
    totalCompanyCommission: number;
    totalSaleCommission: number;
    totalRealizedCommission: number;
  } {
    const leadTxs = transactions.filter(t => t.lead_id === leadId && t.status === 'confirmed');

    let totalDealValue = 0;
    let totalCompanyCommission = 0;
    let totalSaleCommission = 0;
    let totalRealizedCommission = 0;

    const deals = leadTxs.map(tx => {
      const calculated = this.calculateTransactionCommission(tx, policy);
      totalDealValue += calculated.dealValue;
      totalCompanyCommission += calculated.companyCommissionAmount;
      totalSaleCommission += calculated.totalSaleCommissionAmount;
      if (calculated.isEligible) {
        totalRealizedCommission += calculated.totalSaleCommissionAmount;
      }

      // Build timeline
      const timeline: any = {};
      if (tx.type === 'booking') {
        timeline.booking = { code: tx.code, date: tx.transaction_date, amount: tx.amount, status: tx.status };
      }
      if (tx.deposit_date || tx.type === 'deposit') {
        timeline.deposit = {
          code: tx.code,
          date: tx.deposit_date || tx.transaction_date,
          amount: tx.type === 'deposit' ? tx.amount : Math.round(calculated.dealValue * 0.03),
          status: 'confirmed',
        };
      }
      if (tx.type === 'contract' || tx.contract_date || tx.contract_code) {
        timeline.contract = {
          code: tx.contract_code || tx.code,
          date: tx.contract_date || tx.transaction_date,
          amount: calculated.dealValue,
          status: 'confirmed',
        };
      }
      if (tx.first_installment_amount || tx.first_installment_date) {
        timeline.firstInstallment = {
          amount: tx.first_installment_amount || Math.round(calculated.dealValue * 0.1),
          date: tx.first_installment_date || tx.transaction_date,
          paid: Boolean(tx.first_installment_paid),
        };
      }

      return { tx, calculated, timeline };
    });

    return {
      deals,
      totalProducts: deals.length,
      totalDealValue,
      totalCompanyCommission,
      totalSaleCommission,
      totalRealizedCommission,
    };
  }

  /**
   * 6. PHÂN QUYỀN PHẠM VI XEM HIỆU SUẤT SÀN (SCOPE-BASED PERMISSION)
   */
  canAccessAgency(
    currentUser: Partial<UserProfile> | { role: UserRole; agency_id?: string; [key: string]: any },
    agencyId: string
  ): boolean {
    if (currentUser.role === 'admin' || currentUser.role === 'director' || currentUser.role === 'marketing_manager') {
      return true;
    }
    if (currentUser.role === 'sales_manager') {
      return currentUser.agency_id === agencyId;
    }
    if (currentUser.role === 'team_leader') {
      return currentUser.agency_id === agencyId;
    }
    return false;
  }
}

export const financialCalculationService = new FinancialCalculationService();
