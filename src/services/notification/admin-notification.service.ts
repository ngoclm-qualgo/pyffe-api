// src/services/notification/admin-notification.service.ts
// API object cho campaign thông báo admin (backoffice). Dùng JWT backoffice riêng (ADMIN_ACCESS_TOKEN), không qua TokenManager.
// Xem specs/notification-push-postman-curl-guide.md.
import { randomUUID } from 'node:crypto';
import { type APIRequestContext, type APIResponse } from '@playwright/test';
import { env } from '../../../config/env';
import { createLogger, type Logger } from '../../core/utils/logger';

const NOTIFICATIONS_PATH = '/api/v1/admin/notifications';

export class AdminNotificationService {
  constructor(
    private readonly request: APIRequestContext, // tạo với baseURL: env.ADMIN_BASE_URL
    private readonly correlationId: string = randomUUID(),
    private readonly log: Logger = createLogger('admin-notification'),
  ) {}

  create(body: Record<string, unknown>): Promise<APIResponse> {
    return this.logged(`Create admin notification campaign (${body.type})`, () => this.request.post(NOTIFICATIONS_PATH, {
      data: body,
      headers: this.headers(),
      timeout: env.API_TIMEOUT_MS,
    }));
  }

  refreshStatus(notificationId: string): Promise<APIResponse> {
    return this.logged('Refresh notification dispatch status', () => this.request.post(`${NOTIFICATIONS_PATH}/${notificationId}/refresh-status`, {
      headers: this.headers(),
      timeout: env.API_TIMEOUT_MS,
    }));
  }

  getDispatches(notificationId: string): Promise<APIResponse> {
    return this.logged('Get notification dispatches', () => this.request.get(`${NOTIFICATIONS_PATH}/${notificationId}/dispatches`, {
      headers: this.headers(),
      timeout: env.API_TIMEOUT_MS,
    }));
  }

  private headers() {
    return {
      Authorization: `Bearer ${env.ADMIN_ACCESS_TOKEN}`,
      'x-language': 'en',
      'x-correlation-id': this.correlationId,
    };
  }

  private async logged(action: string, fn: () => Promise<APIResponse>): Promise<APIResponse> {
    const started = Date.now();
    try {
      const res = await fn();
      this.log.info(action, { status: res.status(), durationMs: Date.now() - started });
      return res;
    } catch (err) {
      this.log.error(`${action} failed`, { durationMs: Date.now() - started, err });
      throw err;
    }
  }
}
