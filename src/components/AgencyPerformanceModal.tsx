// ========================================================
// REAL ESTATE CRM - AGENCY PERFORMANCE MODAL (MODULE 3)
// Xem chi tiết hiệu suất Sàn: Phân quyền RBAC, Nhân sự & Doanh số cá nhân,
// Leads theo trạng thái chăm sóc, Doanh số, HĐMB, Hoa hồng Sàn & Drill-down
// ========================================================

import React, { useEffect, useState } from 'react';
import { 
  Building2, 
  Users, 
  FileText, 
  DollarSign, 
  Award, 
  TrendingUp, 
  Phone, 
  Mail, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  Filter,
  X,
  ExternalLink,
  ShieldAlert,
  Download,
  Calendar
} from 'lucide-react';
import { contractRepository } from '@/data/repositories/contractRepository';
import { projectRepository } from '@/data/repositories/projectRepository';
import { financialCalculationService, TimeRangeFilter } from '@/domain/services/financialCalculationService';
import { AgencyPerformanceDetail, LeadStatus, Project, Transaction } from '@/domain/types';
import { JOURNEY_STAGES } from '@/domain/constants';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/app/useAuthStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { exportToExcel } from '@/lib/exportExcel';
import { formatCurrencyVND } from '@/lib/utils';

interface Props {
  agencyId: string;
  projectId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const AgencyPerformanceModal: React.FC<Props> = ({
  agencyId,
  projectId: initialProjectId,
  isOpen,
  onClose,
}) => {
  const { currentUser } = useAuthStore();
  const [data, setData] = useState<AgencyPerformanceDetail | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'leads' | 'personnel'>('leads');

  // Filters
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || 'all');
  const [selectedTimePreset, setSelectedTimePreset] = useState<'all' | 'week' | 'month' | 'quarter'>('all');

