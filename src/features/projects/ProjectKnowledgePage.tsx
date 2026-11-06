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
  ShieldCheck
} from 'lucide-react';
import { projectRepository } from '@/data/repositories/projectRepository';
import { aiRepository, ProjectEnrichProposal } from '@/data/repositories/aiRepository';
import { Project, ProjectKnowledge, ProjectFaq } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';

export const ProjectKnowledgePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [knowledge, setKnowledge] = useState<ProjectKnowledge | null>(null);
  const [faqs, setFaqs] = useState<ProjectFaq[]>([]);
  const [loading, setLoading] = useState(true);

  // Ô văn bản tóm tắt <= 3000 ký tự
  const [summaryText, setSummaryText] = useState('');
  const [isSavingSummary, setIsSavingSummary] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  // AI Enrichment Modal
  const [enrichModalOpen, setEnrichModalOpen] = useState(false);
  const [proposals, setProposals] = useState<ProjectEnrichProposal[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [proj, know, faqList] = await Promise.all([
          projectRepository.getProjectById(id),
          projectRepository.getProjectKnowledge(id),
          projectRepository.getProjectFaqs(id),
        ]);
        setProject(proj);
        setKnowledge(know);
        setSummaryText(know?.summary_text || '');
        setFaqs(faqList);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [id]);

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
      const results = await aiRepository.enrichProject(project.name, project.location, project.developer);
      // Áp dụng quy tắc mục 8: Trường trống mặc định được chọn, trường đã có dữ liệu mặc định không bị ghi đè
      const mapped = results.map(p => {
        const currentVal = knowledge ? (knowledge[p.field] as string) : undefined;
        return {
          ...p,
          currentValue: currentVal,
          selected: !currentVal, // Trống -> mặc định chọn, đã có -> không chọn mặc định
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

  const handleApplyEnrichment = async () => {
    if (!id || !knowledge) return;
    const updated = { ...knowledge };

    proposals.forEach(p => {
      if (p.selected) {
        (updated as any)[p.field] = p.proposedValue;
        (updated as any)[`${p.field}_source`] = p.sourceUrl;
        (updated as any)[`${p.field}_unverified`] = true; // Gắn cờ unverified cho tới khi người dùng duyệt
      }
    });

    setKnowledge(updated);
    setEnrichModalOpen(false);
    // Tự sinh lại văn bản tóm tắt
    const newSummary = `Vị trí: ${updated.location || ''}\n` +
                       `Loại hình: ${updated.property_type || ''}\n` +
                       `Giá: ${updated.price_range || ''}\n` +
                       `Pháp lý: ${updated.legal || ''}\n` +
                       `Tiến độ: ${updated.progress || ''}\n` +
                       `Chính sách: ${updated.policy || ''}\n` +
                       `Điểm nhấn: ${updated.highlights || ''}`;
    setSummaryText(newSummary.slice(0, 3000));
    await projectRepository.updateKnowledgeSummary(id, newSummary);
  };

  if (loading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-96 w-full" /></div>;
  }

  if (!project) {
    return <div className="p-8 text-center text-slate-500">Không tìm thấy thông tin dự án.</div>;
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

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/scripts')}>
            <FileText className="h-4 w-4 mr-1.5" /> Quản lý Sales Scripts
          </Button>
          <Button variant="primary" size="sm" onClick={handleStartEnrich}>
            <Sparkles className="h-4 w-4 mr-1.5" /> AI Bổ sung thông tin tự động
          </Button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Đã lưu tóm tắt và tự động trích xuất các trường thông tin thành công!</span>
        </div>
      )}

      {/* 2. KHUNG DÁN VĂN BẢN TÓM TẮT DỰ ÁN (<= 3000 KÝ TỰ) */}
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50/20 to-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                Ô Tóm Tắt Dự Án Dạng Văn Bản (Tối đa 3.000 ký tự)
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Không upload file để tiết kiệm tài nguyên database. Định dạng các dòng dạng "Nhãn: nội dung" (Vị trí:, Giá:, Pháp lý:, Tiến độ:, Chính sách:, Điểm nhấn:) để hệ thống tự điền.
              </p>
            </div>
            <span className={`text-xs font-semibold ${summaryText.length > 2800 ? 'text-rose-600' : 'text-slate-500'}`}>
              {summaryText.length} / 3.000 ký tự
            </span>
          </div>
        </CardHeader>

        <div className="space-y-3">
          <textarea
            rows={7}
            maxLength={3000}
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
        description="Ưu tiên nguồn chính thức từ chủ đầu tư và báo chính thống. Vui lòng đối chiếu trước khi áp dụng."
        maxWidth="xl"
      >
        {isEnriching ? (
          <div className="p-10 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-3"></div>
            <p className="text-xs font-bold text-slate-800">AI đang quét dữ liệu chính thống cho dự án "{project.name}"...</p>
            <p className="text-[11px] text-slate-400 mt-1">Đang lọc bỏ các nguồn diễn đàn không đáng tin cậy.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Chọn các trường bạn muốn cập nhật. Trường trống mặc định được chọn, trường đã có dữ liệu sẽ không bị ghi đè nếu bạn không tick chọn.
            </p>

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

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setEnrichModalOpen(false)}>
                Hủy bỏ
              </Button>
              <Button variant="primary" size="sm" onClick={handleApplyEnrichment}>
                Áp Dụng Các Trường Đã Chọn
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
