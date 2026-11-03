// tests/data/auth.data.ts
// Static test data for the auth flow — not real accounts/emails, just needs the right format/behavior.

/**
 * Just needs a valid email format to pass the init step; used separately so real accounts aren't touched.
 * Each call returns a new address because the backend rate-limits OTP sends to the same email.
 */
export const negativeTestEmail = () => `qa-negative-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

/** Malformed emails used to test input validation in the init step. */
export const INVALID_EMAILS = [
  'not-an-email',
  'missing-domain@',
  '@missing-local.com',
  'spaces in@email.com',
];

/** Deliberately wrong OTP code, used to test the rejected verify flow. */
export const INVALID_OTP_CODE = '000000';
