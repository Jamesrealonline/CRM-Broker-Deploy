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
  FileText
} from 'lucide-react';
import { useAuthStore } from '@/app/useAuthStore';
import { leadRepository } from '@/data/repositories/leadRepository';
import { projectRepository } from '@/data/repositories/projectRepository';
import { aiRepository, AILeadInsightResult } from '@/data/repositories/aiRepository';
import { Lead, LeadActivity, LeadStatusHistory, LeadStatus, ProjectKnowledge } from '@/domain/types';
import { JOURNEY_STAGES } from '@/domain/constants';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { formatDate, formatCurrencyVND, maskPhone, maskEmail } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';

export const LeadDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();

  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [history, setHistory] = useState<LeadStatusHistory[]>([]);
  const [knowledge, setKnowledge] = useState<ProjectKnowledge | null>(null);
  const [loading, setLoading] = useState(true);

  // Tab
  const [activeTab, setActiveTab] = useState<'timeline' | 'activities' | 'ai'>('ai');

  // Modal chuyển trạng thái giao dịch
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<LeadStatus>('contacted');
  const [txCode, setTxCode] = useState('');
  const [txAmount, setTxAmount] = useState('50000000');
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
          const [actList, histList, knowData] = await Promise.all([
            leadRepository.getLeadActivities(id),
            leadRepository.getLeadStatusHistory(id),
            projectRepository.getProjectKnowledge(leadData.project_id),
          ]);
          setActivities(actList);
          setHistory(histList);
          setKnowledge(knowData);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeadData();
  }, [id, currentUser]);

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
  const displayPhone = isMarketing ? maskPhone(lead.customer_phone) : lead.customer_phone;
  const displayEmail = isMarketing ? maskEmail(lead.customer_email) : lead.customer_email;

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
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Số điện thoại</span>
                <span className="font-semibold text-slate-800 text-sm flex items-center gap-1.5 mt-0.5">
                  <Phone className="h-3.5 w-3.5 text-blue-600" /> {displayPhone}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Email</span>
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
          </div>

          {/* TAB 1: AI ASSISTANT PANEL */}
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
    </div>
  );
};
