// src/core/utils/retry.ts: only use for safe requests (GET)
const RETRYABLE = new Set([429, 502, 503, 504]);

export async function withRetry<T extends { status(): number }>(
  fn: () => Promise<T>,
  attempts: number,
): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      const res = await fn();
      if (i >= attempts || !RETRYABLE.has(res.status())) return res;
    } catch (e) {
      if (i >= attempts) throw e;
    }
    await new Promise((r) => setTimeout(r, 200 * 2 ** i)); // backoff; add Retry-After support if needed
  }
}