// tests/functional/session-refresh.spec.ts
// Scenario: phiên onboarding được gia hạn bằng refresh token.
import { test } from '../../src/core/fixtures/api.fixture';

test.describe('Gia hạn phiên onboarding', { tag: ['@svc-auth', '@regression'] }, () => {
  test('AUTH-03 refresh trả cặp token mới', async ({ sessionSteps }) => {
    const t1 = await sessionSteps.onboard();
    const t2 = await sessionSteps.refreshSession(t1);
    await sessionSteps.expectNewAccessToken(t1, t2);
  });

  test('AUTH-08 refresh token cũ bị từ chối sau khi đã dùng', { tag: '@negative' }, async ({ sessionSteps }) => {
    const t1 = await sessionSteps.onboard();
    await sessionSteps.refreshSessionOk(t1);
    const reuse = await sessionSteps.reuseRefreshToken(t1);
    await sessionSteps.expectRefreshTokenRejected(reuse);
  });
});
