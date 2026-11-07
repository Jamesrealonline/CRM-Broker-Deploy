// ========================================================
// REAL ESTATE CRM - DASHBOARD PAGE
// Phân tích KPI, Doanh số, Phễu chuyển đổi từ DỮ LIỆU THẬT
// ========================================================

import React, { useState, useEffect } from 'react';
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
  Eye
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
  Cell 
} from 'recharts';
import { useAuthStore } from '@/app/useAuthStore';
import { dashboardRepository, DashboardKpiData } from '@/data/repositories/dashboardRepository';
import { projectRepository } from '@/data/repositories/projectRepository';
import { teamRepository } from '@/data/repositories/teamRepository';
import { Project, Agency } from '@/domain/types';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatCurrencyVND } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { AgencyPerformanceModal } from '@/components/AgencyPerformanceModal';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const [data, setData] = useState<DashboardKpiData | null>(null);
  const [loading, setLoading] = useState(true);

  // Bộ lọc
  const [projectId, setProjectId] = useState<string>('');
  const [agencyId, setAgencyId] = useState<string>('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);

  // Modal hiệu suất sàn
  const [perfAgencyId, setPerfAgencyId] = useState<string | null>(null);
  const [perfModalOpen, setPerfModalOpen] = useState(false);

  useEffect(() => {
    const loadDropdowns = async () => {
      const [pList, aList] = await Promise.all([
        projectRepository.getProjects(),
        teamRepository.getAgencies(),
      ]);
      setProjects(pList);
      setAgencies(aList);
    };
    loadDropdowns();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      setLoading(true);
      try {
        const kpi = await dashboardRepository.getDashboardKpi(
          { projectId: projectId || undefined, agencyId: agencyId || undefined },
          currentUser
        );
        setData(kpi);
      } catch (err) {
        console.error('Error fetching dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser, projectId, agencyId]);

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

        {/* Bộ lọc Dự án & Sàn */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
            <Filter className="h-3.5 w-3.5 text-blue-600" />
            <span>Lọc:</span>
          </div>

          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 font-medium text-slate-700"
          >
            <option value="">Tất cả dự án</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            value={agencyId}
            onChange={(e) => setAgencyId(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 font-medium text-slate-700"
          >
            <option value="">Tất cả sàn giao dịch</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

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
