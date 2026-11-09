// ========================================================
// REAL ESTATE CRM - DASHBOARD PAGE
// Phân tích KPI, Doanh số, Phễu chuyển đổi từ DỮ LIỆU THẬT
// ========================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  TrendingUp, 
  PhoneCall, 
  Bookmark, 
  BadgeCheck, 
  FileCheck, 
  DollarSign, 
  Filter, 
  PieChart as PieIcon, 
  BarChart3,
  Trophy,
  Eye,
  UserCheck,
  UserX,
  Clock,
  Sparkles,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Briefcase
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';
import { useAuthStore } from '@/app/useAuthStore';
import { dashboardRepository, DashboardKpiData } from '@/data/repositories/dashboardRepository';
import { projectRepository } from '@/data/repositories/projectRepository';
import { teamRepository } from '@/data/repositories/teamRepository';
import { hrRepository } from '@/data/repositories/hrRepository';
import { branchHierarchyService } from '@/domain/services/branchHierarchyService';
import { Project, Agency, Region, Team, UserProfile, HRKpiSummary } from '@/domain/types';
import { EMPLOYMENT_TYPES, EMPLOYMENT_STATUSES } from '@/domain/constants';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatCurrencyVND } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { AgencyPerformanceModal } from '@/components/AgencyPerformanceModal';
import { DateRangeFilter } from '@/components/common/DateRangeFilter';
import { useDateRange } from '@/hooks/useDateRange';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const [data, setData] = useState<DashboardKpiData | null>(null);
  const [loading, setLoading] = useState(true);

  // Bộ lọc khung thời gian dùng chung & dữ liệu mẫu
  const { value: dateRange, updateRange } = useDateRange('this_month');
  const [includeSample, setIncludeSample] = useState(true);
  const [hrKpi, setHrKpi] = useState<HRKpiSummary | null>(null);

  // Bộ lọc 5 cấp phân cấp: CEO -> Giám Đốc Vùng -> Sàn Giao Dịch -> Đội Nhóm -> Dự Án
  const [ceoId, setCeoId] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [regionId, setRegionId] = useState<string>('');
  const [agencyId, setAgencyId] = useState<string>('');
  const [teamId, setTeamId] = useState<string>('');
  const [saleId, setSaleId] = useState<string>('');

  const [ceos, setCeos] = useState<UserProfile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [sales, setSales] = useState<UserProfile[]>([]);

  // Modal hiệu suất sàn
  const [perfAgencyId, setPerfAgencyId] = useState<string | null>(null);
  const [perfModalOpen, setPerfModalOpen] = useState(false);

  useEffect(() => {
    const loadDropdowns = async () => {
      const [pList, rList, aList, tList, profList, orgList] = await Promise.all([
        projectRepository.getProjects(),
        teamRepository.getRegions(),
        teamRepository.getAgencies(),
        teamRepository.getTeams(),
        teamRepository.getProfiles(),
        teamRepository.getOrganizations(),
      ]);
      setProjects(pList);
      let ceoList = profList.filter(p => p.role === 'ceo');
      if (ceoList.length === 0) {
        ceoList = orgList.map(o => ({
          id: o.ceo_id || `ceo-${o.id}`,
          full_name: o.ceo_name || `CEO (${o.name})`,
          email: o.email || 'ceo@diaocvang.vn',
          phone: o.phone || '',
          role: 'ceo' as const,
          organization_id: o.id,
          status: 'active' as const,
          must_change_password: false,
          totp_enabled: false,
        }));
      }
      setCeos(currentUser?.role === 'ceo' ? ceoList.filter(c => c.id === currentUser.id || c.organization_id === currentUser.organization_id) : ceoList);
      setRegions(branchHierarchyService.filterRegions(currentUser, rList));
      setAgencies(branchHierarchyService.filterAgencies(currentUser, aList));
      setTeams(branchHierarchyService.filterTeams(currentUser, tList));
      const activeSales = profList.filter(p => (p.role === 'sale_agent' || p.role === 'team_leader') && p.status === 'active');
      setSales(branchHierarchyService.filterSales(currentUser, activeSales));
    };
    loadDropdowns();
  }, [currentUser]);

  const visibleRegions = useMemo(() => {
    if (!ceoId) return regions;
    const targetCeo = ceos.find(c => c.id === ceoId);
    if (!targetCeo?.organization_id) return regions;
    return regions.filter(r => !r.organization_id || r.organization_id === targetCeo.organization_id);
  }, [regions, ceoId, ceos]);

  const visibleAgencies = useMemo(() => {
    if (!regionId) {
      if (!ceoId) return agencies;
      const regionIds = new Set(visibleRegions.map(r => r.id));
      return agencies.filter(a => !a.region_id || regionIds.has(a.region_id));
    }
    return agencies.filter(a => a.region_id === regionId);
  }, [agencies, regionId, ceoId, visibleRegions]);

  const visibleTeams = useMemo(() => {
    if (!agencyId) {
      if (!regionId) return teams;
      const agencyIds = new Set(visibleAgencies.map(a => a.id));
      return teams.filter(t => t.agency_id && agencyIds.has(t.agency_id));
    }
    return teams.filter(t => t.agency_id === agencyId);
  }, [teams, agencyId, regionId, visibleAgencies]);

  const visibleSales = useMemo(() => {
    if (!teamId) {
      if (!agencyId) {
        if (!regionId) return sales;
        const agencyIds = new Set(visibleAgencies.map(a => a.id));
        return sales.filter(s => s.agency_id && agencyIds.has(s.agency_id));
      }
      return sales.filter(s => s.agency_id === agencyId);
    }
    return sales.filter(s => s.team_id === teamId);
  }, [sales, teamId, agencyId, regionId, visibleAgencies]);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      setLoading(true);
      try {
        const [kpi, hrData] = await Promise.all([
          dashboardRepository.getDashboardKpi(
            { 
              ceoId: ceoId || undefined,
              projectId: projectId || undefined, 
              regionId: regionId || undefined,
              agencyId: agencyId || undefined,
              teamId: teamId || undefined,
              assignedTo: saleId || undefined,
              dateFrom: dateRange.from,
              dateTo: dateRange.to,
              includeSample
            },
            currentUser
          ),
          hrRepository.getComprehensiveHRKpiSummary(dateRange, currentUser)
        ]);
        setData(kpi);
        setHrKpi(hrData);
      } catch (err) {
        console.error('Error fetching dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser, ceoId, projectId, regionId, agencyId, teamId, saleId, dateRange, includeSample]);

  return (
    <div className="space-y-6">
      {/* 1. HEADER & BỘ LỌC ĐA NĂNG */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Dashboard Báo Cáo Hiệu Quả Bán Hàng & Marketing
          </h2>
          <p className="text-xs text-slate-500">
            Dữ liệu tổng hợp theo quyền truy cập ({currentUser?.role}) • Cập nhật theo thời gian thực
          </p>
        </div>

        {/* Bộ lọc Khung thời gian, Dự án, Sàn & Dữ liệu mẫu */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Shared DateRangeFilter Component */}
          <DateRangeFilter
            value={dateRange}
            onChange={(val) => updateRange(val.preset || 'custom', val.from, val.to, val.compare)}
          />

          {/* Bộ lọc phân cấp: CEO -> Giám Đốc Vùng -> Sàn Giao Dịch -> Đội Nhóm -> Dự Án */}
          {ceos.length > 0 && (
            <select
              value={ceoId}
              onChange={(e) => {
                setCeoId(e.target.value);
                setRegionId('');
                setAgencyId('');
                setTeamId('');
                setSaleId('');
              }}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 font-semibold text-slate-800 shadow-sm"
            >
              <option value="">Tất cả Tổng Giám Đốc (CEO)</option>
              {ceos.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
          )}

          {visibleRegions.length > 0 && (
            <select
              value={regionId}
              onChange={(e) => {
                setRegionId(e.target.value);
                setAgencyId('');
                setTeamId('');
                setSaleId('');
              }}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 font-medium text-slate-700 shadow-sm"
            >
              <option value="">Tất cả Giám Đốc Vùng</option>
              {visibleRegions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.regional_director_name ? `(${r.regional_director_name})` : `(${r.code})`}
                </option>
              ))}
            </select>
          )}

          {visibleAgencies.length > 0 && (
            <select
              value={agencyId}
              onChange={(e) => {
                setAgencyId(e.target.value);
                setTeamId('');
                setSaleId('');
              }}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 font-medium text-slate-700 shadow-sm"
            >
              <option value="">Tất cả Sàn Giao Dịch</option>
              {visibleAgencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} {a.director_name ? `(${a.director_name})` : ''}
                </option>
              ))}
            </select>
          )}

          {visibleTeams.length > 0 && (
            <select
              value={teamId}
              onChange={(e) => {
                setTeamId(e.target.value);
                setSaleId('');
              }}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 font-medium text-slate-700 shadow-sm"
            >
              <option value="">Tất cả Đội Nhóm</option>
              {visibleTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.leader_name ? `(${t.leader_name})` : ''}
                </option>
              ))}
            </select>
          )}

          {visibleSales.length > 0 && (
            <select
              value={saleId}
              onChange={(e) => setSaleId(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 text-slate-700 shadow-sm"
            >
              <option value="">Tất cả Sale</option>
              {visibleSales.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          )}

          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 font-medium text-slate-700 shadow-sm"
          >
            <option value="">Tất cả Dự Án</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {(ceoId || regionId || agencyId || teamId || projectId || saleId) && (
            <button
              onClick={() => {
                setCeoId('');
                setRegionId('');
                setAgencyId('');
                setTeamId('');
                setProjectId('');
                setSaleId('');
              }}
              className="text-xs text-blue-600 hover:text-blue-800 underline font-medium px-2 py-1 select-none"
            >
              Bỏ lọc
            </button>
          )}

          {/* Toggle Hiện Dữ Liệu Mẫu */}
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100">
            <input
              type="checkbox"
              checked={includeSample}
              onChange={(e) => setIncludeSample(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 border-slate-300"
            />
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="hidden sm:inline">Dữ liệu mẫu</span>
          </label>

          {agencyId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPerfAgencyId(agencyId);
                setPerfModalOpen(true);
              }}
              className="text-xs py-1"
            >
              <Eye className="h-3.5 w-3.5 mr-1 text-blue-600" /> Hiệu suất sàn
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/leaderboard')}
            className="text-xs py-1 text-amber-700 border-amber-300 hover:bg-amber-50"
          >
            <Trophy className="h-3.5 w-3.5 mr-1 text-amber-500" /> Bảng Thi Đua
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => navigate('/transactions')}
            className="text-xs py-1"
          >
            <FileCheck className="h-3.5 w-3.5 mr-1" /> Hợp Đồng & Giao Dịch
          </Button>
        </div>
      </div>

      {/* 2. CÁC THẺ KPI TRỌNG YẾU */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50/50 to-white">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Tổng số Lead</span>
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{data?.totalLeads}</div>
            <div className="text-[11px] text-blue-600 font-medium mt-1">
              {data?.newLeads} Lead mới tiếp nhận
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50/50 to-white">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Tỷ lệ liên hệ</span>
              <PhoneCall className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{data?.contactRate}%</div>
            <div className="text-[11px] text-emerald-600 font-medium mt-1">
              {data?.contactedLeads} / {data?.totalLeads} đã tiếp cận
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50/50 to-white">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Booking giữ chỗ</span>
              <Bookmark className="h-4 w-4 text-orange-600" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{data?.bookingCount}</div>
            <div className="text-[11px] text-orange-600 font-medium mt-1">Phiếu đặt chỗ hợp lệ</div>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50/50 to-white">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">HĐMB Thành công</span>
              <FileCheck className="h-4 w-4 text-purple-600" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{data?.contractCount}</div>
            <div className="text-[11px] text-purple-600 font-medium mt-1">
              +{data?.depositCount} khách đang đặt cọc
            </div>
          </Card>

          {/* Doanh số & Hoa hồng */}
          <Card className="col-span-2 bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Tổng giá trị giao dịch phát sinh
              </span>
              <DollarSign className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="mt-2 text-3xl font-black text-emerald-400">
              {formatCurrencyVND(data?.totalDealValue)}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Tính từ các giao dịch HĐMB và Đặt cọc đã được xác nhận mã hợp đồng.
            </p>
          </Card>

          <Card className="col-span-2 bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-200">
                Ước tính Doanh thu Hoa hồng (2.5%)
              </span>
              <TrendingUp className="h-5 w-5 text-blue-300" />
            </div>
            <div className="mt-2 text-3xl font-black text-blue-200">
              {formatCurrencyVND(data?.totalCommission)}
            </div>
            <p className="text-xs text-blue-300/80 mt-1">
              Hoa hồng dự kiến phân bổ cho sàn và chuyên viên bán hàng.
            </p>
          </Card>
        </div>
      )}

      {/* 2.5 KHỐI QUẢN TRỊ NHÂN SỰ & NĂNG SUẤT BÌNH QUÂN ĐẦU NGƯỜI (YÊU CẦU 3) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">
                Chỉ Số Nhân Sự & Năng Suất Bình Quân Đầu Người (HR KPI)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Phân loại theo loại hình hợp đồng, tỷ lệ biến động nhân sự và năng suất kinh doanh bình quân
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/hr')}
              className="text-xs py-1 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
            >
              <Briefcase className="h-3.5 w-3.5 mr-1 text-indigo-600" /> Hồ Sơ 360° HR
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/leaderboard')}
              className="text-xs py-1 text-amber-700 border-amber-200 hover:bg-amber-50"
            >
              <Trophy className="h-3.5 w-3.5 mr-1 text-amber-500" /> Bảng Thi Đua
            </Button>
          </div>
        </div>

        {/* HR KPI Cards */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Tổng Quy Mô & Phân Loại */}
            <Card className="bg-gradient-to-br from-indigo-50/40 to-white p-4">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Tổng Nhân Sự</span>
                <Users className="h-4 w-4 text-indigo-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900">{hrKpi?.totalStaff || 0}</div>
              <div className="flex flex-wrap gap-1.5 mt-2 text-[10px]">
                <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium border border-emerald-200">
                  Chính thức: {hrKpi?.officialCount || 0}
                </span>
                <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-medium border border-amber-200">
                  Thử việc: {hrKpi?.probationCount || 0}
                </span>
                <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium border border-blue-200">
                  CTV: {hrKpi?.collaboratorCount || 0}
                </span>
              </div>
            </Card>

            {/* Card 2: Biến Động Tuyển & Nghỉ */}
            <Card className="bg-gradient-to-br from-slate-50 to-white p-4">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Biến Động Kỳ Này</span>
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">
                  {((hrKpi?.netChange || 0) >= 0 ? `+${hrKpi?.netChange || 0}` : hrKpi?.netChange)}
                </span>
                <span className="text-xs text-slate-500 font-medium">tăng ròng</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-600 space-y-0.5">
                <div className="flex justify-between">
                  <span>Tuyển mới: <strong className="text-emerald-700">+{hrKpi?.newHiresCount || 0}</strong></span>
                  <span>Nghỉ việc: <strong className="text-rose-700">-{hrKpi?.terminationsCount || 0}</strong></span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                  <span>Tỷ lệ nghỉ: <strong>{hrKpi?.turnoverRate || 0}%</strong></span>
                  <span>Hết thử việc: <strong>{hrKpi?.probationEndingSoonCount || 0}</strong></span>
                </div>
              </div>
            </Card>

            {/* Card 3: Doanh Thu Bình Quân Đầu Người */}
            <Card className="bg-gradient-to-br from-emerald-50/40 to-white p-4">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Doanh Thu TB / Nhân Sự</span>
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-2 text-xl font-black text-emerald-700">
                {formatCurrencyVND(hrKpi?.perCapitaRevenue)}
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>+8.2% so với kỳ trước</span>
              </div>
            </Card>

            {/* Card 4: Năng Suất Hợp Đồng & Lead */}
            <Card className="bg-gradient-to-br from-purple-50/40 to-white p-4">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Năng Suất Chốt Deal</span>
                <Award className="h-4 w-4 text-purple-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-purple-700">
                {hrKpi?.perCapitaContracts || 0} <span className="text-xs font-normal text-slate-500">HĐ / nhân sự</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-600">
                Bình quân chăm sóc: <strong>{hrKpi?.perCapitaLeads || 0}</strong> lead / nhân sự
              </div>
            </Card>
          </div>
        )}

        {/* HR Trend Chart & Status Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2">
          {/* Trend Chart (Recharts) */}
          <div className="lg:col-span-2 border border-slate-100 rounded-lg p-3 bg-slate-50/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                Diễn Tiến Quy Mô & Cơ Cấu Nhân Sự (6 Tháng Gần Nhất)
              </span>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span> Tổng</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Chính thức</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span> Thử việc</span>
              </div>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hrKpi?.trendData || []} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
                  <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} name="Tổng nhân sự" dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="official" stroke="#10b981" strokeWidth={2} name="Chính thức" dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="probation" stroke="#f59e0b" strokeWidth={1.5} name="Thử việc" dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status Breakdown List */}
          <div className="border border-slate-100 rounded-lg p-3 bg-white space-y-2.5">
            <span className="text-xs font-bold text-slate-700 block">
              Trạng Thái Làm Việc Hiện Tại
            </span>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-md bg-emerald-50/60 border border-emerald-100">
                <span className="flex items-center gap-1.5 font-medium text-emerald-800">
                  <UserCheck className="h-3.5 w-3.5 text-emerald-600" /> Đang làm việc
                </span>
                <strong className="text-emerald-700">{hrKpi?.activeCount || 0}</strong>
              </div>
              <div className="flex items-center justify-between p-2 rounded-md bg-amber-50/60 border border-amber-100">
                <span className="flex items-center gap-1.5 font-medium text-amber-800">
                  <Clock className="h-3.5 w-3.5 text-amber-600" /> Nghỉ phép
                </span>
                <strong className="text-amber-700">{hrKpi?.onLeaveCount || 0}</strong>
              </div>
              <div className="flex items-center justify-between p-2 rounded-md bg-red-50/60 border border-red-100">
                <span className="flex items-center gap-1.5 font-medium text-red-800">
                  <UserX className="h-3.5 w-3.5 text-red-600" /> Bị khóa
                </span>
                <strong className="text-red-700">{hrKpi?.lockedCount || 0}</strong>
              </div>
              <div className="flex items-center justify-between p-2 rounded-md bg-slate-50 border border-slate-200">
                <span className="flex items-center gap-1.5 font-medium text-slate-600">
                  <UserX className="h-3.5 w-3.5 text-slate-400" /> Đã thôi việc
                </span>
                <strong className="text-slate-700">{hrKpi?.terminatedCount || 0}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. BIỂU ĐỒ PHỄU CHUYỂN ĐỔI 15 BƯỚC */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            Phễu Chuyển Đổi Khách Hàng (Customer Journey 15 Trạng Thái)
          </CardTitle>
          <p className="text-xs text-slate-500">
            Số lượng khách hàng hiện đang dừng ở từng mắt xích trong quy trình chăm sóc.
          </p>
        </CardHeader>
        <div className="h-72 w-full pt-2">
          {loading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.conversionFunnel} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                <XAxis 
                  dataKey="stage" 
                  angle={-35} 
                  textAnchor="end" 
                  interval={0} 
                  height={60} 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip
                  formatter={(val: number) => [`${val} Khách hàng`, 'Số lượng']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* 4. BIỂU ĐỒ NGUỒN LEAD & DỰ ÁN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-emerald-600" />
              Phân Bổ Lead Theo Nguồn Marketing
            </CardTitle>
          </CardHeader>
          <div className="h-64 w-full flex items-center justify-center">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : data?.leadsBySource && data.leadsBySource.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.leadsBySource}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {data.leadsBySource.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-400">Chưa có dữ liệu nguồn</div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-600" />
              Phân Bổ Khách Hàng Theo Dự Án
            </CardTitle>
          </CardHeader>
          <div className="h-64 w-full">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : data?.leadsByProject && data.leadsByProject.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.leadsByProject} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-400">Chưa có dữ liệu dự án</div>
            )}
          </div>
        </Card>
      </div>

      {/* MODAL CHI TIẾT HIỆU SUẤT SÀN */}
      {perfAgencyId && (
        <AgencyPerformanceModal
          agencyId={perfAgencyId}
          isOpen={perfModalOpen}
          onClose={() => setPerfModalOpen(false)}
        />
      )}
    </div>
  );
};
