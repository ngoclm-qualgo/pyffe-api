// src/steps/notification/admin-notification.steps.ts
import { test, expect, type APIResponse } from '@playwright/test';
import { env } from '../../../config/env';
import type { AdminNotificationService } from '../../services/notification/admin-notification.service';
import { expectNoForbiddenBrand } from '../../core/utils/brand-check';
import { createLogger } from '../../core/utils/logger';
import { logResponseBody } from '../../core/utils/log-response';

const log = createLogger('admin-notification-steps');
type CampaignType = 'product_announcement' | 'community_update';

export class AdminNotificationSteps {
  constructor(private readonly admin: AdminNotificationService) {}

  createCampaign(type: CampaignType, title: string, description: string): Promise<APIResponse> {
    return test.step(`Admin creates campaign of type ${type}`, () =>
      this.admin.create({
        title,
        description,
        type,
        actionType: 'open_web',
        targetUrl: 'https://pyffe.com',
        campaignId: `PYFFE_${type.toUpperCase()}_${Date.now()}`,
        audienceId: env.AUDIENCE_ID!,
        deliveryMode: 'immediate',
      }));
  }

  async expectCreated(res: APIResponse): Promise<string> {
    return test.step('Campaign is created successfully', async () => {
      const body = (await logResponseBody(log, 'Create campaign response', res)) as { data?: { id?: string } } | undefined;
      await expect(res).toBeOK();
      const id = body?.data?.id;
      expect(id, 'must return the data.id of the newly created campaign — see the response log above to confirm the actual field').toBeTruthy();
      return id!;
    });
  }

  expectNoForbiddenBrandInContent(title: string, description: string) {
    return test.step('Campaign content does not mention the legacy brand', () => {
      expectNoForbiddenBrand(`${title}\n${description}`, 'admin notification');
    });
  }

  refreshAndGetDispatches(notificationId: string): Promise<APIResponse> {
    return test.step('Refresh and get dispatch status', async () => {
      await this.admin.refreshStatus(notificationId);
      return this.admin.getDispatches(notificationId);
    });
  }

  expectDispatchedWithoutForbiddenBrand(res: APIResponse) {
    return test.step('Dispatch succeeds and returned content does not mention the legacy brand', async () => {
      const body = await logResponseBody(log, 'Get dispatches response', res);
      await expect(res).toBeOK();
      expectNoForbiddenBrand(typeof body === 'string' ? body : JSON.stringify(body ?? ''), 'admin notification dispatch');
    });
  }
}