  // Drilldown Sale detail modal (Module 4)
  const [drilldownSale, setDrilldownSale] = useState<{
    saleId: string;
    saleName: string;
    transactions: Transaction[];
    totalRevenue: number;
    totalCommission: number;
  } | null>(null);
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownStatusFilter, setDrilldownStatusFilter] = useState<string>('all');

  // Load project list
  useEffect(() => {
    projectRepository.getProjects().then(setProjects).catch(console.error);
  }, []);

  // Check RBAC permission
  const hasAccess = currentUser ? financialCalculationService.canAccessAgency(currentUser, agencyId) : false;

  const loadData = () => {
    if (!isOpen || !agencyId || !hasAccess) return;
    setLoading(true);

    const timeFilter: TimeRangeFilter = { preset: selectedTimePreset };
    const pId = selectedProjectId === 'all' ? undefined : selectedProjectId;

    contractRepository.getAgencyPerformanceDetail(agencyId, pId, timeFilter)
      .then(res => setData(res))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [agencyId, selectedProjectId, selectedTimePreset, isOpen, hasAccess]);

  if (!isOpen) return null;

  const formatVND = (num: number) => {
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(2) + ' tỷ đ';
    }
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + ' tr đ';
    }
    return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Quản Trị Viên';
      case 'director': return 'Tổng Giám Đốc';
      case 'sales_manager': return 'Giám Đốc Sàn';
      case 'team_leader': return 'Trưởng Nhóm (Leader)';
      case 'sale_agent': return 'Chuyên Viên Tư Vấn';
      case 'marketing_manager': return 'Marketing Manager';
      default: return role;
    }
  };

  // Drilldown handler for clicking a staff member
  const handleDrilldownPersonnel = async (memberId: string, memberName: string) => {
    setDrilldownSale({
      saleId: memberId,
      saleName: memberName,
      transactions: [],
      totalRevenue: 0,
      totalCommission: 0,
    });
    setDrilldownOpen(true);
    setDrilldownLoading(true);

    try {
      const pId = selectedProjectId === 'all' ? undefined : selectedProjectId;
      const res = await contractRepository.getSaleCommissions(
        memberId,
        pId,
        { preset: selectedTimePreset },
        drilldownStatusFilter
      );
      setDrilldownSale({
        saleId: memberId,
        saleName: memberName,
        transactions: res.transactions,
        totalRevenue: res.totalRevenue,
        totalCommission: res.totalCommission,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setDrilldownLoading(false);
    }
  };

  // Export personnel table to Excel
  const handleExportPersonnel = () => {
    if (!data) return;
    exportToExcel({
      filename: `Hieu_Suat_Nhan_Su_${data.agency_code}_${new Date().toISOString().slice(0, 10)}`,
      title: `BÁO CÁO HIỆU SUẤT NHÂN SỰ - ${data.agency_name}`,
      metadata: {
        'Mã sàn': data.agency_code,
        'Giám đốc sàn': data.director_name || 'Đang cập nhật',
        'Tổng nhân sự': data.total_members,
        'Dự án': selectedProjectId === 'all' ? 'Tất cả dự án' : (projects.find(p => p.id === selectedProjectId)?.name || selectedProjectId),
        'Khoảng thời gian': selectedTimePreset === 'week' ? 'Tuần này' : selectedTimePreset === 'month' ? 'Tháng này' : selectedTimePreset === 'quarter' ? 'Quý này' : 'Toàn thời gian',
        'Thời gian xuất': new Date().toLocaleString('vi-VN'),
      },
      columns: [
        { header: 'Họ và Tên', key: 'full_name' },
        { header: 'Vai trò', key: 'role_name' },
        { header: 'Team trực thuộc', key: 'team_name' },
        { header: 'Email', key: 'email' },
        { header: 'Điện thoại', key: 'phone' },
        { header: 'Số HĐMB chốt', key: 'contracts_count' },
        { header: 'Doanh số cá nhân (VNĐ)', key: 'personal_revenue' },
        { header: 'Hoa hồng cá nhân (VNĐ)', key: 'personal_commission' },
      ],
      data: data.members.map(m => ({
        full_name: m.full_name,
        role_name: getRoleLabel(m.role),
        team_name: m.team_name || 'Sàn',
        email: m.email,
        phone: m.phone,
        contracts_count: m.contracts_count || 0,
        personal_revenue: m.personal_revenue || 0,
        personal_commission: m.personal_commission || 0,
      })),
      totals: {
        full_name: 'TỔNG CỘNG',
        contracts_count: data.total_contracts,
        personal_revenue: data.total_revenue,
        personal_commission: data.total_commission,
      },
    });
  };

  // Export drilldown sale contracts to Excel
  const handleExportSaleContracts = () => {
    if (!drilldownSale) return;
    exportToExcel({
      filename: `Hop_Dong_Sale_${drilldownSale.saleName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`,
      title: `BẢNG CHI TIẾT HỢP ĐỒNG & HOA HỒNG: ${drilldownSale.saleName}`,
      metadata: {
        'Chuyên viên': drilldownSale.saleName,
        'Tổng số HĐMB': drilldownSale.transactions.length,
        'Tổng doanh số': formatCurrencyVND(drilldownSale.totalRevenue),
        'Tổng hoa hồng': formatCurrencyVND(drilldownSale.totalCommission),
        'Thời gian xuất': new Date().toLocaleString('vi-VN'),
      },
      columns: [
        { header: 'Mã HĐMB', key: 'contract_code' },
        { header: 'Dự án', key: 'project_name' },
        { header: 'Mã căn', key: 'unit_code' },
        { header: 'Khách hàng', key: 'customer_name' },
        { header: 'Giá trị giao dịch (VNĐ)', key: 'deal_value' },
        { header: '% Hoa hồng áp dụng', key: 'sale_commission_rate' },
        { header: 'Hoa hồng nhận được (VNĐ)', key: 'sale_commission_amount' },
        { header: 'Tiến độ Đợt 1', key: 'installment_status' },
        { header: 'Ngày ký', key: 'contract_date' },
      ],
      data: drilldownSale.transactions.map(t => ({
        contract_code: t.contract_code || t.code,
        project_name: t.project_name || '',
        unit_code: t.unit_code || '',
        customer_name: t.customer_name || '',
        deal_value: t.deal_value || t.amount || 0,
        sale_commission_rate: `${t.sale_commission_rate || 1.8}%`,
        sale_commission_amount: t.sale_commission_amount || 0,
        installment_status: t.first_installment_paid ? 'Đã thanh toán đợt 1' : 'Chờ đóng tiền đợt 1',
        contract_date: t.contract_date ? new Date(t.contract_date).toLocaleDateString('vi-VN') : '',
      })),
      totals: {
        contract_code: 'TỔNG CỘNG',
        deal_value: drilldownSale.totalRevenue,
        sale_commission_amount: drilldownSale.totalCommission,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/30 shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">{data?.agency_name || 'Chi Tiết Hiệu Suất Sàn Giao Dịch'}</h3>
                {data && (
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
                    {data.agency_code}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Giám đốc sàn: <span className="font-semibold text-slate-800">{data?.director_name || 'Đang cập nhật'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Bộ lọc Dự án */}
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none"
            >
              <option value="all">Tất cả dự án</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* Bộ lọc Thời gian */}
            <select
              value={selectedTimePreset}
              onChange={(e) => setSelectedTimePreset(e.target.value as any)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none"
            >
              <option value="all">Toàn thời gian</option>
              <option value="week">Tuần này</option>
              <option value="month">Tháng này</option>
              <option value="quarter">Quý này</option>
            </select>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors ml-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* KIỂM TRA PHÂN QUYỀN RBAC */}
          {!hasAccess ? (
            <div className="p-8 text-center bg-rose-50/50 rounded-2xl border border-rose-200 max-w-lg mx-auto my-6 space-y-3">
              <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto" />
              <h4 className="text-base font-bold text-rose-900">Từ Chối Quyền Truy Cập Hiệu Suất Sàn</h4>
              <p className="text-xs text-rose-700 leading-relaxed">
                Theo quy định bảo mật hệ thống, chỉ các vai trò <strong>Giám Đốc</strong>, <strong>Trưởng Phòng</strong>, <strong>Team Leader</strong> và <strong>Quản Trị Viên</strong> mới được quyền truy cập hiệu suất chi tiết của sàn giao dịch trong phạm vi quản lý.
              </p>
              <div className="pt-2">
                <Button variant="outline" size="sm" onClick={onClose}>
                  Đóng cửa sổ
                </Button>
              </div>
            </div>
          ) : loading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
              <Skeleton className="h-64 rounded-xl" />
            </div>
          ) : data ? (
            <>
              {/* 4 THẺ CHỈ SỐ NỔI BẬT */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 bg-gradient-to-br from-blue-50 to-white rounded-xl border border-blue-100 shadow-sm">
                  <div className="flex items-center justify-between text-blue-600 mb-1">
                    <span className="text-xs font-semibold">Tổng Nhân Sự</span>
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">{data.total_members}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">nhân sự hoạt động</div>
                </div>

                <div className="p-4 bg-gradient-to-br from-indigo-50 to-white rounded-xl border border-indigo-100 shadow-sm">
                  <div className="flex items-center justify-between text-indigo-600 mb-1">
                    <span className="text-xs font-semibold">Leads Đang Chăm Sóc</span>
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">{data.total_leads}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">khách hàng trong funnel</div>
                </div>

                <div className="p-4 bg-gradient-to-br from-emerald-50 to-white rounded-xl border border-emerald-100 shadow-sm">
                  <div className="flex items-center justify-between text-emerald-600 mb-1">
                    <span className="text-xs font-semibold">Tổng Doanh Số Sàn</span>
                    <DollarSign className="h-4 w-4" />
                  </div>
                  <div className="text-xl font-black text-emerald-700">{formatVND(data.total_revenue)}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{data.total_contracts} HĐMB đã chốt</div>
                </div>

                <div className="p-4 bg-gradient-to-br from-amber-50 to-white rounded-xl border border-amber-100 shadow-sm">
                  <div className="flex items-center justify-between text-amber-600 mb-1">
                    <span className="text-xs font-semibold">Tổng Hoa Hồng Sàn</span>
                    <Award className="h-4 w-4" />
                  </div>
                  <div className="text-xl font-black text-amber-700">{formatVND(data.total_commission)}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">thực nhận từ chủ đầu tư</div>
                </div>
              </div>

              {/* TABS CHUYỂN ĐỔI: LEADS THEO TRẠNG THÁI VS DANH SÁCH NHÂN SỰ */}
              <div className="border-b border-slate-200 flex items-center justify-between">
                <div className="flex gap-4">
                  <button
                    onClick={() => setActiveTab('leads')}
                    className={`pb-2.5 text-xs font-bold transition-colors border-b-2 ${
                      activeTab === 'leads'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Phân Bổ Leads Theo Tình Trạng Chăm Sóc ({data.total_leads})
                  </button>
                  <button
                    onClick={() => setActiveTab('personnel')}
                    className={`pb-2.5 text-xs font-bold transition-colors border-b-2 ${
                      activeTab === 'personnel'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Danh Sách Nhân Sự & Doanh Số Cá Nhân ({data.total_members})
                  </button>
                </div>

                {activeTab === 'personnel' && (
                  <Button variant="outline" size="sm" onClick={handleExportPersonnel} className="h-7 text-xs mb-1">
                    <Download className="h-3.5 w-3.5 mr-1" /> Xuất Excel
                  </Button>
                )}
              </div>

              {/* NỘI DUNG TAB 1: PHÂN BỔ LEADS THEO TRẠNG THÁI */}
              {activeTab === 'leads' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {JOURNEY_STAGES.map(stage => {
                      const count = data.lead_status_counts[stage.id as LeadStatus] || 0;
                      return (
                        <div
                          key={stage.id}
                          className="p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-all flex flex-col justify-between"
                        >
                          <div className="text-[11px] font-semibold text-slate-600 mb-2 truncate">
                            {stage.label}
                          </div>
                          <div className="flex items-baseline justify-between">
                            <span className="text-lg font-black text-slate-900">{count}</span>
                            <span 
                              className="w-2.5 h-2.5 rounded-full" 
                              style={{ backgroundColor: stage.color }} 
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Thanh trực quan Conversion Pipeline */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Tỷ trọng giai đoạn Pipeline khách hàng</span>
                      <span>100% Leads</span>
                    </div>
                    <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden flex">
                      {JOURNEY_STAGES.map(stage => {
                        const count = data.lead_status_counts[stage.id as LeadStatus] || 0;
                        const pct = data.total_leads > 0 ? (count / data.total_leads) * 100 : 0;
                        if (pct <= 0) return null;
                        return (
                          <div
                            key={stage.id}
                            style={{ width: `${pct}%`, backgroundColor: stage.color }}
                            title={`${stage.label}: ${count} (${pct.toFixed(1)}%)`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* NỘI DUNG TAB 2: DANH SÁCH NHÂN SỰ & DOANH SỐ CÁ NHÂN (CÓ DRILL-DOWN) */}
              {activeTab === 'personnel' && (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-3">Họ và Tên</th>
                        <th className="p-3">Vai trò</th>
                        <th className="p-3">Team Trực Thuộc</th>
                        <th className="p-3 text-right">Doanh Số Cá Nhân</th>
                        <th className="p-3 text-center">HĐMB</th>
                        <th className="p-3 text-right">Hoa Hồng</th>
                        <th className="p-3 text-center">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.members.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slate-400">
                            Chưa có nhân sự nào được phân bổ vào sàn này.
                          </td>
                        </tr>
                      ) : (
                        data.members.map((m) => (
                          <tr key={m.id} className="hover:bg-blue-50/40 transition-colors">
                            <td className="p-3 font-bold text-slate-900">
                              <button
                                type="button"
                                onClick={() => handleDrilldownPersonnel(m.id, m.full_name)}
                                className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-bold"
                              >
                                {m.full_name}
                                <ExternalLink className="h-3 w-3 inline text-slate-400" />
                              </button>
                              <div className="text-[10px] text-slate-400 font-normal">{m.email}</div>
                            </td>
                            <td className="p-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                                m.role === 'sales_manager' || m.role === 'director'
                                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                  : m.role === 'team_leader'
                                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                  : 'bg-blue-100 text-blue-700 border border-blue-200'
                              }`}>
                                {getRoleLabel(m.role)}
                              </span>
                            </td>
                            <td className="p-3 text-slate-600 font-medium">
                              {m.team_name || 'Trực thuộc Sàn'}
                            </td>
                            <td className="p-3 text-right font-black text-slate-900">
                              {formatVND(m.personal_revenue || 0)}
                            </td>
                            <td className="p-3 text-center font-bold text-slate-700">
                              {m.contracts_count || 0}
                            </td>
                            <td className="p-3 text-right font-bold text-emerald-700">
                              {formatVND(m.personal_commission || 0)}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleDrilldownPersonnel(m.id, m.full_name)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                              >
                                Xem Hợp Đồng
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="p-8 text-center text-slate-500">
              Không thể tải thông tin hiệu suất sàn.
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* DRILL-DOWN MODAL: DOANH SỐ & HOA HỒNG CHI TIẾT TỪNG HỢP ĐỒNG CỦA NHÂN SỰ (MODULE 4) */}
      <Modal
        isOpen={drilldownOpen}
        onClose={() => setDrilldownOpen(false)}
        title={`Hiệu Suất Cá Nhân & Danh Sách Hợp Đồng: ${drilldownSale?.saleName || ''}`}
        description="Chi tiết từng hợp đồng ký kết, mã căn, giá trị giao dịch, % hoa hồng và đối soát thu tiền đợt 1."
        maxWidth="2xl"
      >
        {drilldownLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-44 w-full" />
          </div>
        ) : drilldownSale && (
          <div className="space-y-4">
            {/* Header Thống kê cá nhân */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <div className="text-[11px] text-slate-500 font-semibold">Tổng Số HĐMB</div>
                <div className="text-xl font-black text-slate-900">{drilldownSale.transactions.length} căn</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 font-semibold">Tổng Doanh Số Đạt Được</div>
                <div className="text-xl font-black text-blue-600">{formatVND(drilldownSale.totalRevenue)}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 font-semibold">Tổng Hoa Hồng Sale</div>
                <div className="text-xl font-black text-emerald-600">{formatVND(drilldownSale.totalCommission)}</div>
              </div>
            </div>

            {/* Thanh công cụ: Xuất Excel */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Danh sách chi tiết {drilldownSale.transactions.length} hợp đồng
              </span>
              <Button variant="outline" size="sm" onClick={handleExportSaleContracts} className="h-7 text-xs">
                <Download className="h-3.5 w-3.5 mr-1" /> Xuất Excel
              </Button>
            </div>

            {/* Bảng chi tiết từng hợp đồng */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-80">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-3">Mã HĐMB & Dự Án</th>
                    <th className="p-3">Mã Căn & Khách Hàng</th>
                    <th className="p-3 text-right">Giá Trị Giao Dịch</th>
                    <th className="p-3 text-center">% Hoa Hồng</th>
                    <th className="p-3 text-right">Hoa Hồng Nhận</th>
                    <th className="p-3 text-center">Tiến Độ Đợt 1</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {drilldownSale.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">
                        Chưa có hợp đồng nào được ghi nhận cho chuyên viên này trong kỳ đã chọn.
                      </td>
                    </tr>
                  ) : (
                    drilldownSale.transactions.map((t) => (
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
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setDrilldownOpen(false)}>
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
