// ========================================================
// REAL ESTATE CRM - AGENCY PERFORMANCE MODAL
// Xem chi tiết hiệu suất Sàn: Nhân sự, Leads theo trạng thái, Doanh số, HĐMB, Hoa hồng
// Dành cho Giám đốc, Trưởng phòng kinh doanh, Team Leader & Admin
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
  X
} from 'lucide-react';
import { contractRepository } from '@/data/repositories/contractRepository';
import { AgencyPerformanceDetail, LeadStatus } from '@/domain/types';
import { JOURNEY_STAGES } from '@/domain/constants';
import { Skeleton } from '@/components/ui/Skeleton';

interface Props {
  agencyId: string;
  projectId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const AgencyPerformanceModal: React.FC<Props> = ({
  agencyId,
  projectId,
  isOpen,
  onClose,
}) => {
  const [data, setData] = useState<AgencyPerformanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'leads' | 'personnel'>('leads');

  useEffect(() => {
    if (!isOpen || !agencyId) return;
    setLoading(true);
    contractRepository.getAgencyPerformanceDetail(agencyId, projectId)
      .then(res => {
        setData(res);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [agencyId, projectId, isOpen]);

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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/30">
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
                Giám đốc sàn phụ trách: <span className="font-semibold text-slate-800">{data?.director_name || 'Đang cập nhật'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading ? (
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
                    <span className="text-xs font-semibold">Tổng Doanh Số</span>
                    <DollarSign className="h-4 w-4" />
                  </div>
                  <div className="text-xl font-black text-emerald-700">{formatVND(data.total_revenue)}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{data.total_contracts} HĐMB đã ký</div>
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
              <div className="border-b border-slate-200 flex gap-4">
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
                  Danh Sách Nhân Sự & Vai Trò ({data.total_members})
                </button>
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

              {/* NỘI DUNG TAB 2: DANH SÁCH NHÂN SỰ & VAI TRÒ */}
              {activeTab === 'personnel' && (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-3">Họ và Tên</th>
                        <th className="p-3">Vai trò / Chức danh</th>
                        <th className="p-3">Team Trực Thuộc</th>
                        <th className="p-3">Email & Điện Thoại</th>
                        <th className="p-3 text-center">Trạng Thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.members.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400">
                            Chưa có nhân sự nào được phân bổ vào sàn này.
                          </td>
                        </tr>
                      ) : (
                        data.members.map((m) => (
                          <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 font-bold text-slate-900">
                              {m.full_name}
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
                            <td className="p-3 text-slate-500 space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <Mail className="h-3 w-3 text-slate-400" />
                                <span>{m.email}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Phone className="h-3 w-3 text-slate-400" />
                                <span>{m.phone}</span>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Đang hoạt động
                              </span>
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
    </div>
  );
};
