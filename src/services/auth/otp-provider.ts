// src/services/auth/otp-provider.ts
import { env } from '../../../config/env';
import { createMailbox, visibleText, type Mailbox } from './mailbox';

// Hộp thư mail.tm do provisionEmailAddress tạo, tra theo địa chỉ
const mailboxes = new Map<string, Mailbox>();

/**
 * Tạo một hộp thư mail.tm dùng một lần (địa chỉ ngẫu nhiên) cho lần onboarding tiếp theo.
 * Dùng khi không cấu hình TEST_USER_EMAIL cố định.
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
 * Lấy mã verify của luồng email. Không log mã này.
 * Cách 1 (khuyến nghị cho môi trường ổn định): mã cố định qua AUTH_TEST_OTP.
 * Cách 2 (khi backend sinh OTP thật): đọc email trong hộp thư mail.tm đã tạo bằng provisionEmailAddress
 * (không cần API key). TEST_USER_EMAIL cố định thì phải dùng AUTH_TEST_OTP.
 */
export async function getVerificationCode(email: string): Promise<string> {
  if (env.AUTH_TEST_OTP) return env.AUTH_TEST_OTP;

  const mailbox = mailboxes.get(email);
  if (!mailbox) throw new Error(`Không đọc được hộp thư ${email}: đặt AUTH_TEST_OTP hoặc để provisionEmailAddress tạo hộp thư`);
  const mail = await mailbox.waitForEmail();
  const code = extractCode(mail.subject, mail.body);
  if (!code) throw new Error(`Email gửi tới ${email} không chứa mã verify`);
  return code;
}
