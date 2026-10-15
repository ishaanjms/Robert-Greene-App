const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const requestCounts = new Map<string, RateLimitEntry>();

export function getClientRequestKey(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  return forwardedFor?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'anonymous';
}

export function isRateLimited(key: string) {
  const now = Date.now();

  for (const [entryKey, entry] of requestCounts) {
    if (entry.resetAt <= now) requestCounts.delete(entryKey);
  }

  const existing = requestCounts.get(key);
  if (!existing || existing.resetAt <= now) {
    requestCounts.set(key, {count: 1, resetAt: now + WINDOW_MS});
    return {limited: false, retryAfterSeconds: 0};
  }

  existing.count += 1;
  return {
    limited: existing.count > MAX_REQUESTS_PER_WINDOW,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1_000)),
  };
}
