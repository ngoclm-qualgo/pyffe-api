// src/steps/family/settings.steps.ts
// Steps for syncing family call-blocking settings to other devices.
import { test, expect, type APIResponse } from '@playwright/test';
import type { FamilyService, FamilyContext } from '../../services/family/family.service';
import { createLogger } from '../../core/utils/logger';
import { logResponseBody } from '../../core/utils/log-response';

const log = createLogger('settings');

export class SettingsSteps {
  constructor(private readonly family: FamilyService, private readonly ctx: FamilyContext) {}

  updateAutoBlockScamCall(value: boolean): Promise<APIResponse> {
    return test.step(`User updates setting AUTO_BLOCK_SCAM_CALL = ${value}`, () =>
      this.family.updateSettings(this.ctx.familyId, this.ctx.actorDeviceId, [{ key: 'AUTO_BLOCK_SCAM_CALL', value }]));
  }

  expectSynchronized(res: APIResponse) {
    return test.step('System syncs the setting to other devices (204)', async () => {
      await logResponseBody(log, 'Update family settings response', res);
      expect(res.status()).toBe(204);
    });
  }
}
