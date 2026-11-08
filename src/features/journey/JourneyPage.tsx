// ========================================================
// REAL ESTATE CRM - CUSTOMER JOURNEY KANBAN (15 TRẠNG THÁI)
// Kéo thả dnd-kit, Form xác nhận giao dịch bắt buộc (Booking/Cọc/HĐMB)
// ========================================================

import React, { useState, useEffect } from 'react';
import { 
  DndContext, 
  DragEndEvent, 
  DragOverlay, 
  DragStartEvent, 
  useSensor, 
  useSensors, 
  PointerSensor,
  useDroppable
} from '@dnd-kit/core';
import { useNavigate } from 'react-router-dom';
import { 
  GitCommit, 
  Building2, 
  Phone, 
  DollarSign, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink 
} from 'lucide-react';
import { useAuthStore } from '@/app/useAuthStore';
import { leadRepository } from '@/data/repositories/leadRepository';
import { projectRepository } from '@/data/repositories/projectRepository';
import { Lead, LeadStatus, Project } from '@/domain/types';
import { JOURNEY_STAGES } from '@/domain/constants';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatCurrencyVND, maskPhone } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';

// Droppable Column Component
const KanbanColumn: React.FC<{
  stage: typeof JOURNEY_STAGES[0];
  leads: Lead[];
  onCardClick: (leadId: string) => void;
  isMarketing: boolean;
}> = ({ stage, leads, onCardClick, isMarketing }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col flex-shrink-0 w-72 rounded-xl border bg-slate-50/70 p-3 transition-colors ${
        isOver ? 'border-blue-500 bg-blue-50/40' : stage.borderColor
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/80">
        <div className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${stage.color.replace('text-', 'bg-')}`}></span>
          <h3 className="text-xs font-bold text-slate-800 truncate max-w-[170px]">{stage.label}</h3>
        </div>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
          {leads.length}
        </span>
      </div>

      {/* Cards Scroll Area */}
      <div className="flex-1 space-y-2.5 overflow-y-auto min-h-[420px] max-h-[calc(100vh-280px)] pr-1">
        {leads.map((lead) => (
          <div
            key={lead.id}
            onClick={() => onCardClick(lead.id)}
            className="group relative rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md hover:border-blue-400 transition-all cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-start justify-between gap-1 mb-1.5">
              <span className="text-xs font-bold text-slate-900 group-hover:text-blue-600 truncate">
                {lead.customer_name}
              </span>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                {lead.lead_score}đ
              </span>
            </div>

            <div className="text-[11px] text-slate-500 space-y-1">
              <div className="flex items-center gap-1 truncate text-slate-700">
                <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                <span className="truncate">{lead.project_name}</span>
              </div>
              <div className="flex items-center gap-1 text-slate-500">
                <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                <span>{isMarketing ? maskPhone(lead.customer_phone) : lead.customer_phone}</span>
              </div>
              <div className="text-[10px] text-blue-700 font-medium">
                Ngân sách: {formatCurrencyVND(lead.budget_min)}
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
              <span className="truncate max-w-[120px]">{lead.assigned_name || 'Chưa phân'}</span>
              <span className="flex items-center gap-0.5 text-blue-600 group-hover:underline">
                Xem <ExternalLink className="h-2.5 w-2.5" />
              </span>
            </div>
          </div>
        ))}
        {leads.length === 0 && (
          <div className="h-24 flex items-center justify-center border border-dashed border-slate-200 rounded-lg text-[11px] text-slate-400">
            Thả Lead vào đây
          </div>
        )}
      </div>
    </div>
  );
};

export const JourneyPage: React.FC = () => {
  const { currentUser } = useAuthStore();
  const navigate = useNavigate();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Drag and drop state
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  // Form xác nhận giao dịch bắt buộc
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [pendingDrop, setPendingDrop] = useState<{ leadId: string; targetStage: LeadStatus } | null>(null);
  const [txCode, setTxCode] = useState('');
  const [txAmount, setTxAmount] = useState('50000000');
  const [unitCode, setUnitCode] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
  const [txNotes, setTxNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  useEffect(() => {
    projectRepository.getProjects().then((list) => {
      setProjects(list);
    });
  }, []);

  const fetchLeads = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const res = await leadRepository.getLeads(
        { projectId: selectedProjectId || undefined, pageSize: 200 },
        currentUser
      );
      setLeads(res.leads);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [currentUser, selectedProjectId]);

  const handleDragStart = (event: DragStartEvent) => {
    const leadId = event.active.id as string;
    const found = leads.find((l) => l.id === leadId);
    if (found) setActiveLead(found);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveLead(null);
    if (!over) return;

    const leadId = active.id as string;
    const targetStage = over.id as LeadStatus;
    const currentLead = leads.find((l) => l.id === leadId);

    if (!currentLead || currentLead.status === targetStage) return;

    // QUY TẮC BẮT BUỘC: Nếu kéo vào Booking, Đặt cọc, HĐMB -> BẬT MODAL NHẬP GIAO DỊCH
    if (['booking', 'deposit', 'contract'].includes(targetStage)) {
      setPendingDrop({ leadId, targetStage });
      setUnitCode('');
      if (targetStage === 'booking') {
        setTxCode(`BK-${Date.now().toString().slice(-6)}`);
        setTxAmount('50000000');
      } else if (targetStage === 'deposit') {
        setTxCode(`DC-${Date.now().toString().slice(-6)}`);
        setTxAmount('100000000');
      } else if (targetStage === 'contract') {
        setTxCode(`HDMB-2026-${Date.now().toString().slice(-4)}`);
        setTxAmount('3200000000');
      }
      setErrorMsg(null);
      setTxModalOpen(true);
      return;
    }

    // Các trạng thái khác chuyển trực tiếp
    await updateStageDirectly(leadId, targetStage);
  };

  const updateStageDirectly = async (leadId: string, newStatus: LeadStatus) => {
    if (!currentUser) return;
    // Cập nhật optimistic trên giao diện
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    );

    const res = await leadRepository.updateLeadStageWithTransaction({
      leadId,
      newStatus,
      currentUser,
      notes: `Kéo thả chuyển trạng thái sang ${newStatus}`,
    });

    if (!res.success) {
      alert(`Lỗi: ${res.error}`);
      fetchLeads(); // Rollback nếu lỗi
    }
  };

  const handleConfirmTransactionDrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingDrop || !currentUser) return;

    const res = await leadRepository.updateLeadStageWithTransaction({
      leadId: pendingDrop.leadId,
      newStatus: pendingDrop.targetStage,
      currentUser,
      txCode,
      txAmount: Number(txAmount),
      unitCode,
      txDate,
      notes: txNotes,
    });

    if (res.success) {
      setTxModalOpen(false);
      setPendingDrop(null);
      fetchLeads();
    } else {
      setErrorMsg(res.error || 'Cập nhật giao dịch thất bại.');
    }
  };

  const isMarketing = currentUser?.role === 'marketing_manager';

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] space-y-4">
      {/* 1. HEADER & FILTER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shrink-0">
        <div className="flex items-center gap-2">
          <GitCommit className="h-5 w-5 text-blue-600" />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Customer Journey Kanban (15 Giai Đoạn Chăm Sóc)
            </h2>
            <p className="text-[11px] text-slate-500">
              Kéo thả chuyển giai đoạn • Booking, Cọc, HĐMB yêu cầu nhập thông tin giao dịch tài chính
            </p>
          </div>
        </div>

        {/* Lọc dự án */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Dự án:</span>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="">Tất cả các dự án</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. KANBAN HORIZONTAL SCROLL BOARD */}
      {loading ? (
        <div className="flex gap-4 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-full w-72 rounded-xl shrink-0" />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 flex gap-3 overflow-x-auto pb-4 select-none">
            {JOURNEY_STAGES.map((stage) => {
              const stageLeads = leads.filter((l) => l.status === stage.id);
              return (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  leads={stageLeads}
                  onCardClick={(leadId) => navigate(`/leads/${leadId}`)}
                  isMarketing={isMarketing}
                />
              );
            })}
          </div>

          {/* Drag Overlay Ghost */}
          <DragOverlay>
            {activeLead ? (
              <div className="rounded-lg border-2 border-blue-500 bg-white p-3 shadow-2xl opacity-90 w-64 rotate-2">
                <span className="text-xs font-bold text-slate-900 block truncate">
                  {activeLead.customer_name}
                </span>
                <span className="text-[11px] text-slate-500 block truncate">
                  {activeLead.project_name}
                </span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* 3. MODAL NHẬP GIAO DỊCH BẮT BUỘC KHI KÉO VÀO BOOKING / CỌC / HĐMB */}
      <Modal
        isOpen={txModalOpen}
        onClose={() => { setTxModalOpen(false); setPendingDrop(null); }}
        title={`Xác nhận giao dịch: ${JOURNEY_STAGES.find(s => s.id === pendingDrop?.targetStage)?.label}`}
        description="Việc chuyển trạng thái này yêu cầu nhập chính xác dữ liệu đối soát giao dịch tài chính."
        maxWidth="md"
      >
        <form onSubmit={handleConfirmTransactionDrop} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1">
            <Input
              label="Mã căn hộ / sản phẩm *"
              required
              value={unitCode}
              onChange={(e) => setUnitCode(e.target.value)}
              placeholder="Ví dụ: A-12.04"
            />
          </div>

          {pendingDrop?.targetStage === 'booking' && (
            <div className="space-y-3 bg-orange-50/60 p-3 rounded-lg border border-orange-200">
              <Input
                label="Mã Booking giữ chỗ *"
                required
                value={txCode}
                onChange={(e) => setTxCode(e.target.value)}
                placeholder="BK-VHGP-0012"
              />
              <Input
                label="Số tiền Booking (VNĐ) *"
                type="number"
                required
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
              />
            </div>
          )}

          {pendingDrop?.targetStage === 'deposit' && (
            <div className="space-y-3 bg-rose-50/60 p-3 rounded-lg border border-rose-200">
              <Input
                label="Số tiền đặt cọc (VNĐ) *"
                type="number"
                required
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
              />
              <Input
                label="Ngày đặt cọc *"
                type="date"
                required
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
              />
            </div>
          )}

          {pendingDrop?.targetStage === 'contract' && (
            <div className="space-y-3 bg-purple-50/60 p-3 rounded-lg border border-purple-200">
              <Input
                label="Mã hợp đồng mua bán (HĐMB) *"
                required
                value={txCode}
                onChange={(e) => setTxCode(e.target.value)}
                placeholder="HDMB-2026-..."
              />
              <Input
                label="Giá trị hợp đồng thực tế (VNĐ) *"
                type="number"
                required
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">Ghi chú xác nhận</label>
            <textarea
              rows={2}
              value={txNotes}
              onChange={(e) => setTxNotes(e.target.value)}
              placeholder="Khách đã ký bản cam kết thanh toán..."
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { setTxModalOpen(false); setPendingDrop(null); }}
            >
              Hủy bỏ
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Xác Nhận & Cập Nhật Giao Dịch
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
