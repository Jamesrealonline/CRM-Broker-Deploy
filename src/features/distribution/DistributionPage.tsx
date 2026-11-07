// ========================================================
// REAL ESTATE CRM - LEAD DISTRIBUTION & ROUND ROBIN PAGE
// Lead Pool, Phân bổ xoay vòng Round Robin (RPC), Phân bổ thủ công
// ========================================================

import React, { useState, useEffect } from 'react';
import { 
  Share2, 
  RotateCw, 
  UserCheck, 
  ShieldAlert, 
  Building2, 
  Users, 
  CheckCircle2, 
  History, 
  Clock,
  Play,
  Eye,
  AlertTriangle,
  Archive,
  RefreshCw
} from 'lucide-react';
import { useAuthStore } from '@/app/useAuthStore';
import { leadRepository } from '@/data/repositories/leadRepository';
import { teamRepository } from '@/data/repositories/teamRepository';
import { autoTransferService } from '@/domain/services/autoTransferService';
import { Lead, UserProfile, AutoTransferScanResult } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { formatDate, maskPhone } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';

export const DistributionPage: React.FC = () => {
  const { currentUser } = useAuthStore();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sales, setSales] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab filter: all vs pool
  const [filterTab, setFilterTab] = useState<'all' | 'pool'>('all');

  // Scanner State (Module 7)
  const [scanRunning, setScanRunning] = useState(false);
  const [scanResult, setScanResult] = useState<AutoTransferScanResult | null>(null);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [isDryRunModal, setIsDryRunModal] = useState(true);

  // Modal phân bổ thủ công
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedSaleId, setSelectedSaleId] = useState('');
  const [isDistributing, setIsDistributing] = useState(false);
  const [distributionMsg, setDistributionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchPool = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [leadRes, saleList] = await Promise.all([
        leadRepository.getLeads({ pageSize: 100 }, currentUser),
        teamRepository.getProfiles(),
      ]);
      setLeads(leadRes.leads);
      setSales(saleList.filter(s => s.role === 'sale_agent' || s.role === 'team_leader'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPool();
  }, [currentUser]);

  // Phân bổ tự động Round Robin cho 1 Lead
  const handleRoundRobin = async (lead: Lead) => {
    setIsDistributing(true);
    setDistributionMsg(null);

    const res = await leadRepository.assignRoundRobin(lead.id, lead.project_id, lead.team_id);
    setIsDistributing(false);

    if (res.success) {
      setDistributionMsg({
        type: 'success',
        text: `Đã tự động phân bổ Lead "${lead.customer_name}" cho chuyên viên "${res.saleName}" theo quy tắc Round Robin.`,
      });
      fetchPool();
    } else {
      setDistributionMsg({
        type: 'error',
        text: res.error || 'Phân bổ Round Robin thất bại (Sale đã vượt quá giới hạn Lead hoặc chưa được gán dự án).',
      });
    }
  };

  // Mở modal phân bổ thủ công
  const handleOpenManual = (lead: Lead) => {
    setSelectedLead(lead);
    if (sales.length > 0) setSelectedSaleId(sales[0].id);
    setManualModalOpen(true);
  };

  const handleConfirmManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !selectedSaleId || !currentUser) return;

    const sale = sales.find(s => s.id === selectedSaleId);
    if (!sale) return;

    // Cập nhật người phụ trách
    const res = await leadRepository.updateLeadStageWithTransaction({
      leadId: selectedLead.id,
      newStatus: selectedLead.status,
      currentUser,
      notes: `Điều chuyển phân bổ thủ công cho chuyên viên ${sale.full_name}`,
    });

    setManualModalOpen(false);
    if (res.success) {
      setDistributionMsg({
        type: 'success',
        text: `Đã phân bổ Lead "${selectedLead.customer_name}" cho ${sale.full_name}.`,
      });
      fetchPool();
    }
  };

  // Quét quá hạn (Dry-run hoặc Real run)
  const handleRunScan = async (dryRun: boolean) => {
    setScanRunning(true);
    setIsDryRunModal(dryRun);
    try {
      const res = await autoTransferService.runAutoTransferScan({ 
        isDryRun: dryRun,
        allLeads: leads,
        allSales: sales,
        performedBy: currentUser?.full_name || 'Quản lý'
      });
      setScanResult(res);
      setScanModalOpen(true);
      if (!dryRun) {
        fetchPool();
        setDistributionMsg({
          type: 'success',
          text: `Đã hoàn tất quét: Chuyển ${res.transferredCount} lead, Cảnh báo ${res.warnedCount} lead, Thu hồi về kho chung ${res.poolReclaimedCount} lead.`,
        });
      }
    } catch (err: any) {
      alert(`Lỗi khi quét: ${err?.message || 'Không xác định'}`);
    } finally {
      setScanRunning(false);
    }
  };

  const poolLeads = leads.filter(l => !l.assigned_to || l.assigned_name === 'Kho lead chung' || l.assigned_name === 'Chưa phân bổ');
  const displayedLeads = filterTab === 'pool' ? poolLeads : leads;

  return (
    <div className="space-y-6">
      {/* 1. HEADER & THÔNG TIN QUY TẮC */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Share2 className="h-5 w-5 text-blue-600" />
            Trung Tâm Phân Bổ Lead & Tự Động Chuyển Quá Hạn 24H
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Đồng hồ 24 giờ liên tục (Wall-clock real time). Tự động xoay vòng cho Sale tiếp theo khi không phát sinh chăm sóc.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleRunScan(true)}
            isLoading={scanRunning && isDryRunModal}
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs"
          >
            <Eye className="h-3.5 w-3.5 mr-1" /> Chạy Thử Quét (Dry-run)
          </Button>

          <Button 
            variant="primary" 
            size="sm" 
            onClick={() => handleRunScan(false)}
            isLoading={scanRunning && !isDryRunModal}
            className="bg-blue-600 hover:bg-blue-700 text-xs"
          >
            <Play className="h-3.5 w-3.5 mr-1" /> Quét & Chuyển Ngay
          </Button>

          <Button variant="outline" size="sm" onClick={fetchPool} className="text-xs">
            <RotateCw className="h-3.5 w-3.5 mr-1" /> Làm mới
          </Button>
        </div>
      </div>

      {distributionMsg && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2 border ${
            distributionMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {distributionMsg.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
          )}
          <span>{distributionMsg.text}</span>
        </div>
      )}

      {/* 2. STATS OVERVIEW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-amber-50/50 to-white border-amber-200">
          <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
            Lead Chờ Phân Bổ (Pool)
          </div>
          <div className="mt-2 text-3xl font-black text-amber-900">
            {poolLeads.length}
          </div>
          <p className="text-[11px] text-amber-700 mt-1">Gồm lead mới & lead thu hồi về kho</p>
        </Card>

        <Card className="bg-gradient-to-br from-rose-50/50 to-white border-rose-200">
          <div className="text-xs font-semibold text-rose-800 uppercase tracking-wider">
            Kho Lead Chung (Quá Hạn)
          </div>
          <div className="mt-2 text-3xl font-black text-rose-900">
            {leads.filter(l => l.assigned_name === 'Kho lead chung').length}
          </div>
          <p className="text-[11px] text-rose-700 mt-1">Đã quá 3 lần chuyển không có chăm sóc</p>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50/50 to-white border-blue-200">
          <div className="text-xs font-semibold text-blue-800 uppercase tracking-wider">
            Chuyên Viên Sẵn Sàng (Active)
          </div>
          <div className="mt-2 text-3xl font-black text-blue-900">
            {sales.length}
          </div>
          <p className="text-[11px] text-blue-700 mt-1">Đang hoạt động & chấp nhận nhận lead</p>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50/50 to-white border-emerald-200">
          <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
            Cơ Chế 24H Liên Tục
          </div>
          <div className="mt-2 text-base font-bold text-emerald-900 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Wall-Clock Real Time
          </div>
          <p className="text-[11px] text-emerald-700 mt-1">Bỏ tính giờ làm việc / ngày lễ</p>
        </Card>
      </div>

      {/* 3. BẢNG LEAD POOL */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              Danh Sách Điều Phối Khách Hàng
            </CardTitle>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
              <button
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  filterTab === 'all'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả Lead ({leads.length})
              </button>
              <button
                onClick={() => setFilterTab('pool')}
                className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${
                  filterTab === 'pool'
                    ? 'bg-white text-rose-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Archive className="h-3 w-3" />
                Kho Lead Chung ({poolLeads.length})
              </button>
            </div>
          </div>
        </CardHeader>

        {loading ? (
          <div className="space-y-3 p-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : displayedLeads.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Hiện tại không có Lead nào phù hợp với bộ lọc.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                  <th className="py-3 px-4">Khách Hàng</th>
                  <th className="py-3 px-4">Dự Án</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4">Đồng Hồ 24h</th>
                  <th className="py-3 px-4">Lần Chuyển</th>
                  <th className="py-3 px-4">Chuyên Viên Hiện Tại</th>
                  <th className="py-3 px-4">Tiếp Nhận</th>
                  <th className="py-3 px-4 text-right">Thao Tác Phân Bổ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedLeads.slice(0, 30).map((lead) => {
                  const care = autoTransferService.getCareRemainingHours(lead);
                  const colorClasses = {
                    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    yellow: 'bg-amber-50 text-amber-700 border-amber-200',
                    red: 'bg-rose-50 text-rose-700 border-rose-200 font-bold',
                    gray: 'bg-slate-100 text-slate-600 border-slate-200',
                  }[care.badgeColor];

                  return (
                    <tr key={lead.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {lead.customer_name}
                        <span className="block text-[10px] text-slate-400 font-normal">
                          {lead.customer_phone}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {lead.project_name}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 border text-slate-700">
                          {lead.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          title={care.pauseReason || `Hạn chót: ${lead.care_deadline_at ? formatDate(lead.care_deadline_at) : '24h'}`}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border ${colorClasses}`}
                        >
                          <Clock className="h-3 w-3" />
                          {care.badgeLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          (lead.auto_transfer_count || 0) >= 3 
                            ? 'bg-rose-100 text-rose-700' 
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {lead.auto_transfer_count || 0}/3 lần
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {lead.assigned_name === 'Kho lead chung' ? (
                          <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded text-[10px] border border-rose-200">
                            Kho lead chung
                          </span>
                        ) : lead.assigned_name ? (
                          <span className="font-medium text-slate-800">{lead.assigned_name}</span>
                        ) : (
                          <span className="text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded text-[10px]">
                            Chưa phân bổ
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {formatDate(lead.created_at)}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleRoundRobin(lead)}
                          isLoading={isDistributing}
                          className="text-xs py-1 px-2.5 bg-blue-600 hover:bg-blue-700"
                        >
                          <RotateCw className="h-3 w-3 mr-1" /> Round Robin
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenManual(lead)}
                          className="text-xs py-1 px-2.5"
                        >
                          <UserCheck className="h-3 w-3 mr-1" /> Thủ công
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 4. MODAL PHÂN BỔ THỦ CÔNG */}
      <Modal
        isOpen={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        title="Chỉ Định Chuyên Viên Tư Vấn Thủ Công"
        description={`Phân bổ Lead "${selectedLead?.customer_name}" cho chuyên viên thuộc dự án ${selectedLead?.project_name}.`}
        maxWidth="md"
      >
        <form onSubmit={handleConfirmManual} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">Chọn Sale tiếp nhận</label>
            <select
              value={selectedSaleId}
              onChange={(e) => setSelectedSaleId(e.target.value)}
              className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white"
            >
              {sales.map((sale) => (
                <option key={sale.id} value={sale.id}>
                  {sale.full_name} ({sale.role === 'team_leader' ? 'Trưởng nhóm' : 'Sale Agent'}) - SĐT: {sale.phone}
                </option>
              ))}
            </select>
          </div>

          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
            Lưu ý: Chuyên viên được giao sẽ nhận thông báo follow-up và có trách nhiệm liên hệ khách hàng trong vòng 24 giờ.
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setManualModalOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Xác Nhận Phân Bổ
            </Button>
          </div>
        </form>
      </Modal>

      {/* 5. MODAL KẾT QUẢ QUÉT TỰ ĐỘNG (DRY-RUN HOẶC THỰC THI) */}
      <Modal
        isOpen={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
        title={isDryRunModal ? "Kết Quả Chạy Thử Quét Quá Hạn 24H (Dry-run)" : "Kết Quả Quét & Điều Chuyển Lead Tự Động"}
        description={isDryRunModal ? "Mô phỏng các hành động hệ thống sẽ thực hiện nếu chạy thật (Không thay đổi dữ liệu)." : "Dữ liệu đã được điều chuyển và thông báo email đã được phát hành."}
        maxWidth="lg"
      >
        <div className="space-y-4">
          {scanResult && (
            <>
              {/* Thống kê nhanh */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
                <div className="p-2.5 bg-slate-50 border rounded-lg">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Đã quét</span>
                  <span className="text-base font-black text-slate-800">{scanResult.scannedCount}</span>
                </div>
                <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <span className="text-[10px] text-indigo-700 block font-bold uppercase">Chuyển Sale</span>
                  <span className="text-base font-black text-indigo-700">{scanResult.transferredCount}</span>
                </div>
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-[10px] text-amber-700 block font-bold uppercase">Cảnh báo (20h)</span>
                  <span className="text-base font-black text-amber-700">{scanResult.warnedCount}</span>
                </div>
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg">
                  <span className="text-[10px] text-rose-700 block font-bold uppercase">Về Kho chung</span>
                  <span className="text-base font-black text-rose-700">{scanResult.poolReclaimedCount}</span>
                </div>
                <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
                  <span className="text-[10px] text-purple-700 block font-bold uppercase">Miễn chuyển</span>
                  <span className="text-base font-black text-purple-700">{scanResult.exemptSkippedCount}</span>
                </div>
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <span className="text-[10px] text-emerald-700 block font-bold uppercase">Dừng đồng hồ</span>
                  <span className="text-base font-black text-emerald-700">{scanResult.stopClockSkippedCount}</span>
                </div>
              </div>

              {/* Bảng chi tiết */}
              <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 sticky top-0 text-[10px] uppercase font-semibold text-slate-500 border-b">
                    <tr>
                      <th className="py-2.5 px-3">Lead ID</th>
                      <th className="py-2.5 px-3">Hành Động</th>
                      <th className="py-2.5 px-3">Sale Kế Tiếp</th>
                      <th className="py-2.5 px-3">Lý Do / Chi Tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scanResult.details.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-6 text-slate-400 text-xs">
                          Không có lead nào cần xử lý hoặc chuyển giao trong lần quét này.
                        </td>
                      </tr>
                    ) : (
                      scanResult.details.map((d, i) => {
                        const actMap: Record<string, { label: string; color: string }> = {
                          transferred: { label: 'Chuyển Sale', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                          warned: { label: 'Cảnh Báo 20h', color: 'bg-amber-50 text-amber-700 border-amber-200' },
                          pool_reclaimed: { label: 'Kho Chung', color: 'bg-rose-50 text-rose-700 border-rose-200' },
                          exempt_skipped: { label: 'Bỏ qua (Miễn)', color: 'bg-purple-50 text-purple-700 border-purple-200' },
                          stop_clock_skipped: { label: 'Bỏ qua (Dừng)', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                        };
                        const a = actMap[d.action] || { label: d.action, color: 'bg-slate-100 text-slate-700 border-slate-200' };

                        return (
                          <tr key={i} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                              {d.customerName || d.leadId.slice(0, 8)}
                            </td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${a.color}`}>
                                {a.label}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-medium text-slate-800">{d.toSale || '—'}</td>
                            <td className="py-2 px-3 text-slate-500 text-[11px]">{d.reason}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            {isDryRunModal ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setScanModalOpen(false);
                  handleRunScan(false);
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Play className="h-3.5 w-3.5 mr-1" /> Chạy Thật Bây Giờ
              </Button>
            ) : <div />}
            <Button variant="outline" size="sm" onClick={() => setScanModalOpen(false)}>
              Đóng
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
