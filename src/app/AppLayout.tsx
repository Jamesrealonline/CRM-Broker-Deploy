// ========================================================
// REAL ESTATE CRM - MAIN APP LAYOUT
// Sidebar Desktop, Mobile Drawer, Role Switcher (Chỉ dành cho Admin)
// ========================================================

import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  GitCommit, 
  Share2, 
  Building2, 
  FileText, 
  Bell, 
  ShieldCheck, 
  LogOut, 
  Menu, 
  X, 
  UserCheck, 
  Lock,
  ChevronDown,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  FileCheck,
  Trophy
} from 'lucide-react';
import { useAuthStore } from './useAuthStore';
import { USER_ROLES } from '@/domain/constants';
import { UserRole } from '@/domain/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export const AppLayout: React.FC = () => {
  const { currentUser, realUser, logout, updateActivity, setImpersonatedRole, impersonatingRole } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const navigate = useNavigate();

  // Kiểm tra quyền Admin thực tế (không bị ảnh hưởng khi đang giả lập góc nhìn)
  const isRealAdmin = realUser?.role === 'admin';

  // 1. Giám sát hoạt động của người dùng để reset session timer (30 phút tự đăng xuất)
  useEffect(() => {
    const handleActivity = () => updateActivity();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);

    const interval = setInterval(() => updateActivity(), 60000); // Kiểm tra mỗi phút

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      clearInterval(interval);
    };
  }, [updateActivity]);

  const navItems = [
    { to: '/dashboard', label: 'Tổng quan KPI', icon: LayoutDashboard },
    { to: '/leads', label: 'Quản lý & Phân bổ Lead', icon: Users },
    { to: '/journey', label: 'Customer Journey', icon: GitCommit },
    { to: '/transactions', label: 'Giao dịch & Hợp đồng', icon: FileCheck },
    { to: '/leaderboard', label: 'Bảng Thi Đua & Hiệu Suất', icon: Trophy },
  ];

  // Quyền truy cập phân hệ Cơ cấu & Quản trị Nhân sự Vòng đời
  const canAccessHR = currentUser && ['admin', 'ceo', 'company_admin', 'regional_director', 'director', 'hr_admin', 'sales_manager', 'team_leader'].includes(currentUser.role);
  if (canAccessHR) {
    navItems.push({ to: '/hr', label: 'Cơ Cấu & Nhân Sự', icon: UserCheck });
  }

  navItems.push(
    { to: '/projects', label: 'Dự án & Tri thức AI', icon: Building2 },
    { to: '/scripts', label: 'Sales Scripts', icon: FileText },
    { to: '/notifications', label: 'Thông báo Follow-up', icon: Bell }
  );

  // Chỉ tài khoản có quyền Admin kỹ thuật hoặc Quản Trị Doanh Nghiệp mới được vào Trung tâm quản trị
  const canAccessAdmin = isRealAdmin || realUser?.role === 'company_admin';
  if (canAccessAdmin) {
    navItems.push({ 
      to: '/admin', 
      label: realUser?.role === 'company_admin' ? 'Quản Trị Doanh Nghiệp' : 'Trung tâm Quản trị', 
      icon: ShieldCheck 
    });
  }

  const currentRoleInfo = USER_ROLES.find(r => r.value === currentUser?.role);
  const realRoleInfo = USER_ROLES.find(r => r.value === realUser?.role);

  const handleRoleSelect = async (role: UserRole) => {
    setRoleDropdownOpen(false);
    await setImpersonatedRole(role);
  };

  const handleResetRole = async () => {
    setRoleDropdownOpen(false);
    await setImpersonatedRole(null);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-800">
      {/* 1. SIDEBAR DESKTOP */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-200 border-r border-slate-800 select-none">
        {/* Logo Brand */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-800">
          <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/30">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              REAL ESTATE CRM
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Intelligence Platform
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User Card & Logout Bottom */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60">
          <div className="flex items-center justify-between mb-3">
            <div className="truncate">
              <p className="text-xs font-bold text-white truncate">
                {realUser?.full_name || currentUser?.full_name}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {realUser?.email || currentUser?.email}
              </p>
            </div>
            <Badge variant="info" className="text-[10px]">
              {realRoleInfo?.label.split('(')[0] || 'Member'}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10"
          >
            <LogOut className="h-3.5 w-3.5 mr-2" /> Đăng xuất an toàn
          </Button>
        </div>
      </aside>

      {/* 2. MOBILE DRAWER NAVIGATION */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 text-slate-200 p-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-6 w-6 text-blue-500" />
                <span className="font-bold text-sm text-white">REAL ESTATE CRM</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold ${
                        isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="pt-4 border-t border-slate-800">
              <p className="text-xs font-semibold">{realUser?.full_name}</p>
              <p className="text-[11px] text-slate-400 mb-3">{realRoleInfo?.label}</p>
              <Button variant="danger" size="sm" className="w-full" onClick={handleLogout}>
                <LogOut className="h-3.5 w-3.5 mr-1.5" /> Đăng xuất
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MAIN CONTENT CONTAINER */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOP BAR */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-sm md:text-base font-bold text-slate-900">
                Hệ thống Quản Trị Bất Động Sản & Bán Hàng
              </h1>
              <p className="hidden md:block text-[11px] text-slate-500">
                Tuân thủ Nghị định 13/2023/NĐ-CP • Supabase PostgreSQL • Vercel
              </p>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            {/* Role Impersonation Switcher (CHỈ HIỂN THỊ KHI TÀI KHOẢN LÀ ADMIN) */}
            {isRealAdmin ? (
              <div className="relative">
                <button
                  onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50/70 hover:bg-blue-100/70 text-xs font-medium text-blue-900 transition-colors shadow-sm"
                  title="Chỉ Admin có quyền chuyển đổi góc nhìn vai trò"
                >
                  <UserCheck className="h-3.5 w-3.5 text-blue-600" />
                  <span className="hidden sm:inline">Góc nhìn:</span>
                  <span className="font-bold text-blue-700">{currentRoleInfo?.label.split('(')[0]}</span>
                  <ChevronDown className="h-3 w-3 text-blue-500" />
                </button>

                {roleDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white shadow-xl border border-slate-200 p-2 z-50">
                    <div className="px-3 py-2 border-b border-slate-100 mb-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-800">Chuyển đổi góc nhìn vai trò</p>
                        <span className="text-[9px] uppercase font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Admin Only</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Mỗi lần chuyển đổi sẽ được ghi nhận vào nhật ký kiểm toán Audit Log.
                      </p>
                    </div>
                    <div className="space-y-1">
                      {USER_ROLES.map((role) => (
                        <button
                          key={role.value}
                          onClick={() => handleRoleSelect(role.value)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs flex flex-col transition-colors ${
                            currentUser?.role === role.value ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span className="font-medium">{role.label}</span>
                          <span className="text-[10px] text-slate-400">{role.description}</span>
                        </button>
                      ))}
                    </div>
                    {impersonatingRole && (
                      <div className="pt-2 mt-1 border-t border-slate-100">
                        <Button variant="outline" size="sm" className="w-full text-xs" onClick={handleResetRole}>
                          <RotateCcw className="h-3 w-3 mr-1" /> Quay lại Quản trị viên
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Người dùng thông thường: Chỉ hiển thị nhãn vai trò cố định của họ */
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700 font-medium">
                <span className="text-[11px] text-slate-400">Vai trò:</span>
                <span className="font-bold text-slate-800">{realRoleInfo?.label.split('(')[0]}</span>
              </div>
            )}

            {/* Notification Bell */}
            <button
              onClick={() => navigate('/notifications')}
              className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
            </button>

            {/* AI Active Badge */}
            <Badge variant="info" className="hidden lg:inline-flex text-[11px]">
              <Sparkles className="h-3 w-3 mr-1 text-blue-600" />
              AI Activated
            </Badge>
          </div>
        </header>

        {/* CẢNH BÁO KHI ADMIN ĐANG Ở CHẾ ĐỘ GIẢ LẬP GÓC NHÌN (CHẾ ĐỘ CHỈ ĐỌC - READ ONLY) */}
        {isRealAdmin && impersonatingRole && (
          <div className="bg-amber-500/20 border-b border-amber-400 px-4 md:px-6 py-2.5 flex items-center justify-between text-xs text-amber-950 shrink-0 shadow-inner">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 animate-pulse" />
              <span>
                <strong className="text-amber-900 font-bold uppercase tracking-wide mr-1.5">[CHẾ ĐỘ CHỈ ĐỌC / READ-ONLY]:</strong> 
                Bạn đang quan sát giao diện như một{' '}
                <strong className="text-amber-950 underline font-bold">{currentRoleInfo?.label}</strong>.
                Hệ thống cưỡng chế bảo mật: <strong className="text-red-700">Cấm mọi thao tác tiền, duyệt giao dịch hoặc đổi mật khẩu</strong>.
              </span>
            </div>
            <button
              onClick={handleResetRole}
              className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded text-[11px] font-bold shadow-sm transition-colors flex items-center gap-1.5 shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Thoát góc nhìn (Về Admin)
            </button>
          </div>
        )}

        {/* OUTLET VIEWPORT */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
