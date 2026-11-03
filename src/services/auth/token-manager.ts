// src/services/auth/token-manager.ts
import type { AuthService } from './auth.service';
import type { TokenResponse } from './auth.schema';

// accessToken is a JWT: read the expiry from the exp claim (in seconds)
function jwtExpiresAt(jwt: string): number {
  const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
  return payload.exp * 1000;
}

export class TokenManager {
  private token?: { value: string; expiresAt: number };
  private refreshToken?: string;
  private inflight?: Promise<string>;

  constructor(
    private readonly auth: AuthService,
    private readonly email?: string, // if unset, each onboarding creates a new mail.tm mailbox; ignored when mode = 'companion'
    private readonly mode: 'email' | 'companion' = 'email', // 'companion': uses onboardCompanion (no email/OTP needed) for the second device joining the family
    private readonly skewMs = 10_000, // the sample accessToken only lives 60 seconds so keep the buffer short
  ) {}

  /** Device id used to get the JWT — must match the x-device-id header on family-scoped APIs. */
  get deviceId(): string { return this.auth.deviceId; }

  async getAccessToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt - this.skewMs) return this.token.value;
    // Only one refresh at a time within the worker
    this.inflight ??= this.renew().finally(() => { this.inflight = undefined; });
    return this.inflight;
  }

  invalidate() { this.token = undefined; }

  private async renew(): Promise<string> {
    // Prefer refreshToken (always store the new tokens); fall back to re-running onboarding on failure
    const t = (await this.tryRefresh()) ?? (await this.onboard());
    this.token = { value: t.accessToken, expiresAt: jwtExpiresAt(t.accessToken) };
    this.refreshToken = t.refreshToken;
    return t.accessToken;
  }

  private onboard(): Promise<TokenResponse> {
    return this.mode === 'companion' ? this.auth.onboardCompanion() : this.auth.onboard(this.email);
  }

  private async tryRefresh(): Promise<TokenResponse | undefined> {
    if (!this.refreshToken || !this.token) return undefined;
    const res = await this.auth.refreshRaw(this.refreshToken, this.token.value);
    return res.ok() ? this.auth.tokensFrom(await res.json()) : undefined;
  }
}