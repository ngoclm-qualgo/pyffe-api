// tests/functional/scam-alert.spec.ts
// Feature: scam alert — each scriptId is accepted by the API, in every supported language.
// The actual push content (title/body) can only be verified on a physical device / via Notification Service
// dispatch (see "Safety and prerequisites" in specs/notification-push-postman-curl-guide.md), so these tests
// only check at the API level: the request is accepted correctly and the content we send has no legacy brand mentions.
// Family + actor device are provisioned automatically for each worker (fixture `family`), no need to manually
// declare FAMILY_ID/ACTOR_DEVICE_ID — see src/core/fixtures/family-provisioning.ts.
import { test } from '../../src/core/fixtures/api.fixture';
import { SCAM_ALERT_SCENARIOS, SMS_SCAM_SCENARIO, SMS_SCAM_SUPPRESSED_LEVEL } from '../data/family.data';
import { SUPPORTED_LANGUAGES } from '../data/email.data';

test.describe('Scam alert', { tag: ['@svc-family', '@svc-notification', '@regression'] }, () => {
  SCAM_ALERT_SCENARIOS.forEach((scenario, i) => {
    const id = `SCAM-${String(i + 1).padStart(2, '0')}`;
    test(`${id} ${scenario.scriptId} is accepted and triggers an alert event`, async ({ scamAlertSteps }) => {
      const res = await scamAlertSteps.trigger(scenario);
      await scamAlertSteps.expectAccepted(res);
    });
  });

  test('SCAM-08 SMS_SCAM level 2 is still accepted even though push is intentionally suppressed', async ({ scamAlertSteps }) => {
    const res = await scamAlertSteps.trigger(SMS_SCAM_SCENARIO, { level: SMS_SCAM_SUPPRESSED_LEVEL });
    await scamAlertSteps.expectAccepted(res);
  });

  test('SCAM-09 the same scriptId is accepted in every supported language', async ({ scamAlertSteps }) => {
    for (const { code } of SUPPORTED_LANGUAGES) {
      const res = await scamAlertSteps.trigger(SMS_SCAM_SCENARIO, { language: code });
      await scamAlertSteps.expectAccepted(res);
    }
  });
});
