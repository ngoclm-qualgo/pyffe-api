// src/steps/auth/session.steps.ts
// Các bước người dùng khi gia hạn phiên onboarding.
import { test, expect, type APIResponse } from '@playwright/test';
import type { AuthService } from '../../services/auth/auth.service';
import type { TokenResponse } from '../../services/auth/auth.schema';

export class SessionSteps {
  constructor(private readonly auth: AuthService) {}

  onboard(): Promise<TokenResponse> {
    return test.step('Người dùng onboarding', () => this.auth.onboard());
  }

  /** Gia hạn phiên lần đầu, kỳ vọng thành công, trả về cặp token mới. */
  refreshSession(old: TokenResponse): Promise<TokenResponse> {
    return test.step('Gia hạn phiên bằng refresh token', async () => {
      const res = await this.auth.refreshRaw(old.refreshToken, old.accessToken);
      await expect(res).toBeOK();
      return this.auth.tokensFrom(await res.json());
    });
  }

  refreshSessionOk(old: TokenResponse) {
    return test.step('Gia hạn phiên lần đầu thành công', async () => {
      await expect(await this.auth.refreshRaw(old.refreshToken, old.accessToken)).toBeOK();
    });
  }

  reuseRefreshToken(old: TokenResponse): Promise<APIResponse> {
    return test.step('Dùng lại refresh token cũ', () => this.auth.refreshRaw(old.refreshToken, old.accessToken));
  }

  expectNewAccessToken(before: TokenResponse, after: TokenResponse) {
    return test.step('Nhận access token mới', () => {
      expect(after.accessToken).not.toBe(before.accessToken);
    });
  }

  expectRefreshTokenRejected(res: APIResponse) {
    return test.step('Refresh token cũ bị từ chối', () => {
      expect([400, 401]).toContain(res.status()); // đúng nếu backend có rotation: cần xác nhận
    });
  }
}
