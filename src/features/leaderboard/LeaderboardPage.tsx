// ========================================================
// REAL ESTATE CRM - SALES COMPETITION & LEADERBOARDS (MODULE 4 & 5)
// Bảng Thi Đua 3 Chỉ Số: Doanh Số, HĐMB, Hoa Hồng giữa Các Sàn,
// Trưởng Phòng, Team và Sale Agents (Lọc theo Dự án, Thời gian,
// % so với kỳ trước, Phân quyền bảo mật & Xuất Excel hợp đồng)
// ========================================================

import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Building2, 
  Users, 
  UserCheck, 
  Award, 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  FileCheck, 
  ChevronRight,
  Filter,
  Sparkles,
  Eye,
  Calendar,
  CheckCircle2, 
  Clock,
  Download,
  Lock,
  Layers,
  ArrowUpDown
} from 'lucide-react';
import { contractRepository } from '@/data/repositories/contractRepository';
import { projectRepository } from '@/data/repositories/projectRepository';
import { hrRepository } from '@/data/repositories/hrRepository';
import { TimeRangeFilter } from '@/domain/services/financialCalculationService';
import { LeaderboardItem, Project, Transaction, RecruiterRank, EmploymentType } from '@/domain/types';
import { EMPLOYMENT_TYPES, EMPLOYMENT_STATUSES } from '@/domain/constants';
import { AgencyPerformanceModal } from '@/components/AgencyPerformanceModal';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/app/useAuthStore';
import { exportToExcel } from '@/lib/exportExcel';
import { formatCurrencyVND } from '@/lib/utils';
import { DateRangeFilter } from '@/components/common/DateRangeFilter';
import { useDateRange } from '@/hooks/useDateRange';

type CompetitionTab = 'agency' | 'sales_manager' | 'team' | 'sale_agent' | 'recruiter';
type RankingMetric = 'revenue' | 'contracts_count' | 'commission';

