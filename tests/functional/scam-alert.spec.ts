// tests/functional/scam-alert.spec.ts
// Feature: cảnh báo lừa đảo (scam alert) — mỗi scriptId được API chấp nhận, ở mọi ngôn ngữ hỗ trợ.
// Nội dung push thực tế (title/body) chỉ xác minh được trên thiết bị vật lý / Notification Service dispatch
// (xem "Safety and prerequisites" trong specs/notification-push-postman-curl-guide.md), nên các test này
// chỉ kiểm tra API-level: yêu cầu được chấp nhận đúng và không nhắc thương hiệu cũ trong nội dung ta gửi lên.
// Family + actor device được dựng tự động cho mỗi worker (fixture `family`), không cần khai FAMILY_ID/
// ACTOR_DEVICE_ID thủ công — xem src/core/fixtures/family-provisioning.ts.
import { test } from '../../src/core/fixtures/api.fixture';
import { SCAM_ALERT_SCENARIOS, SMS_SCAM_SCENARIO, SMS_SCAM_SUPPRESSED_LEVEL } from '../data/family.data';
import { SUPPORTED_LANGUAGES } from '../data/email.data';

test.describe('Cảnh báo lừa đảo (scam alert)', { tag: ['@svc-family', '@svc-notification', '@regression'] }, () => {
  SCAM_ALERT_SCENARIOS.forEach((scenario, i) => {
    const id = `SCAM-${String(i + 1).padStart(2, '0')}`;
    test(`${id} ${scenario.scriptId} được chấp nhận và phát sinh sự kiện cảnh báo`, async ({ scamAlertSteps }) => {
      const res = await scamAlertSteps.trigger(scenario);
      await scamAlertSteps.expectAccepted(res);
    });
  });

  test('SCAM-08 SMS_SCAM mức độ 2 vẫn được chấp nhận dù push bị chặn có chủ đích', async ({ scamAlertSteps }) => {
    const res = await scamAlertSteps.trigger(SMS_SCAM_SCENARIO, { level: SMS_SCAM_SUPPRESSED_LEVEL });
    await scamAlertSteps.expectAccepted(res);
  });

  test('SCAM-09 cùng một scriptId được chấp nhận ở mọi ngôn ngữ hỗ trợ', async ({ scamAlertSteps }) => {
    for (const { code } of SUPPORTED_LANGUAGES) {
      const res = await scamAlertSteps.trigger(SMS_SCAM_SCENARIO, { language: code });
      await scamAlertSteps.expectAccepted(res);
    }
  });
});
