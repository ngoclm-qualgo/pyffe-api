// tests/e2e/session-lifecycle.spec.ts
// Journey: người dùng onboarding, dùng phiên, gia hạn liên tục và token cũ không còn dùng được.
import { test } from '../../src/core/fixtures/api.fixture';

test.describe('Vòng đời phiên onboarding', { tag: ['@svc-auth', '@regression'] }, () => {
  test('E2E-01 onboarding, gia hạn hai lần liên tiếp, token cũ bị từ chối', async ({ onboardingSteps, sessionSteps }) => {
    const t1 = await sessionSteps.onboard();
    await onboardingSteps.expectValidSession(t1);

    const t2 = await sessionSteps.refreshSession(t1);
    await sessionSteps.expectNewAccessToken(t1, t2);

    const t3 = await sessionSteps.refreshSession(t2);
    await sessionSteps.expectNewAccessToken(t2, t3);

    const reuse = await sessionSteps.reuseRefreshToken(t1);
    await sessionSteps.expectRefreshTokenRejected(reuse);
  });
});
