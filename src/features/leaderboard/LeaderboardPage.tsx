// ========================================================
// REAL ESTATE CRM - SALES COMPETITION & LEADERBOARDS
// Bảng Thi Đua Doanh Số, HĐMB, Hoa Hồng giữa Các Sàn,
// Trưởng Phòng, Team và Sale Agents (Lọc theo Dự án & Tổng)
// ========================================================

import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Building2, 
  Users, 
  UserCheck, 
  Award, 
  TrendingUp, 
  DollarSign, 
  FileCheck, 
  ChevronRight,
  Filter,
  Sparkles,
  Eye,
  Calendar,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { contractRepository } from '@/data/repositories/contractRepository';
import { projectRepository } from '@/data/repositories/projectRepository';
import { LeaderboardItem, Project, Transaction } from '@/domain/types';
import { AgencyPerformanceModal } from '@/components/AgencyPerformanceModal';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

type CompetitionTab = 'agency' | 'sales_manager' | 'team' | 'sale_agent';

export const LeaderboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<CompetitionTab>('agency');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [projects, setProjects] = useState<Project[]>([]);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Agency Performance Drill-down Modal
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);
  const [agencyModalOpen, setAgencyModalOpen] = useState(false);

  // Sale Contract Commission Drill-down Modal
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<{
    saleId: string;
    saleName: string;
    transactions: Transaction[];
    totalRevenue: number;
    totalCommission: number;
  } | null>(null);
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [loadingSaleContracts, setLoadingSaleContracts] = useState(false);

  // Load Projects once
  useEffect(() => {
    projectRepository.getProjects().then(setProjects).catch(console.error);
  }, []);

  // Load Leaderboard when Tab or Project changes
  useEffect(() => {
    setLoading(true);
    contractRepository.getLeaderboard({
      type: activeTab,
      projectId: selectedProjectId === 'all' ? undefined : selectedProjectId,
    })
      .then(setLeaderboardData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeTab, selectedProjectId]);

  const handleOpenAgencyDetail = (agencyId: string) => {
    setSelectedAgencyId(agencyId);
    setAgencyModalOpen(true);
  };

  const handleOpenSaleContracts = async (saleId: string, saleName: string) => {
    setLoadingSaleContracts(true);
    setSaleModalOpen(true);
    try {
      const res = await contractRepository.getSaleCommissions(
        saleId,
        selectedProjectId === 'all' ? undefined : selectedProjectId
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

  const formatVND = (num: number) => {
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(2) + ' tỷ đ';
    }
    if (num >= 1000000) {
      return (num / 1000000).toFixed(0) + ' tr đ';
    }
    return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
  };

  const formatFullVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
  };

  // Top 3 Podium
  const top1 = leaderboardData[0];
  const top2 = leaderboardData[1];
  const top3 = leaderboardData[2];

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & BỘ LỌC DỰ ÁN */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Bảng Thi Đua Doanh Số & Hoa Hồng Hệ Thống
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Xếp hạng thi đua thời gian thực giữa các Sàn, Trưởng phòng kinh doanh, Team và Chuyên viên tư vấn.
          </p>
        </div>

        {/* LỌC DỰ ÁN: TỔNG VÀ TỪNG DỰ ÁN CỤ THỂ */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 shrink-0">
            <Filter className="h-3.5 w-3.5 text-slate-400" /> Phạm vi:
          </span>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-blue-50 border border-blue-200 text-blue-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">🌟 Tổng toàn hệ thống (Tất cả dự án)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>🏢 Dự án: {p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. 4 TABS THI ĐUA */}
      <div className="flex items-center gap-2 bg-slate-200/70 p-1.5 rounded-2xl w-fit">
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
          <span>Đội Nhóm Kinh Doanh</span>
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
          <span>Chuyên Viên Tư Vấn (Sale)</span>
        </button>
      </div>

      {/* 3. BỤC VINH DANH TOP 1, 2, 3 */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
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
              <p className="text-[11px] text-slate-500 mb-3">{top2.subtitle}</p>
              <div className="text-lg font-black text-slate-900">{formatVND(top2.revenue)}</div>
              <div className="text-xs font-semibold text-emerald-600 mt-0.5">
                {top2.contracts_count} HĐMB • {formatVND(top2.commission)} HH
              </div>
              {activeTab === 'agency' && (
                <button
                  onClick={() => handleOpenAgencyDetail(top2.id)}
                  className="mt-3 text-[11px] font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
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
              Quán Quân Doanh Số
            </div>
            <h4 className="font-black text-slate-900 text-base truncate">{top1.name}</h4>
            <p className="text-xs text-slate-500 mb-3">{top1.subtitle}</p>
            <div className="text-2xl font-black text-amber-600">{formatVND(top1.revenue)}</div>
            <div className="text-xs font-bold text-emerald-700 mt-1">
              {top1.contracts_count} HĐMB • {formatVND(top1.commission)} Hoa Hồng
            </div>
            {activeTab === 'agency' && (
              <button
                onClick={() => handleOpenAgencyDetail(top1.id)}
                className="mt-4 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 inline-flex items-center gap-1"
              >
                Xem chi tiết hiệu suất sàn <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
            {activeTab === 'sale_agent' && (
              <button
                onClick={() => handleOpenSaleContracts(top1.id, top1.name)}
                className="mt-4 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 inline-flex items-center gap-1"
              >
                Xem hợp đồng & hoa hồng <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* TOP 3 - HUY CHƯƠNG ĐỒNG */}
          {top3 ? (
            <div className="bg-gradient-to-t from-orange-50 to-white p-5 rounded-2xl border border-orange-200/80 shadow-sm text-center relative overflow-hidden order-3">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-amber-700/20 text-amber-800 font-black text-sm mb-2">
                🥉 3
              </div>
              <h4 className="font-bold text-slate-900 text-sm truncate">{top3.name}</h4>
              <p className="text-[11px] text-slate-500 mb-3">{top3.subtitle}</p>
              <div className="text-lg font-black text-slate-900">{formatVND(top3.revenue)}</div>
              <div className="text-xs font-semibold text-emerald-600 mt-0.5">
                {top3.contracts_count} HĐMB • {formatVND(top3.commission)} HH
              </div>
              {activeTab === 'agency' && (
                <button
                  onClick={() => handleOpenAgencyDetail(top3.id)}
                  className="mt-3 text-[11px] font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                >
                  Xem hiệu suất sàn <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : <div className="hidden md:block order-3" />}
        </div>
      )}

      {/* 4. BẢNG XẾP HẠNG CHI TIẾT ĐẦY ĐỦ */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
            <span>Bảng Xếp Hạng Thi Đua Đầy Đủ</span>
            <span className="text-xs font-normal text-slate-400">({leaderboardData.length} đơn vị/cá nhân)</span>
          </div>
          <span className="text-xs text-slate-500">
            Sắp xếp theo: <span className="font-bold text-blue-600">Doanh số ký kết (VND)</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3 text-center w-14">Hạng</th>
                <th className="p-3">Đơn Vị / Nhân Sự</th>
                <th className="p-3 text-right">Tổng Doanh Số</th>
                <th className="p-3 text-center">Số Lượng HĐMB</th>
                <th className="p-3 text-right">Tổng Hoa Hồng</th>
                <th className="p-3 w-44">Tiến Độ Mục Tiêu Thi Đua</th>
                <th className="p-3 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leaderboardData.map((item, idx) => (
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

                  {/* Doanh số */}
                  <td className="p-3 text-right">
                    <div className="font-black text-slate-900 text-sm">{formatFullVND(item.revenue)}</div>
                  </td>

                  {/* Số HĐMB */}
                  <td className="p-3 text-center">
                    <span className="font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
                      {item.contracts_count} căn
                    </span>
                  </td>

                  {/* Hoa hồng */}
                  <td className="p-3 text-right">
                    <div className="font-bold text-emerald-700">{formatFullVND(item.commission)}</div>
                  </td>

                  {/* Tiến độ mục tiêu */}
                  <td className="p-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                        <span>Đạt {item.target_progress || 0}%</span>
                        <span>Mục tiêu 10 tỷ</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full"
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CHI TIẾT HIỆU SUẤT CỦA SÀN */}
      {selectedAgencyId && (
        <AgencyPerformanceModal
          agencyId={selectedAgencyId}
          projectId={selectedProjectId === 'all' ? undefined : selectedProjectId}
          isOpen={agencyModalOpen}
          onClose={() => setAgencyModalOpen(false)}
        />
      )}

      {/* MODAL DOANH SỐ VÀ HOA HỒNG CỦA SALE THEO TỪNG HỢP ĐỒNG */}
      <Modal
        isOpen={saleModalOpen}
        onClose={() => setSaleModalOpen(false)}
        title={`Doanh Số & Hoa Hồng Theo Từng Hợp Đồng: ${selectedSaleDetail?.saleName || ''}`}
        description="Chi tiết từng giao dịch ký kết HĐMB, mã căn, giá trị giao dịch và đối soát hoa hồng thực nhận."
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
            <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <div className="text-[11px] text-slate-500 font-semibold">Tổng Số HĐMB Chốt</div>
                <div className="text-xl font-black text-slate-900">{selectedSaleDetail.transactions.length} căn</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 font-semibold">Tổng Doanh Số Đạt Được</div>
                <div className="text-xl font-black text-blue-600">{formatVND(selectedSaleDetail.totalRevenue)}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 font-semibold">Tổng Hoa Hồng Sale Nhận</div>
                <div className="text-xl font-black text-emerald-600">{formatVND(selectedSaleDetail.totalCommission)}</div>
              </div>
            </div>

            {/* Bảng từng hợp đồng */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
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
                        Chưa có hợp đồng nào được ký kết.
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
                          {formatFullVND(t.deal_value || t.amount)}
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px]">
                            {t.sale_commission_rate || 1.8}%
                          </span>
                        </td>
                        <td className="p-3 text-right font-black text-emerald-700">
                          {formatFullVND(t.sale_commission_amount || 0)}
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
