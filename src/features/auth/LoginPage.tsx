// ========================================================
// REAL ESTATE CRM - LOGIN PAGE
// Giao diện bảo mật, khóa tạm 5 phút sau 5 lần sai, ẩn chi tiết lỗi
// ========================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Lock, Mail, ShieldAlert, Sparkles, KeyRound } from 'lucide-react';
import { useAuthStore } from '@/app/useAuthStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { USER_ROLES } from '@/domain/constants';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('admin@diaocvang.vn');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.error || 'Thông tin tài khoản hoặc mật khẩu không chính xác.');
      }
    } catch {
      setError('Đã xảy ra lỗi khi kết nối máy chủ. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoSelect = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword('password123');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 selection:bg-blue-500 selection:text-white">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 rounded-xl bg-blue-600 items-center justify-center text-white shadow-xl shadow-blue-500/20 mb-3">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            REAL ESTATE CRM PLATFORM
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Sales & Marketing Intelligence Platform • Supabase & Vercel
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-800 border border-slate-700/80 rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-300">Email đăng nhập</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@diaocvang.vn"
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-slate-300">Mật khẩu</label>
                <span className="text-[11px] text-slate-400">Tối thiểu 8 ký tự</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              className="w-full py-2.5 font-semibold text-sm mt-2"
            >
              Đăng nhập an toàn
            </Button>
          </form>

          {/* Quick Demo Selector (Hỗ trợ kiểm thử nhanh 6 vai trò) */}
          <div className="mt-6 pt-5 border-t border-slate-700/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <KeyRound className="h-3 w-3 text-blue-400" /> Thử nhanh 6 vai trò:
              </span>
              <span className="text-[10px] text-slate-500">Pass: password123</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { role: 'Admin', email: 'admin@diaocvang.vn' },
                { role: 'Giám Đốc', email: 'giamdoc@diaocvang.vn' },
                { role: 'Marketing', email: 'marketing@diaocvang.vn' },
                { role: 'GĐ Sàn', email: 'gdsan@diaocvang.vn' },
                { role: 'Trưởng Nhóm', email: 'truongnhom@diaocvang.vn' },
                { role: 'Sale Agent', email: 'sale@diaocvang.vn' },
              ].map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleQuickDemoSelect(acc.email)}
                  className={`px-2.5 py-1.5 rounded-md text-[11px] text-left transition-colors border ${
                    email === acc.email
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-medium'
                      : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:bg-slate-700/60'
                  }`}
                >
                  {acc.role}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-6">
          <p className="text-[11px] text-slate-400">
            Hệ thống bảo vệ dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP • Khóa tự động sau 5 lần sai
          </p>
        </div>
      </div>
    </div>
  );
};
