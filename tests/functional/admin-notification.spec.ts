// tests/functional/admin-notification.spec.ts
// Feature: campaign thông báo admin (backoffice) — product announcement, community update.
// Đây là scenario thông báo duy nhất mà nội dung (title/description) lấy lại được qua API (create + dispatches),
// nên là nơi kiểm tra "không nhắc thương hiệu cũ" tự động được cho phần notification.
import { test } from '../../src/core/fixtures/api.fixture';
import { env } from '../../config/env';

test.describe('Campaign thông báo admin', { tag: ['@svc-notification', '@svc-back-office', '@regression'] }, () => {
  test.skip(
    !env.ADMIN_BASE_URL || !env.ADMIN_ACCESS_TOKEN || !env.AUDIENCE_ID,
    'Cần ADMIN_BASE_URL, ADMIN_ACCESS_TOKEN (quyền create trên notifications) và AUDIENCE_ID trong .env.<env>.local',
  );

  test('ADMIN-01 product announcement được tạo, dispatch và không nhắc thương hiệu cũ', async ({ adminNotificationSteps }) => {
    const title = 'Pyffe security update';
    const description = 'Open Pyffe to review the latest protection update.';

    const createRes = await adminNotificationSteps.createCampaign('product_announcement', title, description);
    adminNotificationSteps.expectNoForbiddenBrandInContent(title, description);
    const notificationId = await adminNotificationSteps.expectCreated(createRes);

    const dispatchRes = await adminNotificationSteps.refreshAndGetDispatches(notificationId);
    await adminNotificationSteps.expectDispatchedWithoutForbiddenBrand(dispatchRes);
  });

  test('ADMIN-02 community update được tạo, dispatch và không nhắc thương hiệu cũ', async ({ adminNotificationSteps }) => {
    const title = 'Pyffe community update';
    const description = 'A new Pyffe community update is available.';

    const createRes = await adminNotificationSteps.createCampaign('community_update', title, description);
    adminNotificationSteps.expectNoForbiddenBrandInContent(title, description);
    const notificationId = await adminNotificationSteps.expectCreated(createRes);

    const dispatchRes = await adminNotificationSteps.refreshAndGetDispatches(notificationId);
    await adminNotificationSteps.expectDispatchedWithoutForbiddenBrand(dispatchRes);
  });
});
