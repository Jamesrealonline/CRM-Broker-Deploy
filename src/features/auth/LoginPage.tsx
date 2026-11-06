// ========================================================
// REAL ESTATE CRM - LOGIN PAGE
// Giao diện bảo mật, khóa tạm 5 phút sau 5 lần sai, ẩn chi tiết lỗi
// ========================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Lock, Mail, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '@/app/useAuthStore';
import { Button } from '@/components/ui/Button';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

            <div className="space-y-1.5">
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
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
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
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              className="w-full py-2.5 font-semibold text-sm mt-3"
            >
              Đăng nhập hệ thống
            </Button>
          </form>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-6">
          <p className="text-[11px] text-slate-400">
            Hệ thống bảo vệ dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP • Khóa tự động sau 5 lần nhập sai
          </p>
        </div>
      </div>
    </div>
  );
};
