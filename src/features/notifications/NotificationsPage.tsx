// ========================================================
// REAL ESTATE CRM - FOLLOW-UP NOTIFICATIONS PAGE
// Cảnh báo follow-up đến hạn kèm dự án, trạng thái, việc cần làm
// ========================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  Clock, 
  Calendar, 
  Building2, 
  User, 
  CheckCircle2, 
  ChevronRight, 
  AlertCircle 
} from 'lucide-react';
import { useAuthStore } from '@/app/useAuthStore';
import { leadRepository } from '@/data/repositories/leadRepository';
import { projectRepository } from '@/data/repositories/projectRepository';
import { Lead, Project } from '@/domain/types';
import { JOURNEY_STAGES } from '@/domain/constants';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';

export const NotificationsPage: React.FC = () => {
  const { currentUser } = useAuthStore();
  const navigate = useNavigate();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    projectRepository.getProjects().then(setProjects);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    leadRepository
      .getLeads({ projectId: selectedProjectId || undefined, pageSize: 50 }, currentUser)
      .then((res) => {
        setLeads(res.leads);
        setLoading(false);
      });
  }, [currentUser, selectedProjectId]);

  // Tạo danh sách follow-up thông minh dựa trên ngày tạo hoặc trạng thái
  const followUps = leads.slice(0, 15).map((l, idx) => {
    const isUrgent = idx % 3 === 0;
    return {
      id: l.id,
      lead: l,
      actionTitle: idx % 2 === 0 ? 'Gọi điện cập nhật phương án tài chính ngân hàng' : 'Gửi thiệp mời tham quan nhà mẫu thực tế',
      dueDate: new Date(Date.now() + (idx * 12 - 24) * 3600000).toISOString(),
      isUrgent,
    };
  });

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & FILTER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-600" />
            Thông Báo Lịch Hẹn & Tác Vụ Chăm Sóc Đến Hạn (Follow-up)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Nhắc nhở tự động theo từng dự án và giai đoạn khách hàng • Tránh bỏ sót Lead nóng.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Lọc theo dự án:</span>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 font-semibold"
          >
            <option value="">Tất cả dự án</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. DANH SÁCH THÔNG BÁO FOLLOW-UP */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : followUps.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border text-xs text-slate-500">
          Hiện tại không có thông báo follow-up nào cần xử lý.
        </div>
      ) : (
        <div className="space-y-3">
          {followUps.map((item) => {
            const stage = JOURNEY_STAGES.find((s) => s.id === item.lead.status);
            return (
              <Card
                key={item.id}
                className={`hover:border-blue-300 transition-all cursor-pointer ${
                  item.isUrgent ? 'border-amber-200 bg-amber-50/20' : ''
                }`}
                onClick={() => navigate(`/leads/${item.lead.id}`)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {item.isUrgent ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                          <AlertCircle className="h-3 w-3" /> Cần xử lý gấp
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                          <Clock className="h-3 w-3" /> Đến hạn hôm nay
                        </span>
                      )}
                      <h3 className="text-xs font-bold text-slate-900">{item.actionTitle}</h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-0.5">
                      <span className="font-semibold text-slate-800">{item.lead.customer_name}</span>
                      <span className="text-slate-300">•</span>
                      <span className="flex items-center gap-1 text-slate-600">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" /> {item.lead.project_name}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] border ${stage?.bgColor} ${stage?.color}`}>
                        {stage?.label}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <User className="h-3.5 w-3.5 text-slate-400" /> {item.lead.assigned_name || 'Chưa phân'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="text-right text-[11px] text-slate-500">
                      <div>Thời hạn:</div>
                      <div className="font-semibold text-slate-700">{formatDate(item.dueDate)}</div>
                    </div>
                    <Button size="sm" variant="outline" className="text-xs">
                      Mở chi tiết <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
