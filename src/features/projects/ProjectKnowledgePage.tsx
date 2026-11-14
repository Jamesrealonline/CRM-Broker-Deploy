// ========================================================
// REAL ESTATE CRM - PROJECT KNOWLEDGE & AI ENRICHMENT PAGE
// Tóm tắt văn bản <= 3000 ký tự (Tự parse nhãn), AI Enrich kèm nguồn & cờ unverified
// ========================================================

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Building2, 
  Sparkles, 
  Save, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  HelpCircle, 
  FileText,
  FileCheck,
  ShieldCheck,
  DollarSign,
  Award,
  TrendingUp,
  Percent,
  Edit3,
  Calendar,
  Clock,
  Trash2,
  Plus,
  Filter,
  History,
  ToggleLeft,
  ToggleRight,
  Layers,
  Sliders,
} from 'lucide-react';
import { projectRepository } from '@/data/repositories/projectRepository';
import { aiRepository, ProjectEnrichProposal } from '@/data/repositories/aiRepository';
import { 
  Project, 
  ProjectKnowledge, 
  ProjectFaq, 
  SoldProduct,
  ProjectCommissionPolicy,
  CommissionTier,
  RoleCommissionRate,
  RecognitionMilestone,
  ProjectUnit,
  UnitStatus
} from '@/domain/types';
import { TimeRangeFilter } from '@/domain/services/financialCalculationService';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/app/useAuthStore';

