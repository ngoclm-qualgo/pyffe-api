// tests/functional/session-refresh.spec.ts
// Scenario: onboarding session is refreshed using a refresh token.
import { test } from '../../src/core/fixtures/api.fixture';

test.describe('Onboarding session refresh', { tag: ['@svc-auth', '@regression'] }, () => {
  test('AUTH-03 refresh returns a new token pair', async ({ sessionSteps }) => {
    const t1 = await sessionSteps.onboard();
    const t2 = await sessionSteps.refreshSession(t1);
    await sessionSteps.expectNewAccessToken(t1, t2);
  });

  test('AUTH-08 old refresh token is rejected after being used', { tag: '@negative' }, async ({ sessionSteps }) => {
    const t1 = await sessionSteps.onboard();
    await sessionSteps.refreshSessionOk(t1);
    const reuse = await sessionSteps.reuseRefreshToken(t1);
    await sessionSteps.expectRefreshTokenRejected(reuse);
  });
});
