// ========================================================
// REAL ESTATE CRM - MAIN APP LAYOUT
// Sidebar Desktop, Mobile ☰ Drawer, Role Switcher, Session Watchdog
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
  Sparkles
} from 'lucide-react';
import { useAuthStore } from './useAuthStore';
import { USER_ROLES } from '@/domain/constants';
import { UserRole } from '@/domain/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export const AppLayout: React.FC = () => {
  const { currentUser, logout, updateActivity, setImpersonatedRole, impersonatingRole } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const navigate = useNavigate();

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
    { to: '/leads', label: 'Quản lý Lead', icon: Users },
    { to: '/journey', label: 'Customer Journey', icon: GitCommit },
    { to: '/distribution', label: 'Phân bổ Lead', icon: Share2 },
    { to: '/projects', label: 'Dự án & Tri thức AI', icon: Building2 },
    { to: '/scripts', label: 'Sales Scripts', icon: FileText },
    { to: '/notifications', label: 'Thông báo Follow-up', icon: Bell },
  ];

  // Chỉ Admin và Manager được vào Trung tâm quản trị
  if (currentUser?.role === 'admin' || currentUser?.role === 'director' || currentUser?.role === 'sales_manager') {
    navItems.push({ to: '/admin', label: 'Trung tâm Quản trị', icon: ShieldCheck });
  }

  const currentRoleInfo = USER_ROLES.find(r => r.value === currentUser?.role);

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
            <div className="text-[10px] text-blue-400 font-medium tracking-wider uppercase">
              Sales & Marketing AI
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User Card & Role Info */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-semibold text-blue-400 border border-slate-700">
                {currentUser?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate w-32">{currentUser?.full_name}</p>
                <p className="text-[10px] text-slate-400 truncate">{currentRoleInfo?.label.split('(')[0]}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
            <button
              onClick={() => navigate('/change-password')}
              title="Đổi mật khẩu"
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <Lock className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleLogout}
              title="Đăng xuất"
              className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors ml-auto flex items-center gap-1 text-xs"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Thoát</span>
            </button>
          </div>
        </div>
      </aside>

      {/* 2. MOBILE DRAWER MENU */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-slate-900/60 backdrop-blur-sm">
          <div className="fixed inset-y-0 left-0 w-72 bg-slate-900 text-white p-5 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold">
                  <Building2 className="h-4 w-4" />
                </div>
                <span className="font-bold text-sm">REAL ESTATE CRM</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 py-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium ${
                        isActive ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
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
              <p className="text-xs font-semibold">{currentUser?.full_name}</p>
              <p className="text-[11px] text-slate-400 mb-3">{currentRoleInfo?.label}</p>
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
            {/* Role Impersonation Switcher (Chỉ dành cho Admin theo quy định mục 6) */}
            <div className="relative">
              <button
                onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors"
              >
                <UserCheck className="h-3.5 w-3.5 text-blue-600" />
                <span className="hidden sm:inline">Góc nhìn:</span>
                <span className="font-semibold text-blue-700">{currentRoleInfo?.label.split('(')[0]}</span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              {roleDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white shadow-xl border border-slate-200 p-2 z-50">
                  <div className="px-3 py-2 border-b border-slate-100 mb-1">
                    <p className="text-xs font-bold text-slate-800">Chuyển đổi góc nhìn vai trò</p>
                    <p className="text-[10px] text-slate-500">
                      Mỗi lần chuyển đổi sẽ được ghi nhận vào nhật ký bảo mật Audit Log.
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
                        Quay lại Quản trị viên
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notification Bell */}
            <button
              onClick={() => navigate('/notifications')}
              className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
            </button>

            {/* Role Badge */}
            <Badge variant="info" className="hidden lg:inline-flex text-[11px]">
              <Sparkles className="h-3 w-3 mr-1 text-blue-600" />
              AI Activated
            </Badge>
          </div>
        </header>

        {/* OUTLET VIEWPORT */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
