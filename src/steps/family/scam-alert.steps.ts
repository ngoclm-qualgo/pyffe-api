// src/steps/family/scam-alert.steps.ts
// Steps for triggering a scam alert and verifying the API accepts it.
import { test, expect, type APIResponse } from '@playwright/test';
import type { FamilyService, FamilyContext } from '../../services/family/family.service';
import type { ScamAlertScenario } from '../../../tests/data/family.data';
import { createLogger } from '../../core/utils/logger';
import { logResponseBody } from '../../core/utils/log-response';

const log = createLogger('scam-alert');
const isoSeconds = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

export class ScamAlertSteps {
  constructor(private readonly family: FamilyService, private readonly ctx: FamilyContext) {}

  trigger(scenario: ScamAlertScenario, opts: { language?: string; level?: number } = {}): Promise<APIResponse> {
    return test.step(`Trigger alert ${scenario.scriptId} (${scenario.category})`, () =>
      this.family.sendScamAlert(this.ctx.familyId, this.ctx.actorDeviceId, {
        scriptId: scenario.scriptId,
        category: scenario.category,
        level: opts.level ?? 3,
        eventAt: isoSeconds(),
        payload: scenario.payload,
      }, opts));
  }

  expectAccepted(res: APIResponse) {
    return test.step('System accepts and raises the alert event (204)', async () => {
      await logResponseBody(log, 'Scam alert trigger response', res);
      expect(res.status()).toBe(204);
    });
  }
}
