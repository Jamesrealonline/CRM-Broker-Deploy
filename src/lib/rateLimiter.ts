// ========================================================
// RATE LIMITER - SLIDING WINDOW FOR ENDPOINTS & ACTIONS (P1.3)
// ========================================================

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Kiểm tra Rate Limit theo cơ chế Sliding Window
 * @param identifier User ID hoặc IP Address
 * @param endpoint Tên endpoint hoặc hành động
 * @param limit Số lượng request tối đa trong cửa sổ thời gian
 * @param windowMs Kích thước cửa sổ tính bằng milliseconds (mặc định 60,000ms = 1 phút)
 */
export function checkRateLimit(
  identifier: string,
  endpoint: string,
  limit: number,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetTimeMs: number } {
  const key = `${endpoint}:${identifier}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  let record = rateLimitStore.get(key);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(key, record);
  }

  // Lọc bỏ các timestamp nằm ngoài sliding window
  record.timestamps = record.timestamps.filter(ts => ts > windowStart);

  if (record.timestamps.length >= limit) {
    const oldestTimestamp = record.timestamps[0];
    const resetTimeMs = Math.max(0, oldestTimestamp + windowMs - now);
    return {
      allowed: false,
      remaining: 0,
      resetTimeMs,
    };
  }

  record.timestamps.push(now);
  const remaining = limit - record.timestamps.length;
  return {
    allowed: true,
    remaining,
    resetTimeMs: windowMs,
  };
}

/**
 * Cưỡng chế Rate Limit: Ném lỗi HTTP 429 nếu vượt ngưỡng cho phép
 */
export function assertRateLimit(
  identifier: string,
  endpoint: string,
  limit: number,
  windowMs: number = 60000
): void {
  const result = checkRateLimit(identifier, endpoint, limit, windowMs);
  if (!result.allowed) {
    const seconds = Math.ceil(result.resetTimeMs / 1000);
    throw new Error(
      `Bạn đã gửi quá nhiều yêu cầu đến thao tác "${endpoint}". Vui lòng thử lại sau ${seconds} giây (HTTP 429 Too Many Requests).`
    );
  }
}

/**
 * Xóa dữ liệu rate limit (dùng cho test suite)
 */
export function clearRateLimits(): void {
  rateLimitStore.clear();
}
