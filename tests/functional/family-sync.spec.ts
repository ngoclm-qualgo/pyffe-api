// tests/functional/family-sync.spec.ts
// Feature: đồng bộ dữ liệu family tới các thiết bị khác — cài đặt chặn gọi, danh sách số điện thoại.
// Family + actor device dựng tự động cho mỗi worker (fixture `family`) — xem src/core/fixtures/family-provisioning.ts.
import { test } from '../../src/core/fixtures/api.fixture';

// Settings + phone-number đi qua Call Service (không phải Family Service — xem specs/notification-push-postman-curl-guide.md
// mục 4/5). Family tự tạo qua Family Service được Family Service chấp nhận (scam-alert, device, create/delete đều đã
// verify live), nhưng Call Service trả 403 DEVICE_NOT_AUTHORIZED cho chính device/family đó dù request đã ký đúng HMAC
// giống Family Service — nghĩa là Call Service có cơ chế authorize device riêng, chưa rõ contract (không có spec).
// Cho tới khi có spec/contract của Call Service, đặt FAMILY_ID/ACTOR_DEVICE_ID thủ công trong .env.<env>.local trỏ vào
// một family mà Call Service đã chấp nhận, để ghi đè fixture tự động.
test.describe('Đồng bộ cài đặt gọi của family', { tag: ['@svc-call', '@svc-family', '@svc-notification', '@regression'] }, () => {
  test('FAMILY-01 cập nhật cài đặt AUTO_BLOCK_SCAM_CALL đồng bộ tới thiết bị khác', async ({ settingsSteps }) => {
    const res = await settingsSteps.updateAutoBlockScamCall(true);
    await settingsSteps.expectSynchronized(res);
  });
});

test.describe('Đồng bộ số điện thoại của family', { tag: ['@svc-call', '@svc-family', '@svc-notification', '@regression'] }, () => {
  test('FAMILY-02 thêm số điện thoại vào safelist đồng bộ và có thể xóa lại', async ({ phoneNumberSteps }) => {
    const uniqueNumber = `+8491${Date.now().toString().slice(-7)}`;
    const createRes = await phoneNumberSteps.addSafelistNumber(uniqueNumber);
    const phoneNumberId = await phoneNumberSteps.expectCreated(createRes);

    const deleteRes = await phoneNumberSteps.deleteNumber(phoneNumberId);
    phoneNumberSteps.expectDeleted(deleteRes);
  });

  // BLOCKLIST còn phát sinh cảnh báo CALL_BLOCKLIST_ADDED (xem guide, mục 5); bản thân cảnh báo đó
  // được kiểm ở mức API trigger riêng trong scam-alert.spec.ts (SCAM-05), test này chỉ xác nhận
  // nhánh đồng bộ số điện thoại chấp nhận category BLOCKLIST.
  test('FAMILY-03 thêm số điện thoại vào blocklist đồng bộ và có thể xóa lại', async ({ phoneNumberSteps }) => {
    const uniqueNumber = `+8491${Date.now().toString().slice(-7)}`;
    const createRes = await phoneNumberSteps.addBlocklistNumber(uniqueNumber);
    const phoneNumberId = await phoneNumberSteps.expectCreated(createRes);

    const deleteRes = await phoneNumberSteps.deleteNumber(phoneNumberId);
    phoneNumberSteps.expectDeleted(deleteRes);
  });
});
