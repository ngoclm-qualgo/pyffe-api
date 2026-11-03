// src/core/utils/log-response.ts
// Logs the response content (status + body) into the test result, to confirm assertions match
// what the server actually returns (especially useful for fields/statuses still assumed from the guide).
import type { APIResponse } from '@playwright/test';
import type { Logger } from './logger';

export async function logResponseBody(log: Logger, action: string, res: APIResponse): Promise<unknown> {
  const text = await res.text();
  let body: unknown = text || undefined;
  if (text) {
    try { body = JSON.parse(text); } catch { /* not JSON, keep as raw text */ }
  }
  log.info(action, { status: res.status(), body });
  return body;
}
