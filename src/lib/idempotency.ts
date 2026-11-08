// ========================================================
// IDEMPOTENCY MANAGER - PREVENT DUPLICATE MUTATIONS (P1.3)
// ========================================================

import { computePhoneHash } from './masking';
import { supabase, isLiveSupabaseConfigured } from './supabase';

interface LocalIdempotencyEntry {
  idempotency_key: string;
  endpoint: string;
  request_hash: string;
  status: 'processing' | 'completed' | 'failed';
  response_body?: any;
  created_at: number;
}

const STORAGE_KEY_IDEMPOTENCY = 'crm_request_idempotency';

/**
 * Kiểm tra hoặc bắt đầu xử lý request có Idempotency Key
 */
export async function checkOrStartIdempotency(
  idempotencyKey: string,
  endpoint: string,
  payload: any,
  userId?: string
): Promise<{ isCached: boolean; response?: any }> {
  const requestHash = computePhoneHash(JSON.stringify(payload || {}));

  if (isLiveSupabaseConfigured) {
    const { data, error } = await supabase.rpc('check_or_start_idempotency', {
      p_idempotency_key: idempotencyKey,
      p_endpoint: endpoint,
      p_request_hash: requestHash,
      p_user_id: userId,
    });

    if (error) throw new Error(error.message);
    if (data?.status === 'cached') {
      return { isCached: true, response: data.response_body };
    }
    return { isCached: false };
  }

  // Local / Simulator mode
  const list: LocalIdempotencyEntry[] = JSON.parse(localStorage.getItem(STORAGE_KEY_IDEMPOTENCY) || '[]');
  const existing = list.find(e => e.idempotency_key === idempotencyKey && e.endpoint === endpoint);

  if (existing) {
    if (existing.request_hash !== requestHash) {
      throw new Error(`Idempotency Key conflict: Khóa "${idempotencyKey}" đã được sử dụng với nội dung yêu cầu khác.`);
    }

    if (existing.status === 'completed') {
      return { isCached: true, response: existing.response_body };
    }

    if (existing.status === 'processing') {
      throw new Error(`Yêu cầu với khóa "${idempotencyKey}" đang được xử lý song song. Vui lòng chờ.`);
    }
  }

  // Đăng ký bản ghi mới ở trạng thái processing
  list.unshift({
    idempotency_key: idempotencyKey,
    endpoint,
    request_hash: requestHash,
    status: 'processing',
    created_at: Date.now(),
  });

  localStorage.setItem(STORAGE_KEY_IDEMPOTENCY, JSON.stringify(list.slice(0, 500)));
  return { isCached: false };
}

/**
 * Hoàn tất xử lý và lưu kết quả cho Idempotency Key
 */
export async function completeIdempotency(
  idempotencyKey: string,
  endpoint: string,
  response: any
): Promise<void> {
  if (isLiveSupabaseConfigured) {
    await supabase.rpc('complete_idempotent_request', {
      p_idempotency_key: idempotencyKey,
      p_endpoint: endpoint,
      p_response_code: 200,
      p_response_body: response,
    });
    return;
  }

  const list: LocalIdempotencyEntry[] = JSON.parse(localStorage.getItem(STORAGE_KEY_IDEMPOTENCY) || '[]');
  const entry = list.find(e => e.idempotency_key === idempotencyKey && e.endpoint === endpoint);
  if (entry) {
    entry.status = 'completed';
    entry.response_body = response;
    localStorage.setItem(STORAGE_KEY_IDEMPOTENCY, JSON.stringify(list));
  }
}
