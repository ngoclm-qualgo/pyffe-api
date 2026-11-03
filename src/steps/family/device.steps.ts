// src/steps/family/device.steps.ts
// Family device management steps: reactivate a locked device, remove a member's device.
// targetDeviceId is passed as a parameter (not read from env) because each test provisions its own
// companion device via the `targetDevice` fixture — see src/core/fixtures/family-provisioning.ts.
import { test, expect, type APIResponse } from '@playwright/test';
import type { FamilyService, FamilyContext } from '../../services/family/family.service';
import { createLogger } from '../../core/utils/logger';
import { logResponseBody } from '../../core/utils/log-response';

const log = createLogger('device');

export class DeviceSteps {
  constructor(private readonly family: FamilyService, private readonly ctx: FamilyContext) {}

  activateSuspendedDevice(targetDeviceId: string): Promise<APIResponse> {
    return test.step('Family owner reactivates a suspended device (SUSPENDED -> ACTIVE)', () =>
      this.family.updateDeviceStatus(this.ctx.familyId, this.ctx.actorDeviceId, targetDeviceId, 'ACTIVE'));
  }

  removeMemberDevice(targetDeviceId: string): Promise<APIResponse> {
    return test.step('Family owner removes another member\'s device', () =>
      this.family.removeDevice(this.ctx.familyId, this.ctx.actorDeviceId, targetDeviceId));
  }

  expectAccepted(res: APIResponse) {
    return test.step('Request is accepted', async () => {
      await logResponseBody(log, 'Device update response', res);
      await expect(res).toBeOK();
    });
  }
}
