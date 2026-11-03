// tests/functional/onboarding.spec.ts
// Feature: Onboarding
import { test } from '../../src/core/fixtures/api.fixture';
import { INVALID_EMAILS, INVALID_OTP_CODE, negativeTestEmail } from '../data/auth.data';

// ---- Successful sign-in ----

test.describe('Successful sign-in', { tag: ['@svc-auth', '@smoke'] }, () => {
  test('AUTH-01 onboarding by email returns a valid JWT token', async ({ onboardingSteps }) => {
    const tokens = await onboardingSteps.onboardWithEmail();
    await onboardingSteps.expectValidSession(tokens);
  });

  test('AUTH-02 onboarding as companion receives token', async ({ onboardingSteps }) => {
    const tokens = await onboardingSteps.onboardAsCompanion();
    await onboardingSteps.expectJwtAccessToken(tokens);
  });
});

// ---- Failed sign-in ----

test.describe('Failed sign-in', { tag: ['@svc-auth', '@regression', '@negative'] }, () => {
  for (const email of INVALID_EMAILS) {
    test(`AUTH-04 entering malformed email (${email}) is rejected with 400 and standard error schema`, async ({ onboardingSteps }) => {
      const res = await onboardingSteps.enterEmail(email);
      await onboardingSteps.expectBadRequest(res);
    });
  }

  test('AUTH-05 entering wrong OTP code does not issue a token', async ({ onboardingSteps }) => {
    // Use a dedicated email in case backend locks the account after repeated wrong codes
    const session = await onboardingSteps.enterValidEmail(negativeTestEmail());
    const res = await onboardingSteps.enterOtp(session, INVALID_OTP_CODE);
    await onboardingSteps.expectInvalidOtp(res);
  });

  test('AUTH-10 request without a signature is rejected', async ({ onboardingSteps }) => {
    const res = await onboardingSteps.sendUnsignedOnboardingRequest(negativeTestEmail());
    await onboardingSteps.expectRejected(res);
  });
});

// ---- Email OTP onboarding: one test case per language, combining expectations (domain, no legacy brand,
// new template, and matching content/subject differing from English) as steps within the same test case. ----

test.describe('Email onboarding using new template', { tag: ['@svc-auth', '@email-otp'] }, () => {
  test('EMAIL-01 Email onboarding use new template in English', async ({ playwright, onboardingSteps }) => {
    const mail = await onboardingSteps.receiveOnboardingEmail(playwright.request, 'en');
    await onboardingSteps.expectSentFromProductDomain(mail);
    await onboardingSteps.expectNoLegacyBrand(mail);
    await onboardingSteps.expectNewTemplate(mail);
    await onboardingSteps.expectMatchesSubject(mail, 'en');
    await onboardingSteps.expectMatchesTemplate(mail, 'en');
  });

  test('EMAIL-02 Email onboarding use new template in Vietnamese', async ({ playwright, onboardingSteps }) => {
    const mail = await onboardingSteps.receiveOnboardingEmail(playwright.request, 'vi');
    await onboardingSteps.expectSentFromProductDomain(mail);
    await onboardingSteps.expectNoLegacyBrand(mail);
    await onboardingSteps.expectNewTemplate(mail);
    await onboardingSteps.expectMatchesSubject(mail, 'vi');
    await onboardingSteps.expectMatchesTemplate(mail, 'vi');
  });

  test('EMAIL-03 Email onboarding use new template in French', async ({ playwright, onboardingSteps }) => {
    const mail = await onboardingSteps.receiveOnboardingEmail(playwright.request, 'fr');
    await onboardingSteps.expectSentFromProductDomain(mail);
    await onboardingSteps.expectNoLegacyBrand(mail);
    await onboardingSteps.expectNewTemplate(mail);
    await onboardingSteps.expectMatchesSubject(mail, 'fr');
    await onboardingSteps.expectMatchesTemplate(mail, 'fr');
  });

  test('EMAIL-04 Email onboarding use new template in Portuguese', async ({ playwright, onboardingSteps }) => {
    const mail = await onboardingSteps.receiveOnboardingEmail(playwright.request, 'pt');
    await onboardingSteps.expectSentFromProductDomain(mail);
    await onboardingSteps.expectNoLegacyBrand(mail);
    await onboardingSteps.expectNewTemplate(mail);
    await onboardingSteps.expectMatchesSubject(mail, 'pt');
    await onboardingSteps.expectMatchesTemplate(mail, 'pt');
  });

  test('EMAIL-05 Email onboarding use new template in Spanish', async ({ playwright, onboardingSteps }) => {
    const mail = await onboardingSteps.receiveOnboardingEmail(playwright.request, 'es');
    await onboardingSteps.expectSentFromProductDomain(mail);
    await onboardingSteps.expectNoLegacyBrand(mail);
    await onboardingSteps.expectNewTemplate(mail);
    await onboardingSteps.expectMatchesSubject(mail, 'es');
    await onboardingSteps.expectMatchesTemplate(mail, 'es');
  });

  test('EMAIL-06 Email onboarding use new template in Filipino', async ({ playwright, onboardingSteps }) => {
    const mail = await onboardingSteps.receiveOnboardingEmail(playwright.request, 'fil');
    await onboardingSteps.expectSentFromProductDomain(mail);
    await onboardingSteps.expectNoLegacyBrand(mail);
    await onboardingSteps.expectNewTemplate(mail);
    await onboardingSteps.expectMatchesSubject(mail, 'fil');
    await onboardingSteps.expectMatchesTemplate(mail, 'fil');
  });
});
