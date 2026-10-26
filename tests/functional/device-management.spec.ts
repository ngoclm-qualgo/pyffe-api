// tests/functional/device-management.spec.ts
// Feature: quản lý thiết bị trong family — kích hoạt lại thiết bị bị khóa, xóa thiết bị thành viên.
// Mỗi test tự dựng một companion device riêng (fixture `targetDevice`, đã ở trạng thái SUSPENDED khi join) và
// tự dọn dẹp sau khi chạy — không còn khái niệm "cấp lại thiết bị" giữa các lần chạy như trước.
import { test } from '../../src/core/fixtures/api.fixture';

test.describe('Quản lý thiết bị family', { tag: ['@svc-family', '@svc-notification', '@regression'] }, () => {
  test('DEVICE-01 kích hoạt lại thiết bị đang bị khóa', async ({ deviceSteps, targetDevice }) => {
    const res = await deviceSteps.activateSuspendedDevice(targetDevice);
    await deviceSteps.expectAccepted(res);
  });

  test('DEVICE-02 xóa thiết bị của thành viên khác', async ({ deviceSteps, targetDevice }) => {
    const res = await deviceSteps.removeMemberDevice(targetDevice);
    await deviceSteps.expectAccepted(res);
  });
});
