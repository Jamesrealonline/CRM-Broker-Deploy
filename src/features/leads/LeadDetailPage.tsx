// ========================================================
// REAL ESTATE CRM - LEAD DETAIL & AI ASSISTANT PAGE
// Hồ sơ, Timeline, Chăm sóc, Form giao dịch bắt buộc & Trợ lý AI
// ========================================================

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  Building2, 
  User, 
  Sparkles, 
  Clock, 
  Plus, 
  MessageSquare, 
  Calendar, 
  CheckCircle2, 
  Copy, 
  AlertCircle,
  FileText,
  DollarSign,
  TrendingUp,
  Award,
  ShieldCheck,
  Check,
  X,
  History,
  UserCheck,
  RotateCcw,
  AlertTriangle,
  Send,
  Trash2
} from 'lucide-react';
import { useAuthStore } from '@/app/useAuthStore';
import { leadRepository } from '@/data/repositories/leadRepository';
import { projectRepository } from '@/data/repositories/projectRepository';
import { contractRepository } from '@/data/repositories/contractRepository';
import { teamRepository } from '@/data/repositories/teamRepository';
import { autoTransferService } from '@/domain/services/autoTransferService';
import { financialCalculationService } from '@/domain/services/financialCalculationService';
import { aiRepository, AILeadInsightResult } from '@/data/repositories/aiRepository';
import { notificationService } from '@/domain/services/notificationService';
import { 
  Lead, 
  LeadActivity, 
  LeadStatusHistory, 
  LeadStatus, 
  ProjectKnowledge, 
  ProjectCommissionPolicy, 
  Transaction,
  LeadAssignmentHistory,
  UserProfile
} from '@/domain/types';
import { JOURNEY_STAGES } from '@/domain/constants';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { formatDate, formatCurrencyVND, maskPhone, maskEmail } from '@/lib/utils';
import { canViewFullPII } from '@/lib/masking';
import { controlledDataService } from '@/domain/services/controlledDataService';
import { Skeleton } from '@/components/ui/Skeleton';

