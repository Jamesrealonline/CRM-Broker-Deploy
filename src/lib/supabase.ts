import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

// Trong môi trường Unit Test (Vitest) không có auth session, sử dụng Mock Simulator để kiểm tra logic nội bộ.
// Trong môi trường App thật (Browser dev/prod), kết nối trực tiếp Supabase live.
export const isLiveSupabaseConfigured = 
  import.meta.env.MODE !== 'test' &&
  Boolean(import.meta.env.VITE_SUPABASE_URL) && 
  Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY) &&
  !import.meta.env.VITE_SUPABASE_URL.includes('placeholder');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
