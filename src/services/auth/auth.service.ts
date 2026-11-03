// src/services/auth/auth.service.ts
import { randomUUID } from 'node:crypto';
import { test, type APIRequestContext, type APIResponse } from '@playwright/test';
import { env } from '../../../config/env';
import { getVerificationCode, provisionEmailAddress } from './otp-provider';
import { buildHeaders, defaultDevice, pkcePair, type DeviceContext } from './request-signer';
import { ApiError } from '../../core/client/api-error';
import { createLogger, type Logger } from '../../core/utils/logger';
import { challengeResponseSchema, extractTokens, type ChallengeResponse, type TokenResponse } from './auth.schema';

const CHALLENGE_PATH = '/api/v1/auth/challenge/anonymous';
const REFRESH_PATH = '/api/v1/auth/refresh';

export class AuthService {
  constructor(
    private readonly request: APIRequestContext, // created with baseURL: env.BASE_URL — paths below are always relative
    private readonly device: DeviceContext = defaultDevice(),
    private readonly correlationId: string = randomUUID(),
    private readonly language: string = 'en',
    private readonly log: Logger = createLogger('auth'),
  ) {}

  /** Device id used to sign requests/onboarding — fixtures creating a family/device need the x-device-id header to match the device that got the JWT. */
  get deviceId(): string { return this.device.id; }

  // One challenge step: returns the raw response so negative tests can check status/body.
  // `action` is the user action, used as the log message.
  challengeRaw(body: Record<string, unknown>, action = 'Send auth challenge'): Promise<APIResponse> {
    return this.logged(action, 'POST', CHALLENGE_PATH, () => this.request.post(CHALLENGE_PATH, {
      data: body,
      headers: buildHeaders(body, this.device, this.correlationId, this.language),
      timeout: env.API_TIMEOUT_MS,
    }));
  }
  initEmailRaw(email: string) {
    return this.challengeRaw({ authFlow: 'LOGIN', challengeName: 'INIT_CHALLENGE', clientMetadata: { type: 'EMAIL', email } }, 'Enter email to log in');
  }
  /** Init onboarding without signing the request (no x-signature/device headers) to test the request gets rejected. */
  initEmailUnsignedRaw(email: string) {
    return this.logged('Enter email to log in without signature', 'POST', CHALLENGE_PATH, () => this.request.post(CHALLENGE_PATH, {
      data: { authFlow: 'LOGIN', challengeName: 'INIT_CHALLENGE', clientMetadata: { type: 'EMAIL', email } },
      timeout: env.API_TIMEOUT_MS,
    }));
  }
  acceptTermsRaw(session: string) {
    return this.challengeRaw({ authFlow: 'LOGIN', challengeName: 'TERM_CONDITION', session, clientMetadata: { action: 'ACCEPTED' } }, 'Accept terms & conditions');
  }
  verifyOtpRaw(session: string, code: string) {
    return this.challengeRaw({ authFlow: 'LOGIN', challengeName: 'EMAIL_OTP_REQUIRED', session, clientMetadata: { code } }, 'Enter OTP code');
  }
  resendOtpRaw(session: string, challengeResponses: unknown) {
    return this.challengeRaw({ authFlow: 'LOGIN', challengeName: 'RESEND_OTP', session, challengeResponses, clientMetadata: { otpProvider: 'EMAIL' } }, 'Request a new OTP code');
  }
  refreshRaw(refreshToken: string, accessToken: string): Promise<APIResponse> {
    const body = { refreshToken };
    return this.logged('Refresh onboarding session', 'POST', REFRESH_PATH, () => this.request.post(REFRESH_PATH, {
      data: body,
      headers: { ...buildHeaders(body, this.device, this.correlationId, this.language), Authorization: `Bearer ${accessToken}` },
      timeout: env.API_TIMEOUT_MS,
    }));
  }

  /**
   * Email flow: init, then follow whatever challenge the server requires (T&C, verify).
   * If `email` isn't passed and TEST_USER_EMAIL isn't configured, creates a one-time
   * mail.tm mailbox for this onboarding (only makes sense when not using AUTH_TEST_OTP).
   */
  async onboard(email?: string): Promise<TokenResponse> {
    return this.tokensFrom(await this.onboardRaw(email));
  }

