// src/steps/auth/onboarding.steps.ts
import { test, expect, type APIResponse, type PlaywrightWorkerArgs } from '@playwright/test';
import { env } from '../../../config/env';
import { AuthService } from '../../services/auth/auth.service';
import { problemSchema, type TokenResponse } from '../../services/auth/auth.schema';
import { jwtClaims } from '../../core/utils/jwt';
import { createMailbox, visibleText, logoAltText, type ReceivedEmail } from '../../services/auth/mailbox';
import { expectNoForbiddenBrand } from '../../core/utils/brand-check';
import { EMAIL_CONTENT_TEMPLATES, EMAIL_SUBJECT_TEMPLATES } from '../../../tests/data/email.data';
import { FORBIDDEN_BRANDS } from '../../../tests/data/brand.data';

type PlaywrightRequest = PlaywrightWorkerArgs['playwright']['request'];

/** Merge blanks/continous breaklines into a space, compare content ignoring formatting differences. */
const collapseWhitespace = (s: string) => s.replace(/\s+/g, ' ').trim();

export class OnboardingSteps {
  // One email per language, shared between tests (to avoid mail.tm rate limits)
  private readonly emails = new Map<string, ReceivedEmail>();

  constructor(private readonly auth: AuthService) {}

  // ---- Actions ----

  onboardWithEmail(): Promise<TokenResponse> {
    return test.step('Owner onboarding with email', () => this.auth.onboard());
  }

  onboardAsCompanion(): Promise<TokenResponse> {
    return test.step('Device onboarding with paring code', () => this.auth.onboardCompanion());
  }

  enterEmail(email: string): Promise<APIResponse> {
    return test.step('User enters invalid email format', () => this.auth.initEmailRaw(email));
  }

  /** Enter valid email and return session for proceeding to OTP step. */
  enterValidEmail(email: string): Promise<string> {
    return test.step('User enters valid email', async () => {
      const res = await this.auth.initEmailRaw(email);
      expect(res.status(), 'init must succeed to have a session').toBe(200);
      return (await res.json()).session as string;
    });
  }

  enterOtp(session: string, code: string): Promise<APIResponse> {
    return test.step('User enters incorrect OTP', () => this.auth.verifyOtpRaw(session, code));
  }

  sendUnsignedOnboardingRequest(email: string): Promise<APIResponse> {
    return test.step('Send unsigned onboarding request', () => this.auth.initEmailUnsignedRaw(email));
  }

  /** Send onboarding init with specified language to a new mailbox and return the received email (with cache). */
  async receiveOnboardingEmail(request: PlaywrightRequest, language: string): Promise<ReceivedEmail> {
    const cached = this.emails.get(language);
    if (cached) return cached;
    const mail = await test.step(`User requests onboarding in language [${language}] and receives email`, async () => {
      const ctx = await request.newContext({ baseURL: env.BASE_URL });
      try {
        const mailbox = await createMailbox();
        const res = await new AuthService(ctx, undefined, undefined, language).initEmailRaw(mailbox.address);
        await expect(res, 'init onboarding must succeed for the system to send an email').toBeOK();
        return await mailbox.waitForEmail();
      } finally {
        await ctx.dispose();
      }
    });
    this.emails.set(language, mail);
    return mail;
  }

  // ---- Expectations ----

  expectValidSession(tokens: TokenResponse) {
    return test.step('User receives valid access token and refresh token', () => {
      const claims = jwtClaims(tokens.accessToken);
      expect(claims.sub).toBeTruthy();
      expect(claims.exp).toBeGreaterThan(claims.iat);
      expect(tokens.refreshToken).toBeTruthy();
    });
  }

  expectJwtAccessToken(tokens: TokenResponse) {
    return test.step('User receives access token in JWT format', () => {
      expect(tokens.accessToken.split('.')).toHaveLength(3);
    });
  }

  expectBadRequest(res: APIResponse) {
    return test.step('System returns 400 with standard error schema', async () => {
      expect(res.status()).toBe(400);
      expect(problemSchema.safeParse(await res.json()).success).toBe(true);
    });
  }

  expectInvalidOtp(res: APIResponse) {
    return test.step('System rejects with INVALID_OTP', async () => {
      expect([400, 401]).toContain(res.status());
      expect((await res.json()).errorCode).toBe('INVALID_OTP');
    });
  }

  expectRejected(res: APIResponse) {
    return test.step('System rejects the request', async () => {
      await expect(res, 'request without proper signature must be rejected').not.toBeOK(); // exact status follows real contract 
    });
  }

  expectSentFromProductDomain(mail: ReceivedEmail) {
    return test.step('User receives email from product domain', () => {
      expect(mail.from.toLowerCase(), 'sender address').toContain('pyffe');
    });
  }

  expectNoLegacyBrand(mail: ReceivedEmail) {
    return test.step(`User receives email without legacy brand references`, () => {
      expectNoForbiddenBrand(`${mail.subject}\n${visibleText(mail.body)}`, 'email');
    });
  }

  expectNewTemplate(mail: ReceivedEmail) {
    return test.step('User receives email with new template (logo, OTP code)', () => {
      expect(mail.body, 'must contain logo (img tag)').toMatch(/<img\b[^>]*\bsrc=/i);
      expect(logoAltText(mail.body), 'logo image must have alt text').toBeTruthy();
      expect(visibleText(mail.body), 'must contain 6-digit OTP code').toMatch(/\b\d{6}\b/);
    });
  }

  expectMatchesTemplate(mail: ReceivedEmail, language: string) {
    return test.step('User receives email with matching template', () => {
      const template = EMAIL_CONTENT_TEMPLATES[language];
      expect(template, `no template available for [${language}]`).toBeTruthy();
      const actual = collapseWhitespace(visibleText(mail.body));
      const otp = actual.match(/\b\d{6}\b/)?.[0];
      expect(otp, 'must find 6-digit OTP code to construct expected content').toBeTruthy();
      const expected = collapseWhitespace(template!.replace('<OTP_CODE>', otp!));
      expect(actual, 'email content must match required template (with actual OTP code)').toMatch(expected);
    });
  }

  expectMatchesSubject(mail: ReceivedEmail, language: string) {
    return test.step('User receives email with matching subject', () => {
      const expected = EMAIL_SUBJECT_TEMPLATES[language];
      expect(expected, `no subject template available for [${language}]`).toBeTruthy();
      expect(collapseWhitespace(mail.subject), 'email subject must match required template').toBe(collapseWhitespace(expected!));
    });
  }
  
}
