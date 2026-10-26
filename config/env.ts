import dotenv from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

import { ENVIRONMENTS, type TestEnv } from './env-names';

export { ENVIRONMENTS, type TestEnv };

// Bắt buộc chọn môi trường rõ ràng, không có giá trị mặc định để tránh chạy nhầm
const target = process.env.TEST_ENV;
if (!ENVIRONMENTS.includes(target as TestEnv)) {
  throw new Error(`TEST_ENV phải là một trong: ${ENVIRONMENTS.join(', ')} (hiện tại: ${target ?? 'chưa đặt'})`);
}

// dotenv không ghi đè biến đã tồn tại. Thứ tự ưu tiên (cao đến thấp):
// 1) biến môi trường của CI
// 2) .env.<env>.local (secret cục bộ, gitignored)
// 3) config/environments/<env>.env (giá trị không bí mật, được commit)
dotenv.config({ path: path.resolve(process.cwd(), `.env.${target}.local`) });
dotenv.config({ path: path.resolve(__dirname, 'environments', `${target}.env`) });

const schema = z.object({
  TEST_ENV: z.enum(ENVIRONMENTS),
  BASE_URL: z.string().url(),
  DP_BASE_URL: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
  // Base URL backoffice (chỉ cần cho các test campaign thông báo admin); không đặt thì các test đó tự skip
  ADMIN_BASE_URL: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
  // JWT backoffice có quyền `create` trên `notifications`; không đặt thì các test campaign admin tự skip
  ADMIN_ACCESS_TOKEN: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  // Family + actor device cho test scam-alert/device/settings/phone-number được dựng tự động mỗi worker
  // (xem src/core/fixtures/family-provisioning.ts). Đặt cả hai biến này để ghi đè — dùng nguyên một family có
  // sẵn thay vì tạo mới — hữu ích khi family tự tạo chưa có subscription benefit một scenario cần (ví dụ FAMILY-01).
  FAMILY_ID: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  ACTOR_DEVICE_ID: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  // Audience test riêng cho campaign thông báo admin (xem specs/notification-push-postman-curl-guide.md); không đặt thì các test liên quan tự skip
  AUDIENCE_ID: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  // Không đặt (hoặc để trống) thì AuthService tự tạo một hộp thư mail.tm dùng một lần cho mỗi lần onboard
  TEST_USER_EMAIL: z.preprocess((v) => (v === '' ? undefined : v), z.string().email().optional()),
  // Mã verify cố định (nếu có); nếu không đặt, AuthService đọc OTP từ hộp thư mail.tm vừa tạo
  AUTH_TEST_OTP: z.string().optional(),
  API_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  RETRY_COUNT: z.coerce.number().int().min(0).max(3).default(1),
  DEVICE_ID: z.string().optional(), // không đặt thì AuthService tự sinh mỗi lần chạy
  COUNTRY_CODE: z.string().min(2),
  HMAC_SECRET: z.string().min(1),
  ENCRYPTION_KEY: z.string().min(1), // độ dài phải khớp AES-128/192/256 (16/24/32 byte)
});

export const env = schema.parse(process.env);

// Khác biệt vận hành giữa các môi trường (điều chỉnh sau khi đo thực tế)
const PROFILES = {
  dev: { workers: 4, pollTimeoutMs: 10_000, allowDestructive: true },
  qa: { workers: 2, pollTimeoutMs: 15_000, allowDestructive: false },
} satisfies Record<TestEnv, { workers: number; pollTimeoutMs: number; allowDestructive: boolean }>;

export const profile = PROFILES[env.TEST_ENV];