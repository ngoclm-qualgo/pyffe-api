// src/steps/family/phone-number.steps.ts
// Các bước đồng bộ số điện thoại của family tới các thiết bị khác.
import { test, expect, type APIResponse } from '@playwright/test';
import type { FamilyService, FamilyContext } from '../../services/family/family.service';
import { createLogger } from '../../core/utils/logger';
import { logResponseBody } from '../../core/utils/log-response';

const log = createLogger('phone-number');

export class PhoneNumberSteps {
  constructor(private readonly family: FamilyService, private readonly ctx: FamilyContext) {}

  addSafelistNumber(phoneNumber: string): Promise<APIResponse> {
    return test.step(`Người dùng thêm số điện thoại ${phoneNumber} vào safelist`, () =>
      this.family.addPhoneNumber(this.ctx.familyId, this.ctx.actorDeviceId, [
        { phoneNumber, category: 'SAFELIST', note: 'pyffe-api automation' },
      ]));
  }

  addBlocklistNumber(phoneNumber: string): Promise<APIResponse> {
    return test.step(`Người dùng thêm số điện thoại ${phoneNumber} vào blocklist`, () =>
      this.family.addPhoneNumber(this.ctx.familyId, this.ctx.actorDeviceId, [
        { phoneNumber, category: 'BLOCKLIST', note: 'pyffe-api automation' },
      ]));
  }

  deleteNumber(phoneNumberId: string): Promise<APIResponse> {
    return test.step('Người dùng xóa số điện thoại', () =>
      this.family.deletePhoneNumber(this.ctx.familyId, this.ctx.actorDeviceId, phoneNumberId));
  }

  async expectCreated(res: APIResponse): Promise<string> {
    return test.step('Số điện thoại được tạo và đồng bộ cho các thiết bị khác', async () => {
      // Log toàn bộ body để xác nhận đúng field chứa id (giả định data[0].id theo quy ước của admin notification;
      // đối chiếu log này với response thực tế nếu assertion id dưới đây sai).
      const body = (await logResponseBody(log, 'Add phone number response', res)) as { data?: { id?: string }[] } | undefined;
      await expect(res).toBeOK();
      const id = body?.data?.[0]?.id;
      expect(id, 'phải trả về id số điện thoại vừa tạo trong data[0].id — xem log response phía trên để xác nhận field thực tế').toBeTruthy();
      return id!;
    });
  }

  expectDeleted(res: APIResponse) {
    return test.step('Số điện thoại được xóa và đồng bộ cho các thiết bị khác', async () => {
      await logResponseBody(log, 'Delete phone number response', res);
      expect(res.status()).toBe(204);
    });
  }
}
