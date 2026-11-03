// scripts/cli.ts
// Data-setup commands: log in as owner, print the full API response payload to stdout as JSON (logs go to stderr via LOG_STDERR=1).
//   npm run owner:login:new:qa                          -> using a new mail.tm email
//   npm run owner:login:existing:qa [-- --email a@b.c]  -> using an existing email (defaults to TEST_USER_EMAIL, needs AUTH_TEST_OTP)
//   npm run companion:request-code:qa                   -> companion onboarding (init/verify/accept T&C) + request pairing code (specs/request-join.api.txt)
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { request } from '@playwright/test';
import { env } from '../config/env';
import { AuthService } from '../src/services/auth/auth.service';
import { TokenManager } from '../src/services/auth/token-manager';
import { provisionEmailAddress } from '../src/services/auth/otp-provider';
import { defaultDevice } from '../src/services/auth/request-signer';
import { ApiClient } from '../src/core/client/api-client';
import { CompanionService } from '../src/services/family/companion.service';
import { createLogger } from '../src/core/utils/logger';
import type { ChallengeResponse } from '../src/services/auth/auth.schema';

const log = createLogger('cli');

async function ownerLogin(email?: string): Promise<ChallengeResponse> {
  const ctx = await request.newContext({ baseURL: env.BASE_URL });
  try {
    return await new AuthService(ctx).onboardRaw(email);
  } finally {
    await ctx.dispose();
  }
}

/** Companion flow: onboard (init -> CODE_CHALLENGE verify -> accept T&C), then request a JOIN pairing code. */
async function companionRequestCode(): Promise<unknown> {
  const ctx = await request.newContext({ baseURL: env.BASE_URL });
  try {
    const correlationId = randomUUID();
    const companionLog = createLogger('companion').child({ correlationId });
    const device = defaultDevice();
    const auth = new AuthService(ctx, device, correlationId, undefined, companionLog);
    const tokens = new TokenManager(auth, undefined, 'companion');
    const api = new ApiClient(ctx, tokens, companionLog, correlationId);
    const res = await new CompanionService(api).createRequest(tokens.deviceId, 'JOIN');
    const pairing = await api.json<Record<string, unknown>>(res, 201);
    return { ...pairing, deviceId: device.id, deviceInfo: device.info };
  } finally {
    await ctx.dispose();
  }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { values } = parseArgs({ args: rest, options: { email: { type: 'string' } } });

  switch (command) {
    case 'owner-login-new':
      process.stdout.write(`${JSON.stringify(await ownerLogin(await provisionEmailAddress()), null, 2)}\n`);
      break;
    case 'owner-login-existing': {
      const email = values.email ?? env.TEST_USER_EMAIL;
      if (!email) throw new Error('Requires --email or TEST_USER_EMAIL (with AUTH_TEST_OTP) for an existing owner');
      process.stdout.write(`${JSON.stringify(await ownerLogin(email), null, 2)}\n`);
      break;
    }
    case 'companion-request-code':
      process.stdout.write(`${JSON.stringify(await companionRequestCode(), null, 2)}\n`);
      break;
    default:
      throw new Error(`Unsupported command: ${command ?? '(empty)'}. Use: owner-login-new | owner-login-existing | companion-request-code`);
  }
}

main().catch((err) => {
  log.error('Command failed', { err });
  process.exit(1);
});
