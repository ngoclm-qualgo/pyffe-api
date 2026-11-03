// src/services/family/companion.service.ts
// API object for the companion device (second device) requesting to join/leave a family via pairing code.
// Uses a separate ApiClient bound to the companion's accessToken (see TokenManager mode 'companion'), not the owner's.
// See specs/familyservice.yml (POST /api/v1/companions/requests).
import type { ApiClient } from '../../core/client/api-client';

type Opts = { language?: string };
export type CompanionRequestType = 'JOIN' | 'REJOIN' | 'LEAVE';

export class CompanionService {
  constructor(private readonly api: ApiClient) {}

  /** JOIN returns a pairing code for the owner to approve (FamilyService.approveInvite); LEAVE removes the companion from the family. */
  createRequest(deviceId: string, requestType: CompanionRequestType, opts: Opts = {}) {
    return this.api.post('/api/v1/companions/requests', { requestType }, {
      action: `Companion ${requestType.toLowerCase()} family request`,
      headers: { 'x-device-id': deviceId, 'x-language': opts.language ?? 'en' },
    });
  }
}
