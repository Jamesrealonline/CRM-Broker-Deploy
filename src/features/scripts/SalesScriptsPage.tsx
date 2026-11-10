// ========================================================
// REAL ESTATE CRM - SALES SCRIPTS & AI ADVISORS PAGE
// 1. Quản lý 15 bước kịch bản theo Dự án
// 2. Cố vấn Bán Hàng AI Claude (Trò chuyện, phân tích & tự động cập nhật chân dung)
// ========================================================

import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  RotateCcw, 
  Save, 
  CheckCircle2, 
  Building2, 
  Sparkles, 
  Copy,
  Bot,
  MessageSquare,
  Send,
  KeyRound,
  User,
  Zap,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Phone,
  Target
} from 'lucide-react';
import { projectRepository } from '@/data/repositories/projectRepository';
import { leadRepository } from '@/data/repositories/leadRepository';
import { 
  claudeAdvisorService, 
  AdvisorMessage, 
  AdvisorExtractedUpdate 
} from '@/data/repositories/aiRepository';
import { useAuthStore } from '@/app/useAuthStore';
import { branchHierarchyService } from '@/domain/services/branchHierarchyService';
import { Project, SalesScript, LeadStatus, Lead, ProjectKnowledge } from '@/domain/types';
import { JOURNEY_STAGES } from '@/domain/constants';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { maskPhone } from '@/lib/utils';
import { AI_MASTER_STAGE_SCRIPTS, formatFullScriptMarkdown } from '@/data/aiSalesScripts';

