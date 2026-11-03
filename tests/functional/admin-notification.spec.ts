// tests/functional/admin-notification.spec.ts
// Feature: admin notification campaigns (back office) — product announcement, community update.
// This is the only notification scenario where content (title/description) can be retrieved back via API
// (create + dispatches), so it's where the automated "no legacy brand mentions" check is covered for notifications.
import { test } from '../../src/core/fixtures/api.fixture';
import { env } from '../../config/env';

test.describe('Admin notification campaign', { tag: ['@svc-notification', '@svc-back-office', '@regression'] }, () => {
  test.skip(
    !env.ADMIN_BASE_URL || !env.ADMIN_ACCESS_TOKEN || !env.AUDIENCE_ID,
    'Requires ADMIN_BASE_URL, ADMIN_ACCESS_TOKEN (create permission on notifications), and AUDIENCE_ID in .env.<env>.local',
  );

  test('ADMIN-01 product announcement is created, dispatched, and has no legacy brand mentions', async ({ adminNotificationSteps }) => {
    const title = 'Pyffe security update';
    const description = 'Open Pyffe to review the latest protection update.';

    const createRes = await adminNotificationSteps.createCampaign('product_announcement', title, description);
    adminNotificationSteps.expectNoForbiddenBrandInContent(title, description);
    const notificationId = await adminNotificationSteps.expectCreated(createRes);

    const dispatchRes = await adminNotificationSteps.refreshAndGetDispatches(notificationId);
    await adminNotificationSteps.expectDispatchedWithoutForbiddenBrand(dispatchRes);
  });

  test('ADMIN-02 community update is created, dispatched, and has no legacy brand mentions', async ({ adminNotificationSteps }) => {
    const title = 'Pyffe community update';
    const description = 'A new Pyffe community update is available.';

    const createRes = await adminNotificationSteps.createCampaign('community_update', title, description);
    adminNotificationSteps.expectNoForbiddenBrandInContent(title, description);
    const notificationId = await adminNotificationSteps.expectCreated(createRes);

    const dispatchRes = await adminNotificationSteps.refreshAndGetDispatches(notificationId);
    await adminNotificationSteps.expectDispatchedWithoutForbiddenBrand(dispatchRes);
  });
});
