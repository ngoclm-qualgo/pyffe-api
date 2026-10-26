// src/steps/family/settings.steps.ts
// Các bước đồng bộ cài đặt chặn gọi của family tới các thiết bị khác.
import { test, expect, type APIResponse } from '@playwright/test';
import type { FamilyService, FamilyContext } from '../../services/family/family.service';
import { createLogger } from '../../core/utils/logger';
import { logResponseBody } from '../../core/utils/log-response';

const log = createLogger('settings');

export class SettingsSteps {
  constructor(private readonly family: FamilyService, private readonly ctx: FamilyContext) {}

  updateAutoBlockScamCall(value: boolean): Promise<APIResponse> {
    return test.step(`Người dùng cập nhật cài đặt AUTO_BLOCK_SCAM_CALL = ${value}`, () =>
      this.family.updateSettings(this.ctx.familyId, this.ctx.actorDeviceId, [{ key: 'AUTO_BLOCK_SCAM_CALL', value }]));
  }

  expectSynchronized(res: APIResponse) {
    return test.step('Hệ thống đồng bộ cài đặt cho các thiết bị khác (204)', async () => {
      await logResponseBody(log, 'Update family settings response', res);
      expect(res.status()).toBe(204);
    });
  }
}
