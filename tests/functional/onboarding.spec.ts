// tests/functional/onboarding.spec.ts
// Feature: Onboarding
import { test } from '../../src/core/fixtures/api.fixture';
import { INVALID_EMAILS, INVALID_OTP_CODE, negativeTestEmail } from '../data/auth.data';

// ---- Đăng nhập thành công ----

test.describe('Đăng nhập thành công', { tag: ['@svc-auth', '@smoke'] }, () => {
  test('AUTH-01 onboarding bằng email nhận token JWT hợp lệ', async ({ onboardingSteps }) => {
    const tokens = await onboardingSteps.onboardWithEmail();
    await onboardingSteps.expectValidSession(tokens);
  });

  test('AUTH-02 onboarding bằng companion nhận token', async ({ onboardingSteps }) => {
    const tokens = await onboardingSteps.onboardAsCompanion();
    await onboardingSteps.expectJwtAccessToken(tokens);
  });
});

// ---- Đăng nhập thất bại ----

test.describe('Đăng nhập thất bại', { tag: ['@svc-auth', '@regression', '@negative'] }, () => {
  for (const email of INVALID_EMAILS) {
    test(`AUTH-04 nhập email sai định dạng (${email}) bị từ chối 400 đúng schema lỗi`, async ({ onboardingSteps }) => {
      const res = await onboardingSteps.enterEmail(email);
      await onboardingSteps.expectBadRequest(res);
    });
  }

  test('AUTH-05 nhập sai mã OTP không được cấp token', async ({ onboardingSteps }) => {
    // Dùng email riêng nếu backend khóa tài khoản sau nhiều lần sai mã
    const session = await onboardingSteps.enterValidEmail(negativeTestEmail());
    const res = await onboardingSteps.enterOtp(session, INVALID_OTP_CODE);
    await onboardingSteps.expectInvalidOtp(res);
  });

  test('AUTH-10 request không có chữ ký bị từ chối', async ({ onboardingSteps }) => {
    const res = await onboardingSteps.sendUnsignedOnboardingRequest(negativeTestEmail());
    await onboardingSteps.expectRejected(res);
  });
});

// ---- Email OTP onboarding: một test case cho mỗi ngôn ngữ, gộp các kỳ vọng (domain, không thương hiệu cũ,
// template mới, và khớp nội dung/khác tiêu đề tiếng Anh) làm các step bên trong cùng một test case. ----

test.describe('Email onboarding dùng template mới', { tag: ['@svc-auth', '@email-otp'] }, () => {
  test('EMAIL-01 Email onboarding use new template in English', async ({ playwright, onboardingSteps }) => {
    const mail = await onboardingSteps.receiveOnboardingEmail(playwright.request, 'en');
    await onboardingSteps.expectSentFromProductDomain(mail);
    await onboardingSteps.expectNoLegacyBrand(mail);
    await onboardingSteps.expectNewTemplate(mail);
    await onboardingSteps.expectMatchesTemplate(mail, 'en');
  });

  test('EMAIL-02 Email onboarding use new template in Vietnamese', async ({ playwright, onboardingSteps }) => {
    const mail = await onboardingSteps.receiveOnboardingEmail(playwright.request, 'vi');
    await onboardingSteps.expectSentFromProductDomain(mail);
    await onboardingSteps.expectNoLegacyBrand(mail);
    await onboardingSteps.expectNewTemplate(mail);
    await onboardingSteps.expectSubjectDiffersFromEnglish(mail, playwright.request);
  });

  test('EMAIL-03 Email onboarding use new template in French', async ({ playwright, onboardingSteps }) => {
    const mail = await onboardingSteps.receiveOnboardingEmail(playwright.request, 'fr');
    await onboardingSteps.expectSentFromProductDomain(mail);
    await onboardingSteps.expectNoLegacyBrand(mail);
    await onboardingSteps.expectNewTemplate(mail);
    await onboardingSteps.expectSubjectDiffersFromEnglish(mail, playwright.request);
  });

  test('EMAIL-04 Email onboarding use new template in Portuguese', async ({ playwright, onboardingSteps }) => {
    const mail = await onboardingSteps.receiveOnboardingEmail(playwright.request, 'pt');
    await onboardingSteps.expectSentFromProductDomain(mail);
    await onboardingSteps.expectNoLegacyBrand(mail);
    await onboardingSteps.expectNewTemplate(mail);
    await onboardingSteps.expectSubjectDiffersFromEnglish(mail, playwright.request);
  });

  test('EMAIL-05 Email onboarding use new template in Spanish', async ({ playwright, onboardingSteps }) => {
    const mail = await onboardingSteps.receiveOnboardingEmail(playwright.request, 'es');
    await onboardingSteps.expectSentFromProductDomain(mail);
    await onboardingSteps.expectNoLegacyBrand(mail);
    await onboardingSteps.expectNewTemplate(mail);
    await onboardingSteps.expectSubjectDiffersFromEnglish(mail, playwright.request);
  });

  test('EMAIL-06 Email onboarding use new template in Filipino', async ({ playwright, onboardingSteps }) => {
    const mail = await onboardingSteps.receiveOnboardingEmail(playwright.request, 'fil');
    await onboardingSteps.expectSentFromProductDomain(mail);
    await onboardingSteps.expectNoLegacyBrand(mail);
    await onboardingSteps.expectNewTemplate(mail);
    await onboardingSteps.expectSubjectDiffersFromEnglish(mail, playwright.request);
  });
});
