import type { APIRequestContext, APIResponse } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { env } from '../../../config/env';
import type { TokenManager } from '../../services/auth/token-manager';
import { countryCodeHeader, hmacSignature } from '../../services/auth/request-signer';
import { ApiError } from './api-error';
import type { Logger } from '../utils/logger';
import { withRetry } from '../utils/retry';

type Opts = { action?: string; data?: unknown; params?: Record<string, string | number>; headers?: Record<string, string> };

export class ApiClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly tokens: TokenManager,
    private readonly log: Logger,
    private readonly correlationId: string, // một giá trị cho cả test/flow
  ) {}

  get(path: string, o: Opts = {}) { return withRetry(() => this.send('GET', path, o), env.RETRY_COUNT); }
  post(path: string, data: unknown, o: Opts = {}) { return this.send('POST', path, { ...o, data }); }
  put(path: string, data: unknown, o: Opts = {}) { return this.send('PUT', path, { ...o, data }); }
  patch(path: string, data: unknown, o: Opts = {}) { return this.send('PATCH', path, { ...o, data }); }
  delete(path: string, o: Opts = {}) { return this.send('DELETE', path, o); }

  /** Kiểm tra status mong đợi rồi trả về JSON. */
  async json<T = unknown>(res: APIResponse, expected: number | number[] = [200, 201]): Promise<T> {
    const ok = ([] as number[]).concat(expected).includes(res.status());
    if (!ok) throw new ApiError('http', `Unexpected status ${res.status()} for ${res.url()}`, res.status());
    return (await res.json()) as T;
  }

  private async send(method: string, path: string, o: Opts): Promise<APIResponse> {
    const requestId = randomUUID();
    const action = o.action ?? `${method} ${path}`; // hành động của người dùng; mặc định là method + path
    const started = Date.now();
    const token = await this.tokens.getAccessToken();
    try {
      const res = await this.request.fetch(path, {
        method,
        data: o.data,
        params: o.params,
        timeout: env.API_TIMEOUT_MS,
        headers: {
          ...o.headers,
          Authorization: `Bearer ${token}`,
          'X-Correlation-ID': this.correlationId,
          'X-Request-ID': requestId,
          'x-country-code': countryCodeHeader(),
          'x-signature': this.signatureFor(method, o.data, o.params),
        },
      });
      this.log.info(action, { requestId, method, endpoint: path, status: res.status(), durationMs: Date.now() - started });
      return res;
    } catch (err) {
      this.log.error(`${action} failed`, { requestId, method, endpoint: path, durationMs: Date.now() - started, err });
      throw new ApiError('transport', `Transport error on ${method} ${path}: ${(err as Error).message}`);
    }
  }

  // Gateway (Kong HMAC-validate) ký trên body cho POST/PUT/PATCH có body; GET/HEAD hoặc request không có body
  // thì ký trên query params (rỗng nếu không có) — khớp logic pre-request script trong specs/requirement.md.
  private signatureFor(method: string, data: unknown, params?: Record<string, string | number>): string {
    const hasBody = data !== undefined && data !== null && !(typeof data === 'object' && Object.keys(data as object).length === 0);
    const toSign = method === 'GET' || method === 'HEAD' || !hasBody ? (params ?? {}) : data;
    return hmacSignature(toSign as Record<string, unknown>);
  }
}