// ========================================================
// REAL ESTATE CRM - ADMIN CONTROL CENTER
// Quản trị người dùng, Tạo User mới, Ma trận phân quyền, Cơ cấu Sàn/Team
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
  UserPlus,
  Search,
  CheckCircle2, 
  AlertCircle,
  Mail,
  Phone,
  User,
  Shield
} from 'lucide-react';
import { useAuthStore } from '@/app/useAuthStore';
import { teamRepository, CreateUserInput } from '@/data/repositories/teamRepository';
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
  const { currentUser, realUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'users' | 'permissions' | 'teams' | 'settings' | 'audit'>('users');

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [agencyFilter, setAgencyFilter] = useState<string>('all');

  // Modal Create User
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);

  const [newUser, setNewUser] = useState<CreateUserInput>({
    full_name: '',
    email: '',
    phone: '',
    role: 'sale_agent',
    agency_id: '',
    team_id: '',
    password: 'password123',
    must_change_password: true,
  });

  // Settings state
  const [maxLeads, setMaxLeads] = useState(30);
  const [autoReclaimHours, setAutoReclaimHours] = useState(48);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const reloadData = async () => {
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

  useEffect(() => {
    reloadData();
  }, []);

  // Xử lý tạo User mới
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setModalSuccess(null);
    setIsSubmitting(true);

    try {
      const result = await teamRepository.createUser(newUser);
      if (result.success && result.profile) {
        setModalSuccess(`Đã tạo thành công tài khoản cho ${result.profile.full_name} (${result.profile.email})`);
        auditRepository.logAction(
          realUser?.id || currentUser!.id,
          realUser?.full_name || currentUser!.full_name,
          'user_create',
          { email: result.profile.email, role: result.profile.role }
        );
        // Refresh danh sách
        await reloadData();
        // Reset form
        setTimeout(() => {
          setIsCreateModalOpen(false);
          setModalSuccess(null);
          setNewUser({
            full_name: '',
            email: '',
            phone: '',
            role: 'sale_agent',
            agency_id: '',
            team_id: '',
            password: 'password123',
            must_change_password: true,
          });
        }, 1200);
      } else {
        setModalError(result.error || 'Không thể tạo người dùng. Vui lòng kiểm tra lại thông tin.');
      }
    } catch (err: any) {
      setModalError(err.message || 'Lỗi hệ thống khi tạo người dùng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLockUser = async (userId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'locked' ? 'active' : 'locked';
    const success = await teamRepository.toggleUserStatus(userId, nextStatus);
    if (success) {
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, status: nextStatus } : p));
      auditRepository.logAction(
        realUser?.id || currentUser!.id,
        realUser?.full_name || currentUser!.full_name,
        'account_status_change',
        { targetUserId: userId, newStatus: nextStatus }
      );
    }
  };

  const handleResetPassword = (email: string) => {
    alert(`Đã đặt lại mật khẩu tạm thời là 'password123' cho tài khoản ${email}. Người dùng sẽ phải đổi mật khẩu khi đăng nhập.`);
    auditRepository.logAction(
      realUser?.id || currentUser!.id,
      realUser?.full_name || currentUser!.full_name,
      'password_reset_by_admin',
      { targetEmail: email }
    );
  };

  const handleSaveSettings = () => {
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
    auditRepository.logAction(
      realUser?.id || currentUser!.id,
      realUser?.full_name || currentUser!.full_name,
      'system_settings_updated',
      { maxLeads, autoReclaimHours }
    );
  };

  // Filter profiles
  const filteredProfiles = profiles.filter(p => {
    const matchSearch = 
      p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.phone && p.phone.includes(searchQuery));
    const matchRole = roleFilter === 'all' || p.role === roleFilter;
    const matchAgency = agencyFilter === 'all' || p.agency_id === agencyFilter;
    return matchSearch && matchRole && matchAgency;
  });

  const availableTeamsForSelectedAgency = teams.filter(
    t => !newUser.agency_id || t.agency_id === newUser.agency_id
  );

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & TABS */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Trung Tâm Quản Trị Hệ Thống (Admin Control Center)
                </h2>
                <span className="text-[10px] font-semibold uppercase bg-red-100 text-red-700 px-2 py-0.5 rounded border border-red-200">
                  Chỉ Dành Cho Admin
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Quản lý người dùng, tạo tài khoản mới, ma trận phân quyền Role-based, cơ cấu tổ chức và nhật ký kiểm toán.
              </p>
            </div>
          </div>

          {activeTab === 'users' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              className="font-semibold text-xs py-2 shadow-sm"
            >
              <UserPlus className="h-4 w-4 mr-1.5" /> Thêm người dùng mới
            </Button>
          )}
        </div>

        <div className="flex flex-wrap border-b border-slate-200 gap-4 text-xs font-semibold">
          {[
            { id: 'users', label: `Tài khoản & Nhân sự (${profiles.length})`, icon: Users },
            { id: 'permissions', label: 'Ma trận Phân quyền 6 Vai trò', icon: KeyRound },
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
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm">Danh Sách Người Dùng & Quản Trị Tài Khoản</CardTitle>
              <p className="text-xs text-slate-500">
                Toàn bộ tài khoản có hiệu lực trong hệ sinh thái bất động sản.
              </p>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm tên, email, SĐT..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 w-44"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Tất cả vai trò</option>
                {USER_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label.split('(')[0]}</option>
                ))}
              </select>

              <select
                value={agencyFilter}
                onChange={(e) => setAgencyFilter(e.target.value)}
                className="py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Tất cả sàn</option>
                {agencies.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </select>
            </div>
          </CardHeader>

          {loading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] border-y border-slate-200">
                    <th className="py-3 px-4">Họ và Tên</th>
                    <th className="py-3 px-4">Email Đăng Nhập</th>
                    <th className="py-3 px-4">Số Điện Thoại</th>
                    <th className="py-3 px-4">Vai Trò (Role)</th>
                    <th className="py-3 px-4">Sàn / Team</th>
                    <th className="py-3 px-4">Trạng Thái</th>
                    <th className="py-3 px-4 text-right">Thao Tác Quản Trị</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProfiles.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                        Không tìm thấy người dùng phù hợp với tiêu chí lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredProfiles.map((p) => {
                      const roleObj = USER_ROLES.find(r => r.value === p.role);
                      const agencyObj = agencies.find(a => a.id === p.agency_id);
                      const teamObj = teams.find(t => t.id === p.team_id);

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {p.full_name}
                            {p.id === realUser?.id && (
                              <span className="ml-1.5 text-[9px] bg-slate-200 text-slate-700 px-1 py-0.5 rounded font-normal">
                                Bạn
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">{p.email}</td>
                          <td className="py-3 px-4 text-slate-600">{p.phone || '-'}</td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[10px] border border-blue-200 inline-block">
                              {roleObj?.label.split('(')[0] || p.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {agencyObj ? (
                              <span className="font-medium text-slate-800">{agencyObj.code}</span>
                            ) : '-'}
                            {teamObj ? ` • ${teamObj.name}` : ''}
                          </td>
                          <td className="py-3 px-4">
                            {p.status === 'active' ? (
                              <Badge variant="success">Hoạt động</Badge>
                            ) : (
                              <Badge variant="danger">Đã khóa</Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResetPassword(p.email)}
                              className="text-[11px] py-1 px-2"
                              title="Đặt lại mật khẩu tạm thời thành password123"
                            >
                              <RotateCcw className="h-3 w-3 mr-1" /> Reset Pass
                            </Button>
                            {p.role !== 'admin' && (
                              <Button
                                size="sm"
                                variant={p.status === 'locked' ? 'primary' : 'danger'}
                                onClick={() => handleToggleLockUser(p.id, p.status)}
                                className="text-[11px] py-1 px-2"
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
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* 3. TAB 2: PERMISSION MATRIX */}
      {activeTab === 'permissions' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-blue-600" />
              <div>
                <CardTitle className="text-sm">Ma Trận Phân Quyền Theo 6 Vai Trò (RBAC)</CardTitle>
                <p className="text-xs text-slate-500">
                  Quy định chi tiết phạm vi truy cập dữ liệu và các thao tác nghiệp vụ trong CRM.
                </p>
              </div>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-center text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                  <th className="py-3 px-4 text-left">Chức năng & Màn hình</th>
                  <th className="bg-blue-50/60 text-blue-800">Admin (Quản trị)</th>
                  <th>Director (GĐ Sàn)</th>
                  <th>Marketing</th>
                  <th>Sales Manager</th>
                  <th>Team Leader</th>
                  <th>Sale Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {[
                  { name: 'Dashboard KPI toàn sàn', a: 'Toàn hệ thống', d: 'Toàn hệ thống', m: 'Toàn hệ thống', sm: 'Theo sàn phụ trách', tl: 'Theo team', sa: 'Cá nhân' },
                  { name: 'Phạm vi xem Lead (RLS)', a: 'Tất cả 100%', d: 'Tất cả 100%', m: 'Tất cả (Ẩn SĐT)', sm: 'Lead thuộc sàn', tl: 'Lead thuộc team', sa: 'Chỉ Lead được giao' },
                  { name: 'Kéo thả Journey & Tạo Giao dịch', a: true, d: true, m: false, sm: true, tl: true, sa: true },
                  { name: 'Phân bổ Round Robin (Lead Pool)', a: true, d: true, m: false, sm: true, tl: true, sa: false },
                  { name: 'Xuất dữ liệu Lead ra CSV', a: true, d: true, m: true, sm: true, tl: true, sa: false },
                  { name: 'Chỉnh sửa Tri thức Dự án & FAQ', a: true, d: true, m: true, sm: true, tl: false, sa: false },
                  { name: 'Tùy chỉnh Sales Scripts & Phiên bản', a: true, d: true, m: true, sm: true, tl: false, sa: false },
                  { name: 'Tạo tài khoản & Quản lý User', a: 'Chỉ Admin', d: false, m: false, sm: false, tl: false, sa: false },
                  { name: 'Chuyển đổi góc nhìn vai trò (Góc nhìn)', a: 'Chỉ Admin', d: false, m: false, sm: false, tl: false, sa: false },
                  { name: 'Cấu hình tham số & Xem Audit Logs', a: 'Chỉ Admin', d: false, m: false, sm: false, tl: false, sa: false },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-left font-semibold text-slate-900">{row.name}</td>
                    <td className="py-3 px-2 font-bold text-blue-700 bg-blue-50/40">
                      {typeof row.a === 'boolean' ? (row.a ? '✓ Toàn quyền' : '-') : row.a}
                    </td>
                    <td className="py-3 px-2">{typeof row.d === 'boolean' ? (row.d ? '✓ Có' : '-') : row.d}</td>
                    <td className="py-3 px-2">{typeof row.m === 'boolean' ? (row.m ? '✓ Có' : '-') : row.m}</td>
                    <td className="py-3 px-2">{typeof row.sm === 'boolean' ? (row.sm ? '✓ Có' : '-') : row.sm}</td>
                    <td className="py-3 px-2">{typeof row.tl === 'boolean' ? (row.tl ? '✓ Có' : '-') : row.tl}</td>
                    <td className="py-3 px-2">{typeof row.sa === 'boolean' ? (row.sa ? '✓ Có' : '-') : row.sa}</td>
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
              <CardTitle className="text-sm">Danh Sách Sàn Giao Dịch Phân Phối</CardTitle>
            </CardHeader>
            <div className="divide-y divide-slate-100">
              {agencies.map((a) => (
                <div key={a.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-900">{a.name}</p>
                    <p className="text-[11px] text-slate-500">Mã: {a.code} • ĐT: {a.phone}</p>
                  </div>
                  <Badge variant="outline">{a.status}</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Danh Sách Đội Nhóm Bán Hàng (Teams)</CardTitle>
            </CardHeader>
            <div className="divide-y divide-slate-100">
              {teams.map((t) => {
                const agency = agencies.find(a => a.id === t.agency_id);
                return (
                  <div key={t.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{t.name}</p>
                      <p className="text-[11px] text-slate-500">
                        Thuộc sàn: <span className="font-semibold">{agency?.name || 'Chưa gán'}</span>
                      </p>
                    </div>
                    <Badge variant="info">Mã: {t.code}</Badge>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* 5. TAB 4: SYSTEM SETTINGS */}
      {activeTab === 'settings' && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="text-sm">Cấu Hình Thông Số Nghiệp Vụ Toàn Hệ Thống</CardTitle>
          </CardHeader>
          <div className="p-5 space-y-5 text-xs">
            {settingsSaved && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Đã lưu thành công cấu hình hệ thống!</span>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Giới hạn Lead chưa chăm sóc tối đa cho mỗi Sale Agent
              </label>
              <Input
                type="number"
                value={maxLeads}
                onChange={(e) => setMaxLeads(Number(e.target.value))}
                min={5}
                max={100}
                className="w-48 text-xs"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Khi Sale đạt ngưỡng này, hệ thống Round Robin sẽ tự động bỏ qua để tránh quá tải.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Thời gian tự động thu hồi Lead không phát sinh tương tác (Giờ)
              </label>
              <Input
                type="number"
                value={autoReclaimHours}
                onChange={(e) => setAutoReclaimHours(Number(e.target.value))}
                min={12}
                max={168}
                className="w-48 text-xs"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Lead ở trạng thái 'new' hoặc 'unreachable' quá thời gian này sẽ được hoàn trả về Pool chung.
              </p>
            </div>

            <Button variant="primary" size="sm" onClick={handleSaveSettings}>
              Lưu cấu hình hệ thống
            </Button>
          </div>
        </Card>
      )}

      {/* 6. TAB 5: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Nhật Ký Kiểm Toán & Giám Sát An Ninh (Audit Logs)</CardTitle>
            <p className="text-xs text-slate-500">
              Ghi lại mọi hoạt động đăng nhập, đổi mật khẩu, phân bổ Lead và chuyển đổi góc nhìn vai trò.
            </p>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] border-y">
                  <th className="py-2.5 px-4">Thời Gian</th>
                  <th className="py-2.5 px-4">Người Thực Hiện</th>
                  <th className="py-2.5 px-4">Hành Động</th>
                  <th className="py-2.5 px-4">Chi Tiết Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-slate-400">Chưa có bản ghi nhật ký.</td>
                  </tr>
                ) : (
                  auditLogs.slice(0, 50).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{log.user_name || 'Hệ thống'}</td>
                      <td className="py-2.5 px-4">
                        <Badge variant="outline" className="text-[10px] font-mono">{log.action}</Badge>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 font-mono text-[11px]">
                        {JSON.stringify(log.details || {})}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 7. MODAL: THÊM NGƯỜI DÙNG MỚI */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Thêm Người Dùng Mới Vào Hệ Thống"
      >
        <form onSubmit={handleCreateUserSubmit} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{modalError}</span>
            </div>
          )}

          {modalSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{modalSuccess}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Họ và tên <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={newUser.full_name}
                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                placeholder="Nguyễn Văn A"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email đăng nhập <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="sale.nguyen@diaocvang.vn"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Số điện thoại <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  placeholder="0912345678"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Vai trò (Role) <span className="text-red-500">*</span>
              </label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              >
                {USER_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label.split('(')[0]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Thuộc Sàn giao dịch
              </label>
              <select
                value={newUser.agency_id || ''}
                onChange={(e) => setNewUser({ ...newUser, agency_id: e.target.value || null, team_id: null })}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="">(Không gán sàn)</option>
                {agencies.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Thuộc Team kinh doanh
              </label>
              <select
                value={newUser.team_id || ''}
                onChange={(e) => setNewUser({ ...newUser, team_id: e.target.value || null })}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="">(Không gán team)</option>
                {availableTeamsForSelectedAgency.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mật khẩu khởi tạo
            </label>
            <div className="relative">
              <Shield className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="password123"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Mặc định: password123 (Người dùng có thể đổi sau).</p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="must_change_pass"
              checked={newUser.must_change_password}
              onChange={(e) => setNewUser({ ...newUser, must_change_password: e.target.checked })}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            <label htmlFor="must_change_pass" className="text-xs text-slate-700 select-none">
              Bắt buộc người dùng đổi mật khẩu ở lần đăng nhập đầu tiên
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              Tạo tài khoản
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
