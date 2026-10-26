// src/services/family/companion.service.ts
// API object cho companion device (thiết bị thứ hai) xin tham gia/rời family bằng pairing code.
// Dùng ApiClient riêng, gắn với accessToken của companion (xem TokenManager mode 'companion'), không phải owner.
// Xem specs/familyservice.yml (POST /api/v1/companions/requests).
import type { ApiClient } from '../../core/client/api-client';

type Opts = { language?: string };
export type CompanionRequestType = 'JOIN' | 'REJOIN' | 'LEAVE';

export class CompanionService {
  constructor(private readonly api: ApiClient) {}

  /** JOIN trả về pairing code để owner duyệt (FamilyService.approveInvite); LEAVE gỡ companion khỏi family. */
  createRequest(deviceId: string, requestType: CompanionRequestType, opts: Opts = {}) {
    return this.api.post('/api/v1/companions/requests', { requestType }, {
      action: `Companion ${requestType.toLowerCase()} family request`,
      headers: { 'x-device-id': deviceId, 'x-language': opts.language ?? 'en' },
    });
  }
}
