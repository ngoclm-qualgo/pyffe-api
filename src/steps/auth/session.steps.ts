// src/steps/auth/session.steps.ts
// User steps for renewing the onboarding session.
import { test, expect, type APIResponse } from '@playwright/test';
import type { AuthService } from '../../services/auth/auth.service';
import type { TokenResponse } from '../../services/auth/auth.schema';

export class SessionSteps {
  constructor(private readonly auth: AuthService) {}

  onboard(): Promise<TokenResponse> {
    return test.step('User onboarding', () => this.auth.onboard());
  }

  /** Refresh session for the first time, expect success, return the new token pair. */
  refreshSession(old: TokenResponse): Promise<TokenResponse> {
    return test.step('Refresh session using refresh token', async () => {
      const res = await this.auth.refreshRaw(old.refreshToken, old.accessToken);
      await expect(res).toBeOK();
      return this.auth.tokensFrom(await res.json());
    });
  }

  refreshSessionOk(old: TokenResponse) {
    return test.step('First session refresh succeeds', async () => {
      await expect(await this.auth.refreshRaw(old.refreshToken, old.accessToken)).toBeOK();
    });
  }

  reuseRefreshToken(old: TokenResponse): Promise<APIResponse> {
    return test.step('Reuse old refresh token', () => this.auth.refreshRaw(old.refreshToken, old.accessToken));
  }

  expectNewAccessToken(before: TokenResponse, after: TokenResponse) {
    return test.step('Receive new access token', () => {
      expect(after.accessToken).not.toBe(before.accessToken);
    });
  }

  expectRefreshTokenRejected(res: APIResponse) {
    return test.step('Old refresh token is rejected', () => {
      expect([400, 401]).toContain(res.status()); // correct if backend has rotation: needs confirmation
    });
  }
}
