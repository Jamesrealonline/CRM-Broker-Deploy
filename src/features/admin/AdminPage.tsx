// ========================================================
// REAL ESTATE CRM - ADMIN CONTROL CENTER
// Người dùng, Phân quyền Role, Sàn & Team, Cấu hình, Audit Logs
// ========================================================

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Users, 
  KeyRound, 
  Building2, 
  Sliders, 
  ShieldAlert, 
  Lock, 
  Unlock, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { useAuthStore } from '@/app/useAuthStore';
import { teamRepository } from '@/data/repositories/teamRepository';
import { auditRepository } from '@/data/repositories/auditRepository';
import { UserProfile, Agency, Team, AuditLog, UserRole } from '@/domain/types';
import { USER_ROLES } from '@/domain/constants';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { formatDate } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';

export const AdminPage: React.FC = () => {
  const { currentUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'users' | 'permissions' | 'teams' | 'settings' | 'audit'>('users');

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Settings
  const [maxLeads, setMaxLeads] = useState(30);
  const [autoReclaimHours, setAutoReclaimHours] = useState(48);
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [uList, aList, tList, logs] = await Promise.all([
        teamRepository.getProfiles(),
        teamRepository.getAgencies(),
        teamRepository.getTeams(),
        auditRepository.getAuditLogs(),
      ]);
      setProfiles(uList);
      setAgencies(aList);
      setTeams(tList);
      setAuditLogs(logs);
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleToggleLockUser = (userId: string) => {
    setProfiles(prev => prev.map(p => {
      if (p.id === userId) {
        const nextStatus = p.status === 'locked' ? 'active' : 'locked';
        return { ...p, status: nextStatus };
      }
      return p;
    }));
    auditRepository.logAction(currentUser!.id, currentUser!.full_name, 'account_status_change', { targetUserId: userId });
  };

  const handleResetPassword = (email: string) => {
    alert(`Đã gửi mật khẩu tạm thời mới tới hòm thư ${email}. Người dùng phải đổi mật khẩu ở lần đăng nhập tới.`);
    auditRepository.logAction(currentUser!.id, currentUser!.full_name, 'password_reset_by_admin', { targetEmail: email });
  };

  const handleSaveSettings = () => {
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
    auditRepository.logAction(currentUser!.id, currentUser!.full_name, 'system_settings_updated', { maxLeads, autoReclaimHours });
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & TABS */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Trung Tâm Quản Trị Hệ Thống (Admin Control Center)
            </h2>
            <p className="text-xs text-slate-500">
              Quản lý tài khoản, ma trận phân quyền Role-based, cơ cấu Sàn - Team và giám sát Audit Logs.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap border-b border-slate-200 gap-4 text-xs font-semibold">
          {[
            { id: 'users', label: 'Tài khoản & Nhân sự', icon: Users },
            { id: 'permissions', label: 'Ma trận Phân quyền', icon: KeyRound },
            { id: 'teams', label: 'Cơ cấu Sàn & Team', icon: Building2 },
            { id: 'settings', label: 'Cấu hình Hệ thống', icon: Sliders },
            { id: 'audit', label: 'Nhật ký Bảo mật (Audit)', icon: ShieldAlert },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-3 flex items-center gap-1.5 transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. TAB 1: USERS MANAGEMENT */}
      {activeTab === 'users' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Danh Sách Người Dùng & Phân Quyền Vai Trò</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px]">
                  <th className="py-3 px-4">Họ và Tên</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Số Điện Thoại</th>
                  <th className="py-3 px-4">Vai Trò (Role)</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4 text-right">Thao Tác Bảo Mật</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {profiles.map((p) => {
                  const roleObj = USER_ROLES.find(r => r.value === p.role);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-bold text-slate-900">{p.full_name}</td>
                      <td className="py-3 px-4 text-slate-600">{p.email}</td>
                      <td className="py-3 px-4 text-slate-600">{p.phone}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[10px] border border-blue-200">
                          {roleObj?.label.split('(')[0]}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {p.status === 'active' ? (
                          <Badge variant="success">Hoạt động</Badge>
                        ) : (
                          <Badge variant="danger">Đã khóa</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResetPassword(p.email)}
                          className="text-[11px] py-1"
                        >
                          <RotateCcw className="h-3 w-3 mr-1" /> Reset Pass
                        </Button>
                        <Button
                          size="sm"
                          variant={p.status === 'locked' ? 'primary' : 'danger'}
                          onClick={() => handleToggleLockUser(p.id)}
                          className="text-[11px] py-1"
                        >
                          {p.status === 'locked' ? (
                            <>
                              <Unlock className="h-3 w-3 mr-1" /> Mở khóa
                            </>
                          ) : (
                            <>
                              <Lock className="h-3 w-3 mr-1" /> Khóa
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 3. TAB 2: PERMISSION MATRIX */}
      {activeTab === 'permissions' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ma Trận Phân Quyền Theo 6 Vai Trò</CardTitle>
            <p className="text-xs text-slate-500">
              Quyền xem Lead thực tế được quyết định bởi Row Level Security (RLS) ở máy chủ PostgreSQL.
            </p>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-center text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b text-slate-600 font-bold uppercase text-[10px]">
                  <th className="py-3 px-4 text-left">Chức năng & Màn hình</th>
                  <th>Admin</th>
                  <th>Director</th>
                  <th>Marketing</th>
                  <th>Sales Manager</th>
                  <th>Team Leader</th>
                  <th>Sale Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {[
                  { name: 'Dashboard KPI toàn công ty', a: true, d: true, m: true, sm: 'Sàn', tl: 'Team', sa: 'Cá nhân' },
                  { name: 'Xem Lead (Phân quyền RLS)', a: 'Tất cả', d: 'Tất cả', m: 'Ẩn SĐT', sm: 'Sàn mình', tl: 'Team mình', sa: 'Được giao' },
                  { name: 'Kéo thả Journey & Tạo Giao dịch', a: true, d: true, m: false, sm: true, tl: true, sa: true },
                  { name: 'Phân bổ Round Robin (Lead Pool)', a: true, d: true, m: false, sm: true, tl: true, sa: false },
                  { name: 'Xuất dữ liệu CSV', a: true, d: true, m: true, sm: true, tl: true, sa: false },
                  { name: 'Chỉnh sửa Tri thức Dự án & FAQ', a: true, d: true, m: true, sm: true, tl: false, sa: false },
                  { name: 'Sửa Sales Script Tùy chỉnh', a: true, d: true, m: true, sm: true, tl: false, sa: false },
                  { name: 'Quản trị Người dùng & Cấu hình', a: true, d: false, m: false, sm: false, tl: false, sa: false },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-left font-semibold text-slate-900">{row.name}</td>
                    <td className="py-3 px-2 font-bold text-blue-600">{typeof row.a === 'boolean' ? (row.a ? '✓' : '-') : row.a}</td>
                    <td className="py-3 px-2">{typeof row.d === 'boolean' ? (row.d ? '✓' : '-') : row.d}</td>
                    <td className="py-3 px-2">{typeof row.m === 'boolean' ? (row.m ? '✓' : '-') : row.m}</td>
                    <td className="py-3 px-2">{typeof row.sm === 'boolean' ? (row.sm ? '✓' : '-') : row.sm}</td>
                    <td className="py-3 px-2">{typeof row.tl === 'boolean' ? (row.tl ? '✓' : '-') : row.tl}</td>
                    <td className="py-3 px-2">{typeof row.sa === 'boolean' ? (row.sa ? '✓' : '-') : row.sa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 4. TAB 3: TEAMS & AGENCIES */}
      {activeTab === 'teams' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Danh Sách Sàn Phân Phối (Agencies)</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              {agencies.map((a) => (
                <div key={a.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50 text-xs">
                  <div className="flex items-center justify-between font-bold text-slate-900 mb-1">
                    <span>{a.name}</span>
                    <span className="text-blue-700 bg-blue-100 px-2 py-0.5 rounded text-[10px]">{a.code}</span>
                  </div>
                  <p className="text-slate-500">{a.address}</p>
                  <p className="text-slate-400 text-[11px] mt-1">Hotline: {a.phone} • Email: {a.email}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Các Đội Nhóm Bán Hàng (Teams)</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              {teams.map((t) => (
                <div key={t.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50 text-xs">
                  <div className="flex items-center justify-between font-bold text-slate-900 mb-1">
                    <span>{t.name}</span>
                    <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[10px]">{t.code}</span>
                  </div>
                  <p className="text-slate-600">Trưởng nhóm: <span className="font-semibold text-slate-800">{t.leader_name || 'Đang cập nhật'}</span></p>
                  <p className="text-slate-400 text-[11px] mt-1">Quy mô: {t.member_count || 5} chuyên viên</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* 5. TAB 4: SYSTEM SETTINGS */}
      {activeTab === 'settings' && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="text-sm">Quy Tắc Phân Bổ & Bảo Mật Hệ Thống</CardTitle>
          </CardHeader>
          <div className="space-y-4 text-xs">
            {settingsSaved && (
              <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Cấu hình hệ thống đã được cập nhật thành công!</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="block font-semibold text-slate-800">
                Giới hạn số Lead tối đa mỗi Sale Agent được nhận cùng lúc
              </label>
              <input
                type="number"
                value={maxLeads}
                onChange={(e) => setMaxLeads(Number(e.target.value))}
                className="w-full h-9 px-3 border border-slate-300 rounded-lg bg-white"
              />
              <p className="text-[11px] text-slate-400">
                Khi Sale đạt giới hạn này, RPC Round Robin sẽ tự động bỏ qua để phân cho người khác.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block font-semibold text-slate-800">
                Thời gian tự động thu hồi Lead nếu không có hoạt động tương tác (Giờ)
              </label>
              <input
                type="number"
                value={autoReclaimHours}
                onChange={(e) => setAutoReclaimHours(Number(e.target.value))}
                className="w-full h-9 px-3 border border-slate-300 rounded-lg bg-white"
              />
              <p className="text-[11px] text-slate-400">
                Sau số giờ này nếu trạng thái vẫn là "Mới tiếp nhận", Lead tự động chuyển về giỏ chung.
              </p>
            </div>

            <div className="pt-3 border-t">
              <Button size="sm" onClick={handleSaveSettings}>
                Lưu Cấu Hình
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* 6. TAB 5: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-blue-600" />
              Nhật Ký Bảo Mật & Thao Tác Hệ Thống (Audit Logs)
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b text-slate-500 font-semibold uppercase text-[10px]">
                  <th className="py-3 px-4">Thời Gian</th>
                  <th className="py-3 px-4">Người Thực Hiện</th>
                  <th className="py-3 px-4">Hành Động</th>
                  <th className="py-3 px-4">Chi Tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.slice(0, 30).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{formatDate(log.created_at)}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{log.user_name || 'Hệ thống'}</td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px] border border-blue-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))}
                {auditLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">Chưa có nhật ký ghi nhận.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
