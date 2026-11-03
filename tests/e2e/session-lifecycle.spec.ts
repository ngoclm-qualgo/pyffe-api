// tests/e2e/session-lifecycle.spec.ts
// Journey: user onboards, uses the session, refreshes repeatedly, and the old token becomes unusable.
import { test } from '../../src/core/fixtures/api.fixture';

test.describe('Onboarding session lifecycle', { tag: ['@svc-auth', '@regression'] }, () => {
  test('E2E-01 onboard, refresh twice in a row, old token is rejected', async ({ onboardingSteps, sessionSteps }) => {
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