export const LeadDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();

  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [history, setHistory] = useState<LeadStatusHistory[]>([]);
  const [assignmentHistory, setAssignmentHistory] = useState<LeadAssignmentHistory[]>([]);
  const [knowledge, setKnowledge] = useState<ProjectKnowledge | null>(null);
  const [loading, setLoading] = useState(true);

  // Tab (Module 7: thêm assignments)
  const [activeTab, setActiveTab] = useState<'timeline' | 'activities' | 'ai' | 'deals' | 'assignments'>('deals');

  // Customer Deals & Commission
  const [customerDeals, setCustomerDeals] = useState<ReturnType<typeof financialCalculationService.aggregateCustomerDeals> | null>(null);
  const [projectPolicy, setProjectPolicy] = useState<ProjectCommissionPolicy | null>(null);
  const [leadTransactions, setLeadTransactions] = useState<Transaction[]>([]);
  const [isUpdatingMilestone, setIsUpdatingMilestone] = useState(false);

  // Manager Actions State (Module 6 & 7)
  const [managerSales, setManagerSales] = useState<UserProfile[]>([]);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [reassignSaleId, setReassignSaleId] = useState('');
  const [reassignReason, setReassignReason] = useState('Quản lý điều chuyển chuyên viên phụ trách');
  const [reassignLoading, setReassignLoading] = useState(false);

  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [extendHours, setExtendHours] = useState(24);
  const [extendReason, setExtendReason] = useState('Gia hạn thêm thời gian để chuẩn bị tài liệu dự án');
  const [extendLoading, setExtendLoading] = useState(false);

  const [exemptModalOpen, setExemptModalOpen] = useState(false);
  const [isExemptVal, setIsExemptVal] = useState(true);
  const [exemptReason, setExemptReason] = useState('Khách hàng VIP ngoại giao, miễn chuyển tự động');
  const [exemptLoading, setExemptLoading] = useState(false);

  // Modal chuyển trạng thái giao dịch
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<LeadStatus>('contacted');
  const [txCode, setTxCode] = useState('');
  const [txAmount, setTxAmount] = useState('50000000');
  const [unitCode, setUnitCode] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
  const [statusNotes, setStatusNotes] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Modal thêm hoạt động
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [actType, setActType] = useState<any>('call');
  const [actTitle, setActTitle] = useState('');
  const [actContent, setActContent] = useState('');

  // AI Assistant State
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState<AILeadInsightResult | null>(null);
  const [aiScript, setAiScript] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id || !currentUser) return;
    const fetchLeadData = async () => {
      setLoading(true);
      try {
        const leadData = await leadRepository.getLeadById(id);
        if (leadData) {
          setLead(leadData);
          setIsExemptVal(Boolean(leadData.is_exempt_auto_transfer));
          const [actList, histList, knowData, txList, policies, assignHist, profs] = await Promise.all([
            leadRepository.getLeadActivities(id),
            leadRepository.getLeadStatusHistory(id),
            projectRepository.getProjectKnowledge(leadData.project_id),
            contractRepository.getTransactions({ leadId: id }),
            projectRepository.getProjectPolicies(leadData.project_id),
            leadRepository.getAssignmentHistory(id),
            teamRepository.getProfiles(),
          ]);
          setActivities(actList);
          setHistory(histList);
          setAssignmentHistory(assignHist);
          setKnowledge(knowData);
          setLeadTransactions(txList);

          const activeSales = profs.filter(p => (p.role === 'sale_agent' || p.role === 'team_leader') && p.status === 'active');
          setManagerSales(activeSales);
          if (activeSales.length > 0 && !reassignSaleId) {
            setReassignSaleId(activeSales[0].id);
          }

          const activePolicy = policies.find(p => p.is_active) || policies[0];
          setProjectPolicy(activePolicy);
          const deals = financialCalculationService.aggregateCustomerDeals(id, txList, activePolicy);
          setCustomerDeals(deals);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeadData();
  }, [id, currentUser]);

  const handleToggleFirstInstallment = async (txId: string, currentPaid: boolean) => {
    if (!id || !lead) return;
    setIsUpdatingMilestone(true);
    try {
      await contractRepository.updateContractMilestone(txId, {
        first_installment_paid: !currentPaid,
        first_installment_date: !currentPaid ? new Date().toISOString() : undefined,
      });
      const txList = await contractRepository.getTransactions({ leadId: id });
      setLeadTransactions(txList);
      const deals = financialCalculationService.aggregateCustomerDeals(id, txList, projectPolicy);
      setCustomerDeals(deals);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingMilestone(false);
    }
  };

  // Kích hoạt AI Intelligence
  const handleGenerateAI = async () => {
    if (!lead) return;
    setAiLoading(true);
    try {
      const [insights, script] = await Promise.all([
        aiRepository.getLeadInsights(lead, activities, knowledge),
        aiRepository.generateScript(lead, knowledge, lead.status),
      ]);
      setAiInsights(insights);
      setAiScript(script);
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (lead && !aiInsights) {
      handleGenerateAI();
    }
  }, [lead]);

  // Xử lý chuyển trạng thái
  const handleOpenStatusChange = (status: LeadStatus) => {
    setTargetStatus(status);
    setStatusError(null);
    setUnitCode('');
    if (status === 'booking') {
      setTxCode(`BK-${Date.now().toString().slice(-6)}`);
      setTxAmount('50000000');
    } else if (status === 'deposit') {
      setTxCode(`DC-${Date.now().toString().slice(-6)}`);
      setTxAmount('100000000');
    } else if (status === 'contract') {
      setTxCode(`HDMB-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`);
      setTxAmount('3200000000');
    }
    setStatusModalOpen(true);
  };

  const handleConfirmStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !currentUser) return;
    setIsUpdatingStatus(true);
    setStatusError(null);

    const res = await leadRepository.updateLeadStageWithTransaction({
      leadId: lead.id,
      newStatus: targetStatus,
      currentUser,
      txCode,
      txAmount: Number(txAmount),
      unitCode,
      txDate,
      notes: statusNotes,
    });

    setIsUpdatingStatus(false);
    if (res.success) {
      setStatusModalOpen(false);
      setLead({ ...lead, status: targetStatus, notes: statusNotes || lead.notes });
      const [newAct, newHist] = await Promise.all([
        leadRepository.getLeadActivities(lead.id),
        leadRepository.getLeadStatusHistory(lead.id),
      ]);
      setActivities(newAct);
      setHistory(newHist);
    } else {
      setStatusError(res.error || 'Cập nhật trạng thái thất bại.');
    }
  };

  // Thêm hoạt động
  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !currentUser) return;
    await leadRepository.addActivity(lead.id, {
      userId: currentUser.id,
      userName: currentUser.full_name,
      type: actType,
      title: actTitle,
      content: actContent,
    });
    setActivityModalOpen(false);
    setActTitle('');
    setActContent('');
    const newAct = await leadRepository.getLeadActivities(lead.id);
    setActivities(newAct);
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(aiScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Module 7: Điều chuyển thủ công
  const handleManualReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !currentUser || !reassignSaleId) return;
    const targetSale = managerSales.find(s => s.id === reassignSaleId);
    if (!targetSale) return;

    setReassignLoading(true);
    const res = await leadRepository.manualReassignLead(lead.id, targetSale, reassignReason, currentUser);
    setReassignLoading(false);

    if (res.success) {
      setReassignModalOpen(false);
      const [updatedLead, updatedHist] = await Promise.all([
        leadRepository.getLeadById(lead.id),
        leadRepository.getAssignmentHistory(lead.id),
      ]);
      if (updatedLead) setLead(updatedLead);
      setAssignmentHistory(updatedHist);
      alert(`Đã bàn giao Lead thành công cho chuyên viên ${targetSale.full_name}! Hệ thống đã tự động gửi email thông báo chi tiết qua Webhook.`);
    } else {
      alert(res.error || 'Điều chuyển thất bại');
    }
  };

  // Module 7: Gia hạn hạn chăm sóc
  const handleExtendDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !currentUser) return;
    setExtendLoading(true);
    const ok = await leadRepository.extendCareDeadline(lead.id, extendHours, extendReason, currentUser);
    setExtendLoading(false);

    if (ok) {
      setExtendModalOpen(false);
      const updatedLead = await leadRepository.getLeadById(lead.id);
      if (updatedLead) setLead(updatedLead);
    } else {
      alert('Gia hạn thất bại');
    }
  };

  // Module 7: Cấu hình miễn chuyển
  const handleToggleExempt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !currentUser) return;
    setExemptLoading(true);
    const ok = await leadRepository.setLeadExempt(lead.id, isExemptVal, exemptReason, currentUser);
    setExemptLoading(false);

    if (ok) {
      setExemptModalOpen(false);
      const updatedLead = await leadRepository.getLeadById(lead.id);
      if (updatedLead) setLead(updatedLead);
    } else {
      alert('Cập nhật miễn chuyển thất bại');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-3 gap-6">
          <Skeleton className="h-96 col-span-1" />
          <Skeleton className="h-96 col-span-2" />
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-8 text-center bg-white rounded-xl">
        <p className="text-sm text-slate-500">Không tìm thấy thông tin Lead này.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/leads')}>
          Quay lại danh sách
        </Button>
      </div>
    );
  }

  const stage = JOURNEY_STAGES.find((s) => s.id === lead.status);
  const isMarketing = currentUser?.role === 'marketing_manager';
  const canFull = canViewFullPII(currentUser, lead.agency_id);
  const displayPhone = canFull ? lead.customer_phone : (isMarketing ? maskPhone(lead.customer_phone) : lead.customer_phone);
  const displayEmail = canFull ? lead.customer_email : (isMarketing ? maskEmail(lead.customer_email) : lead.customer_email);

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & NAVIGATION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/leads')}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{lead.customer_name}</h2>
              {lead.is_sample && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-500" /> Mẫu
                </span>
              )}
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${stage?.bgColor} ${stage?.color} ${stage?.borderColor}`}>
                {stage?.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Dự án: <span className="font-semibold text-slate-700">{lead.project_name}</span> • Mã Lead: {lead.id}
            </p>
          </div>
        </div>

        {/* Nút hành động nhanh */}
        <div className="flex items-center gap-2">
          {canFull && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDeleteReason('');
                setDeleteError(null);
                setDeleteModalOpen(true);
              }}
              className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1 text-red-500" /> Xóa Lead
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={() => setActivityModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Ghi nhận hoạt động
          </Button>

          <select
            value={lead.status}
            onChange={(e) => handleOpenStatusChange(e.target.value as LeadStatus)}
            className="text-xs font-semibold px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg focus:outline-none"
          >
            {JOURNEY_STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                Chuyển sang: {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 1.5 BANNER ĐẾM NGƯỢC 24H LIÊN TỤC & ĐIỀU CHUYỂN TỰ ĐỘNG (MODULE 7) */}
      {(() => {
        const care = autoTransferService.getCareRemainingHours(lead);
        const isManager = ['admin', 'director', 'sales_manager', 'team_leader'].includes(currentUser?.role || '');

        const styleMap = {
          green: {
            bg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
            badge: 'bg-emerald-600 text-white',
            border: 'border-emerald-300',
            icon: <Clock className="h-5 w-5 text-emerald-600 shrink-0" />,
          },
          yellow: {
            bg: 'bg-amber-50 border-amber-200 text-amber-900',
            badge: 'bg-amber-600 text-white',
            border: 'border-amber-300',
            icon: <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />,
          },
          red: {
            bg: 'bg-rose-50 border-rose-200 text-rose-900',
            badge: 'bg-rose-600 text-white animate-pulse',
            border: 'border-rose-300',
            icon: <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />,
          },
          gray: {
            bg: 'bg-slate-50 border-slate-200 text-slate-800',
            badge: 'bg-slate-500 text-white',
            border: 'border-slate-300',
            icon: <Clock className="h-5 w-5 text-slate-400 shrink-0" />,
          },
        }[care.badgeColor];

        return (
          <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm ${styleMap.bg}`}>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white rounded-lg border shadow-xs mt-0.5">
                {styleMap.icon}
              </div>
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-sm">
                    {care.isPaused ? 'Đồng hồ chăm sóc: Tạm dừng' : `Hạn chót chăm sóc: ${care.badgeLabel}`}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${styleMap.badge}`}>
                    {care.badgeColor === 'red' ? 'Cần Xử Lý Ngay' : care.badgeColor === 'yellow' ? 'Sắp Hết Hạn' : care.badgeColor === 'green' ? 'Đúng Tiến Độ' : 'Tạm Dừng'}
                  </span>
                  {lead.auto_transfer_count ? (
                    <span className="text-[11px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                      Đã chuyển: {lead.auto_transfer_count}/3 lần
                    </span>
                  ) : null}
                  {lead.is_exempt_auto_transfer && (
                    <span className="text-[11px] font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded border border-purple-200">
                      Miễn chuyển tự động
                    </span>
                  )}
                </div>
                <p className="text-xs opacity-90">
                  {care.isPaused
                    ? (care.pauseReason || 'Đồng hồ dừng do lead ở trạng thái đặc biệt hoặc đã có lịch hẹn chăm sóc')
                    : care.isOverdue
                    ? `Lead đã quá hạn 24h liên tục. Hệ thống sẽ tự động chuyển cho Sale tiếp theo nếu chưa có ghi nhận chăm sóc.`
                    : `Hạn chót cập nhật: ${lead.care_deadline_at ? formatDate(lead.care_deadline_at) : '24 giờ từ khi nhận'}. Bất kỳ tương tác (cuộc gọi, ghi chú) hoặc đổi trạng thái sẽ gia hạn thêm 24h.`}
                </p>
              </div>
            </div>

            {isManager && (
              <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReassignModalOpen(true)}
                  className="bg-white hover:bg-slate-50 text-xs shadow-xs"
                >
                  <UserCheck className="h-3.5 w-3.5 mr-1 text-blue-600" />
                  Điều chuyển Sale
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExtendModalOpen(true)}
                  className="bg-white hover:bg-slate-50 text-xs shadow-xs"
                >
                  <Clock className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                  Gia hạn 24h
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsExemptVal(!lead.is_exempt_auto_transfer);
                    setExemptModalOpen(true);
                  }}
                  className="bg-white hover:bg-slate-50 text-xs shadow-xs"
                >
                  <ShieldCheck className="h-3.5 w-3.5 mr-1 text-purple-600" />
                  {lead.is_exempt_auto_transfer ? 'Bỏ miễn chuyển' : 'Miễn chuyển'}
                </Button>
              </div>
            )}
          </div>
        );
      })()}

      {/* 2. MAIN GRID (LEFT: INFO PROFILE, RIGHT: TABS TIMELINE / AI) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: HỒ SƠ LEAD & THÔNG TIN DỰ ÁN */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Hồ Sơ Khách Hàng</CardTitle>
            </CardHeader>
            <div className="space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Số điện thoại</span>
                  {canFull && lead.customer_phone && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(lead.customer_phone || '');
                        setCopiedField('phone');
                        setTimeout(() => setCopiedField(null), 1500);
                      }}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
                    >
                      <Copy className="h-2.5 w-2.5" />
                      {copiedField === 'phone' ? 'Đã sao chép!' : 'Sao chép'}
                    </button>
                  )}
                </div>
                <span className="font-semibold text-slate-800 text-sm flex items-center gap-1.5 mt-0.5">
                  <Phone className="h-3.5 w-3.5 text-blue-600" /> {displayPhone}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Email</span>
                  {canFull && lead.customer_email && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(lead.customer_email || '');
                        setCopiedField('email');
                        setTimeout(() => setCopiedField(null), 1500);
                      }}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
                    >
                      <Copy className="h-2.5 w-2.5" />
                      {copiedField === 'email' ? 'Đã sao chép!' : 'Sao chép'}
                    </button>
                  )}
                </div>
                <span className="font-medium text-slate-800 flex items-center gap-1.5 mt-0.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400" /> {displayEmail || 'Chưa có'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Mục đích</span>
                  <span className="font-medium text-slate-800">
                    {lead.purpose === 'investment' ? 'Đầu tư' : 'Để ở an cư'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Điểm Lead Score</span>
                  <span className="font-bold text-emerald-600 text-sm">{lead.lead_score} / 100</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Ngân sách dự kiến</span>
                <span className="font-semibold text-slate-900 text-sm">
                  {formatCurrencyVND(lead.budget_min)} - {formatCurrencyVND(lead.budget_max)}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Chuyên viên phụ trách</span>
                <span className="font-medium text-slate-800 flex items-center gap-1 mt-0.5">
                  <User className="h-3.5 w-3.5 text-blue-600" />
                  {lead.assigned_name || 'Chưa phân bổ'}
                </span>
              </div>

              {lead.notes && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Ghi chú nhu cầu</span>
                  <p className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-1">
                    {lead.notes}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Card Thông tin dự án gắn liền */}
          <Card className="bg-slate-900 text-white border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-blue-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Tri thức dự án: {lead.project_name}
              </h3>
            </div>
            <div className="text-xs text-slate-300 space-y-2">
              <p><span className="text-slate-400">Vị trí:</span> {knowledge?.location || 'Đang cập nhật'}</p>
              <p><span className="text-slate-400">Khung giá:</span> {knowledge?.price_range || 'Đang cập nhật'}</p>
              <p><span className="text-slate-400">Chính sách:</span> {knowledge?.policy || 'Đang cập nhật'}</p>
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN: TABS (AI ASSISTANT, HOẠT ĐỘNG, TIMELINE LỊCH SỬ) */}
        <div className="lg:col-span-2 space-y-4">
          {/* TAB HEADERS */}
          <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('deals')}
              className={`pb-3 flex items-center gap-1.5 transition-colors border-b-2 ${
                activeTab === 'deals'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="h-4 w-4 text-emerald-600" />
              Giao Dịch & Hợp Đồng ({customerDeals?.totalProducts || 0})
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className={`pb-3 flex items-center gap-1.5 transition-colors border-b-2 ${
                activeTab === 'ai'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sparkles className="h-4 w-4 text-blue-600" />
              AI Sales Intelligence
            </button>

            <button
              onClick={() => setActiveTab('activities')}
              className={`pb-3 flex items-center gap-1.5 transition-colors border-b-2 ${
                activeTab === 'activities'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <MessageSquare className="h-4 w-4 text-slate-500" />
              Hoạt Động Chăm Sóc ({activities.length})
            </button>

            <button
              onClick={() => setActiveTab('timeline')}
              className={`pb-3 flex items-center gap-1.5 transition-colors border-b-2 ${
                activeTab === 'timeline'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Clock className="h-4 w-4 text-slate-500" />
              Lịch Sử Chuyển Trạng Thái ({history.length})
            </button>

            <button
              onClick={() => setActiveTab('assignments')}
              className={`pb-3 flex items-center gap-1.5 transition-colors border-b-2 ${
                activeTab === 'assignments'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <History className="h-4 w-4 text-slate-500" />
              Lịch Sử Điều Chuyển ({assignmentHistory.length})
            </button>
          </div>

          {/* TAB: THÔNG TIN GIAO DỊCH & HỢP ĐỒNG CỦA KHÁCH HÀNG (MODULE 2) */}
          {activeTab === 'deals' && (
            <div className="space-y-5">
              {/* Thẻ tổng cộng nhiều sản phẩm */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-slate-900 text-white rounded-2xl shadow-sm">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Tổng Sản Phẩm</span>
                  <span className="text-xl font-black text-white">{customerDeals?.totalProducts || 0}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">căn / sản phẩm</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Tổng Giá Trị GD</span>
                  <span className="text-lg font-black text-blue-400">{formatCurrencyVND(customerDeals?.totalDealValue || 0)}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">doanh số giao dịch</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Tổng Hoa Hồng CĐT</span>
                  <span className="text-lg font-black text-amber-400">{formatCurrencyVND(customerDeals?.totalCompanyCommission || 0)}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">công ty nhận từ CĐT</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Tổng Hoa Hồng Sale</span>
                  <span className="text-lg font-black text-indigo-300">{formatCurrencyVND(customerDeals?.totalSaleCommission || 0)}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">cơ bản + lũy tiến</span>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Thực Nhận Theo Mốc</span>
                  <span className="text-lg font-black text-emerald-400">{formatCurrencyVND(customerDeals?.totalRealizedCommission || 0)}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">đủ điều kiện ghi nhận</span>
                </div>
              </div>

              {/* Banner quy tắc ghi nhận hoa hồng theo dự án */}
              <div className="flex items-center justify-between p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>
                    <strong>Quy tắc dự án {lead.project_name}:</strong> Điều kiện ghi nhận hoa hồng:
                    <span className="ml-1.5 px-2 py-0.5 rounded-full bg-blue-600 text-white font-bold text-[11px]">
                      {projectPolicy?.recognition_milestone === 'deposit'
                        ? '1. Sau khi nộp cọc'
                        : projectPolicy?.recognition_milestone === 'contract'
                        ? '2. Sau khi ký HĐMB'
                        : '3. Sau khi đóng tiền Đợt 1 thành công'}
                    </span>
                  </span>
                </div>
                <span className="text-[11px] text-blue-700 hidden sm:inline">
                  Tỷ lệ CĐT: <strong>{projectPolicy?.company_commission_rate || 3.5}%</strong> • Tỷ lệ Sale: <strong>{projectPolicy?.role_rates.find(r => r.role === 'sale_agent')?.default_rate || 1.8}%</strong>
                </span>
              </div>

              {/* Danh sách từng sản phẩm / hợp đồng của khách hàng */}
              {!customerDeals || customerDeals.deals.length === 0 ? (
                <Card className="p-8 text-center bg-white border-dashed border-2 border-slate-200">
                  <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-800">Chưa có hợp đồng nào được ký kết</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Khách hàng đang ở giai đoạn "{JOURNEY_STAGES.find(s => s.id === lead.status)?.label}". Chuyển trạng thái sang Đặt cọc hoặc Ký HĐMB để kích hoạt hợp đồng và tính toán hoa hồng.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-4"
                    onClick={() => handleOpenStatusChange('deposit')}
                  >
                    Tạo giao dịch Đặt cọc / HĐMB
                  </Button>
                </Card>
              ) : (
                <div className="space-y-4">
                  {customerDeals.deals.map((deal, idx) => {
                    const tx = deal.tx;
                    const calc = deal.calculated;
                    const tl = deal.timeline;

                    return (
                      <Card key={tx.id || idx} className="p-5 border-slate-200 bg-white hover:border-blue-300 transition-all shadow-sm">
                        {/* Header sản phẩm */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                              {idx + 1}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-slate-900 text-base">
                                  {tx.unit_code || 'Sản phẩm ' + (idx + 1)}
                                </span>
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-700 border border-slate-200">
                                  {tx.contract_code || tx.code}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Dự án: <span className="font-semibold text-slate-700">{lead.project_name}</span> • Chuyên viên: <span className="font-semibold text-slate-700">{lead.assigned_name || 'Sale'}</span>
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-xs text-slate-400 font-semibold uppercase">Giá trị giao dịch</div>
                            <div className="text-lg font-black text-slate-900">{formatCurrencyVND(calc.dealValue)}</div>
                          </div>
                        </div>

                        {/* Timeline 3 mốc: Cọc -> Ký HĐMB -> Đóng tiền Đợt 1 */}
                        <div className="py-5 border-b border-slate-100">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-3">
                            Tiến độ giao dịch & hợp đồng (Milestones)
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* Mốc 1: Cọc */}
                            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                                  1. Đặt cọc
                                </span>
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  Đã cọc
                                </span>
                              </div>
                              <div className="text-xs text-slate-600 space-y-0.5">
                                <div>Số tiền: <strong className="text-slate-900">{formatCurrencyVND(tl.deposit?.amount || 100000000)}</strong></div>
                                <div>Ngày cọc: <span className="text-slate-700">{formatDate(tl.deposit?.date || tx.created_at)}</span></div>
                              </div>
                            </div>

                            {/* Mốc 2: Ký HĐMB */}
                            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                                  2. Ký HĐMB
                                </span>
                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                                  Đã ký
                                </span>
                              </div>
                              <div className="text-xs text-slate-600 space-y-0.5">
                                <div>Số HĐMB: <strong className="text-slate-900 font-mono">{tl.contract?.code || tx.contract_code || tx.code}</strong></div>
                                <div>Ngày ký: <span className="text-slate-700">{formatDate(tl.contract?.date || tx.transaction_date || tx.created_at)}</span></div>
                              </div>
                            </div>

                            {/* Mốc 3: Đóng tiền Đợt 1 */}
                            <div className={`p-3 rounded-xl border ${
                              tx.first_installment_paid 
                                ? 'bg-emerald-50/50 border-emerald-200' 
                                : 'bg-amber-50/50 border-amber-200'
                            }`}>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full ${tx.first_installment_paid ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                  3. Đóng tiền Đợt 1
                                </span>
                                {tx.first_installment_paid ? (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                                    <Check className="h-3 w-3" /> Đã đóng
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> Chờ đóng
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-600 space-y-0.5">
                                <div>Số tiền: <strong className="text-slate-900">{formatCurrencyVND(tx.first_installment_amount || Math.round(calc.dealValue * 0.1))}</strong></div>
                                <div>Hạn đóng: <span className="text-slate-700">{formatDate(tx.first_installment_date || new Date().toISOString())}</span></div>
                              </div>
                              <div className="mt-2 pt-2 border-t border-slate-200/60 flex justify-end">
                                <button
                                  type="button"
                                  disabled={isUpdatingMilestone}
                                  onClick={() => handleToggleFirstInstallment(tx.id, Boolean(tx.first_installment_paid))}
                                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                                    tx.first_installment_paid
                                      ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                                  }`}
                                >
                                  {tx.first_installment_paid ? 'Hủy đánh dấu đợt 1' : '✓ Xác nhận đã thu tiền Đợt 1'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Phân tích hoa hồng sản phẩm */}
                        <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                            <span className="font-bold text-slate-700 block">Hoa Hồng Công Ty Nhận Từ CĐT:</span>
                            <div className="flex items-baseline justify-between">
                              <span className="text-slate-500">Tỷ lệ chính sách: {calc.companyCommissionRate}%</span>
                              <span className="text-base font-black text-amber-700">{formatCurrencyVND(calc.companyCommissionAmount)}</span>
                            </div>
                          </div>

                          <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-indigo-900">Hoa Hồng Chia Cho Sale:</span>
                              {calc.progressiveBonusRate > 0 && (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                                  + Thưởng lũy tiến: {calc.progressiveBonusRate}%
                                </span>
                              )}
                            </div>
                            <div className="flex items-baseline justify-between">
                              <span className="text-indigo-700">
                                Tỷ lệ: {calc.baseSaleRate}% cơ bản {calc.progressiveBonusRate > 0 ? `+ ${calc.progressiveBonusRate}% lũy tiến` : ''} = <strong>{calc.totalSaleRate}%</strong>
                              </span>
                              <span className="text-base font-black text-indigo-900">{formatCurrencyVND(calc.totalSaleCommissionAmount)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Trạng thái đủ điều kiện ghi nhận */}
                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500">Trạng thái ghi nhận hoa hồng:</span>
                            {calc.isEligible ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                Đủ điều kiện ghi nhận hoa hồng
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                <Clock className="h-3.5 w-3.5 text-amber-600" />
                                Chờ đạt mốc ghi nhận ({
                                  calc.recognitionMilestone === 'deposit'
                                    ? 'Cọc'
                                    : calc.recognitionMilestone === 'contract'
                                    ? 'Ký HĐMB'
                                    : 'Đóng tiền đợt 1'
                                })
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-400">
                            Mã giao dịch: {tx.code}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {activeTab === 'ai' && (
            <div className="space-y-5">
              {aiLoading ? (
                <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-3"></div>
                  <p className="text-xs font-semibold text-slate-700">AI đang phân tích hồ sơ và tạo kịch bản...</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Đầu vào chỉ gồm thông tin dự án và ghi chú của Sale • Bảo vệ dữ liệu cá nhân
                  </p>
                </div>
              ) : (
                <>
                  {/* Phân tích nhu cầu & phản đối */}
                  <Card className="border-blue-100 bg-gradient-to-br from-blue-50/30 to-white">
                    <CardHeader>
                      <CardTitle className="text-xs uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4" />
                        Chân Dung Nhu Cầu & Đề Xuất Hành Động (AI Insight)
                      </CardTitle>
                    </CardHeader>
                    <div className="space-y-4 text-xs">
                      <div>
                        <span className="font-semibold text-slate-900 block mb-1">Tóm tắt khách hàng:</span>
                        <p className="text-slate-700 bg-white p-3 rounded-lg border border-slate-200">
                          {aiInsights?.summary}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-white p-3 rounded-lg border border-slate-200">
                          <span className="font-semibold text-slate-900 block mb-2 flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Nhu cầu nhận diện:
                          </span>
                          <ul className="list-disc list-inside space-y-1 text-slate-600">
                            {aiInsights?.identifiedNeeds.map((need, idx) => (
                              <li key={idx}>{need}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-slate-200">
                          <span className="font-semibold text-slate-900 block mb-2 flex items-center gap-1 text-amber-700">
                            <AlertCircle className="h-3.5 w-3.5" /> Điểm phản đối tiềm ẩn:
                          </span>
                          <ul className="list-disc list-inside space-y-1 text-slate-600">
                            {aiInsights?.objections.map((obj, idx) => (
                              <li key={idx}>{obj}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="bg-blue-600/10 border border-blue-200 p-3 rounded-lg">
                        <span className="font-bold text-blue-900 block mb-1">
                          Đề xuất hành động tiếp theo cho Sale:
                        </span>
                        <p className="text-blue-800 font-medium">
                          {aiInsights?.suggestedAction}
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Kịch bản Script cá nhân hoá */}
                  <Card>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">
                          Kịch Bản Bán Hàng Cá Nhân Hóa (Giai đoạn {stage?.label})
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Dựa trên đặc điểm dự án thật. Sale xác nhận trước khi gửi khách.
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleCopyScript}>
                        <Copy className="h-3.5 w-3.5 mr-1" />
                        {copied ? 'Đã sao chép!' : 'Sao chép kịch bản'}
                      </Button>
                    </div>

                    <div className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono whitespace-pre-wrap leading-relaxed shadow-inner">
                      {aiScript}
                    </div>
                  </Card>
                </>
              )}
            </div>
          )}

          {/* TAB 2: HOẠT ĐỘNG CHĂM SÓC */}
          {activeTab === 'activities' && (
            <Card>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <span className="text-xs font-bold text-slate-900">Nhật Ký Tương Tác Với Khách Hàng</span>
                <Button size="sm" onClick={() => setActivityModalOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Thêm hoạt động
                </Button>
              </div>

              {activities.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">Chưa có hoạt động chăm sóc nào.</div>
              ) : (
                <div className="space-y-3">
                  {activities.map((act) => (
                    <div key={act.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 text-xs">
                      <div className="flex items-center justify-between font-semibold text-slate-900 mb-1">
                        <span className="flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                          {act.title}
                        </span>
                        <span className="text-[10px] text-slate-400">{formatDate(act.created_at)}</span>
                      </div>
                      <p className="text-slate-600 mt-1">{act.content}</p>
                      <div className="mt-2 text-[10px] text-slate-400">Bởi: {act.user_name || 'Chuyên viên'}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* TAB 3: TIMELINE LỊCH SỬ CHUYỂN TRẠNG THÁI */}
          {activeTab === 'timeline' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xs uppercase tracking-wider text-slate-500">
                  Lịch Sử Thay Đổi Trạng Thái (Status History)
                </CardTitle>
              </CardHeader>
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {history.map((hist) => {
                  const s = JOURNEY_STAGES.find((st) => st.id === hist.new_status);
                  return (
                    <div key={hist.id} className="relative text-xs">
                      <div className="absolute -left-6 top-0.5 h-3 w-3 rounded-full bg-blue-600 border-2 border-white"></div>
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        <span>Chuyển sang:</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] border ${s?.bgColor} ${s?.color} ${s?.borderColor}`}>
                          {s?.label}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-1">{hist.notes}</p>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {formatDate(hist.created_at)} • {hist.changer_name || 'Hệ thống'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* TAB 4: LỊCH SỬ ĐIỀU CHUYỂN PHỤ TRÁCH LEAD (MODULE 6 & 7) */}
          {activeTab === 'assignments' && (
            <Card className="p-5">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="h-4 w-4 text-blue-600" />
                  Nhật Ký Điều Chuyển Phụ Trách & Phân Bổ Lead
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Ghi nhận toàn bộ các lần phân bổ ban đầu, điều chuyển tự động do quá hạn 24h, phân bổ hàng loạt hoặc thay đổi thủ công.
                </p>
              </CardHeader>

              {assignmentHistory.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Chưa có lịch sử điều chuyển nào cho Lead này.
                </div>
              ) : (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {assignmentHistory.map((item, idx) => {
                    const reasonMap: Record<string, { label: string; color: string }> = {
                      new_assign: { label: 'Khởi tạo & Giao mới', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                      round_robin: { label: 'Xoay vòng Round-Robin', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                      auto_overdue: { label: 'Tự động chuyển do quá hạn 24h', color: 'bg-rose-50 text-rose-700 border-rose-200' },
                      manual_transfer: { label: 'Quản lý điều chuyển thủ công', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                      bulk_assign: { label: 'Phân bổ hàng loạt (Digest)', color: 'bg-purple-50 text-purple-700 border-purple-200' },
                      pool_reclaim: { label: 'Thu hồi về Kho lead chung', color: 'bg-slate-100 text-slate-700 border-slate-300' },
                    };

                    const rInfo = reasonMap[item.reason] || { label: item.reason, color: 'bg-slate-50 text-slate-700 border-slate-200' };

                    return (
                      <div key={item.id || idx} className="relative">
                        <div className="absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-blue-600 shadow-xs" />
                        <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 text-xs space-y-1.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${rInfo.color}`}>
                                {rInfo.label}
                              </span>
                              {item.transfer_count ? (
                                <span className="text-[10px] text-slate-500 font-medium">
                                  (Lần chuyển thứ {item.transfer_count})
                                </span>
                              ) : null}
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {formatDate(item.created_at)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 font-medium text-slate-800">
                            <span className="text-slate-500">{item.from_sale_name || 'Hệ thống / Kho chung'}</span>
                            <span className="text-blue-500 font-bold">➔</span>
                            <span className="text-blue-700 font-bold">{item.to_sale_name || 'Kho lead chung'}</span>
                          </div>

                          {item.notes && (
                            <p className="text-slate-600 text-[11px] bg-white p-2 rounded border border-slate-200/80">
                              {item.notes}
                            </p>
                          )}

                          <div className="text-[10px] text-slate-400">
                            Thực hiện bởi: <span className="font-medium text-slate-600">{item.created_by || 'Hệ thống'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* 3. MODAL XÁC NHẬN CHUYỂN TRẠNG THÁI (BẮT BUỘC TRANSACTION NẾU LÀ BOOKING/CỌC/HĐMB) */}
      <Modal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title={`Chuyển trạng thái sang "${JOURNEY_STAGES.find(s => s.id === targetStatus)?.label}"`}
        description="Quy tắc nghiệp vụ: Booking, Đặt cọc, Ký HĐMB bắt buộc có dữ liệu giao dịch tài chính hợp lệ."
        maxWidth="md"
      >
        <form onSubmit={handleConfirmStatusChange} className="space-y-4">
          {statusError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs">
              {statusError}
            </div>
          )}

          {['booking', 'deposit', 'contract'].includes(targetStatus) && (
            <div className="space-y-1">
              <Input
                label="Mã căn hộ / sản phẩm *"
                required
                value={unitCode}
                onChange={(e) => setUnitCode(e.target.value)}
                placeholder="Ví dụ: A-12.04"
              />
            </div>
          )}

          {/* Ràng buộc Booking */}
          {targetStatus === 'booking' && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg space-y-3">
              <span className="text-xs font-bold text-orange-900 block flex items-center gap-1">
                <FileText className="h-4 w-4" /> Dữ liệu Booking bắt buộc:
              </span>
              <Input
                label="Mã Booking giữ chỗ *"
                required
                value={txCode}
                onChange={(e) => setTxCode(e.target.value)}
                placeholder="Ví dụ: BK-VHGP-0012"
              />
              <Input
                label="Số tiền giữ chỗ (VNĐ) *"
                type="number"
                required
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
              />
            </div>
          )}

          {/* Ràng buộc Đặt cọc */}
          {targetStatus === 'deposit' && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg space-y-3">
              <span className="text-xs font-bold text-rose-900 block flex items-center gap-1">
                <FileText className="h-4 w-4" /> Dữ liệu Đặt cọc bắt buộc:
              </span>
              <Input
                label="Số tiền đặt cọc (VNĐ) *"
                type="number"
                required
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
              />
              <Input
                label="Ngày nộp cọc *"
                type="date"
                required
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
              />
            </div>
          )}

          {/* Ràng buộc Ký HĐMB */}
          {targetStatus === 'contract' && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg space-y-3">
              <span className="text-xs font-bold text-purple-900 block flex items-center gap-1">
                <FileText className="h-4 w-4" /> Dữ liệu Hợp đồng mua bán bắt buộc:
              </span>
              <Input
                label="Mã hợp đồng (HĐMB) *"
                required
                value={txCode}
                onChange={(e) => setTxCode(e.target.value)}
                placeholder="Ví dụ: HDMB-2026-VHGP-S702"
              />
              <Input
                label="Tổng giá trị hợp đồng (VNĐ) *"
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
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
              placeholder="Khách đã nộp ủy nhiệm chi, đã ký biên bản xác nhận..."
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setStatusModalOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isUpdatingStatus}>
              Xác nhận chuyển trạng thái
            </Button>
          </div>
        </form>
      </Modal>

      {/* 4. MODAL THÊM HOẠT ĐỘNG CHĂM SÓC */}
      <Modal
        isOpen={activityModalOpen}
        onClose={() => setActivityModalOpen(false)}
        title="Ghi nhận hoạt động chăm sóc"
        maxWidth="md"
      >
        <form onSubmit={handleAddActivity} className="space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">Loại hoạt động</label>
            <select
              value={actType}
              onChange={(e) => setActType(e.target.value)}
              className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white"
            >
              <option value="call">Cuộc gọi điện thoại</option>
              <option value="zalo_message">Tin nhắn Zalo</option>
              <option value="meeting">Gặp mặt trực tiếp</option>
              <option value="site_visit">Đi xem thực tế dự án</option>
              <option value="email">Gửi Email tài liệu</option>
              <option value="note">Ghi chú nội bộ</option>
            </select>
          </div>

          <Input
            label="Tiêu đề hoạt động *"
            required
            value={actTitle}
            onChange={(e) => setActTitle(e.target.value)}
            placeholder="Ví dụ: Gọi trao đổi phương án ngân hàng"
          />

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">Nội dung chi tiết</label>
            <textarea
              rows={3}
              required
              value={actContent}
              onChange={(e) => setActContent(e.target.value)}
              placeholder="Khách đồng ý gói vay 24 tháng, hẹn thứ 7 tuần này ghé xem nhà mẫu..."
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setActivityModalOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Lưu hoạt động
            </Button>
          </div>
        </form>
      </Modal>

      {/* 5. MODAL ĐIỀU CHUYỂN SALE THỦ CÔNG (MODULE 7) */}
      <Modal
        isOpen={reassignModalOpen}
        onClose={() => setReassignModalOpen(false)}
        title="Điều Chuyển Chuyên Viên Phụ Trách (Sale)"
        description="Giao Lead này cho Sale khác. Hệ thống sẽ reset đồng hồ 24h, ghi nhận lịch sử và gửi thông báo email."
        maxWidth="md"
      >
        <form onSubmit={handleManualReassign} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">Chọn Chuyên Viên Nhận Lead *</label>
            <select
              required
              value={reassignSaleId}
              onChange={(e) => setReassignSaleId(e.target.value)}
              className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white"
            >
              {managerSales.map((s) => (
                <option key={s.id} value={s.id} disabled={s.id === lead.assigned_to}>
                  {s.full_name} ({s.email}) {s.id === lead.assigned_to ? '(Đang phụ trách)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">Lý do điều chuyển *</label>
            <textarea
              rows={2}
              required
              value={reassignReason}
              onChange={(e) => setReassignReason(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
              placeholder="Nhập lý do điều chuyển phụ trách..."
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setReassignModalOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={reassignLoading} className="bg-blue-600 hover:bg-blue-700">
              <Send className="h-4 w-4 mr-1.5" />
              Xác Nhận & Gửi Email
            </Button>
          </div>
        </form>
      </Modal>

      {/* 6. MODAL GIA HẠN THỜI GIAN CHĂM SÓC 24H */}
      <Modal
        isOpen={extendModalOpen}
        onClose={() => setExtendModalOpen(false)}
        title="Gia Hạn Đồng Hồ Chăm Sóc Lead"
        description="Cộng thêm thời gian vào hạn chót của Sale hiện tại mà không chuyển Lead sang người khác."
        maxWidth="md"
      >
        <form onSubmit={handleExtendDeadline} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">Số giờ gia hạn thêm *</label>
            <select
              value={extendHours}
              onChange={(e) => setExtendHours(Number(e.target.value))}
              className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white"
            >
              <option value={12}>+12 giờ</option>
              <option value={24}>+24 giờ (1 ngày)</option>
              <option value={48}>+48 giờ (2 ngày)</option>
              <option value={72}>+72 giờ (3 ngày)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">Lý do gia hạn *</label>
            <textarea
              rows={2}
              required
              value={extendReason}
              onChange={(e) => setExtendReason(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
              placeholder="Ví dụ: Khách đang đi công tác, hẹn thứ 2 phản hồi..."
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setExtendModalOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={extendLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Clock className="h-4 w-4 mr-1.5" />
              Xác Nhận Gia Hạn
            </Button>
          </div>
        </form>
      </Modal>

      {/* 7. MODAL CẤU HÌNH MIỄN CHUYỂN TỰ ĐỘNG */}
      <Modal
        isOpen={exemptModalOpen}
        onClose={() => setExemptModalOpen(false)}
        title="Cấu Hình Miễn Chuyển Tự Động"
        description="Khi bật miễn chuyển, hệ thống sẽ KHÔNG tự động chuyển Lead này sang Sale khác kể cả khi quá hạn 24h."
        maxWidth="md"
      >
        <form onSubmit={handleToggleExempt} className="space-y-4">
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs space-y-2">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-purple-900">
              <input
                type="checkbox"
                checked={isExemptVal}
                onChange={(e) => setIsExemptVal(e.target.checked)}
                className="h-4 w-4 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
              />
              <span>Kích hoạt quyền miễn chuyển tự động cho Lead này</span>
            </label>
            <p className="text-[11px] text-purple-700 font-normal">
              Thích hợp cho Lead VIP, người thân, quan hệ ngoại giao chỉ định đích danh Sale chăm sóc.
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">Lý do cấu hình *</label>
            <textarea
              rows={2}
              required
              value={exemptReason}
              onChange={(e) => setExemptReason(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
              placeholder="Nhập lý do miễn chuyển..."
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setExemptModalOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={exemptLoading} className="bg-purple-600 hover:bg-purple-700 text-white">
              <ShieldCheck className="h-4 w-4 mr-1.5" />
              Lưu Cấu Hình
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL XÓA LEAD VÀO THÙNG RÁC (ADMIN & GIÁM ĐỐC SÀN) */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Xóa Lead Có Kiểm Soát (Thùng Rác)"
        description={`Xác nhận xóa lead "${lead?.customer_name}". Dữ liệu được đưa vào Thùng rác và có thể khôi phục bất cứ lúc nào.`}
        maxWidth="md"
      >
        <div className="space-y-4">
          {deleteError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{deleteError}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              Lý do xóa lead * (Tối thiểu 5 ký tự)
            </label>
            <textarea
              rows={3}
              required
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Nhập lý do chi tiết..."
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={isDeleting}
              onClick={async () => {
                if (!lead || !currentUser) return;
                if (deleteReason.trim().length < 5) {
                  setDeleteError('Lý do xóa bắt buộc tối thiểu 5 ký tự.');
                  return;
                }
                setIsDeleting(true);
                try {
                  controlledDataService.softDeleteLead(lead.id, deleteReason.trim(), currentUser);
                  alert('Đã chuyển Lead vào Thùng rác.');
                  navigate('/leads');
                } catch (err: any) {
                  setDeleteError(err.message || 'Lỗi khi xóa lead.');
                } finally {
                  setIsDeleting(false);
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Xác Nhận Xóa
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
