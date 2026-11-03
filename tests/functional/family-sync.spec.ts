// tests/functional/family-sync.spec.ts
// Feature: sync family data to other devices — call-blocking settings, phone number list.
// Family + actor device are provisioned automatically for each worker (fixture `family`) — see src/core/fixtures/family-provisioning.ts.
import { test } from '../../src/core/fixtures/api.fixture';

// Settings + phone-number go through the Call Service (not the Family Service — see
// specs/notification-push-postman-curl-guide.md section 4/5). A family created via the Family Service is
// accepted by the Family Service (scam-alert, device, create/delete have all been verified live), but the
// Call Service returns 403 DEVICE_NOT_AUTHORIZED for that same device/family even though the request is signed
// with the correct HMAC like the Family Service — meaning the Call Service has its own device-authorization
// mechanism with an unclear contract (no spec available).
// Until the Call Service spec/contract is available, manually set FAMILY_ID/ACTOR_DEVICE_ID in .env.<env>.local
// to point to a family the Call Service has accepted, to override the automatic fixture.
test.describe('Family call settings sync', { tag: ['@svc-call', '@svc-family', '@svc-notification', '@regression'] }, () => {
  test('FAMILY-01 updating AUTO_BLOCK_SCAM_CALL setting syncs to other devices', async ({ settingsSteps }) => {
    const res = await settingsSteps.updateAutoBlockScamCall(true);
    await settingsSteps.expectSynchronized(res);
  });
});

test.describe('Family phone number sync', { tag: ['@svc-call', '@svc-family', '@svc-notification', '@regression'] }, () => {
  test('FAMILY-02 adding a phone number to the safelist syncs and can be deleted again', async ({ phoneNumberSteps }) => {
    const uniqueNumber = `+8491${Date.now().toString().slice(-7)}`;
    const createRes = await phoneNumberSteps.addSafelistNumber(uniqueNumber);
    const phoneNumberId = await phoneNumberSteps.expectCreated(createRes);

    const deleteRes = await phoneNumberSteps.deleteNumber(phoneNumberId);
    phoneNumberSteps.expectDeleted(deleteRes);
  });

  // BLOCKLIST also triggers a CALL_BLOCKLIST_ADDED alert (see guide, section 5); that alert itself is
  // checked separately at the API-trigger level in scam-alert.spec.ts (SCAM-05) — this test only confirms
  // that the phone-number sync path accepts the BLOCKLIST category.
  test('FAMILY-03 adding a phone number to the blocklist syncs and can be deleted again', async ({ phoneNumberSteps }) => {
    const uniqueNumber = `+8491${Date.now().toString().slice(-7)}`;
    const createRes = await phoneNumberSteps.addBlocklistNumber(uniqueNumber);
    const phoneNumberId = await phoneNumberSteps.expectCreated(createRes);

    const deleteRes = await phoneNumberSteps.deleteNumber(phoneNumberId);
    phoneNumberSteps.expectDeleted(deleteRes);
  });
});
