// src/services/notification/admin-notification.service.ts
// API object for admin (backoffice) notification campaigns. Uses a separate backoffice JWT (ADMIN_ACCESS_TOKEN), not via TokenManager.
// See specs/notification-push-postman-curl-guide.md.
import { randomUUID } from 'node:crypto';
import { type APIRequestContext, type APIResponse } from '@playwright/test';
import { env } from '../../../config/env';
import { createLogger, type Logger } from '../../core/utils/logger';

const NOTIFICATIONS_PATH = '/api/v1/admin/notifications';

export class AdminNotificationService {
  constructor(
    private readonly request: APIRequestContext, // created with baseURL: env.ADMIN_BASE_URL
    private readonly correlationId: string = randomUUID(),
    private readonly log: Logger = createLogger('admin-notification'),
  ) {}

  create(body: Record<string, unknown>): Promise<APIResponse> {
    return this.logged(`Create admin notification campaign (${body.type})`, 'POST', NOTIFICATIONS_PATH, () => this.request.post(NOTIFICATIONS_PATH, {
      data: body,
      headers: this.headers(),
      timeout: env.API_TIMEOUT_MS,
    }));
  }

  refreshStatus(notificationId: string): Promise<APIResponse> {
    const endpoint = `${NOTIFICATIONS_PATH}/${notificationId}/refresh-status`;
    return this.logged('Refresh notification dispatch status', 'POST', endpoint, () => this.request.post(endpoint, {
      headers: this.headers(),
      timeout: env.API_TIMEOUT_MS,
    }));
  }

  getDispatches(notificationId: string): Promise<APIResponse> {
    const endpoint = `${NOTIFICATIONS_PATH}/${notificationId}/dispatches`;
    return this.logged('Get notification dispatches', 'GET', endpoint, () => this.request.get(endpoint, {
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

  private async logged(action: string, method: string, endpoint: string, fn: () => Promise<APIResponse>): Promise<APIResponse> {
    const started = Date.now();
    try {
      const res = await fn();
      this.log.info(action, { method, endpoint, status: res.status(), durationMs: Date.now() - started });
      return res;
    } catch (err) {
      this.log.error(`${action} failed`, { method, endpoint, durationMs: Date.now() - started, err });
      throw err;
    }
  }
}
