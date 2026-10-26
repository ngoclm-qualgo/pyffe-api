// scripts/cli.ts
// Lệnh dựng dữ liệu: đăng nhập owner, in kết quả ra stdout (log đi sang stderr nhờ LOG_STDERR=1).
//   npm run owner:login:new:qa                          -> accessToken, dùng email mail.tm mới
//   npm run owner:login:existing:qa [-- --email a@b.c]  -> accessToken, dùng email có sẵn (mặc định TEST_USER_EMAIL, cần AUTH_TEST_OTP)
import { parseArgs } from 'node:util';
import { request } from '@playwright/test';
import { env } from '../config/env';
import { AuthService } from '../src/services/auth/auth.service';
import { provisionEmailAddress } from '../src/services/auth/otp-provider';
import { createLogger } from '../src/core/utils/logger';

const log = createLogger('cli');

async function ownerLogin(email?: string): Promise<string> {
  const ctx = await request.newContext({ baseURL: env.BASE_URL });
  try {
    const tokens = await new AuthService(ctx).onboard(email);
    return tokens.accessToken;
  } finally {
    await ctx.dispose();
  }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { values } = parseArgs({ args: rest, options: { email: { type: 'string' } } });

  switch (command) {
    case 'owner-login-new':
      process.stdout.write(`${await ownerLogin(await provisionEmailAddress())}\n`);
      break;
    case 'owner-login-existing': {
      const email = values.email ?? env.TEST_USER_EMAIL;
      if (!email) throw new Error('Cần --email hoặc TEST_USER_EMAIL (kèm AUTH_TEST_OTP) cho owner có sẵn');
      process.stdout.write(`${await ownerLogin(email)}\n`);
      break;
    }
    default:
      throw new Error(`Lệnh không hỗ trợ: ${command ?? '(trống)'}. Dùng: owner-login-new | owner-login-existing`);
  }
}

main().catch((err) => {
  log.error('Command failed', { err });
  process.exit(1);
});
