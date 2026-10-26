// src/steps/auth/onboarding.steps.ts
import { test, expect, type APIResponse, type PlaywrightWorkerArgs } from '@playwright/test';
import { env } from '../../../config/env';
import { AuthService } from '../../services/auth/auth.service';
import { problemSchema, type TokenResponse } from '../../services/auth/auth.schema';
import { jwtClaims } from '../../core/utils/jwt';
import { createMailbox, visibleText, type ReceivedEmail } from '../../services/auth/mailbox';
import { expectNoForbiddenBrand } from '../../core/utils/brand-check';
import { EMAIL_CONTENT_TEMPLATES } from '../../../tests/data/email.data';
import { FORBIDDEN_BRANDS } from '../../../tests/data/brand.data';

type PlaywrightRequest = PlaywrightWorkerArgs['playwright']['request'];

/** Gộp khoảng trắng/xuống dòng liên tiếp thành một dấu cách, để so khớp nội dung bỏ qua khác biệt định dạng HTML. */
const collapseWhitespace = (s: string) => s.replace(/\s+/g, ' ').trim();

export class OnboardingSteps {
  // Một email cho mỗi ngôn ngữ, dùng chung giữa các lần gọi trong cùng test (tránh bị mail.tm giới hạn tốc độ)
  private readonly emails = new Map<string, ReceivedEmail>();

  constructor(private readonly auth: AuthService) {}

  // ---- Hành động ----

  onboardWithEmail(): Promise<TokenResponse> {
    return test.step('Người dùng onboarding bằng email (nhập email, đồng ý điều khoản, nhập OTP)', () => this.auth.onboard());
  }

  onboardAsCompanion(): Promise<TokenResponse> {
    return test.step('Thiết bị companion onboarding bằng code challenge', () => this.auth.onboardCompanion());
  }

  enterEmail(email: string): Promise<APIResponse> {
    return test.step('Người dùng nhập email sai định dạng', () => this.auth.initEmailRaw(email));
  }

  /** Nhập email hợp lệ và trả về session để đi tiếp bước OTP. */
  enterValidEmail(email: string): Promise<string> {
    return test.step('Người dùng nhập email hợp lệ', async () => {
      const res = await this.auth.initEmailRaw(email);
      expect(res.status(), 'init phải thành công để có session').toBe(200);
      return (await res.json()).session as string;
    });
  }

  enterOtp(session: string, code: string): Promise<APIResponse> {
    return test.step('Người dùng nhập sai mã OTP', () => this.auth.verifyOtpRaw(session, code));
  }

  sendUnsignedOnboardingRequest(email: string): Promise<APIResponse> {
    return test.step('Gửi yêu cầu onboarding không có chữ ký', () => this.auth.initEmailUnsignedRaw(email));
  }

  /** Gửi init onboarding với ngôn ngữ chỉ định tới hộp thư mới và trả về email nhận được (có cache). */
  async receiveOnboardingEmail(request: PlaywrightRequest, language: string): Promise<ReceivedEmail> {
    const cached = this.emails.get(language);
    if (cached) return cached;
    const mail = await test.step(`Người dùng yêu cầu onboarding bằng ngôn ngữ [${language}] và nhận email`, async () => {
      const ctx = await request.newContext({ baseURL: env.BASE_URL });
      try {
        const mailbox = await createMailbox();
        const res = await new AuthService(ctx, undefined, undefined, language).initEmailRaw(mailbox.address);
        await expect(res, 'init onboarding phải thành công để hệ thống gửi email').toBeOK();
        return await mailbox.waitForEmail();
      } finally {
        await ctx.dispose();
      }
    });
    this.emails.set(language, mail);
    return mail;
  }

  // ---- Kiểm tra kết quả ----

  expectValidSession(tokens: TokenResponse) {
    return test.step('Nhận access token hợp lệ và refresh token', () => {
      const claims = jwtClaims(tokens.accessToken);
      expect(claims.sub).toBeTruthy();
      expect(claims.exp).toBeGreaterThan(claims.iat);
      expect(tokens.refreshToken).toBeTruthy();
    });
  }

  expectJwtAccessToken(tokens: TokenResponse) {
    return test.step('Nhận access token dạng JWT', () => {
      expect(tokens.accessToken.split('.')).toHaveLength(3);
    });
  }

  expectBadRequest(res: APIResponse) {
    return test.step('Hệ thống trả 400 với schema lỗi chuẩn', async () => {
      expect(res.status()).toBe(400);
      expect(problemSchema.safeParse(await res.json()).success).toBe(true);
    });
  }

  expectInvalidOtp(res: APIResponse) {
    return test.step('Hệ thống từ chối với INVALID_OTP', async () => {
      expect([400, 401]).toContain(res.status());
      expect((await res.json()).errorCode).toBe('INVALID_OTP');
    });
  }

  expectRejected(res: APIResponse) {
    return test.step('Hệ thống từ chối yêu cầu', async () => {
      await expect(res, 'request không có chữ ký phải bị từ chối').not.toBeOK(); // status chính xác theo contract thực tế
    });
  }

  expectSentFromProductDomain(mail: ReceivedEmail) {
    return test.step('Địa chỉ người gửi có chứa "pyffe"', () => {
      expect(mail.from.toLowerCase(), 'địa chỉ người gửi').toContain('pyffe');
    });
  }

  expectNoLegacyBrand(mail: ReceivedEmail) {
    return test.step(`Tiêu đề và nội dung không nhắc tới ${FORBIDDEN_BRANDS.join('/')}`, () => {
      expectNoForbiddenBrand(`${mail.subject}\n${visibleText(mail.body)}`, 'email');
    });
  }

  expectNewTemplate(mail: ReceivedEmail) {
    return test.step('Email dùng template mới (logo, mã OTP)', () => {
      expect(mail.body, 'phải có logo (thẻ img)').toMatch(/<img\b[^>]*\bsrc=/i);
      // Kiểm tra trên văn bản hiển thị: HTML thô có nhiều số của CSS/màu sắc nên dễ khớp nhầm
      expect(visibleText(mail.body), 'phải chứa mã OTP 6 chữ số').toMatch(/\b\d{6}\b/);
    });
  }

  expectMatchesTemplate(mail: ReceivedEmail, language: string) {
    return test.step('Nội dung email khớp đúng template yêu cầu', () => {
      const template = EMAIL_CONTENT_TEMPLATES[language];
      expect(template, `chưa có template cho [${language}]`).toBeTruthy();
      const actual = collapseWhitespace(`${mail.subject}\n${visibleText(mail.body)}`);
      const otp = actual.match(/\b\d{6}\b/)?.[0];
      expect(otp, 'phải tìm thấy mã OTP 6 chữ số để dựng nội dung kỳ vọng').toBeTruthy();
      const expected = collapseWhitespace(template!.replace('<OTP_CODE>', otp!));
      expect(actual, 'nội dung email phải khớp template yêu cầu (đã chèn mã OTP thực tế)').toContain(expected);
    });
  }

  expectSubjectDiffersFromEnglish(mail: ReceivedEmail, request: PlaywrightRequest) {
    return test.step('Tiêu đề email khác bản tiếng Anh', async () => {
      const en = await this.receiveOnboardingEmail(request, 'en');
      expect(mail.subject, 'tiêu đề phải khác bản tiếng Anh').not.toBe(en.subject);
    });
  }
}
