// tests/data/auth.data.ts
// Dữ liệu test tĩnh cho luồng auth — không phải tài khoản/email thật, chỉ cần đúng định dạng/hành vi.

/**
 * Chỉ cần đúng định dạng email để qua bước init; dùng riêng để không đụng tài khoản thật.
 * Mỗi lần gọi trả về địa chỉ mới vì backend giới hạn tần suất gửi OTP cho cùng một email.
 */
export const negativeTestEmail = () => `qa-negative-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

/** Các email sai định dạng dùng cho test validate input ở bước init. */
export const INVALID_EMAILS = [
  'not-an-email',
  'missing-domain@',
  '@missing-local.com',
  'spaces in@email.com',
];

/** Mã OTP chắc chắn sai, dùng để test luồng verify bị từ chối. */
export const INVALID_OTP_CODE = '000000';
