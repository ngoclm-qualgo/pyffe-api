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
  /** Companion device joins the family then gets SUSPENDED; each test sets up/tears down its own — see family-provisioning.ts. */
  targetDevice: string;
};
type WorkerFixtures = { tokens: TokenManager; family: FamilyContext };

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // One token manager per worker
  tokens: [async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({ baseURL: env.BASE_URL });
    await use(new TokenManager(new AuthService(ctx), env.TEST_USER_EMAIL));
    await ctx.dispose();
  }, { scope: 'worker' }],

  // Family shared across every test in the worker (created + deleted via specs/familyservice.yml, see family-provisioning.ts).
  // A manual FAMILY_ID/ACTOR_DEVICE_ID in .env.<env>.local (if set) takes priority and is used as-is, with no create/delete —
  // useful when a freshly created family lacks a subscription benefit a scenario needs (e.g. FAMILY-01 needs call-blocking permission).
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
    if (!res.ok()) familyLog.warn('Failed to clean up test family', { familyId, status: res.status() });
    await ctx.dispose();
  }, { scope: 'worker' }],

  api: async ({ playwright, tokens }, use, testInfo) => {
    const ctx = await playwright.request.newContext({ baseURL: env.BASE_URL });
    const correlationId = randomUUID();
    const apiLog = log.child({ testId: testInfo.titlePath.join(' > '), correlationId });
    await use(new ApiClient(ctx, tokens, apiLog, correlationId));
    await ctx.dispose();
  },

  // Dedicated service for auth flow tests (bypasses TokenManager/ApiClient, which already have a token)
  authService: async ({ playwright }, use, testInfo) => {
    const ctx = await playwright.request.newContext({ baseURL: env.BASE_URL });
    const correlationId = randomUUID();
    const authLog = createLogger('auth').child({ testId: testInfo.titlePath.join(' > '), correlationId });
    await use(new AuthService(ctx, undefined, correlationId, undefined, authLog));
    await ctx.dispose();
  },

  // Steps: user actions built on top of the service; specs only call these steps
  onboardingSteps: async ({ authService }, use) => use(new OnboardingSteps(authService)),
  sessionSteps: async ({ authService }, use) => use(new SessionSteps(authService)),

  // Family scenarios (scam-alert, device, settings, phone-number): share the user token via `api`
  familyService: async ({ api }, use) => use(new FamilyService(api)),
  scamAlertSteps: async ({ familyService, family }, use) => use(new ScamAlertSteps(familyService, family)),
  deviceSteps: async ({ familyService, family }, use) => use(new DeviceSteps(familyService, family)),
  settingsSteps: async ({ familyService, family }, use) => use(new SettingsSteps(familyService, family)),
  phoneNumberSteps: async ({ familyService, family }, use) => use(new PhoneNumberSteps(familyService, family)),

  // Second member device (companion): joins the family then gets SUSPENDED, used as TARGET_DEVICE_ID for
  // DEVICE-01/DEVICE-02. Test-scoped (not worker-scoped) so each test gets its own device, no longer "consumed"
  // across runs the way it was when TARGET_DEVICE_ID was a fixed UUID in .env.<env>.local.
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

    // Owner removes the device (not companion self-LEAVE): changing deviceStatus appears to invalidate the companion's JWT,
    // so by cleanup time the companion can no longer call the API. Idempotent — DEVICE-02 may have already deleted this device.
    const removeRes = await familyService.removeDevice(family.familyId, family.actorDeviceId, deviceId);
    if (!removeRes.ok() && removeRes.status() !== 404) {
      companionLog.warn('Failed to clean up target device', { deviceId, status: removeRes.status() });
    }
    await ctx.dispose();
  },

  // Admin notification campaign: dedicated backoffice JWT (ADMIN_ACCESS_TOKEN), bypasses TokenManager
  adminNotificationService: async ({ playwright }, use, testInfo) => {
    const ctx = await playwright.request.newContext({ baseURL: env.ADMIN_BASE_URL });
    const correlationId = randomUUID();
    const adminLog = createLogger('admin-notification').child({ testId: testInfo.titlePath.join(' > '), correlationId });
    await use(new AdminNotificationService(ctx, correlationId, adminLog));
    await ctx.dispose();
  },
  adminNotificationSteps: async ({ adminNotificationService }, use) => use(new AdminNotificationSteps(adminNotificationService)),

  // Depends on api, so teardown runs BEFORE the context is disposed
  cleanup: async ({ api }, use) => {
    const registry = new CleanupRegistry();
    await use(registry);
    const failed = await registry.run();
    if (failed.length) fixtureLog.warn('Test data clean-up incomplete', { failed });
  },
});

export { expect };