  /** Same email flow as `onboard`, but returns the final challenge response body as-is (tokens plus any other fields). */
  async onboardRaw(email?: string): Promise<ChallengeResponse> {
    const target = email ?? env.TEST_USER_EMAIL ?? (await provisionEmailAddress());
    let session: string | undefined;
    this.log.info('Start logging in with email');
    let res = await this.step('init', () => this.initEmailRaw(target));
    for (let i = 0; i < 5; i++) {
      if (extractTokens(res)) { this.log.info('Logged in with email'); return res; }
      session = res.session ?? session;
      if (!session) throw new ApiError('contract', 'Response is missing session');
      const next = res.challengeName;
      if (next === 'TERM_CONDITION') {
        res = await this.step('accept-terms', () => this.acceptTermsRaw(session!));
      } else if (next === 'EMAIL_OTP_REQUIRED') {
        const code = await getVerificationCode(target);
        res = await this.step('verify', () => this.verifyOtpRaw(session!, code));
      } else {
        throw new ApiError('business', `Unsupported challenge: ${next}`);
      }
    }
    throw new ApiError('business', 'Onboarding did not complete after 5 steps');
  }

  /** Companion flow: no email or OTP needed, uses code challenge; follows whatever challenge the server requires. */
  async onboardCompanion(): Promise<TokenResponse> {
    const { verifier, challenge } = pkcePair();
    this.log.info('Start logging in as companion');
    let res = await this.step('companion-init', () =>
      this.challengeRaw({ authFlow: 'LOGIN', challengeName: 'INIT_CHALLENGE', clientMetadata: { type: 'CODE_CHALLENGE', codeChallenge: challenge } }, 'Start companion onboarding (code challenge)'),
    );
    let session: string | undefined;
    for (let i = 0; i < 5; i++) {
      const tokens = extractTokens(res);
      if (tokens) { this.log.info('Logged in as companion'); return tokens; }
      session = res.session ?? session;
      if (!session) throw new ApiError('contract', 'Response is missing session');
      if (res.challengeName === 'TERM_CONDITION') {
        res = await this.step('companion-terms', () => this.acceptTermsRaw(session!));
      } else if (res.challengeName === 'CODE_CHALLENGE') {
        res = await this.step('companion-verify', () =>
          this.challengeRaw({ authFlow: 'LOGIN', challengeName: 'CODE_CHALLENGE', session, clientMetadata: { codeVerifier: verifier } }, 'Confirm companion code'),
        );
      } else {
        throw new ApiError('business', `Unsupported challenge: ${res.challengeName}`);
      }
    }
    throw new ApiError('business', 'Companion onboarding did not complete after 5 steps');
  }

  /** Extract tokens from the refresh response body. */
  tokensFrom(body: unknown): TokenResponse {
    const tokens = extractTokens(body);
    if (!tokens) throw new ApiError('contract', 'Response does not contain accessToken and refreshToken');
    return tokens;
  }

  // Log the user action with method, endpoint, status and response time; transport errors are logged at error level
  private async logged(action: string, method: string, endpoint: string, fn: () => Promise<APIResponse>): Promise<APIResponse> {
    const started = Date.now();
    try {
      const res = await fn();
      this.log.info(action, { method, endpoint, status: res.status(), durationMs: Date.now() - started });
      return res;
    } catch (err) {
      this.log.error(`${action} failed`, { method, endpoint, durationMs: Date.now() - started, err });
      throw err;
    }
  }

  // Wrap a challenge step in test.step so reports/traces show each call in the onboarding flow clearly,
  // instead of one opaque await onboard() call.
  private step(name: string, fn: () => Promise<APIResponse>): Promise<ChallengeResponse> {
    const run = async () => this.expectOk(await fn(), name);
    // Outside the test runner (CLI commands in scripts/) there's no test.step, run directly
    try { test.info(); } catch { return run(); }
    return test.step(name, run);
  }

  private async expectOk(res: APIResponse, step: string): Promise<ChallengeResponse> {
    if (res.status() !== 200) throw new ApiError('http', `Auth step '${step}' failed with status ${res.status()}`, res.status());
    const parsed = challengeResponseSchema.safeParse(await res.json());
    if (!parsed.success) throw new ApiError('contract', parsed.error.message);
    return parsed.data;
  }
}