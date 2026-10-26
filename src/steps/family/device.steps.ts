// src/steps/family/device.steps.ts
// Các bước quản lý thiết bị trong family: kích hoạt lại thiết bị bị khóa, xóa thiết bị thành viên.
// targetDeviceId truyền theo tham số (không đọc từ env) vì mỗi test dựng một companion device riêng
// qua fixture `targetDevice` — xem src/core/fixtures/family-provisioning.ts.
import { test, expect, type APIResponse } from '@playwright/test';
import type { FamilyService, FamilyContext } from '../../services/family/family.service';
import { createLogger } from '../../core/utils/logger';
import { logResponseBody } from '../../core/utils/log-response';

const log = createLogger('device');

export class DeviceSteps {
  constructor(private readonly family: FamilyService, private readonly ctx: FamilyContext) {}

  activateSuspendedDevice(targetDeviceId: string): Promise<APIResponse> {
    return test.step('Chủ gia đình kích hoạt lại thiết bị đang bị khóa (SUSPENDED -> ACTIVE)', () =>
      this.family.updateDeviceStatus(this.ctx.familyId, this.ctx.actorDeviceId, targetDeviceId, 'ACTIVE'));
  }

  removeMemberDevice(targetDeviceId: string): Promise<APIResponse> {
    return test.step('Chủ gia đình xóa thiết bị của thành viên khác', () =>
      this.family.removeDevice(this.ctx.familyId, this.ctx.actorDeviceId, targetDeviceId));
  }

  expectAccepted(res: APIResponse) {
    return test.step('Yêu cầu được chấp nhận', async () => {
      await logResponseBody(log, 'Device update response', res);
      await expect(res).toBeOK();
    });
  }
}
