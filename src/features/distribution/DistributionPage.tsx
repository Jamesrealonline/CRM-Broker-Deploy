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
  Clock 
} from 'lucide-react';
import { useAuthStore } from '@/app/useAuthStore';
import { leadRepository } from '@/data/repositories/leadRepository';
import { teamRepository } from '@/data/repositories/teamRepository';
import { Lead, UserProfile } from '@/domain/types';
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

  const unassignedLeads = leads.filter(l => !l.assigned_to || l.assigned_name === 'Chưa phân bổ');

  return (
    <div className="space-y-6">
      {/* 1. HEADER & THÔNG TIN QUY TẮC */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Share2 className="h-5 w-5 text-blue-600" />
            Trung Tâm Phân Bổ Lead (Lead Distribution Pool)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Quy tắc Round Robin tự động kiểm tra: Sale đang hoạt động, đã được phân quyền dự án, chưa đạt trần giới hạn Lead (max 30-50).
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={fetchPool}>
          <RotateCw className="h-4 w-4 mr-1.5" /> Làm mới giỏ Lead
        </Button>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-amber-50/50 to-white border-amber-200">
          <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
            Lead Chờ Phân Bổ (Pool)
          </div>
          <div className="mt-2 text-3xl font-black text-amber-900">
            {unassignedLeads.length}
          </div>
          <p className="text-[11px] text-amber-700 mt-1">Cần điều phối cho Sale tiếp cận trong vòng 15 phút</p>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50/50 to-white border-blue-200">
          <div className="text-xs font-semibold text-blue-800 uppercase tracking-wider">
            Số Chuyên Viên Sẵn Sàng (Active)
          </div>
          <div className="mt-2 text-3xl font-black text-blue-900">
            {sales.length}
          </div>
          <p className="text-[11px] text-blue-700 mt-1">Đủ điều kiện nhận Lead theo dự án</p>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50/50 to-white border-emerald-200">
          <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
            Cơ Chế Phân Bổ Kích Hoạt
          </div>
          <div className="mt-2 text-lg font-bold text-emerald-900 flex items-center gap-1.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Round Robin & Atomic Locks
          </div>
          <p className="text-[11px] text-emerald-700 mt-1">Chống xung đột nhận trùng 1 Lead giữa 2 Sale</p>
        </Card>
      </div>

      {/* 3. BẢNG LEAD POOL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" />
            Giỏ Khách Hàng Chờ Điều Phối
          </CardTitle>
        </CardHeader>

        {loading ? (
          <div className="space-y-3 p-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Hiện tại không có Lead nào trong danh sách.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                  <th className="py-3 px-4">Khách Hàng</th>
                  <th className="py-3 px-4">Dự Án</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4">Chuyên Viên Hiện Tại</th>
                  <th className="py-3 px-4">Thời Gian Tiếp Nhận</th>
                  <th className="py-3 px-4 text-right">Thao Tác Phân Bổ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.slice(0, 20).map((lead) => (
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
                    <td className="py-3 px-4 text-slate-700">
                      {lead.assigned_name || (
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
                        className="text-xs py-1 px-2.5"
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
                ))}
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
    </div>
  );
};
