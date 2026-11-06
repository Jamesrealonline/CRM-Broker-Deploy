// ========================================================
// REAL ESTATE CRM - SALES SCRIPTS MANAGEMENT PAGE
// Script theo 15 trạng thái, Script Tự động vs Tùy chỉnh, Phiên bản, Đặt lại
// ========================================================

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  RotateCcw, 
  Save, 
  CheckCircle2, 
  Building2, 
  Sparkles, 
  History, 
  Copy 
} from 'lucide-react';
import { projectRepository } from '@/data/repositories/projectRepository';
import { Project, SalesScript, LeadStatus } from '@/domain/types';
import { JOURNEY_STAGES } from '@/domain/constants';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

export const SalesScriptsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [scripts, setScripts] = useState<SalesScript[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<LeadStatus>('new');
  const [currentScript, setCurrentScript] = useState<SalesScript | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    projectRepository.getProjects().then((list) => {
      setProjects(list);
      if (list.length > 0) setSelectedProjectId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    setLoading(true);
    projectRepository.getSalesScripts(selectedProjectId).then((res) => {
      setScripts(res);
      const active = res.find(s => s.status === selectedStatus) || res[0];
      if (active) {
        setCurrentScript(active);
        setContent(active.content);
        setSelectedStatus(active.status);
      }
      setLoading(false);
    });
  }, [selectedProjectId]);

  const handleSelectStage = (status: LeadStatus) => {
    setSelectedStatus(status);
    const active = scripts.find(s => s.status === status);
    if (active) {
      setCurrentScript(active);
      setContent(active.content);
    }
  };

  const handleSave = async () => {
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

  const handleReset = async () => {
    if (!selectedProjectId || !confirm('Bạn có chắc muốn đặt lại kịch bản này về mẫu tự động tiêu chuẩn?')) return;
    const reset = await projectRepository.resetScriptToDefault(selectedProjectId, selectedStatus);
    setCurrentScript(reset);
    setContent(reset.content);
    const refreshed = await projectRepository.getSalesScripts(selectedProjectId);
    setScripts(refreshed);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stage = JOURNEY_STAGES.find(s => s.id === selectedStatus);

  return (
    <div className="space-y-6">
      {/* 1. HEADER & DỰ ÁN */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Hệ Thống Sales Scripts Theo Dự Án & Trạng Thái
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kịch bản Tự động cập nhật khi tóm tắt dự án thay đổi. Kịch bản Tùy chỉnh giữ nguyên bản đã biên soạn.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Dự án:</span>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 font-semibold text-slate-800"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {saveMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Đã lưu kịch bản và nâng phiên bản thành công!</span>
        </div>
      )}

      {/* 2. CHÍNH: CỘT TRÁI 15 GIAI ĐOẠN, CỘT PHẢI NỘI DUNG SCRIPT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LIST 15 TRẠNG THÁI */}
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

        {/* EDITOR NỘI DUNG SCRIPT */}
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

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    {copied ? 'Đã copy!' : 'Sao chép'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleReset}>
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
                <Button variant="primary" size="sm" onClick={handleSave} isLoading={isSaving}>
                  <Save className="h-4 w-4 mr-1.5" /> Lưu Thay Đổi Kịch Bản
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
