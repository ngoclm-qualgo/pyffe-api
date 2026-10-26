import { test as base, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { env } from '../../../config/env';
import { AuthService } from '../../services/auth/auth.service';
import { TokenManager } from '../../services/auth/token-manager';
import { FamilyService, type FamilyContext } from '../../services/family/family.service';
import { CompanionService } from '../../services/family/companion.service';
import { AdminNotificationService } from '../../services/notification/admin-notification.service';
import { OnboardingSteps } from '../../steps/auth/onboarding.steps';
import { SessionSteps } from '../../steps/auth/session.steps';
import { ScamAlertSteps } from '../../steps/family/scam-alert.steps';
import { DeviceSteps } from '../../steps/family/device.steps';
import { SettingsSteps } from '../../steps/family/settings.steps';
import { PhoneNumberSteps } from '../../steps/family/phone-number.steps';
import { AdminNotificationSteps } from '../../steps/notification/admin-notification.steps';
import { ApiClient } from '../client/api-client';
import { CleanupRegistry } from '../utils/cleanup';
import { createLogger } from '../utils/logger';
import { provisionFamily, provisionCompanionDevice } from './family-provisioning';

const log = createLogger('api-client');
const fixtureLog = createLogger('fixtures');

type TestFixtures = {
  api: ApiClient;
  authService: AuthService;
  cleanup: CleanupRegistry;
  onboardingSteps: OnboardingSteps;
  sessionSteps: SessionSteps;
  familyService: FamilyService;
  scamAlertSteps: ScamAlertSteps;
  deviceSteps: DeviceSteps;
  settingsSteps: SettingsSteps;
  phoneNumberSteps: PhoneNumberSteps;
  adminNotificationService: AdminNotificationService;
  adminNotificationSteps: AdminNotificationSteps;
  /** Companion device join family rồi đặt SUSPENDED; mỗi test tự dựng/dọn riêng — xem family-provisioning.ts. */
  targetDevice: string;
};
type WorkerFixtures = { tokens: TokenManager; family: FamilyContext };

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // Một token manager cho mỗi worker
  tokens: [async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({ baseURL: env.BASE_URL });
    await use(new TokenManager(new AuthService(ctx), env.TEST_USER_EMAIL));
    await ctx.dispose();
  }, { scope: 'worker' }],

  // Family dùng chung cho mọi test trong worker (tạo + xóa qua specs/familyservice.yml, xem family-provisioning.ts).
  // FAMILY_ID/ACTOR_DEVICE_ID thủ công trong .env.<env>.local (nếu đặt) được ưu tiên dùng nguyên trạng, không tạo/xóa —
  // hữu ích khi family tự tạo mới chưa có subscription benefit mà một scenario cần (ví dụ FAMILY-01 cần quyền chặn gọi).
  family: [async ({ playwright, tokens }, use) => {
    if (env.FAMILY_ID && env.ACTOR_DEVICE_ID) {
      await use({ familyId: env.FAMILY_ID, actorDeviceId: env.ACTOR_DEVICE_ID });
      return;
    }
    const ctx = await playwright.request.newContext({ baseURL: env.BASE_URL });
    const correlationId = randomUUID();
    const familyLog = createLogger('family-setup').child({ correlationId });
    const familyService = new FamilyService(new ApiClient(ctx, tokens, familyLog, correlationId));
    const actorDeviceId = tokens.deviceId;
    const familyId = await provisionFamily(familyService, actorDeviceId, familyLog);

    await use({ familyId, actorDeviceId });

    const res = await familyService.deleteFamily(familyId, actorDeviceId);
    if (!res.ok()) familyLog.warn('Dọn dẹp family test không thành công', { familyId, status: res.status() });
    await ctx.dispose();
  }, { scope: 'worker' }],

  api: async ({ playwright, tokens }, use, testInfo) => {
    const ctx = await playwright.request.newContext({ baseURL: env.BASE_URL });
    const correlationId = randomUUID();
    const apiLog = log.child({ testId: testInfo.titlePath.join(' > '), correlationId });
    await use(new ApiClient(ctx, tokens, apiLog, correlationId));
    await ctx.dispose();
  },

  // Service riêng cho test luồng auth (không qua TokenManager/ApiClient đã có token)
  authService: async ({ playwright }, use, testInfo) => {
    const ctx = await playwright.request.newContext({ baseURL: env.BASE_URL });
    const correlationId = randomUUID();
    const authLog = createLogger('auth').child({ testId: testInfo.titlePath.join(' > '), correlationId });
    await use(new AuthService(ctx, undefined, correlationId, undefined, authLog));
    await ctx.dispose();
  },

  // Steps: các bước người dùng dựng trên service, spec chỉ gọi các bước này
  onboardingSteps: async ({ authService }, use) => use(new OnboardingSteps(authService)),
  sessionSteps: async ({ authService }, use) => use(new SessionSteps(authService)),

  // Scenario family (scam-alert, thiết bị, cài đặt, số điện thoại): dùng chung token người dùng qua `api`
  familyService: async ({ api }, use) => use(new FamilyService(api)),
  scamAlertSteps: async ({ familyService, family }, use) => use(new ScamAlertSteps(familyService, family)),
  deviceSteps: async ({ familyService, family }, use) => use(new DeviceSteps(familyService, family)),
  settingsSteps: async ({ familyService, family }, use) => use(new SettingsSteps(familyService, family)),
  phoneNumberSteps: async ({ familyService, family }, use) => use(new PhoneNumberSteps(familyService, family)),

  // Thiết bị thành viên thứ hai (companion): join family rồi đặt SUSPENDED, dùng làm TARGET_DEVICE_ID cho
  // DEVICE-01/DEVICE-02. Test-scoped (không phải worker) nên mỗi test có device riêng, không còn bị "tiêu thụ"
  // chéo giữa các lần chạy như khi TARGET_DEVICE_ID là một UUID cố định trong .env.<env>.local.
  targetDevice: async ({ playwright, familyService, family }, use, testInfo) => {
    const ctx = await playwright.request.newContext({ baseURL: env.BASE_URL });
    const correlationId = randomUUID();
    const companionLog = createLogger('companion').child({ testId: testInfo.titlePath.join(' > '), correlationId });
    const companionTokens = new TokenManager(new AuthService(ctx, undefined, correlationId, undefined, companionLog), undefined, 'companion');
    const companionService = new CompanionService(new ApiClient(ctx, companionTokens, companionLog, correlationId));
    const companionDeviceId = companionTokens.deviceId;

    const deviceId = await provisionCompanionDevice(companionService, companionDeviceId, familyService, family.familyId, family.actorDeviceId);
    await familyService.updateDeviceStatus(family.familyId, family.actorDeviceId, deviceId, 'SUSPENDED');

    await use(deviceId);

    // Owner xóa device (không phải companion tự LEAVE): đổi deviceStatus có vẻ vô hiệu hóa JWT của companion,
    // nên lúc dọn dẹp companion không còn gọi API được. Idempotent — DEVICE-02 có thể đã xóa device này rồi.
    const removeRes = await familyService.removeDevice(family.familyId, family.actorDeviceId, deviceId);
    if (!removeRes.ok() && removeRes.status() !== 404) {
      companionLog.warn('Dọn dẹp target device không thành công', { deviceId, status: removeRes.status() });
    }
    await ctx.dispose();
  },

  // Campaign thông báo admin: JWT backoffice riêng (ADMIN_ACCESS_TOKEN), không qua TokenManager
  adminNotificationService: async ({ playwright }, use, testInfo) => {
    const ctx = await playwright.request.newContext({ baseURL: env.ADMIN_BASE_URL });
    const correlationId = randomUUID();
    const adminLog = createLogger('admin-notification').child({ testId: testInfo.titlePath.join(' > '), correlationId });
    await use(new AdminNotificationService(ctx, correlationId, adminLog));
    await ctx.dispose();
  },
  adminNotificationSteps: async ({ adminNotificationService }, use) => use(new AdminNotificationSteps(adminNotificationService)),

  // Phụ thuộc vào api nên teardown chạy TRƯỚC khi context bị dispose
  cleanup: async ({ api }, use) => {
    const registry = new CleanupRegistry();
    await use(registry);
    const failed = await registry.run();
    if (failed.length) fixtureLog.warn('Test data clean-up incomplete', { failed });
  },
});

export { expect };