// scripts/validate-env.ts
import { env, profile } from '../config/env';
import { createLogger } from '../src/core/utils/logger';

const log = createLogger('validate-env');
const host = (u: string) => new URL(u).host;

// Do not log secrets or test account values
log.info('environment config loaded', {
  env: env.TEST_ENV,
  base: host(env.BASE_URL),
  dp: env.DP_BASE_URL ? host(env.DP_BASE_URL) : undefined,
  profile,
});