export const LeaderboardPage: React.FC = () => {
  const { currentUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<CompetitionTab>('agency');
  const [rankingMetric, setRankingMetric] = useState<RankingMetric>('revenue');

  // Shared DateRangeFilter Hook
  const { value: dateRange, updateRange } = useDateRange('this_month');
  const [includeSample, setIncludeSample] = useState(true);

  // Filters
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedEmploymentTypes, setSelectedEmploymentTypes] = useState<EmploymentType[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardItem[]>([]);
  const [recruiters, setRecruiters] = useState<RecruiterRank[]>([]);
  const [loading, setLoading] = useState(true);

  // Agency Performance Drill-down Modal
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);
  const [agencyModalOpen, setAgencyModalOpen] = useState(false);

  // Sale Contract Commission Drill-down Modal (Module 4)
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<{
    saleId: string;
    saleName: string;
    transactions: Transaction[];
    totalRevenue: number;
    totalCommission: number;
  } | null>(null);
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [loadingSaleContracts, setLoadingSaleContracts] = useState(false);
  const [saleStatusFilter, setSaleStatusFilter] = useState<string>('all');

  // Load Projects once
  useEffect(() => {
    projectRepository.getProjects().then(setProjects).catch(console.error);
  }, []);

  // Load Leaderboard when Tab, Project, DateRange, Metric, or Filters change
  useEffect(() => {
    setLoading(true);
    if (activeTab === 'recruiter') {
      hrRepository.getRecruiterLeaderboard()
        .then(setRecruiters)
        .catch(console.error)
        .finally(() => setLoading(false));
      return;
    }

    contractRepository.getLeaderboard({
      type: activeTab,
      projectId: selectedProjectId === 'all' ? undefined : selectedProjectId,
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
      includeSample,
      metric: rankingMetric,
      employmentTypes: selectedEmploymentTypes.length > 0 ? selectedEmploymentTypes : undefined,
      employmentStatuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
    })
      .then(setLeaderboardData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeTab, selectedProjectId, dateRange, includeSample, rankingMetric, selectedEmploymentTypes, selectedStatuses]);

  const toggleEmploymentType = (type: EmploymentType) => {
    setSelectedEmploymentTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const handleOpenAgencyDetail = (agencyId: string) => {
    setSelectedAgencyId(agencyId);
    setAgencyModalOpen(true);
  };

  const loadSaleContracts = async (saleId: string, saleName: string, status?: string) => {
    setLoadingSaleContracts(true);
    try {
      const timeFilter: TimeRangeFilter = {
        preset: (dateRange.preset === 'custom' ? 'custom' : 'month'),
        startDate: dateRange.from || undefined,
        endDate: dateRange.to || undefined,
      };

      const res = await contractRepository.getSaleCommissions(
        saleId,
        selectedProjectId === 'all' ? undefined : selectedProjectId,
        timeFilter,
        status || saleStatusFilter
      );
      setSelectedSaleDetail({
        saleId,
        saleName,
        transactions: res.transactions,
        totalRevenue: res.totalRevenue,
        totalCommission: res.totalCommission,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSaleContracts(false);
    }
  };

  const handleOpenSaleContracts = (saleId: string, saleName: string) => {
    setSaleModalOpen(true);
    loadSaleContracts(saleId, saleName, 'all');
  };

  // Export Leaderboard to Excel
  const handleExportLeaderboard = () => {
    const tabName = 
      activeTab === 'agency' ? 'Các_San' :
      activeTab === 'sales_manager' ? 'Truong_Phong' :
      activeTab === 'team' ? 'Doi_Nhom' : 'Sale_Agents';

    exportToExcel({
      filename: `Bang_Thi_Dua_${tabName}_${new Date().toISOString().slice(0, 10)}`,
      title: `BẢNG XẾP HẠNG THI ĐUA - ${
        activeTab === 'agency' ? 'CÁC SÀN GIAO DỊCH' :
        activeTab === 'sales_manager' ? 'TRƯỞNG PHÒNG & GIÁM ĐỐC SÀN' :
        activeTab === 'team' ? 'ĐỘI NHÓM KINH DOANH' : 'CHUYÊN VIÊN TƯ VẤN (SALE)'
      }`,
      metadata: {
        'Chỉ số xếp hạng': rankingMetric === 'revenue' ? 'Doanh số' : rankingMetric === 'contracts_count' ? 'Số HĐMB' : 'Hoa hồng',
        'Dự án': selectedProjectId === 'all' ? 'Toàn bộ dự án' : (projects.find(p => p.id === selectedProjectId)?.name || selectedProjectId),
        'Kỳ thi đua': `${dateRange.from} đến ${dateRange.to} (${dateRange.preset})`,
        'Ngày xuất': new Date().toLocaleString('vi-VN'),
      },
      columns: [
        { header: 'Thứ hạng', key: 'rank' },
        { header: 'Đơn vị / Nhân sự', key: 'name' },
        { header: 'Thông tin phân cấp', key: 'subtitle' },
        { header: 'Tổng Doanh Số (VNĐ)', key: 'revenue' },
        { header: 'Số Lượng HĐMB', key: 'contracts_count' },
        { header: 'Tổng Hoa Hồng (VNĐ)', key: 'commission' },
        { header: '% Tăng trưởng kỳ trước', key: 'growth_rate' },
      ],
      data: leaderboardData.map(item => ({
        rank: item.rank,
        name: item.name,
        subtitle: item.subtitle || '',
        revenue: item.revenue,
        contracts_count: item.contracts_count,
        commission: (currentUser?.role === 'sale_agent' && item.id !== currentUser.id) ? 'Bảo mật' : item.commission,
        growth_rate: `${item.growth_rate && item.growth_rate > 0 ? '+' : ''}${item.growth_rate || 0}%`,
      })),
      totals: {
        rank: 'TỔNG CỘNG',
        revenue: leaderboardData.reduce((s, i) => s + i.revenue, 0),
        contracts_count: leaderboardData.reduce((s, i) => s + i.contracts_count, 0),
        commission: leaderboardData.reduce((s, i) => s + i.commission, 0),
      },
    });
  };

  // Export individual sale contracts modal to Excel
  const handleExportSaleContracts = () => {
    if (!selectedSaleDetail) return;
    exportToExcel({
      filename: `Chi_Tiet_Hop_Dong_Sale_${selectedSaleDetail.saleName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`,
      title: `BẢNG KÊ DOANH SỐ & HOA HỒNG CHI TIẾT TỪNG HỢP ĐỒNG: ${selectedSaleDetail.saleName}`,
      metadata: {
        'Chuyên viên tư vấn': selectedSaleDetail.saleName,
        'Tổng số HĐMB': selectedSaleDetail.transactions.length,
        'Tổng doanh số': formatCurrencyVND(selectedSaleDetail.totalRevenue),
        'Tổng hoa hồng': formatCurrencyVND(selectedSaleDetail.totalCommission),
        'Thời gian xuất': new Date().toLocaleString('vi-VN'),
      },
      columns: [
        { header: 'Mã HĐMB', key: 'contract_code' },
        { header: 'Dự án', key: 'project_name' },
        { header: 'Mã sản phẩm / căn', key: 'unit_code' },
        { header: 'Khách hàng', key: 'customer_name' },
        { header: 'Giá trị giao dịch (VNĐ)', key: 'deal_value' },
        { header: 'Doanh số ghi nhận (VNĐ)', key: 'recognized_revenue' },
        { header: '% Hoa hồng áp dụng', key: 'sale_commission_rate' },
        { header: 'Hoa hồng nhận được (VNĐ)', key: 'sale_commission_amount' },
        { header: 'Trạng thái hoa hồng', key: 'commission_status' },
        { header: 'Ngày ký kết', key: 'contract_date' },
      ],
      data: selectedSaleDetail.transactions.map(t => ({
        contract_code: t.contract_code || t.code,
        project_name: t.project_name || '',
        unit_code: t.unit_code || '',
        customer_name: t.customer_name || '',
        deal_value: t.deal_value || t.amount || 0,
        recognized_revenue: t.deal_value || t.amount || 0,
        sale_commission_rate: `${t.sale_commission_rate || 1.8}%`,
        sale_commission_amount: t.sale_commission_amount || 0,
        commission_status: t.first_installment_paid ? 'Đủ điều kiện ghi nhận (Đã thu đợt 1)' : 'Chờ thu tiền đợt 1',
        contract_date: t.contract_date ? new Date(t.contract_date).toLocaleDateString('vi-VN') : '',
      })),
      totals: {
        contract_code: 'TỔNG CỘNG',
        deal_value: selectedSaleDetail.totalRevenue,
        recognized_revenue: selectedSaleDetail.totalRevenue,
        sale_commission_amount: selectedSaleDetail.totalCommission,
      },
    });
  };

  const formatVND = (num: number) => {
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(2) + ' tỷ đ';
    }
    if (num >= 1000000) {
      return (num / 1000000).toFixed(0) + ' tr đ';
    }
    return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
  };

  // Check if viewing user is sale_agent to mask commissions of others
  const isSaleAgentViewing = currentUser?.role === 'sale_agent';

  // Top 3 Podium
  const top1 = leaderboardData[0];
  const top2 = leaderboardData[1];
  const top3 = leaderboardData[2];

  const getMetricDisplay = (item: LeaderboardItem) => {
    if (rankingMetric === 'contracts_count') {
      return `${item.contracts_count} HĐMB`;
    }
    if (rankingMetric === 'commission') {
      if (isSaleAgentViewing && item.id !== currentUser?.id) {
        return '****** đ';
      }
      return formatVND(item.commission);
    }
    return formatVND(item.revenue);
  };

  const getMetricLabel = () => {
    if (rankingMetric === 'contracts_count') return 'Số Hợp Đồng (HĐMB)';
    if (rankingMetric === 'commission') return 'Hoa Hồng Thực Nhận';
    return 'Doanh Số Bán Hàng';
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & BỘ LỌC ĐA NĂNG */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Trophy className="h-6 w-6 text-amber-500" />
              Bảng Thi Đua Doanh Số, HĐMB & Hoa Hồng Toàn Hệ Thống
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Thi đua thời gian thực giữa các Sàn, Trưởng phòng kinh doanh, Team và Chuyên viên tư vấn.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.location.href = '/hr'} 
              className="h-8 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 border-indigo-200"
            >
              <UserCheck className="h-3.5 w-3.5 mr-1.5 text-indigo-600" /> Hồ Sơ 360° & Cơ Cấu →
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportLeaderboard} className="h-8 text-xs font-semibold">
              <Download className="h-3.5 w-3.5 mr-1.5" /> Xuất Bảng Xếp Hạng
            </Button>
          </div>
        </div>

        {/* CÁC BỘ LỌC PHẠM VI DỰ ÁN & THỜI GIAN & CHỈ SỐ */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Lọc Dự Án & Thời Gian */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-semibold text-slate-600">Dự án:</span>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="bg-transparent font-bold text-blue-700 focus:outline-none cursor-pointer"
              >
                <option value="all">🌟 Tất cả dự án (Toàn hệ thống)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>🏢 {p.name}</option>
                ))}
              </select>
            </div>

            {/* Reusable DateRangeFilter Component */}
            <DateRangeFilter
              value={dateRange}
              onChange={(val) => updateRange(val.preset || 'custom', val.from, val.to, val.compare)}
            />

            {/* Toggle Dữ Liệu Mẫu */}
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100">
              <input
                type="checkbox"
                checked={includeSample}
                onChange={(e) => setIncludeSample(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 border-slate-300"
              />
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span className="hidden sm:inline">Dữ liệu mẫu</span>
            </label>
          </div>

          {/* CHUYỂN ĐỔI CHỈ SỐ THI ĐUA (DOANH SỐ / HĐMB / HOA HỒNG) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 px-2">Xếp hạng theo:</span>
            <button
              onClick={() => setRankingMetric('revenue')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                rankingMetric === 'revenue'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Doanh Số
            </button>
            <button
              onClick={() => setRankingMetric('contracts_count')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                rankingMetric === 'contracts_count'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Số HĐMB
            </button>
            <button
              onClick={() => setRankingMetric('commission')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                rankingMetric === 'commission'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hoa Hồng
            </button>
          </div>
        </div>

        {/* BỘ LỌC NÂNG CAO LOẠI HÌNH & TRẠNG THÁI CHO SALE AGENTS */}
        {activeTab === 'sale_agent' && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
            <span className="text-slate-500 font-semibold text-[11px]">Loại hình nhân sự:</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {EMPLOYMENT_TYPES.map(type => {
                const isSelected = selectedEmploymentTypes.includes(type.value);
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => toggleEmploymentType(type.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : `${type.badgeClass} hover:opacity-80`
                    }`}
                  >
                    <span>{type.label}</span>
                  </button>
                );
              })}
            </div>

            <span className="text-slate-400">|</span>

            <span className="text-slate-500 font-semibold text-[11px]">Trạng thái:</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {EMPLOYMENT_STATUSES.map(st => {
                const isSelected = selectedStatuses.includes(st.value);
                return (
                  <button
                    key={st.value}
                    type="button"
                    onClick={() => toggleStatus(st.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      isSelected
                        ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                        : `${st.badgeClass} hover:opacity-80`
                    }`}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. 5 TABS THI ĐUA (SÀN, TRƯỞNG PHÒNG, TEAM, SALE, TUYỂN DỤNG) */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-200/70 p-1.5 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('agency')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'agency'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Thi Đua Các Sàn</span>
        </button>

        <button
          onClick={() => setActiveTab('sales_manager')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'sales_manager'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Award className="h-4 w-4" />
          <span>Trưởng Phòng / GĐ Sàn</span>
        </button>

        <button
          onClick={() => setActiveTab('team')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'team'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Thi Đua Đội Nhóm</span>
        </button>

        <button
          onClick={() => setActiveTab('sale_agent')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'sale_agent'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UserCheck className="h-4 w-4" />
          <span>Chuyên Viên Tư Vấn</span>
        </button>

        <button
          onClick={() => setActiveTab('recruiter')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'recruiter'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span>Tuyển Dụng & Nhân Sự</span>
        </button>
      </div>

      {/* 3. BỤC VINH DANH TOP 1, 2, 3 NỔI BẬT */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : top1 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          {/* TOP 2 - HUY CHƯƠNG BẠC */}
          {top2 ? (
            <div className="bg-gradient-to-t from-slate-100 to-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center relative overflow-hidden order-2 md:order-1">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-200 text-slate-700 font-black text-sm mb-2 shadow-inner">
                🥈 2
              </div>
              <h4 className="font-bold text-slate-900 text-sm truncate">{top2.name}</h4>
              <p className="text-[11px] text-slate-500 mb-2">{top2.subtitle}</p>
              
              <div className="text-xl font-black text-slate-900">{getMetricDisplay(top2)}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{getMetricLabel()}</div>

              {top2.growth_rate !== undefined && (
                <div className={`inline-flex items-center gap-1 text-[11px] font-bold mt-2 px-2 py-0.5 rounded-full ${
                  top2.growth_rate >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
                }`}>
                  {top2.growth_rate >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {top2.growth_rate >= 0 ? `+${top2.growth_rate}%` : `${top2.growth_rate}%`} so với kỳ trước
                </div>
              )}

              {activeTab === 'agency' && (
                <button
                  onClick={() => handleOpenAgencyDetail(top2.id)}
                  className="mt-3 text-[11px] font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 block mx-auto"
                >
                  Xem hiệu suất sàn <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : <div className="hidden md:block order-1" />}

          {/* TOP 1 - HUY CHƯƠNG VÀNG QUÁN QUÂN */}
          <div className="bg-gradient-to-t from-amber-50 via-white to-amber-100/50 p-6 rounded-2xl border-2 border-amber-300 shadow-lg text-center relative overflow-hidden order-1 md:order-2 transform md:-translate-y-2">
            <div className="absolute top-2 right-2 text-amber-500/20">
              <Sparkles className="h-16 w-16" />
            </div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-400 text-amber-950 font-black text-lg mb-2 shadow-md shadow-amber-400/40">
              🥇 1
            </div>
            <div className="text-[10px] font-bold tracking-wider text-amber-800 uppercase mb-1">
              Quán Quân {getMetricLabel()}
            </div>
            <h4 className="font-black text-slate-900 text-base truncate">{top1.name}</h4>
            <p className="text-xs text-slate-500 mb-2">{top1.subtitle}</p>
            
            <div className="text-2xl font-black text-amber-600">{getMetricDisplay(top1)}</div>
            <div className="text-xs font-bold text-slate-600 mt-0.5">
              {top1.contracts_count} HĐMB • {formatVND(top1.revenue)} Doanh Số
            </div>

            {top1.growth_rate !== undefined && (
              <div className={`inline-flex items-center gap-1 text-[11px] font-black mt-2 px-2.5 py-0.5 rounded-full ${
                top1.growth_rate >= 0 ? 'text-emerald-700 bg-emerald-100 border border-emerald-300' : 'text-rose-700 bg-rose-100 border border-rose-300'
              }`}>
                {top1.growth_rate >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {top1.growth_rate >= 0 ? `+${top1.growth_rate}%` : `${top1.growth_rate}%`} so với kỳ trước
              </div>
            )}

            <div className="mt-3">
              {activeTab === 'agency' && (
                <button
                  onClick={() => handleOpenAgencyDetail(top1.id)}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 inline-flex items-center gap-1"
                >
                  Xem chi tiết hiệu suất sàn <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
              {activeTab === 'sale_agent' && (
                <button
                  onClick={() => handleOpenSaleContracts(top1.id, top1.name)}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 inline-flex items-center gap-1"
                >
                  Xem hợp đồng & hoa hồng <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* TOP 3 - HUY CHƯƠNG ĐỒNG */}
          {top3 ? (
            <div className="bg-gradient-to-t from-orange-50 to-white p-5 rounded-2xl border border-orange-200/80 shadow-sm text-center relative overflow-hidden order-3">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-amber-700/20 text-amber-800 font-black text-sm mb-2">
                🥉 3
              </div>
              <h4 className="font-bold text-slate-900 text-sm truncate">{top3.name}</h4>
              <p className="text-[11px] text-slate-500 mb-2">{top3.subtitle}</p>
              
              <div className="text-xl font-black text-slate-900">{getMetricDisplay(top3)}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{getMetricLabel()}</div>

              {top3.growth_rate !== undefined && (
                <div className={`inline-flex items-center gap-1 text-[11px] font-bold mt-2 px-2 py-0.5 rounded-full ${
                  top3.growth_rate >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
                }`}>
                  {top3.growth_rate >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {top3.growth_rate >= 0 ? `+${top3.growth_rate}%` : `${top3.growth_rate}%`} so với kỳ trước
                </div>
              )}

              {activeTab === 'agency' && (
                <button
                  onClick={() => handleOpenAgencyDetail(top3.id)}
                  className="mt-3 text-[11px] font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 block mx-auto"
                >
                  Xem hiệu suất sàn <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : <div className="hidden md:block order-3" />}
        </div>
      )}

      {/* 4. BẢNG XẾP HẠNG CHI TIẾT ĐẦY ĐỦ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
            <span>Bảng Xếp Hạng Thi Đua Đầy Đủ</span>
            <span className="text-xs font-normal text-slate-400">({leaderboardData.length} đơn vị / cá nhân)</span>
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-blue-600" />
            Đang xếp hạng theo: <strong className="text-blue-700">{getMetricLabel()}</strong>
          </div>
        </div>

        <div className="overflow-x-auto">
          {activeTab === 'recruiter' ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3 text-center w-14">Hạng</th>
                  <th className="p-3">Quản Lý Tuyển Dụng</th>
                  <th className="p-3">Chức Vụ</th>
                  <th className="p-3 text-center">Nhân Sự Tuyển Mới</th>
                  <th className="p-3 text-center">Đạt Thử Việc</th>
                  <th className="p-3 text-center">Tỷ Lệ Đạt</th>
                  <th className="p-3 text-center">Danh Hiệu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recruiters.map((rec, idx) => (
                  <tr key={rec.recruiterId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${
                        idx === 0 ? 'bg-amber-100 text-amber-800 font-black' : idx === 1 ? 'bg-slate-200 text-slate-800' : idx === 2 ? 'bg-orange-100 text-orange-800' : 'text-slate-500'
                      }`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-slate-900">{rec.recruiterName}</td>
                    <td className="p-3 text-slate-500 capitalize">{rec.recruiterRole.replace('_', ' ')}</td>
                    <td className="p-3 text-center font-bold text-blue-600">+{rec.totalRecruited} nhân sự</td>
                    <td className="p-3 text-center font-bold text-emerald-600">{rec.passedProbationCount} người</td>
                    <td className="p-3 text-center font-bold text-slate-800">{rec.passedProbationRate}%</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        idx === 0 ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {idx === 0 ? '🏆 Quán Quân Tuyển Dụng' : idx < 3 ? '⭐ Xuất Sắc' : 'Đạt Chuẩn'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3 text-center w-14">Hạng</th>
                  <th className="p-3">Đơn Vị / Nhân Sự</th>
                  <th className="p-3">Loại Hình / Nhân Số</th>
                  <th className="p-3 text-right">Tổng Doanh Số</th>
                  <th className="p-3 text-right">Năng Suất TB / Người</th>
                  <th className="p-3 text-center">Số HĐMB</th>
                  <th className="p-3 text-right">Hoa Hồng</th>
                  <th className="p-3 text-center">% Tăng Trưởng</th>
                  <th className="p-3 w-36">Tiến Độ Mục Tiêu</th>
                  <th className="p-3 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaderboardData.map((item, idx) => {
                  const empTypeObj = EMPLOYMENT_TYPES.find(t => t.value === item.employment_type);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Hạng */}
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${
                          idx === 0 
                            ? 'bg-amber-100 text-amber-800 font-black' 
                            : idx === 1 
                            ? 'bg-slate-200 text-slate-800' 
                            : idx === 2 
                            ? 'bg-orange-100 text-orange-800' 
                            : 'text-slate-500'
                        }`}>
                          {idx + 1}
                        </span>
                      </td>

                      {/* Tên */}
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{item.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{item.subtitle}</div>
                      </td>

                      {/* Loại hình hoặc Quy mô nhân sự */}
                      <td className="p-3">
                        {item.type === 'sale_agent' ? (
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${empTypeObj?.badgeClass || 'bg-slate-100 text-slate-600'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${empTypeObj?.dotClass || 'bg-slate-400'}`} />
                              {empTypeObj?.label || 'Chính thức'}
                            </span>
                          </div>
                        ) : (
                          <span className="font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            {item.member_count || 1} nhân sự
                          </span>
                        )}
                      </td>

                      {/* Doanh số */}
                      <td className="p-3 text-right">
                        <div className="font-black text-slate-900 text-sm">{formatCurrencyVND(item.revenue)}</div>
                      </td>

                      {/* Năng suất bình quân đầu người */}
                      <td className="p-3 text-right">
                        <div className="font-semibold text-slate-800">
                          {item.per_capita_revenue ? formatCurrencyVND(item.per_capita_revenue) : formatCurrencyVND(item.revenue)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {item.per_capita_contracts ? `${item.per_capita_contracts} HĐ / người` : '1 người'}
                        </div>
                      </td>

                      {/* Số HĐMB */}
                      <td className="p-3 text-center">
                        <span className="font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
                          {item.contracts_count} căn
                        </span>
                      </td>

                      {/* Hoa hồng (Bảo mật cho Sale Agent) */}
                      <td className="p-3 text-right">
                        {isSaleAgentViewing && item.id !== currentUser?.id ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium italic">
                            <Lock className="h-3 w-3 text-slate-400" /> Bảo mật
                          </span>
                        ) : (
                          <div className="font-bold text-emerald-700">{formatCurrencyVND(item.commission)}</div>
                        )}
                      </td>

                      {/* % Tăng trưởng */}
                      <td className="p-3 text-center">
                        {item.growth_rate !== undefined ? (
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            item.growth_rate >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
                          }`}>
                            {item.growth_rate >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {item.growth_rate >= 0 ? `+${item.growth_rate}%` : `${item.growth_rate}%`}
                          </span>
                        ) : (
                          <span className="text-slate-400">---</span>
                        )}
                      </td>

                      {/* Tiến độ mục tiêu */}
                      <td className="p-3">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                            <span>{item.target_progress || 0}%</span>
                            <span>10 tỷ KPI</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-1.5 rounded-full"
                              style={{ width: `${item.target_progress || 0}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Nút hành động */}
                      <td className="p-3 text-center">
                        {activeTab === 'agency' && (
                          <button
                            onClick={() => handleOpenAgencyDetail(item.id)}
                            className="px-2.5 py-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 inline-flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" /> Hiệu suất sàn
                          </button>
                        )}

                        {activeTab === 'sale_agent' && (
                          <button
                            onClick={() => handleOpenSaleContracts(item.id, item.name)}
                            className="px-2.5 py-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200 inline-flex items-center gap-1"
                          >
                            <FileCheck className="h-3 w-3" /> HĐ & Hoa hồng
                          </button>
                        )}

                        {activeTab !== 'agency' && activeTab !== 'sale_agent' && (
                          <span className="text-slate-400 text-[11px]">---</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL CHI TIẾT HIỆU SUẤT CỦA SÀN (MODULE 3) */}
      {selectedAgencyId && (
        <AgencyPerformanceModal
          agencyId={selectedAgencyId}
          projectId={selectedProjectId === 'all' ? undefined : selectedProjectId}
          isOpen={agencyModalOpen}
          onClose={() => setAgencyModalOpen(false)}
        />
      )}

      {/* MODAL DOANH SỐ VÀ HOA HỒNG CỦA SALE THEO TỪNG HỢP ĐỒNG (MODULE 4) */}
      <Modal
        isOpen={saleModalOpen}
        onClose={() => setSaleModalOpen(false)}
        title={`Chi Tiết Hợp Đồng & Hoa Hồng: ${selectedSaleDetail?.saleName || ''}`}
        description="Chi tiết từng giao dịch ký kết HĐMB, mã căn, giá trị giao dịch, % hoa hồng và đối soát thu tiền đợt 1."
        maxWidth="2xl"
      >
        {loadingSaleContracts ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-44 w-full" />
          </div>
        ) : selectedSaleDetail && (
          <div className="space-y-4">
            {/* Header Tổng hợp của Sale */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-slate-900 text-white rounded-xl">
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tổng Số HĐMB Chốt</div>
                <div className="text-xl font-black text-white">{selectedSaleDetail.transactions.length} căn</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tổng Doanh Số Đạt Được</div>
                <div className="text-lg font-black text-blue-400">{formatCurrencyVND(selectedSaleDetail.totalRevenue)}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tổng Hoa Hồng Sale Nhận</div>
                <div className="text-lg font-black text-emerald-400">{formatCurrencyVND(selectedSaleDetail.totalCommission)}</div>
              </div>
            </div>

            {/* Thanh công cụ: Lọc trạng thái & Nút Xuất Excel */}
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600">Trạng thái:</span>
                <select
                  value={saleStatusFilter}
                  onChange={(e) => {
                    const st = e.target.value;
                    setSaleStatusFilter(st);
                    loadSaleContracts(selectedSaleDetail.saleId, selectedSaleDetail.saleName, st);
                  }}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium focus:outline-none"
                >
                  <option value="all">Tất cả hợp đồng</option>
                  <option value="first_installment_paid">Đã thu tiền Đợt 1 (Đủ điều kiện ghi nhận)</option>
                  <option value="first_installment_pending">Chờ thu tiền Đợt 1</option>
                </select>
              </div>

              <Button variant="outline" size="sm" onClick={handleExportSaleContracts} className="h-8 text-xs font-bold text-slate-700">
                <Download className="h-3.5 w-3.5 mr-1.5" /> Xuất Excel Hợp Đồng
              </Button>
            </div>

            {/* Bảng từng hợp đồng */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-80">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-3">Mã HĐMB & Dự Án</th>
                    <th className="p-3">Mã Căn & Khách Hàng</th>
                    <th className="p-3 text-right">Giá Trị Giao Dịch</th>
                    <th className="p-3 text-center">% Hoa Hồng</th>
                    <th className="p-3 text-right">Hoa Hồng Sale</th>
                    <th className="p-3 text-center">Tiến Độ Đợt 1</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedSaleDetail.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">
                        Chưa có hợp đồng nào được ký kết phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    selectedSaleDetail.transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="p-3">
                          <div className="font-mono font-bold text-slate-900">{t.contract_code || t.code}</div>
                          <div className="text-[11px] text-slate-500">{t.project_name}</div>
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 text-[11px]">
                            {t.unit_code}
                          </span>
                          <div className="text-[11px] text-slate-600 mt-0.5">{t.customer_name}</div>
                        </td>
                        <td className="p-3 text-right font-bold text-slate-900">
                          {formatCurrencyVND(t.deal_value || t.amount)}
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px]">
                            {t.sale_commission_rate || 1.8}%
                          </span>
                        </td>
                        <td className="p-3 text-right font-black text-emerald-700">
                          {formatCurrencyVND(t.sale_commission_amount || 0)}
                        </td>
                        <td className="p-3 text-center">
                          {t.first_installment_paid ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Đã thu đợt 1
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <Clock className="h-3 w-3 text-amber-600" /> Chờ thu đợt 1
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {/* DÒNG TỔNG CỘNG */}
                {selectedSaleDetail.transactions.length > 0 && (
                  <tfoot className="bg-slate-50 font-black border-t-2 border-slate-200 text-xs">
                    <tr>
                      <td colSpan={2} className="p-3 text-slate-900 uppercase">
                        TỔNG CỘNG ({selectedSaleDetail.transactions.length} HĐMB)
                      </td>
                      <td className="p-3 text-right text-blue-700">
                        {formatCurrencyVND(selectedSaleDetail.totalRevenue)}
                      </td>
                      <td className="p-3 text-center text-slate-500">---</td>
                      <td className="p-3 text-right text-emerald-700">
                        {formatCurrencyVND(selectedSaleDetail.totalCommission)}
                      </td>
                      <td className="p-3 text-center text-slate-500">---</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setSaleModalOpen(false)}>
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
