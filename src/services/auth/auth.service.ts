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
    private readonly request: APIRequestContext, // tạo với baseURL: env.BASE_URL — path ở dưới luôn là tương đối
    private readonly device: DeviceContext = defaultDevice(),
    private readonly correlationId: string = randomUUID(),
    private readonly language: string = 'en',
    private readonly log: Logger = createLogger('auth'),
  ) {}

  /** Device id dùng để ký request/onboarding — các fixture tạo family/device cần header x-device-id khớp với device đã lấy JWT. */
  get deviceId(): string { return this.device.id; }

  // Một bước challenge: trả response thô để negative test kiểm tra status/body.
  // `action` là hành động của người dùng, dùng làm nội dung log.
  challengeRaw(body: Record<string, unknown>, action = 'Send auth challenge'): Promise<APIResponse> {
    return this.logged(action, () => this.request.post(CHALLENGE_PATH, {
      data: body,
      headers: buildHeaders(body, this.device, this.correlationId, this.language),
      timeout: env.API_TIMEOUT_MS,
    }));
  }
  initEmailRaw(email: string) {
    return this.challengeRaw({ authFlow: 'LOGIN', challengeName: 'INIT_CHALLENGE', clientMetadata: { type: 'EMAIL', email } }, 'Enter email to log in');
  }
  /** Init onboarding không ký request (không có x-signature/headers thiết bị) để test request bị từ chối. */
  initEmailUnsignedRaw(email: string) {
    return this.logged('Enter email to log in without signature', () => this.request.post(CHALLENGE_PATH, {
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
    return this.logged('Refresh onboarding session', () => this.request.post(REFRESH_PATH, {
      data: body,
      headers: { ...buildHeaders(body, this.device, this.correlationId, this.language), Authorization: `Bearer ${accessToken}` },
      timeout: env.API_TIMEOUT_MS,
    }));
  }

  /**
   * Luồng email: init, rồi làm theo challenge server yêu cầu (T&C, verify).
   * Không truyền `email` và cũng không cấu hình TEST_USER_EMAIL thì tự tạo một hộp thư
   * mail.tm dùng một lần cho lần onboarding này (chỉ hợp lý khi không dùng AUTH_TEST_OTP).
   */
  async onboard(email?: string): Promise<TokenResponse> {
    const target = email ?? env.TEST_USER_EMAIL ?? (await provisionEmailAddress());
    let session: string | undefined;
    this.log.info('Start logging in with email');
    let res = await this.step('init', () => this.initEmailRaw(target));
    for (let i = 0; i < 5; i++) {
      const tokens = extractTokens(res);
      if (tokens) { this.log.info('Logged in with email'); return tokens; }
      session = res.session ?? session;
      if (!session) throw new ApiError('contract', 'Response thiếu session');
      const next = res.challengeName;
      if (next === 'TERM_CONDITION') {
        res = await this.step('accept-terms', () => this.acceptTermsRaw(session!));
      } else if (next === 'EMAIL_OTP_REQUIRED') {
        const code = await getVerificationCode(target);
        res = await this.step('verify', () => this.verifyOtpRaw(session!, code));
      } else {
        throw new ApiError('business', `Challenge không hỗ trợ: ${next}`);
      }
    }
    throw new ApiError('business', 'Onboarding không hoàn tất sau 5 bước');
  }

  /** Luồng companion: không cần email hay OTP, dùng code challenge; làm theo challenge server yêu cầu. */
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
      if (!session) throw new ApiError('contract', 'Response thiếu session');
      if (res.challengeName === 'TERM_CONDITION') {
        res = await this.step('companion-terms', () => this.acceptTermsRaw(session!));
      } else if (res.challengeName === 'CODE_CHALLENGE') {
        res = await this.step('companion-verify', () =>
          this.challengeRaw({ authFlow: 'LOGIN', challengeName: 'CODE_CHALLENGE', session, clientMetadata: { codeVerifier: verifier } }, 'Confirm companion code'),
        );
      } else {
        throw new ApiError('business', `Challenge không hỗ trợ: ${res.challengeName}`);
      }
    }
    throw new ApiError('business', 'Onboarding companion không hoàn tất sau 5 bước');
  }

  /** Lấy token từ body của refresh. */
  tokensFrom(body: unknown): TokenResponse {
    const tokens = extractTokens(body);
    if (!tokens) throw new ApiError('contract', 'Response không chứa accessToken và refreshToken');
    return tokens;
  }

  // Ghi log hành động của người dùng kèm status và thời gian phản hồi; lỗi transport log ở mức error
  private async logged(action: string, fn: () => Promise<APIResponse>): Promise<APIResponse> {
    const started = Date.now();
    try {
      const res = await fn();
      this.log.info(action, { status: res.status(), durationMs: Date.now() - started });
      return res;
    } catch (err) {
      this.log.error(`${action} failed`, { durationMs: Date.now() - started, err });
      throw err;
    }
  }

  // Gom một bước challenge vào test.step để báo cáo/trace thấy rõ từng lệnh gọi trong luồng onboarding,
  // thay vì một lệnh await onboard() không rõ ràng.
  private step(name: string, fn: () => Promise<APIResponse>): Promise<ChallengeResponse> {
    const run = async () => this.expectOk(await fn(), name);
    // Ngoài test runner (lệnh CLI trong scripts/) không có test.step, chạy thẳng
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