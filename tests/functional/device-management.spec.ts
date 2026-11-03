// tests/functional/device-management.spec.ts
// Feature: device management within a family — reactivate a locked device, remove a member's device.
// Each test provisions its own companion device (fixture `targetDevice`, already in SUSPENDED state on join)
// and cleans up after running — there's no longer a "reuse device" concept between runs like before.
import { test } from '../../src/core/fixtures/api.fixture';

test.describe('Family device management', { tag: ['@svc-family', '@svc-notification', '@regression'] }, () => {
  test('DEVICE-01 reactivate a locked device', async ({ deviceSteps, targetDevice }) => {
    const res = await deviceSteps.activateSuspendedDevice(targetDevice);
    await deviceSteps.expectAccepted(res);
  });

  test('DEVICE-02 remove another member\'s device', async ({ deviceSteps, targetDevice }) => {
    const res = await deviceSteps.removeMemberDevice(targetDevice);
    await deviceSteps.expectAccepted(res);
  });
});
