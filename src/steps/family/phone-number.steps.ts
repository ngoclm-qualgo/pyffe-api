// src/steps/family/phone-number.steps.ts
// Steps for syncing family phone numbers to other devices.
import { test, expect, type APIResponse } from '@playwright/test';
import type { FamilyService, FamilyContext } from '../../services/family/family.service';
import { createLogger } from '../../core/utils/logger';
import { logResponseBody } from '../../core/utils/log-response';

const log = createLogger('phone-number');

export class PhoneNumberSteps {
  constructor(private readonly family: FamilyService, private readonly ctx: FamilyContext) {}

  addSafelistNumber(phoneNumber: string): Promise<APIResponse> {
    return test.step(`User adds phone number ${phoneNumber} to safelist`, () =>
      this.family.addPhoneNumber(this.ctx.familyId, this.ctx.actorDeviceId, [
        { phoneNumber, category: 'SAFELIST', note: 'pyffe-api automation' },
      ]));
  }

  addBlocklistNumber(phoneNumber: string): Promise<APIResponse> {
    return test.step(`User adds phone number ${phoneNumber} to blocklist`, () =>
      this.family.addPhoneNumber(this.ctx.familyId, this.ctx.actorDeviceId, [
        { phoneNumber, category: 'BLOCKLIST', note: 'pyffe-api automation' },
      ]));
  }

  deleteNumber(phoneNumberId: string): Promise<APIResponse> {
    return test.step('User deletes phone number', () =>
      this.family.deletePhoneNumber(this.ctx.familyId, this.ctx.actorDeviceId, phoneNumberId));
  }

  async expectCreated(res: APIResponse): Promise<string> {
    return test.step('Phone number is created and synced to other devices', async () => {
      // Log the full body to confirm the correct field holding the id (assumes data[0].id, following the
      // admin notification convention; cross-check this log against the actual response if the id assertion below fails).
      const body = (await logResponseBody(log, 'Add phone number response', res)) as { data?: { id?: string }[] } | undefined;
      await expect(res).toBeOK();
      const id = body?.data?.[0]?.id;
      expect(id, 'must return the id of the newly created phone number in data[0].id — see the response log above to confirm the actual field').toBeTruthy();
      return id!;
    });
  }

  expectDeleted(res: APIResponse) {
    return test.step('Phone number is deleted and synced to other devices', async () => {
      await logResponseBody(log, 'Delete phone number response', res);
      expect(res.status()).toBe(204);
    });
  }
}
