// src/services/auth/otp-provider.ts
import { env } from '../../../config/env';
import { createMailbox, visibleText, type Mailbox } from './mailbox';

// mail.tm mailboxes created by provisionEmailAddress, keyed by address
const mailboxes = new Map<string, Mailbox>();

/**
 * Create a one-time mail.tm mailbox (random address) for the next onboarding.
 * Used when TEST_USER_EMAIL isn't configured.
 */
export async function provisionEmailAddress(): Promise<string> {
  const mailbox = await createMailbox();
  mailboxes.set(mailbox.address, mailbox);
  return mailbox.address;
}

function extractCode(subject: string, html: string): string | undefined {
  return subject.match(/\b\d{6}\b/)?.[0] ?? visibleText(html).match(/\b\d{6}\b/)?.[0];
}

/**
 * Get the verification code for the email flow. Never log this code.
 * Option 1 (recommended for stable environments): fixed code via AUTH_TEST_OTP.
 * Option 2 (when the backend generates a real OTP): read the email from the mail.tm mailbox
 * created by provisionEmailAddress (no API key needed). A fixed TEST_USER_EMAIL requires AUTH_TEST_OTP.
 */
export async function getVerificationCode(email: string): Promise<string> {
  if (env.AUTH_TEST_OTP) return env.AUTH_TEST_OTP;

  const mailbox = mailboxes.get(email);
  if (!mailbox) throw new Error(`Cannot read mailbox ${email}: set AUTH_TEST_OTP or let provisionEmailAddress create the mailbox`);
  const mail = await mailbox.waitForEmail();
  const code = extractCode(mail.subject, mail.body);
  if (!code) throw new Error(`Email sent to ${email} does not contain a verification code`);
  return code;
}
