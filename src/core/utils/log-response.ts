// src/core/utils/log-response.ts
// Ghi log nội dung response (status + body) vào kết quả test, để xác nhận assertion đang khớp với
// dữ liệu thực tế server trả về (đặc biệt hữu ích với các field/status còn đang giả định theo guide).
import type { APIResponse } from '@playwright/test';
import type { Logger } from './logger';

export async function logResponseBody(log: Logger, action: string, res: APIResponse): Promise<unknown> {
  const text = await res.text();
  let body: unknown = text || undefined;
  if (text) {
    try { body = JSON.parse(text); } catch { /* không phải JSON, giữ dạng text thô */ }
  }
  log.info(action, { status: res.status(), body });
  return body;
}
