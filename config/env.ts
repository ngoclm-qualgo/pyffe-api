import dotenv from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

import { ENVIRONMENTS, type TestEnv } from './env-names';

export { ENVIRONMENTS, type TestEnv };

// Environment must be chosen explicitly, no default, to avoid running against the wrong one
const target = process.env.TEST_ENV;
if (!ENVIRONMENTS.includes(target as TestEnv)) {
  throw new Error(`TEST_ENV must be one of: ${ENVIRONMENTS.join(', ')} (currently: ${target ?? 'not set'})`);
}

// dotenv does not override variables that already exist. Priority order (high to low):
// 1) CI environment variables
// 2) .env.<env>.local (local secrets, gitignored)
// 3) config/environments/<env>.env (non-secret values, committed)
dotenv.config({ path: path.resolve(process.cwd(), `.env.${target}.local`) });
dotenv.config({ path: path.resolve(__dirname, 'environments', `${target}.env`) });

const schema = z.object({
  TEST_ENV: z.enum(ENVIRONMENTS),
  BASE_URL: z.string().url(),
  DP_BASE_URL: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
  // Backoffice base URL (only needed for admin notification campaign tests); those tests auto-skip if not set
  ADMIN_BASE_URL: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
  // Backoffice JWT with `create` permission on `notifications`; admin campaign tests auto-skip if not set
  ADMIN_ACCESS_TOKEN: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  // Family + actor device for scam-alert/device/settings/phone-number tests, auto-provisioned per worker
  // (see src/core/fixtures/family-provisioning.ts). Set both variables to override — reuse an existing family
  // instead of creating one — useful when an auto-created family lacks a subscription benefit a scenario needs (e.g. FAMILY-01).
  FAMILY_ID: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  ACTOR_DEVICE_ID: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  // Dedicated test audience for admin notification campaigns (see specs/notification-push-postman-curl-guide.md); related tests auto-skip if not set
  AUDIENCE_ID: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  // If not set (or empty), AuthService creates a disposable mail.tm mailbox for each onboarding
  TEST_USER_EMAIL: z.preprocess((v) => (v === '' ? undefined : v), z.string().email().optional()),
  // Fixed verification code (if any); if not set, AuthService reads the OTP from the mail.tm mailbox just created
  AUTH_TEST_OTP: z.string().optional(),
  API_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  RETRY_COUNT: z.coerce.number().int().min(0).max(3).default(1),
  DEVICE_ID: z.string().optional(), // if not set, AuthService generates one for each run
  COUNTRY_CODE: z.string().min(2),
  HMAC_SECRET: z.string().min(1),
  ENCRYPTION_KEY: z.string().min(1), // length must match AES-128/192/256 (16/24/32 bytes)
});

export const env = schema.parse(process.env);

// Operational differences between environments (adjust after measuring real behavior)
const PROFILES = {
  dev: { workers: 4, pollTimeoutMs: 10_000, allowDestructive: true },
  qa: { workers: 2, pollTimeoutMs: 15_000, allowDestructive: false },
} satisfies Record<TestEnv, { workers: number; pollTimeoutMs: number; allowDestructive: boolean }>;

export const profile = PROFILES[env.TEST_ENV];