export const ProjectKnowledgePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();

  const [project, setProject] = useState<Project | null>(null);
  const [knowledge, setKnowledge] = useState<ProjectKnowledge | null>(null);
  const [faqs, setFaqs] = useState<ProjectFaq[]>([]);
  const [loading, setLoading] = useState(true);

  // Ô văn bản tóm tắt <= 3000 ký tự
  const [summaryText, setSummaryText] = useState('');
  const [isSavingSummary, setIsSavingSummary] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  // Module Hoa Hồng & Sản Phẩm Bán Được (Financials & Sales)
  const [timeFilter, setTimeFilter] = useState<'all' | 'week' | 'month' | 'quarter'>('all');
  const [financialStats, setFinancialStats] = useState<{
    total_contracts: number;
    total_revenue: number;
    total_commission: number;
    total_sale_commission: number;
    expected_commission: number;
    realized_commission: number;
    expected_sale_commission: number;
    realized_sale_commission: number;
    inventory: {
      totalUnits: number;
      soldUnits: number;
      depositUnits: number;
      bookingUnits: number;
      availableUnits: number;
    };
    sold_products: SoldProduct[];
    current_policy?: ProjectCommissionPolicy;
    policies: ProjectCommissionPolicy[];
  } | null>(null);

  // Modal Cấu Hình Chính Sách Hoa Hồng Theo Bậc
  const [commissionModalOpen, setCommissionModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'policy' | 'history'>('policy');
  const [editCompanyRate, setEditCompanyRate] = useState<number>(3.5);
  const [editMilestone, setEditMilestone] = useState<RecognitionMilestone>('first_installment');
  const [editValidFrom, setEditValidFrom] = useState<string>(new Date().toISOString().slice(0, 10));
  const [editValidTo, setEditValidTo] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editTiers, setEditTiers] = useState<CommissionTier[]>([]);
  const [editRoleRates, setEditRoleRates] = useState<RoleCommissionRate[]>([]);
  const [isSavingCommission, setIsSavingCommission] = useState(false);

  // AI Enrichment Modal
  const [enrichModalOpen, setEnrichModalOpen] = useState(false);
  const [proposals, setProposals] = useState<ProjectEnrichProposal[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);

  // Module Quản Lý Giỏ Hàng Sản Phẩm (Units)
  const [units, setUnits] = useState<ProjectUnit[]>([]);
  const [unitFilterStatus, setUnitFilterStatus] = useState<string>('all');
  const [unitFilterType, setUnitFilterType] = useState<string>('all');
  const [unitSearch, setUnitSearch] = useState<string>('');
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  
  // Form tạo căn mới
  const [unitCode, setUnitCode] = useState('');
  const [unitPropertyType, setUnitPropertyType] = useState('Căn hộ 2PN (2WC)');
  const [unitBlock, setUnitBlock] = useState('');
  const [unitFloor, setUnitFloor] = useState<number>(1);
  const [unitArea, setUnitArea] = useState<number>(65);
  const [unitPrice, setUnitPrice] = useState<number>(3500000000);
  const [unitDirection, setUnitDirection] = useState('Đông Nam');
  const [unitStatus, setUnitStatus] = useState<UnitStatus>('available');
  const [unitNotes, setUnitNotes] = useState('');
  const [isSavingUnit, setIsSavingUnit] = useState(false);

  const fetchProjectData = async (currentTimeFilter = timeFilter) => {
    if (!id) return;
    setLoading(true);
    try {
      const [proj, know, faqList, stats, unitList] = await Promise.all([
        projectRepository.getProjectById(id, currentUser || undefined),
        projectRepository.getProjectKnowledge(id, currentUser || undefined),
        projectRepository.getProjectFaqs(id, currentUser || undefined),
        projectRepository.getProjectFinancialStats(id, { preset: currentTimeFilter }),
        projectRepository.getProjectUnits(id),
      ]);
      setProject(proj);
      const effectiveKnowledge: ProjectKnowledge = know || {
        id: crypto.randomUUID(),
        project_id: id,
        location: proj?.location || '',
        property_type: proj?.property_type || '',
        price_range: proj?.expected_price_range || '',
        legal: '',
        progress: '',
        policy: '',
        highlights: '',
        summary_text: '',
        updated_at: new Date().toISOString(),
      };
      // Tự động tái tạo văn bản tóm tắt nếu summary_text đang rỗng nhưng các trường đã có dữ liệu
      if (!effectiveKnowledge.summary_text && (effectiveKnowledge.location || effectiveKnowledge.legal || effectiveKnowledge.price_range)) {
        effectiveKnowledge.summary_text = `Vị trí: ${effectiveKnowledge.location || ''}\n` +
          `Loại hình: ${effectiveKnowledge.property_type || ''}\n` +
          `Giá: ${effectiveKnowledge.price_range || ''}\n` +
          `Pháp lý: ${effectiveKnowledge.legal || ''}\n` +
          `Tiến độ: ${effectiveKnowledge.progress || ''}\n` +
          `Chính sách: ${effectiveKnowledge.policy || ''}\n` +
          `Điểm nhấn: ${effectiveKnowledge.highlights || ''}`;
      }
      setKnowledge(effectiveKnowledge);
      setSummaryText(effectiveKnowledge.summary_text || '');

      const effectiveFaqs = faqList && faqList.length > 0 
        ? faqList 
        : (proj ? aiRepository.generateProjectFaqs(proj.name, proj.developer, proj.location) : []);
      setFaqs(effectiveFaqs);
      setFinancialStats(stats as any);
      setUnits(unitList);

      // Populate policy form from active policy
      if (stats.current_policy) {
        const cp = stats.current_policy;
        setEditCompanyRate(cp.company_commission_rate);
        setEditMilestone(cp.recognition_milestone);
        setEditValidFrom(cp.valid_from);
        setEditValidTo(cp.valid_to || '');
        setEditNotes(cp.notes || '');
        setEditTiers(cp.tiers || []);
        setEditRoleRates(cp.role_rates || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [id, timeFilter, currentUser]);

  // Handler for adding a new progressive tier
  const handleAddTier = () => {
    const newTier: CommissionTier = {
      id: crypto.randomUUID(),
      policy_id: financialStats?.current_policy?.id || `pol-${id}`,
      tier_type: 'contract_count',
      min_threshold: editTiers.length > 0 ? (editTiers[editTiers.length - 1].max_threshold || 10) + 1 : 1,
      max_threshold: null,
      bonus_rate: 0.3,
      target_role: 'all',
      is_active: true,
    };
    setEditTiers([...editTiers, newTier]);
  };

  const handleRemoveTier = (tierId: string) => {
    setEditTiers(editTiers.filter(t => t.id !== tierId));
  };

  const handleToggleTier = (tierId: string) => {
    setEditTiers(editTiers.map(t => t.id === tierId ? { ...t, is_active: !t.is_active } : t));
  };

  const handleUpdateTierField = (tierId: string, field: keyof CommissionTier, value: any) => {
    setEditTiers(editTiers.map(t => t.id === tierId ? { ...t, [field]: value } : t));
  };

  const handleUpdateRoleRate = (role: string, default_rate: number) => {
    setEditRoleRates(editRoleRates.map(r => r.role === role ? { ...r, default_rate } : r));
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsSavingCommission(true);
    try {
      await projectRepository.saveCommissionPolicy({
        id: crypto.randomUUID(), // Tạo phiên bản chính sách mới để lưu lịch sử
        project_id: id,
        company_commission_rate: editCompanyRate,
        recognition_milestone: editMilestone,
        valid_from: editValidFrom,
        valid_to: editValidTo || null,
        is_active: true,
        notes: editNotes,
        tiers: editTiers,
        role_rates: editRoleRates,
      });
      setCommissionModalOpen(false);
      await fetchProjectData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingCommission(false);
    }
  };

  // Lưu tóm tắt văn bản và tự động điền các trường
  const handleSaveSummary = async () => {
    if (!id) return;
    setIsSavingSummary(true);
    try {
      const updated = await projectRepository.updateKnowledgeSummary(id, summaryText);
      setKnowledge(updated);
      setSaveSuccessMsg(true);
      setTimeout(() => setSaveSuccessMsg(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingSummary(false);
    }
  };

  // Kích hoạt AI Bổ sung thông tin tự động
  const handleStartEnrich = async () => {
    if (!project) return;
    setIsEnriching(true);
    setEnrichModalOpen(true);
    try {
      const results = await aiRepository.enrichProject(
        project.name,
        project.location,
        project.developer,
        project.property_type
      );
      // Mặc định chọn tất cả các trường đề xuất để tự động điền đầy đủ thông tin
      const mapped = results.map(p => {
        const currentVal = knowledge ? (knowledge[p.field] as string) : undefined;
        return {
          ...p,
          currentValue: currentVal,
          selected: true, // Mặc định luôn chọn tất cả các trường đề xuất
        };
      });
      setProposals(mapped);
    } catch (err) {
      console.error(err);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleToggleSelectProposal = (index: number) => {
    setProposals(prev => prev.map((item, idx) => idx === index ? { ...item, selected: !item.selected } : item));
  };

  const handleSelectAllProposals = (selected: boolean) => {
    setProposals(prev => prev.map(item => ({ ...item, selected })));
  };

  // Điền tự động tức thì toàn bộ 7 trường + Ô tóm tắt 30.000 ký tự + FAQs
  const handleAutoFillAll = async () => {
    if (!project || !id) return;
    setIsEnriching(true);
    try {
      const results = await aiRepository.enrichProject(
        project.name,
        project.location,
        project.developer,
        project.property_type
      );

      const baseKnowledge: ProjectKnowledge = knowledge || {
        id: crypto.randomUUID(),
        project_id: id,
        summary_text: '',
        updated_at: new Date().toISOString(),
      };
      const updated: ProjectKnowledge = { ...baseKnowledge };

      results.forEach(p => {
        (updated as any)[p.field] = p.proposedValue;
        (updated as any)[`${p.field}_source`] = p.sourceUrl;
        (updated as any)[`${p.field}_unverified`] = true;
      });

      // Tự sinh lại văn bản tóm tắt (tối đa 30.000 ký tự)
      const newSummary = `Vị trí: ${updated.location || ''}\n` +
                         `Loại hình: ${updated.property_type || ''}\n` +
                         `Giá: ${updated.price_range || ''}\n` +
                         `Pháp lý: ${updated.legal || ''}\n` +
                         `Tiến độ: ${updated.progress || ''}\n` +
                         `Chính sách: ${updated.policy || ''}\n` +
                         `Điểm nhấn: ${updated.highlights || ''}`;
      updated.summary_text = newSummary.slice(0, 30000);

      // Cập nhật State giao diện ngay lập tức
      setKnowledge(updated);
      setSummaryText(newSummary.slice(0, 30000));

      // Lưu trực tiếp vào Database Supabase và LocalStorage
      const saved = await projectRepository.saveProjectKnowledge(id, updated);
      setKnowledge(saved);
      setSummaryText(saved.summary_text || newSummary.slice(0, 30000));

      // Tự sinh và lưu các câu hỏi FAQ tương ứng với dự án
      const generatedFaqs = aiRepository.generateProjectFaqs(project.name, project.developer, project.location);
      const savedFaqs = await projectRepository.saveProjectFaqs(id, generatedFaqs);
      setFaqs(savedFaqs);

      setEnrichModalOpen(false);
      setSaveSuccessMsg(true);
      setTimeout(() => setSaveSuccessMsg(false), 3000);
    } catch (err: any) {
      console.error('Error applying auto fill all:', err);
      alert(err.message || 'Không thể tự động điền thông tin dự án.');
    } finally {
      setIsEnriching(false);
    }
  };

  const handleApplyEnrichment = async () => {
    if (!id || !project) return;
    setIsEnriching(true);
    try {
      const baseKnowledge: ProjectKnowledge = knowledge || {
        id: crypto.randomUUID(),
        project_id: id,
        summary_text: '',
        updated_at: new Date().toISOString(),
      };
      const updated: ProjectKnowledge = { ...baseKnowledge };

      proposals.forEach(p => {
        if (p.selected) {
          (updated as any)[p.field] = p.proposedValue;
          (updated as any)[`${p.field}_source`] = p.sourceUrl;
          (updated as any)[`${p.field}_unverified`] = true; // Gắn cờ unverified cho tới khi người dùng duyệt
        }
      });

      // Tự sinh lại văn bản tóm tắt (tối đa 30.000 ký tự)
      const newSummary = `Vị trí: ${updated.location || ''}\n` +
                         `Loại hình: ${updated.property_type || ''}\n` +
                         `Giá: ${updated.price_range || ''}\n` +
                         `Pháp lý: ${updated.legal || ''}\n` +
                         `Tiến độ: ${updated.progress || ''}\n` +
                         `Chính sách: ${updated.policy || ''}\n` +
                         `Điểm nhấn: ${updated.highlights || ''}`;
      updated.summary_text = newSummary.slice(0, 30000);

      // Cập nhật State giao diện ngay lập tức
      setKnowledge(updated);
      setSummaryText(newSummary.slice(0, 30000));

      // Lưu trực tiếp vào Database Supabase và LocalStorage
      const saved = await projectRepository.saveProjectKnowledge(id, updated);
      setKnowledge(saved);
      setSummaryText(saved.summary_text || newSummary.slice(0, 30000));

      // Tự sinh và lưu các câu hỏi FAQ tương ứng với dự án
      const generatedFaqs = aiRepository.generateProjectFaqs(project.name, project.developer, project.location);
      const savedFaqs = await projectRepository.saveProjectFaqs(id, generatedFaqs);
      setFaqs(savedFaqs);

      setEnrichModalOpen(false);
      setSaveSuccessMsg(true);
      setTimeout(() => setSaveSuccessMsg(false), 3000);
    } catch (err: any) {
      console.error('Error applying AI enrichment:', err);
      alert(err.message || 'Không thể lưu thông tin tri thức AI. Vui lòng thử lại.');
    } finally {
      setIsEnriching(false);
    }
  };

  // Quản lý Giỏ hàng (Units) Handlers
  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !unitCode) return;
    setIsSavingUnit(true);
    try {
      const created = await projectRepository.createProjectUnit({
        project_id: id,
        project_name: project?.name,
        unit_code: unitCode.trim(),
        property_type: unitPropertyType,
        block_tower: unitBlock.trim(),
        floor: Number(unitFloor),
        area_sqm: Number(unitArea),
        price: Number(unitPrice),
        direction: unitDirection,
        status: unitStatus,
        notes: unitNotes.trim(),
      });
      setUnits(prev => [created, ...prev]);
      setUnitModalOpen(false);
      setUnitCode('');
      setUnitNotes('');
    } catch (err) {
      console.error(err);
      alert('Không thể lưu sản phẩm vào giỏ hàng.');
    } finally {
      setIsSavingUnit(false);
    }
  };

  const handleUpdateUnitStatus = async (unitId: string, newStatus: UnitStatus) => {
    const updated = await projectRepository.updateProjectUnit(unitId, { status: newStatus });
    if (updated) {
      setUnits(prev => prev.map(u => u.id === unitId ? updated : u));
    }
  };

  const handleDeleteUnit = async (unitId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa sản phẩm này khỏi giỏ hàng?')) return;
    await projectRepository.deleteProjectUnit(unitId);
    setUnits(prev => prev.filter(u => u.id !== unitId));
  };

  const filteredUnits = units.filter(u => {
    if (unitFilterStatus !== 'all' && u.status !== unitFilterStatus) return false;
    if (unitFilterType !== 'all' && u.property_type !== unitFilterType) return false;
    if (unitSearch) {
      const q = unitSearch.toLowerCase().trim();
      return u.unit_code.toLowerCase().includes(q) || 
             (u.block_tower && u.block_tower.toLowerCase().includes(q)) ||
             (u.notes && u.notes.toLowerCase().includes(q));
    }
    return true;
  });

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

  if (loading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-96 w-full" /></div>;
  }

  if (!project) {
    return <div className="p-8 text-center text-slate-500">Không tìm thấy thông tin dự án hoặc bạn không có quyền truy cập vào dự án này.</div>;
  }

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & ACTIONS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/projects')} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{project.name}</h2>
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                {project.code}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Chủ đầu tư: <span className="font-semibold text-slate-700">{project.developer}</span> • {project.location}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCommissionModalOpen(true)}>
            <Edit3 className="h-4 w-4 mr-1.5" /> Cài đặt hoa hồng dự án
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/scripts')}>
            <FileText className="h-4 w-4 mr-1.5" /> Quản lý Sales Scripts
          </Button>
          <Button variant="outline" size="sm" onClick={handleStartEnrich}>
            <Sliders className="h-4 w-4 mr-1.5" /> Tùy chọn đề xuất AI
          </Button>
          <Button variant="primary" size="sm" onClick={handleAutoFillAll} isLoading={isEnriching}>
            <Sparkles className="h-4 w-4 mr-1.5" /> AI Tự Động Điền Đầy Đủ
          </Button>
        </div>
      </div>

      {/* MODULE CHÍNH SÁCH HOA HỒNG & HIỆU SUẤT BÁN HÀNG */}
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50/20 via-white to-indigo-50/20">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Percent className="h-4 w-4 text-blue-600" />
                Chính Sách Hoa Hồng & Thống Kê Bán Hàng Dự Án
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-slate-500">Mốc ghi nhận hoa hồng:</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                  <CheckCircle2 className="h-2.5 w-2.5 text-blue-600" />
                  {project.recognition_milestone === 'deposit' 
                    ? 'Đặt cọc' 
                    : project.recognition_milestone === 'contract' 
                    ? 'Ký HĐMB' 
                    : 'Đóng tiền Đợt 1'}
                </span>
                {financialStats?.current_policy?.valid_from && (
                  <span className="text-[10px] text-slate-400">
                    (Hiệu lực từ: {new Date(financialStats.current_policy.valid_from).toLocaleDateString('vi-VN')})
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* BỘ LỌC THỜI GIAN */}
              <div className="flex items-center gap-1.5 text-xs bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value as any)}
                  className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">Toàn bộ thời gian</option>
                  <option value="week">Tuần này</option>
                  <option value="month">Tháng này</option>
                  <option value="quarter">Quý này</option>
                </select>
              </div>

              <Button size="sm" variant="outline" className="text-xs" onClick={() => setCommissionModalOpen(true)}>
                <Edit3 className="h-3.5 w-3.5 mr-1 text-blue-600" /> Cấu hình chính sách
              </Button>
            </div>
          </div>
        </CardHeader>

        <div className="space-y-4">
          {/* 8 THẺ KPI TÀI CHÍNH & HOA HỒNG CHI TIẾT */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                <span>% Hoa Hồng CĐT</span>
                <Percent className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <div className="text-xl font-black text-blue-700 mt-1">
                {financialStats?.current_policy?.company_commission_rate ?? project.commission_rate ?? 3.5}%
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Sale: {editRoleRates.find(r => r.role === 'sale_agent')?.default_rate ?? project.sale_commission_rate ?? 1.8}%
              </div>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                <span>Bậc Hoa Hồng Lũy Tiến</span>
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div className="text-xl font-black text-emerald-700 mt-1">
                {financialStats?.current_policy?.tiers?.length || 3} bậc
              </div>
              <div className="text-[10px] text-emerald-600 font-medium truncate mt-0.5">
                {financialStats?.current_policy?.tiers?.filter(t => t.is_active).length || 3} bậc đang kích hoạt
              </div>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                <span>Tổng HĐMB Đã Ký</span>
                <FileCheck className="h-3.5 w-3.5 text-purple-600" />
              </div>
              <div className="text-xl font-black text-purple-700 mt-1">
                {financialStats?.total_contracts ?? 0} căn
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Hợp đồng mua bán chính thức</div>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                <span>Tổng Doanh Số Ký Kết</span>
                <DollarSign className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <div className="text-lg font-black text-slate-900 mt-1 truncate">
                {financialStats ? formatVND(financialStats.total_revenue) : '0 đ'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Tính từ các HĐMB xác nhận</div>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                <span>HH CĐT Dự Kiến</span>
                <Award className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <div className="text-lg font-black text-blue-700 mt-1 truncate">
                {financialStats ? formatVND(financialStats.expected_commission) : '0 đ'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Toàn bộ hợp đồng phát sinh</div>
            </div>

            <div className="p-3.5 bg-gradient-to-br from-emerald-50 to-white rounded-xl border border-emerald-200 shadow-sm">
              <div className="text-[11px] font-semibold text-emerald-800 flex items-center justify-between">
                <span>HH CĐT Thực Nhận</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div className="text-lg font-black text-emerald-700 mt-1 truncate">
                {financialStats ? formatVND(financialStats.realized_commission) : '0 đ'}
              </div>
              <div className="text-[10px] text-emerald-700 font-medium mt-0.5">Đã đạt mốc ghi nhận</div>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                <span>HH Sale Dự Kiến</span>
                <Award className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <div className="text-lg font-black text-amber-700 mt-1 truncate">
                {financialStats ? formatVND(financialStats.expected_sale_commission) : '0 đ'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Bao gồm thưởng lũy tiến</div>
            </div>

            <div className="p-3.5 bg-gradient-to-br from-amber-50 to-white rounded-xl border border-amber-200 shadow-sm">
              <div className="text-[11px] font-semibold text-amber-800 flex items-center justify-between">
                <span>HH Sale Thực Nhận</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <div className="text-lg font-black text-amber-700 mt-1 truncate">
                {financialStats ? formatVND(financialStats.realized_sale_commission) : '0 đ'}
              </div>
              <div className="text-[10px] text-amber-700 font-medium mt-0.5">Đủ điều kiện chi trả</div>
            </div>
          </div>

          {/* THỐNG KÊ TỒN KHO SẢN PHẨM DỰ ÁN */}
          {financialStats?.inventory && (
            <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-3 text-xs font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-blue-600" />
                  Thống Kê Cơ Cấu Giỏ Hàng Dự Án
                </span>
                <span className="text-[11px] font-medium text-slate-500">
                  Quy mô dự án: <strong className="text-slate-800">{financialStats.inventory.totalUnits}</strong> sản phẩm
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-2.5 bg-white rounded-lg border border-purple-200">
                  <div className="text-[11px] text-purple-700 font-semibold">Đã Bán (HĐMB)</div>
                  <div className="text-lg font-black text-purple-900">{financialStats.inventory.soldUnits}</div>
                  <div className="text-[10px] text-slate-400">
                    {Math.round((financialStats.inventory.soldUnits / financialStats.inventory.totalUnits) * 100)}% giỏ hàng
                  </div>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-blue-200">
                  <div className="text-[11px] text-blue-700 font-semibold">Đã Đặt Cọc</div>
                  <div className="text-lg font-black text-blue-900">{financialStats.inventory.depositUnits}</div>
                  <div className="text-[10px] text-slate-400">Chờ hoàn tất HĐMB</div>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-amber-200">
                  <div className="text-[11px] text-amber-700 font-semibold">Đang Giữ Chỗ (Booking)</div>
                  <div className="text-lg font-black text-amber-900">{financialStats.inventory.bookingUnits}</div>
                  <div className="text-[10px] text-slate-400">Phiếu ưu tiên chọn căn</div>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-emerald-200">
                  <div className="text-[11px] text-emerald-700 font-semibold">Sản Phẩm Còn Lại</div>
                  <div className="text-lg font-black text-emerald-900">{financialStats.inventory.availableUnits}</div>
                  <div className="text-[10px] text-slate-400">Sẵn sàng phân phối</div>
                </div>
              </div>
            </div>
          )}

          {/* BẢNG CÁC SẢN PHẨM BÁN ĐƯỢC */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Danh Sách Sản Phẩm Đã Bán ({financialStats?.sold_products.length || 0} căn)
              </span>
              <span className="text-[11px] text-slate-500">
                Thống kê tự động từ hợp đồng mua bán chính thức
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Mã Căn/Lô</th>
                    <th className="p-2.5">Loại Hình</th>
                    <th className="p-2.5 text-right">Giá Bán (GTGD)</th>
                    <th className="p-2.5">Số HĐMB</th>
                    <th className="p-2.5">Khách Hàng</th>
                    <th className="p-2.5">Chuyên Viên Chốt</th>
                    <th className="p-2.5">Ngày Bán</th>
                    <th className="p-2.5 text-right">HH CĐT</th>
                    <th className="p-2.5 text-right">HH Sale</th>
                    <th className="p-2.5 text-center">Trạng Thái HH</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!financialStats || financialStats.sold_products.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-slate-400">
                        Chưa có sản phẩm nào được ký HĐMB trong khoảng thời gian này.
                      </td>
                    </tr>
                  ) : (
                    financialStats.sold_products.map((sp) => (
                      <tr key={sp.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2.5 font-bold text-blue-700">
                          {sp.unit_code}
                        </td>
                        <td className="p-2.5 text-slate-600">
                          {sp.property_type}
                        </td>
                        <td className="p-2.5 text-right font-black text-slate-900">
                          {formatFullVND(sp.deal_value)}
                        </td>
                        <td className="p-2.5 font-mono text-[11px] font-semibold text-slate-800">
                          {sp.contract_code}
                        </td>
                        <td className="p-2.5">
                          <div className="font-semibold text-slate-900">{sp.customer_name}</div>
                          <div className="text-[10px] text-slate-400">{sp.customer_phone}</div>
                        </td>
                        <td className="p-2.5">
                          <div className="font-semibold text-slate-800">{sp.sale_name}</div>
                          <div className="text-[10px] text-slate-400">{sp.team_name || 'Team Q1'}</div>
                        </td>
                        <td className="p-2.5 text-slate-500">
                          {new Date(sp.sold_date).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="p-2.5 text-right font-bold text-blue-700">
                          {formatFullVND(sp.commission_amount)}
                        </td>
                        <td className="p-2.5 text-right font-bold text-amber-700">
                          {formatFullVND(sp.sale_commission_amount)}
                        </td>
                        <td className="p-2.5 text-center">
                          {sp.first_installment_paid ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Thực nhận
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <Clock className="h-3 w-3 text-amber-600" /> Dự kiến
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Card>

      {/* 1.5. QUẢN LÝ GIỎ HÀNG DỰ ÁN (PROJECT INVENTORY) */}
      <Card className="border-indigo-200 bg-white shadow-sm overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-indigo-50/50 via-white to-blue-50/30 border-b border-indigo-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-indigo-600" />
                Quản Lý Giỏ Hàng & Bảng Hàng Sản Phẩm ({units.length} căn/lô)
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Quản lý chi tiết theo mã sản phẩm, loại hình, diện tích, giá niêm yết và trạng thái giao dịch thời gian thực.
              </p>
            </div>

            <Button size="sm" variant="primary" onClick={() => setUnitModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" /> Thêm sản phẩm vào giỏ hàng
            </Button>
          </div>
        </CardHeader>

        <div className="p-4 space-y-4">
          {/* STATS PILLS THEO TRẠNG THÁI */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200/80">
              <div className="text-[10px] uppercase font-bold text-emerald-700">🟢 Còn trống (Bảng hàng)</div>
              <div className="text-xl font-black text-emerald-800 mt-0.5">
                {units.filter(u => u.status === 'available').length}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200/80">
              <div className="text-[10px] uppercase font-bold text-amber-700">🟡 Đang giữ chỗ (Booking)</div>
              <div className="text-xl font-black text-amber-800 mt-0.5">
                {units.filter(u => u.status === 'booking').length}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-orange-50 border border-orange-200/80">
              <div className="text-[10px] uppercase font-bold text-orange-700">🟠 Đã cọc (Deposit)</div>
              <div className="text-xl font-black text-orange-800 mt-0.5">
                {units.filter(u => u.status === 'deposit').length}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200">
              <div className="text-[10px] uppercase font-bold text-slate-600">⚪ Đã bán (HĐMB)</div>
              <div className="text-xl font-black text-slate-800 mt-0.5">
                {units.filter(u => u.status === 'sold').length}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200/80">
              <div className="text-[10px] uppercase font-bold text-rose-700">🔴 Khóa bảng hàng</div>
              <div className="text-xl font-black text-rose-800 mt-0.5">
                {units.filter(u => u.status === 'locked').length}
              </div>
            </div>
          </div>

          {/* BỘ LỌC & TÌM KIẾM SẢN PHẨM */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm mã căn (OG-S7...), phân khu, ghi chú..."
                value={unitSearch}
                onChange={(e) => setUnitSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={unitFilterStatus}
                onChange={(e) => setUnitFilterStatus(e.target.value)}
                className="text-xs py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none text-slate-700"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="available">🟢 Còn trống</option>
                <option value="booking">🟡 Đang giữ chỗ</option>
                <option value="deposit">🟠 Đã cọc</option>
                <option value="sold">⚪ Đã bán</option>
                <option value="locked">🔴 Khóa</option>
              </select>

              <select
                value={unitFilterType}
                onChange={(e) => setUnitFilterType(e.target.value)}
                className="text-xs py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none text-slate-700 max-w-[160px] truncate"
              >
                <option value="all">Tất cả loại hình</option>
                {Array.from(new Set(units.map(u => u.property_type))).map(pt => (
                  <option key={pt} value={pt}>{pt}</option>
                ))}
              </select>
            </div>
          </div>

          {/* BẢNG GIỎ HÀNG */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Mã Căn/Lô</th>
                  <th className="p-2.5">Loại Hình</th>
                  <th className="p-2.5">Tòa / Phân Khu</th>
                  <th className="p-2.5 text-center">Tầng</th>
                  <th className="p-2.5 text-right">Diện Tích</th>
                  <th className="p-2.5 text-right">Giá Niêm Yết</th>
                  <th className="p-2.5 text-center">Trạng Thái</th>
                  <th className="p-2.5">Khách / Chuyên Viên</th>
                  <th className="p-2.5 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUnits.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-slate-400">
                      Không tìm thấy sản phẩm nào trong giỏ hàng phù hợp bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredUnits.map((u) => {
                    const statusConfig = {
                      available: { label: 'Còn trống', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                      booking: { label: 'Giữ chỗ', color: 'bg-amber-50 text-amber-700 border-amber-200' },
                      deposit: { label: 'Đã cọc', color: 'bg-orange-50 text-orange-700 border-orange-200' },
                      sold: { label: 'Đã bán', color: 'bg-slate-100 text-slate-700 border-slate-300' },
                      locked: { label: 'Khóa', color: 'bg-rose-50 text-rose-700 border-rose-200' },
                    }[u.status] || { label: u.status, color: 'bg-slate-50 text-slate-600 border-slate-200' };

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2.5 font-bold text-indigo-700">
                          {u.unit_code}
                          {u.direction && <span className="block text-[10px] font-normal text-slate-400">Hướng: {u.direction}</span>}
                        </td>
                        <td className="p-2.5 text-slate-700 font-medium">{u.property_type}</td>
                        <td className="p-2.5 text-slate-600">{u.block_tower || '---'}</td>
                        <td className="p-2.5 text-center text-slate-600 font-mono">{u.floor || '---'}</td>
                        <td className="p-2.5 text-right font-medium text-slate-800">{u.area_sqm ? `${u.area_sqm} m²` : '---'}</td>
                        <td className="p-2.5 text-right font-black text-slate-900">{formatFullVND(u.price)}</td>
                        <td className="p-2.5 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="p-2.5">
                          {u.customer_name ? (
                            <div>
                              <div className="font-semibold text-slate-800">{u.customer_name}</div>
                              {u.sale_name && <div className="text-[10px] text-slate-400">Sale: {u.sale_name}</div>}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Chưa giao dịch</span>
                          )}
                        </td>
                        <td className="p-2.5 text-right space-x-1.5 whitespace-nowrap">
                          {/* ĐỔI TRẠNG THÁI NHANH */}
                          <select
                            value={u.status}
                            onChange={(e) => handleUpdateUnitStatus(u.id, e.target.value as UnitStatus)}
                            className="text-[10px] font-semibold py-1 px-1.5 rounded border border-slate-200 bg-white cursor-pointer"
                          >
                            <option value="available">Còn trống</option>
                            <option value="booking">Giữ chỗ</option>
                            <option value="deposit">Đã cọc</option>
                            <option value="sold">Đã bán</option>
                            <option value="locked">Khóa</option>
                          </select>
                          <button
                            onClick={() => handleDeleteUnit(u.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                            title="Xóa khỏi giỏ hàng"
                          >
                            <Trash2 className="h-3.5 w-3.5 inline" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Đã lưu tóm tắt và tự động trích xuất các trường thông tin thành công!</span>
        </div>
      )}

      {/* 2. KHUNG DÁN VĂN BẢN TÓM TẮT DỰ ÁN (<= 30.000 KÝ TỰ) */}
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50/20 to-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                Ô Tóm Tắt Dự Án Dạng Văn Bản (Tối đa 30.000 ký tự)
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Không upload file để tiết kiệm tài nguyên database. Định dạng các dòng dạng "Nhãn: nội dung" (Vị trí:, Giá:, Pháp lý:, Tiến độ:, Chính sách:, Điểm nhấn:) để hệ thống tự điền.
              </p>
            </div>
            <span className={`text-xs font-semibold ${summaryText.length > 28000 ? 'text-rose-600' : 'text-slate-500'}`}>
              {summaryText.length.toLocaleString()} / 30.000 ký tự
            </span>
          </div>
        </CardHeader>

        <div className="space-y-3">
          <textarea
            rows={7}
            maxLength={30000}
            value={summaryText}
            onChange={(e) => setSummaryText(e.target.value)}
            placeholder="Dán nội dung tóm tắt dự án tại đây... Ví dụ:
Vị trí: Số 259 Xa Lộ Hà Nội, An Phú, Thủ Đức
Loại hình: Căn hộ cao cấp 1-3PN
Giá: 110 - 150 triệu/m²
Pháp lý: Sổ hồng sở hữu lâu dài
Tiến độ: Đang hoàn thiện bàn giao quý 4
Chính sách: Vay 70% lãi suất 0% trong 24 tháng
Điểm nhấn: Kiến trúc mặt đứng xanh 3D lớn nhất Việt Nam"
            className="w-full text-xs font-mono p-3.5 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 shadow-inner leading-relaxed bg-white"
          />

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500 italic">
              Khi bấm lưu, các script Tự động (is_auto) của dự án sẽ tự động cập nhật nội dung mới.
            </span>
            <Button size="sm" variant="primary" onClick={handleSaveSummary} isLoading={isSavingSummary}>
              <Save className="h-4 w-4 mr-1.5" /> Lưu Tóm Tắt & Tự Điền
            </Button>
          </div>
        </div>
      </Card>

      {/* 3. CÁC TRƯỜNG THÔNG TIN ĐÃ ĐƯỢC ĐIỀN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[
          { label: 'Vị trí địa lý', value: knowledge?.location, unverified: knowledge?.location_unverified, source: knowledge?.location_source },
          { label: 'Loại hình phát triển', value: knowledge?.property_type, unverified: knowledge?.property_type_unverified, source: knowledge?.property_type_source },
          { label: 'Khung giá bán & thanh toán', value: knowledge?.price_range, unverified: knowledge?.price_range_unverified, source: knowledge?.price_range_source },
          { label: 'Hồ sơ pháp lý', value: knowledge?.legal, unverified: knowledge?.legal_unverified, source: knowledge?.legal_source },
          { label: 'Tiến độ xây dựng & Bàn giao', value: knowledge?.progress, unverified: knowledge?.progress_unverified, source: knowledge?.progress_source },
          { label: 'Chính sách ưu đãi & Ngân hàng', value: knowledge?.policy, unverified: knowledge?.policy_unverified, source: knowledge?.policy_source },
          { label: 'Điểm nhấn độc quyền (Highlights)', value: knowledge?.highlights, unverified: knowledge?.highlights_unverified, source: knowledge?.highlights_source },
        ].map((item, idx) => (
          <Card key={idx} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">{item.label}</span>
              {item.unverified && (
                <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1 font-medium">
                  <AlertTriangle className="h-2.5 w-2.5" /> Chưa xác minh
                </span>
              )}
            </div>

            <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 min-h-[48px] flex items-center">
              {item.value ? (
                <span>
                  {item.value} {item.unverified ? <span className="text-amber-600 font-medium">(chưa xác minh)</span> : null}
                </span>
              ) : (
                <span className="text-slate-400 italic">Chưa có thông tin</span>
              )}
            </div>

            {item.source && (
              <div className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="truncate">Nguồn: {item.source}</span>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* 4. CÂU HỎI THƯỜNG GẶP FAQ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-blue-600" />
            Hỏi Đáp Trọng Tâm Dự Án (Project FAQ)
          </CardTitle>
        </CardHeader>
        <div className="space-y-3">
          {faqs.map((faq) => (
            <div key={faq.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="text-blue-600">Q:</span> {faq.question}
              </div>
              <div className="text-slate-600 pl-4">
                <span className="font-semibold text-emerald-700">A:</span> {faq.answer}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 5. MODAL AI BỔ SUNG THÔNG TIN TỰ ĐỘNG (DRAFT & REVIEW) */}
      <Modal
        isOpen={enrichModalOpen}
        onClose={() => setEnrichModalOpen(false)}
        title="AI Tự Động Tìm Kiếm & Đề Xuất Thông Tin Dự Án"
        description="Toàn bộ 7 trường thông tin và bộ câu hỏi FAQ đã được AI chọn sẵn để tự động điền đầy đủ dữ liệu chuyên sâu cho dự án."
        maxWidth="xl"
      >
        {isEnriching ? (
          <div className="p-10 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-3"></div>
            <p className="text-xs font-bold text-slate-800">AI đang quét dữ liệu chính thống cho dự án "{project.name}"...</p>
            <p className="text-[11px] text-slate-400 mt-1">Đang trích xuất Vị trí, Pháp lý, Giá, Tiến độ, Chính sách, Điểm nhấn và FAQ.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <p className="text-slate-600">
                Tất cả các trường đã được tick chọn sẵn. Bạn có thể bấm "Áp Dụng Các Trường Đã Chọn" hoặc "⚡ Điền Ngay Toàn Bộ" để hoàn tất.
              </p>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSelectAllProposals(true)}
                  className="px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200"
                >
                  Chọn tất cả
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectAllProposals(false)}
                  className="px-2 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {proposals.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleToggleSelectProposal(idx)}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                    item.selected ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="flex items-center gap-2 font-bold text-slate-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => handleToggleSelectProposal(idx)}
                        className="rounded text-blue-600"
                      />
                      <span>{item.label}</span>
                    </label>
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Gắn cờ chưa kiểm chứng
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] mt-2">
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold block mb-0.5">Giá trị hiện tại:</span>
                      <span className="text-slate-600">{item.currentValue || '(Trống)'}</span>
                    </div>
                    <div className="bg-blue-50/50 p-2 rounded border border-blue-100">
                      <span className="text-[10px] text-blue-700 font-bold block mb-0.5">AI đề xuất mới:</span>
                      <span className="text-slate-800 font-medium">{item.proposedValue}</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />
                    <span>Nguồn: {item.sourceUrl}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setEnrichModalOpen(false)}>
                Hủy bỏ
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleAutoFillAll} isLoading={isEnriching} className="border-blue-300 text-blue-700 bg-blue-50/50 hover:bg-blue-100">
                  <Sparkles className="h-3.5 w-3.5 mr-1 text-blue-600" />
                  Điền Ngay Tất Cả (1-Click)
                </Button>
                <Button variant="primary" size="sm" onClick={handleApplyEnrichment} isLoading={isEnriching}>
                  Áp Dụng Các Trường Đã Chọn
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 6. MODAL CẤU HÌNH CHÍNH SÁCH HOA HỒNG DỰ ÁN TOÀN DIỆN */}
      <Modal
        isOpen={commissionModalOpen}
        onClose={() => setCommissionModalOpen(false)}
        title={`Chính Sách Hoa Hồng & Bậc Lũy Tiến: ${project.name}`}
        description="Cấu hình % CĐT chi trả, bậc lũy tiến, phân bổ vai trò, mốc ghi nhận và thời gian hiệu lực."
        maxWidth="2xl"
      >
        <div className="space-y-4">
          {/* TABS TRONG MODAL */}
          <div className="flex items-center gap-3 border-b border-slate-200">
            <button
              onClick={() => setModalTab('policy')}
              className={`pb-2 text-xs font-bold transition-colors border-b-2 ${
                modalTab === 'policy'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Cấu Hình Chính Sách & Bậc Lũy Tiến
            </button>
            <button
              onClick={() => setModalTab('history')}
              className={`pb-2 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
                modalTab === 'history'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              Lịch Sử Thay Đổi Chính Sách ({financialStats?.policies?.length || 1})
            </button>
          </div>

          {modalTab === 'policy' ? (
            <form onSubmit={handleSavePolicy} className="space-y-4">
              {/* PHẦN 1: TỶ LỆ CĐT & MỐC GHI NHẬN */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    % Hoa hồng Công ty nhận từ CĐT *
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    required
                    value={editCompanyRate}
                    onChange={(e) => setEditCompanyRate(Number(e.target.value))}
                    placeholder="Ví dụ: 3.5"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">Tổng hoa hồng chủ đầu tư cam kết chi trả cho sàn.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mốc Đủ Điều Kiện Ghi Nhận Hoa Hồng *
                  </label>
                  <select
                    value={editMilestone}
                    onChange={(e) => setEditMilestone(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="first_installment">Đóng tiền Đợt 1 (Mặc định chuẩn thị trường)</option>
                    <option value="contract">Ký Hợp đồng mua bán (HĐMB)</option>
                    <option value="deposit">Đặt cọc thành công</option>
                  </select>
                  <p className="text-[10px] text-slate-500 mt-0.5">Hoa hồng sẽ chuyển sang trạng thái "Thực nhận" khi đạt mốc này.</p>
                </div>
              </div>

              {/* PHẦN 2: THỜI GIAN HIỆU LỰC */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hiệu lực Từ Ngày *</label>
                  <Input
                    type="date"
                    required
                    value={editValidFrom}
                    onChange={(e) => setEditValidFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Đến Ngày (Để trống nếu vô hạn)</label>
                  <Input
                    type="date"
                    value={editValidTo}
                    onChange={(e) => setEditValidTo(e.target.value)}
                  />
                </div>
              </div>

              {/* PHẦN 3: PHÂN BỔ TỶ LỆ HOA HỒNG THEO CẤP BẬC */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Tỷ Lệ Hoa Hồng Cơ Bản Theo Cấp Bậc / Vai Trò</span>
                  <span className="text-[10px] text-slate-500 font-normal">% trên giá trị giao dịch</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-semibold text-slate-600 block mb-1">Sale Agent</span>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full text-xs p-1.5 border border-slate-200 rounded bg-white font-bold text-amber-700"
                      value={editRoleRates.find(r => r.role === 'sale_agent')?.default_rate ?? 1.8}
                      onChange={(e) => handleUpdateRoleRate('sale_agent', Number(e.target.value))}
                    />
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-semibold text-slate-600 block mb-1">Team Leader</span>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full text-xs p-1.5 border border-slate-200 rounded bg-white font-bold text-blue-700"
                      value={editRoleRates.find(r => r.role === 'team_leader')?.default_rate ?? 0.4}
                      onChange={(e) => handleUpdateRoleRate('team_leader', Number(e.target.value))}
                    />
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-semibold text-slate-600 block mb-1">Trưởng Phòng / GĐ Sàn</span>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full text-xs p-1.5 border border-slate-200 rounded bg-white font-bold text-purple-700"
                      value={editRoleRates.find(r => r.role === 'sales_manager')?.default_rate ?? 0.3}
                      onChange={(e) => handleUpdateRoleRate('sales_manager', Number(e.target.value))}
                    />
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-semibold text-slate-600 block mb-1">Tổng Giám Đốc</span>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full text-xs p-1.5 border border-slate-200 rounded bg-white font-bold text-slate-800"
                      value={editRoleRates.find(r => r.role === 'director')?.default_rate ?? 0.2}
                      onChange={(e) => handleUpdateRoleRate('director', Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              {/* PHẦN 4: BẬC HOA HỒNG LŨY TIẾN (TIERS) */}
              <div className="p-3 bg-emerald-50/40 rounded-xl border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                      Quy Chế Hoa Hồng Lũy Tiến Theo Bậc (Tiers)
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Cấu hình thưởng thêm % khi đạt mốc doanh số hoặc số lượng HĐMB chốt được.
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" className="text-xs" onClick={handleAddTier}>
                    <Plus className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Thêm Bậc Mới
                  </Button>
                </div>

                <div className="overflow-x-auto border border-emerald-200 rounded-lg bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-emerald-50/70 text-slate-700 font-semibold border-b border-emerald-100">
                      <tr>
                        <th className="p-2">Loại Bậc</th>
                        <th className="p-2">Từ Mốc</th>
                        <th className="p-2">Đến Mốc</th>
                        <th className="p-2">% Thưởng Thêm</th>
                        <th className="p-2 text-center">Bật / Tắt</th>
                        <th className="p-2 text-center">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {editTiers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-400">
                            Chưa có bậc hoa hồng lũy tiến nào. Bấm "Thêm Bậc Mới" để cấu hình.
                          </td>
                        </tr>
                      ) : (
                        editTiers.map((tier, idx) => (
                          <tr key={tier.id} className="hover:bg-slate-50">
                            <td className="p-2">
                              <select
                                value={tier.tier_type}
                                onChange={(e) => handleUpdateTierField(tier.id, 'tier_type', e.target.value)}
                                className="p-1 border border-slate-200 rounded bg-white text-[11px]"
                              >
                                <option value="contract_count">Số HĐMB (Căn)</option>
                                <option value="deal_value">Doanh Số (VNĐ)</option>
                              </select>
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                className="w-20 p-1 border border-slate-200 rounded bg-white text-[11px] font-bold"
                                value={tier.min_threshold}
                                onChange={(e) => handleUpdateTierField(tier.id, 'min_threshold', Number(e.target.value))}
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                placeholder="Vượt mốc"
                                className="w-20 p-1 border border-slate-200 rounded bg-white text-[11px]"
                                value={tier.max_threshold ?? ''}
                                onChange={(e) => handleUpdateTierField(tier.id, 'max_threshold', e.target.value ? Number(e.target.value) : null)}
                              />
                            </td>
                            <td className="p-2">
                              <div className="flex items-center gap-1">
                                <span className="text-emerald-700 font-bold">+</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  className="w-16 p-1 border border-slate-200 rounded bg-white text-[11px] font-black text-emerald-700"
                                  value={tier.bonus_rate}
                                  onChange={(e) => handleUpdateTierField(tier.id, 'bonus_rate', Number(e.target.value))}
                                />
                                <span className="text-[11px] text-slate-500">%</span>
                              </div>
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleTier(tier.id)}
                                className="text-xs"
                              >
                                {tier.is_active ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    Đang Bật
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600">
                                    Đang Tắt
                                  </span>
                                )}
                              </button>
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveTier(tier.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ghi Chú Phiên Bản Chính Sách</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Ghi chú về phân kỳ áp dụng, điều khoản bổ sung từ CĐT..."
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setCommissionModalOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isSavingCommission}>
                  {isSavingCommission ? 'Đang lưu...' : 'Lưu & Kích Hoạt Phiên Bản Chính Sách Mới'}
                </Button>
              </div>
            </form>
          ) : (
            /* TAB LỊCH SỬ THAY ĐỔI CHÍNH SÁCH */
            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              {financialStats?.policies && financialStats.policies.length > 0 ? (
                financialStats.policies.map((p, idx) => (
                  <div
                    key={p.id}
                    className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                      p.is_active ? 'border-blue-400 bg-blue-50/30' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">Phiên bản {financialStats.policies.length - idx}</span>
                        {p.is_active && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Đang hiệu lực
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {new Date(p.valid_from).toLocaleDateString('vi-VN')} {p.valid_to ? `- ${new Date(p.valid_to).toLocaleDateString('vi-VN')}` : '(Không thời hạn)'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-2 bg-slate-50 rounded-lg text-[11px]">
                      <div>Hoa hồng CĐT: <strong>{p.company_commission_rate}%</strong></div>
                      <div>Mốc ghi nhận: <strong>{p.recognition_milestone}</strong></div>
                      <div>Số bậc lũy tiến: <strong>{p.tiers?.length || 0} bậc</strong></div>
                    </div>

                    {p.notes && <p className="text-[11px] text-slate-500 italic">{p.notes}</p>}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400">Chưa có lịch sử thay đổi chính sách nào.</div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL THÊM SẢN PHẨM VÀO GIỎ HÀNG */}
      <Modal
        isOpen={unitModalOpen}
        onClose={() => setUnitModalOpen(false)}
        title="Thêm Sản Phẩm Mới Vào Giỏ Hàng Dự Án"
        description={`Bổ sung căn hộ / nhà phố vào bảng hàng của dự án ${project.name}.`}
        maxWidth="md"
      >
        <form onSubmit={handleCreateUnit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Mã Căn / Mã Sản Phẩm *"
              required
              value={unitCode}
              onChange={(e) => setUnitCode(e.target.value)}
              placeholder="Ví dụ: OG-S7.02-15.08"
            />
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Loại Hình *</label>
              <select
                value={unitPropertyType}
                onChange={(e) => setUnitPropertyType(e.target.value)}
                className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white"
              >
                <option value="Căn hộ 1PN (1WC)">Căn hộ 1PN (1WC)</option>
                <option value="Căn hộ 1PN+1">Căn hộ 1PN+1</option>
                <option value="Căn hộ 2PN (1WC)">Căn hộ 2PN (1WC)</option>
                <option value="Căn hộ 2PN (2WC)">Căn hộ 2PN (2WC)</option>
                <option value="Căn hộ 3PN">Căn hộ 3PN</option>
                <option value="Penthouse / Duplex">Penthouse / Duplex</option>
                <option value="Shophouse Khối Đế">Shophouse Khối Đế</option>
                <option value="Nhà phố liền kề">Nhà phố liền kề</option>
                <option value="Biệt thự Song lập">Biệt thự Song lập</option>
                <option value="Biệt thự Đơn lập">Biệt thự Đơn lập</option>
                <option value="Đất nền">Đất nền</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Tòa / Phân Khu"
              value={unitBlock}
              onChange={(e) => setUnitBlock(e.target.value)}
              placeholder="Tòa S7.02 / Origami"
            />
            <Input
              label="Tầng"
              type="number"
              value={unitFloor}
              onChange={(e) => setUnitFloor(Number(e.target.value))}
            />
            <Input
              label="Diện tích (m²)"
              type="number"
              step="0.1"
              value={unitArea}
              onChange={(e) => setUnitArea(Number(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Giá Bán Niêm Yết (VNĐ) *"
              type="number"
              required
              value={unitPrice}
              onChange={(e) => setUnitPrice(Number(e.target.value))}
            />
            <Input
              label="Hướng Ban Công / Cửa"
              value={unitDirection}
              onChange={(e) => setUnitDirection(e.target.value)}
              placeholder="Đông Nam / Tây Bắc"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Trạng Thái Ban Đầu</label>
              <select
                value={unitStatus}
                onChange={(e) => setUnitStatus(e.target.value as UnitStatus)}
                className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white"
              >
                <option value="available">🟢 Còn trống (Bảng hàng)</option>
                <option value="booking">🟡 Đang giữ chỗ</option>
                <option value="deposit">🟠 Đã cọc</option>
                <option value="sold">⚪ Đã bán</option>
                <option value="locked">🔴 Khóa bảng hàng</option>
              </select>
            </div>
            <Input
              label="Ghi chú đặc điểm căn"
              value={unitNotes}
              onChange={(e) => setUnitNotes(e.target.value)}
              placeholder="Căn góc view hồ bơi, chiết khấu 3%..."
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setUnitModalOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSavingUnit} className="bg-indigo-600 hover:bg-indigo-700">
              Lưu Vào Bảng Hàng
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
