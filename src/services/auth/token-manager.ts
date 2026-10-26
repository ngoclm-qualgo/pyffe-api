// src/services/auth/token-manager.ts
import type { AuthService } from './auth.service';
import type { TokenResponse } from './auth.schema';

// accessToken là JWT: đọc thời điểm hết hạn từ claim exp (tính bằng giây)
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
    private readonly email?: string, // không đặt thì mỗi lần onboarding tự tạo hộp thư mail.tm mới; bỏ qua khi mode = 'companion'
    private readonly mode: 'email' | 'companion' = 'email', // 'companion': dùng onboardCompanion (không cần email/OTP) cho device thứ hai join family
    private readonly skewMs = 10_000, // accessToken mẫu chỉ sống 60 giây nên đệm ngắn
  ) {}

  /** Device id đã dùng để lấy JWT — cần khớp với header x-device-id ở các API family-scoped. */
  get deviceId(): string { return this.auth.deviceId; }

  async getAccessToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt - this.skewMs) return this.token.value;
    // Chỉ một lần làm mới tại một thời điểm trong worker
    this.inflight ??= this.renew().finally(() => { this.inflight = undefined; });
    return this.inflight;
  }

  invalidate() { this.token = undefined; }

  private async renew(): Promise<string> {
    // Ưu tiên refreshToken (luôn lưu token mới); thất bại thì chạy lại luồng onboarding
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