export const SalesScriptsPage: React.FC = () => {
  const { currentUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'scripts' | 'advisor'>('scripts');

  // State kịch bản mẫu
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [scripts, setScripts] = useState<SalesScript[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<LeadStatus>('new');
  const [currentScript, setCurrentScript] = useState<SalesScript | null>(null);
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(false);
  const [copied, setCopied] = useState(false);

  // State AI Advisor
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [currentKnowledge, setCurrentKnowledge] = useState<ProjectKnowledge | null>(null);
  
  // Chat Messages
  const [messages, setMessages] = useState<AdvisorMessage[]>([
    {
      role: 'assistant',
      content: 'Xin chào bạn! Tôi là Cố vấn Bán hàng AI Claude. Hãy chọn một khách hàng và dự án cần tư vấn, tôi sẽ giúp bạn phân tích tâm lý, xử lý rào cản và đề xuất kịch bản chăm sóc thực chiến nhất!',
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isUpdatingLead, setIsUpdatingLead] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [lastExtractedUpdate, setLastExtractedUpdate] = useState<AdvisorExtractedUpdate | null>(null);

  // Key Modal
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    projectRepository.getProjects(currentUser || undefined).then((list) => {
      const filtered = branchHierarchyService.filterProjects(currentUser, list);
      setProjects(filtered);
      if (filtered.length > 0) setSelectedProjectId(filtered[0].id);
    });
    setHasApiKey(claudeAdvisorService.hasClaudeApiKey());
    setTempApiKey(claudeAdvisorService.getClaudeApiKey());
  }, [currentUser]);

  // Tải kịch bản và tri thức dự án khi đổi dự án
  useEffect(() => {
    if (!selectedProjectId) return;
    
    projectRepository.getSalesScripts(selectedProjectId).then((res) => {
      setScripts(res);
      const active = res.find(s => s.status === selectedStatus) || res[0];
      if (active) {
        setCurrentScript(active);
        setContent(active.content);
        setSelectedStatus(active.status);
      }
    });

    projectRepository.getProjectKnowledge(selectedProjectId).then((k) => {
      setCurrentKnowledge(k);
    });

    if (currentUser) {
      leadRepository.getLeads({ projectId: selectedProjectId, pageSize: 50 }, currentUser).then((res) => {
        setLeads(res.leads);
        if (res.leads.length > 0) {
          setSelectedLeadId(res.leads[0].id);
        } else {
          setSelectedLeadId('');
        }
      });
    }
  }, [selectedProjectId, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Chọn lead tư vấn
  const selectedLead = leads.find(l => l.id === selectedLeadId) || leads[0] || null;
  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0] || null;

  // Khi đổi khách hàng cần tư vấn -> reset mở đầu chat
  const handleSelectLead = (leadId: string) => {
    setSelectedLeadId(leadId);
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      setMessages([
        {
          role: 'assistant',
          content: `Đã kích hoạt hồ sơ khách hàng **${lead.customer_name || 'Khách hàng'}** (Trạng thái: **${lead.status.toUpperCase()}**, Ngân sách: **${((lead.budget_min || 0) / 1e9).toFixed(1)} - ${((lead.budget_max || 0) / 1e9).toFixed(1)} tỷ**).
Bạn đang gặp khó khăn gì trong quá trình tương tác với khách này? Hãy chia sẻ phản hồi gần nhất của khách nhé!`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setUpdateSuccess(null);
      setLastExtractedUpdate(null);
    }
  };

  // Gửi tin nhắn tới Cố vấn AI Claude
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputQuestion).trim();
    if (!text || isThinking) return;

    if (!selectedLead || !selectedProject || !currentUser) {
      alert('Vui lòng chọn khách hàng và dự án trước khi trò chuyện với AI Advisor.');
      return;
    }

    const userMsg: AdvisorMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputQuestion('');
    setIsThinking(true);

    try {
      const reply = await claudeAdvisorService.chatWithClaudeAdvisor(newHistory, {
        lead: selectedLead,
        project: selectedProject,
        projectKnowledge: currentKnowledge,
        currentUser,
      });

      const assistantMsg: AdvisorMessage = {
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages([...newHistory, assistantMsg]);
    } catch (err: any) {
      console.error(err);
      setMessages([
        ...newHistory,
        {
          role: 'assistant',
          content: 'Xin lỗi bạn, đã xảy ra lỗi trong quá trình kết nối với AI Advisor. Vui lòng thử lại!',
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  // Tự động phân tích và Cập nhật chân dung & tình trạng chăm sóc
  const handleAutoUpdateCareAndPersona = async () => {
    if (!selectedLead || !selectedProject || !currentUser) return;
    if (messages.length <= 1) {
      alert('Vui lòng trò chuyện ít nhất 1 câu hỏi để AI Advisor có dữ liệu phân tích chân dung khách hàng.');
      return;
    }

    setIsUpdatingLead(true);
    setUpdateSuccess(null);

    try {
      const extracted = await claudeAdvisorService.extractPersonaAndCareUpdate(messages, {
        lead: selectedLead,
        project: selectedProject,
        projectKnowledge: currentKnowledge,
        currentUser,
      });

      setLastExtractedUpdate(extracted);

      const res = await claudeAdvisorService.applyAdvisorUpdateToLead(selectedLead.id, extracted, currentUser);
      if (res.success && res.lead) {
        setUpdateSuccess(`Đã tự động cập nhật chân dung & tình trạng chăm sóc vào hồ sơ của ${selectedLead.customer_name}!`);
        // Đồng bộ lead trong danh sách
        setLeads(prev => prev.map(l => l.id === selectedLead.id ? res.lead! : l));
      } else {
        alert(res.error || 'Không thể cập nhật hồ sơ khách hàng.');
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi khi cập nhật hồ sơ.');
    } finally {
      setIsUpdatingLead(false);
    }
  };

  // Lưu API Key Claude
  const handleSaveApiKey = () => {
    claudeAdvisorService.setClaudeApiKey(tempApiKey);
    setHasApiKey(claudeAdvisorService.hasClaudeApiKey());
    setIsKeyModalOpen(false);
  };

  // Script Actions
  const handleSelectStage = (status: LeadStatus) => {
    setSelectedStatus(status);
    const active = scripts.find(s => s.status === status);
    if (active) {
      setCurrentScript(active);
      setContent(active.content);
    }
  };

  const handleSaveScript = async () => {
    if (!currentScript || !selectedProjectId) return;
    setIsSaving(true);
    try {
      const updated: SalesScript = {
        ...currentScript,
        content,
      };
      await projectRepository.saveSalesScript(updated);
      setSaveMsg(true);
      setTimeout(() => setSaveMsg(false), 2500);

      const refreshed = await projectRepository.getSalesScripts(selectedProjectId);
      setScripts(refreshed);
      const active = refreshed.find(s => s.status === selectedStatus);
      if (active) setCurrentScript(active);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateAiScript = async () => {
    if (!selectedProjectId) return;
    const aiDetail = AI_MASTER_STAGE_SCRIPTS[selectedStatus];
    if (!aiDetail) return;
    const generatedMarkdown = formatFullScriptMarkdown(aiDetail, selectedProject?.name || 'Dự án Bất Động Sản');
    setContent(generatedMarkdown);
    if (currentScript) {
      const updated: SalesScript = {
        ...currentScript,
        content: generatedMarkdown,
        is_auto: true,
        is_edited: false,
      };
      await projectRepository.saveSalesScript(updated);
      setSaveMsg(true);
      setTimeout(() => setSaveMsg(false), 2500);
      const refreshed = await projectRepository.getSalesScripts(selectedProjectId);
      setScripts(refreshed);
      const active = refreshed.find(s => s.status === selectedStatus);
      if (active) setCurrentScript(active);
    }
  };

  const handleResetScript = async () => {
    if (!selectedProjectId || !confirm('Bạn có chắc muốn đặt lại kịch bản này về mẫu tự động tiêu chuẩn?')) return;
    const reset = await projectRepository.resetScriptToDefault(selectedProjectId, selectedStatus);
    setCurrentScript(reset);
    setContent(reset.content);
    const refreshed = await projectRepository.getSalesScripts(selectedProjectId);
    setScripts(refreshed);
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stage = JOURNEY_STAGES.find(s => s.id === selectedStatus);

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & NAVIGATION TABS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              {activeTab === 'scripts' ? <FileText className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {activeTab === 'scripts'
                  ? 'Kịch Bản Bán Hàng 15 Bước Theo Dự Án'
                  : 'AI Sales Advisor (Cố Vấn Bán Hàng Thông Minh Claude)'}
              </h2>
              <p className="text-xs text-slate-500">
                {activeTab === 'scripts'
                  ? 'Kịch bản tự động cập nhật theo dự án. Tùy chỉnh giữ nguyên phiên bản đã biên soạn.'
                  : 'Đồng hành cùng Sale xử lý từ chối, kịch bản chăm sóc và tự động cập nhật chân dung khách hàng.'}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher & Project Select */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('scripts')}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                activeTab === 'scripts' ? 'bg-white text-blue-700 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="h-3.5 w-3.5" /> Kịch Bản 15 Bước
            </button>
            <button
              onClick={() => setActiveTab('advisor')}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                activeTab === 'advisor' ? 'bg-blue-600 text-white shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" /> AI Sales Advisor
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Dự án:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 font-semibold text-slate-800"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. TAB 1: KỊCH BẢN BÁN HÀNG 15 BƯỚC */}
      {activeTab === 'scripts' && (
        <div className="space-y-4">
          {saveMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Đã lưu kịch bản và nâng phiên bản thành công!</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CỘT TRÁI: 15 TRẠNG THÁI */}
            <Card className="p-3">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 py-1 mb-2">
                15 Trạng Thái Khách Hàng
              </div>
              <div className="space-y-1">
                {JOURNEY_STAGES.map((s) => {
                  const itemScript = scripts.find(sc => sc.status === s.id);
                  const isActive = selectedStatus === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleSelectStage(s.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white font-semibold shadow-sm'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <span className="truncate">{s.label}</span>
                      <div className="flex items-center gap-1">
                        {itemScript?.is_edited ? (
                          <span className={`text-[9px] px-1.5 py-0.2 rounded border ${isActive ? 'bg-blue-700 text-white border-blue-500' : 'bg-slate-200 text-slate-700'}`}>
                            Tùy chỉnh v{itemScript.version}
                          </span>
                        ) : (
                          <span className={`text-[9px] px-1.5 py-0.2 rounded border ${isActive ? 'bg-blue-700 text-white border-blue-500' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                            Tự động
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* CỘT PHẢI: EDITOR SCRIPT */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base text-slate-900">
                          Kịch Bản Tư Vấn: {stage?.label}
                        </CardTitle>
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          Phiên bản v{currentScript?.version || 1}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {currentScript?.is_edited
                          ? 'Kịch bản đã được chuyên viên can thiệp tùy chỉnh (sẽ không bị ghi đè tự động).'
                          : 'Kịch bản Tự động liên kết với tóm tắt dự án.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateAiScript}
                        className="bg-indigo-50/80 text-indigo-700 hover:bg-indigo-100 border-indigo-200 font-semibold"
                        title="Tạo lại kịch bản chuyên sâu chuẩn theo trạng thái bằng AI"
                      >
                        <Sparkles className="h-3.5 w-3.5 mr-1 text-indigo-600" />
                        AI Soạn Kịch Bản Chuẩn
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleCopyScript}>
                        <Copy className="h-3.5 w-3.5 mr-1" />
                        {copied ? 'Đã copy!' : 'Sao chép'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleResetScript}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Đặt lại theo mẫu
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <div className="space-y-4">
                  <textarea
                    rows={12}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full text-xs font-mono p-4 rounded-xl border border-slate-300 focus:outline-none focus:border-blue-500 shadow-inner bg-slate-900 text-slate-100 leading-relaxed"
                  />

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-slate-400">
                      Cập nhật lần cuối: {currentScript?.updated_at ? new Date(currentScript.updated_at).toLocaleString('vi-VN') : 'Mặc định'}
                    </span>
                    <Button variant="primary" size="sm" onClick={handleSaveScript} isLoading={isSaving}>
                      <Save className="h-4 w-4 mr-1.5" /> Lưu Thay Đổi Kịch Bản
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* 3. TAB 2: AI SALES ADVISOR (CLAUDE AI) */}
      {activeTab === 'advisor' && (
        <div className="space-y-4">
          {/* BANNER THÔNG BÁO THÀNH CÔNG */}
          {updateSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{updateSuccess}</span>
              </div>
              <span className="text-[11px] text-emerald-700 font-semibold underline">Đã đồng bộ hồ sơ Lead</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CỘT TRÁI: CHỌN KHÁCH HÀNG & THÔNG TIN HỒ SƠ */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <User className="h-4 w-4 text-blue-600" />
                    Khách Hàng Cần Tư Vấn
                  </CardTitle>
                </CardHeader>

                <div className="p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Chọn khách hàng từ dự án {selectedProject?.name}:
                    </label>
                    <select
                      value={selectedLeadId}
                      onChange={(e) => handleSelectLead(e.target.value)}
                      className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500"
                    >
                      {leads.length === 0 ? (
                        <option value="">Chưa có khách hàng trong dự án này</option>
                      ) : (
                        leads.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.customer_name} ({l.status}) - {maskPhone(l.customer_phone)}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {selectedLead && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-sm">{selectedLead.customer_name}</span>
                        <Badge variant="info" className="uppercase text-[10px]">{selectedLead.status}</Badge>
                      </div>

                      <div className="space-y-1 text-slate-600 text-[11px]">
                        <p><strong>Mục đích:</strong> {selectedLead.purpose === 'investment' ? 'Đầu tư sinh lời' : 'Mua ở / An cư'}</p>
                        <p><strong>Ngân sách:</strong> {((selectedLead.budget_min || 0) / 1e9).toFixed(1)} - {((selectedLead.budget_max || 0) / 1e9).toFixed(1)} tỷ</p>
                        <p className="flex items-center gap-1">
                          <strong>Điểm thiện chí:</strong>
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold font-mono">
                            {selectedLead.lead_score || 50}/100
                          </span>
                        </p>
                      </div>

                      {selectedLead.notes && (
                        <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 max-h-24 overflow-y-auto">
                          <strong>Ghi chú chăm sóc:</strong>
                          <p className="whitespace-pre-line mt-0.5">{selectedLead.notes}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* NÚT THỰC HIỆN TỰ ĐỘNG CẬP NHẬT HỒ SƠ */}
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full py-2.5 font-bold text-xs shadow-md shadow-blue-500/20"
                    onClick={handleAutoUpdateCareAndPersona}
                    isLoading={isUpdatingLead}
                    disabled={!selectedLead || messages.length <= 1}
                  >
                    <Zap className="h-4 w-4 mr-1.5 text-amber-300" />
                    Cập Nhật Chân Dung & Chăm Sóc Vào Hồ Sơ
                  </Button>
                  <p className="text-[10px] text-slate-400 text-center">
                    AI sẽ phân tích đoạn chat để tự động lưu chân dung tâm lý và cập nhật tiến độ chăm sóc vào Lead.
                  </p>
                </div>
              </Card>

              {/* CARD CẤU HÌNH API KEY CLAUDE */}
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${hasApiKey ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                  <div>
                    <p className="font-bold text-slate-800">
                      {hasApiKey ? 'Claude 3.5 Sonnet (API Key Active)' : 'Chế độ Cố vấn Nội bộ (Local Engine)'}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {hasApiKey ? 'Đang kết nối trực tiếp Anthropic Claude' : 'Hoạt động chuẩn nghiệp vụ. Có thể thêm Key Claude'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsKeyModalOpen(true)}
                  className="text-[11px] py-1 px-2.5"
                >
                  <KeyRound className="h-3 w-3 mr-1" /> {hasApiKey ? 'Đổi Key' : 'Nhập Key'}
                </Button>
              </div>

              {/* CARD PREVIEW CHÂN DUNG SAU KHI PHÂN TÍCH */}
              {lastExtractedUpdate && (
                <Card className="p-3.5 border-blue-200 bg-blue-50/40">
                  <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-blue-900">
                    <Target className="h-4 w-4 text-blue-600" />
                    Bản Ghi Chân Dung Vừa Cập Nhật:
                  </div>
                  <div className="space-y-1.5 text-[11px] text-slate-700">
                    <p><strong>Tình trạng:</strong> {lastExtractedUpdate.careStatusSummary}</p>
                    <p><strong>Nét tâm lý:</strong> {lastExtractedUpdate.personaTraits.join(', ')}</p>
                    <p><strong>Rào cản:</strong> {lastExtractedUpdate.painPoints.join(', ')}</p>
                    <p className="text-blue-800 font-semibold">👉 <strong>Hành động kế tiếp:</strong> {lastExtractedUpdate.recommendedNextAction}</p>
                  </div>
                </Card>
              )}
            </div>

            {/* CỘT PHẢI: KHUNG TRÒ CHUYỆN VỚI CLAUDE AI ADVISOR */}
            <div className="lg:col-span-2">
              <Card className="flex flex-col h-[650px] shadow-sm">
                <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">Trò Chuyện Cố Vấn Bán Hàng</CardTitle>
                      <p className="text-[11px] text-slate-500">
                        Đang đồng hành cùng: <strong className="text-slate-800">{currentUser?.full_name}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSelectLead(selectedLeadId)}
                      className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
                      title="Xóa đoạn chat và bắt đầu phiên tư vấn mới"
                    >
                      <RotateCcw className="h-3 w-3" /> Làm mới phiên chat
                    </button>
                  </div>
                </CardHeader>

                {/* VÙNG TIN NHẮN (MESSAGE HISTORY) */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                  {messages.map((msg, idx) => {
                    const isAssistant = msg.role === 'assistant';
                    return (
                      <div
                        key={idx}
                        className={`flex gap-3 ${isAssistant ? 'justify-start' : 'justify-end'}`}
                      >
                        {isAssistant && (
                          <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Bot className="h-4 w-4" />
                          </div>
                        )}

                        <div className={`max-w-[85%] rounded-2xl p-3.5 text-xs shadow-sm leading-relaxed ${
                          isAssistant
                            ? 'bg-white border border-slate-200 text-slate-800'
                            : 'bg-blue-600 text-white'
                        }`}>
                          <div className="whitespace-pre-line font-sans">
                            {msg.content}
                          </div>
                          {msg.timestamp && (
                            <div className={`text-[10px] mt-1.5 text-right ${isAssistant ? 'text-slate-400' : 'text-blue-100'}`}>
                              {msg.timestamp}
                            </div>
                          )}
                        </div>

                        {!isAssistant && (
                          <div className="h-8 w-8 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-sm font-bold text-xs">
                            {currentUser?.full_name.charAt(0) || 'S'}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {isThinking && (
                    <div className="flex gap-3 justify-start">
                      <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 animate-bounce">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-500 flex items-center gap-2">
                        <div className="flex space-x-1">
                          <div className="h-2 w-2 rounded-full bg-blue-600 animate-ping"></div>
                          <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse"></div>
                        </div>
                        <span>Cố vấn Claude đang phân tích tâm lý và soạn kịch bản...</span>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* GỢI Ý CÂU HỎI THƯỜNG GẶP (QUICK PROMPTS) */}
                <div className="p-2 border-t border-slate-100 bg-white flex items-center gap-1.5 overflow-x-auto text-[11px] text-slate-600">
                  <span className="font-semibold text-slate-400 shrink-0 text-[10px] uppercase ml-1">Gợi ý:</span>
                  {[
                    'Khách chê giá đắt so với dự án cũ, xử lý thế nào?',
                    'Khách không nghe máy 2 lần, soạn tin Zalo khơi gợi?',
                    'Khách đắn đo vay ngân hàng, kịch bản tư vấn lãi suất?',
                    'Đề xuất kịch bản chốt cọc trong tuần này',
                  ].map((promptText, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(promptText)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-slate-200 rounded-full whitespace-nowrap transition-colors shrink-0"
                    >
                      {promptText}
                    </button>
                  ))}
                </div>

                {/* INPUT KHUNG CHAT */}
                <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
                  <textarea
                    rows={2}
                    value={inputQuestion}
                    onChange={(e) => setInputQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={`Hỏi Cố vấn AI Claude về cách chăm sóc ${selectedLead?.customer_name || 'khách hàng'}... (Nhấn Enter để gửi)`}
                    className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none"
                  />
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => handleSendMessage()}
                    isLoading={isThinking}
                    disabled={!inputQuestion.trim()}
                    className="h-full px-4 rounded-xl"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CẤU HÌNH ANTHROPIC CLAUDE API KEY */}
      <Modal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        title="Cấu Hình Anthropic Claude API Key"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            Nền tảng CRM hỗ trợ tích hợp trực tiếp <strong>Claude 3.5 Sonnet</strong> từ Anthropic. Nếu bạn có API Key, hãy dán vào ô bên dưới để kích hoạt trí tuệ nhân tạo thế hệ mới nhất:
          </p>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Anthropic API Key (sk-ant-...)
            </label>
            <div className="relative">
              <KeyRound className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder="sk-ant-api03-..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Khóa API được lưu cục bộ trên trình duyệt của bạn (Local Storage) và không bị chia sẻ. Nếu để trống, hệ thống sẽ sử dụng AI Advisor Engine nội bộ được huấn luyện theo nghiệp vụ Bất động sản Việt Nam.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsKeyModalOpen(false)}
            >
              Đóng
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSaveApiKey}
            >
              Lưu Cấu Hình Key
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
