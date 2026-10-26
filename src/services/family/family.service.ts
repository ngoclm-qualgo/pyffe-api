// src/services/family/family.service.ts
// API object cho các endpoint family dùng trong các scenario thông báo: scam-alert, thiết bị, cài đặt, số điện thoại.
// Xem specs/notification-push-postman-curl-guide.md. Create/delete/invite-approve (tạo FAMILY_ID/ACTOR_DEVICE_ID/
// TARGET_DEVICE_ID cho test, xem src/core/fixtures/family-provisioning.ts) theo contract trong specs/familyservice.yml.
import type { ApiClient } from '../../core/client/api-client';

type Opts = { language?: string };

/** familyId + device đóng vai actor (owner) trong family đó — dựng bởi src/core/fixtures/family-provisioning.ts. */
export type FamilyContext = { familyId: string; actorDeviceId: string };

export type ScamAlertBody = {
  scriptId: string;
  category: 'SMS' | 'CALL' | 'BROWSING' | 'FAMILY';
  level: number;
  eventAt: string;
  payload: Record<string, unknown>;
};

export class FamilyService {
  constructor(private readonly api: ApiClient) {}

  /** Tạo family mới; device gọi request (x-device-id) trở thành owner device. */
  create(ownerDeviceId: string, body: { name: string; countryCode: string }, opts: Opts = {}) {
    return this.api.post('/api/v1/families', body, {
      action: 'Create family',
      headers: { 'x-device-id': ownerDeviceId, 'x-language': opts.language ?? 'en' },
    });
  }

  /** deviceFamily.familyId = family đang gắn với device gọi — dùng để lấy lại family khi create trả 409 FAMILY_OWNER_ALREADY_EXISTS. */
  listMine(deviceId: string, opts: Opts = {}) {
    return this.api.get('/api/v1/families', {
      action: 'List my families',
      headers: { 'x-device-id': deviceId, 'x-language': opts.language ?? 'en' },
    });
  }

  /** Chỉ thành công khi owner là thành viên cuối cùng còn lại trong family. */
  deleteFamily(familyId: string, ownerDeviceId: string, opts: Opts = {}) {
    return this.api.delete(`/api/v1/families/${familyId}`, {
      action: 'Delete family',
      headers: { 'x-device-id': ownerDeviceId, 'x-language': opts.language ?? 'en' },
    });
  }

  /** Owner duyệt yêu cầu JOIN bằng pairing code công ty companion vừa tạo; trả về deviceId của thiết bị vừa vào family. */
  approveInvite(familyId: string, ownerDeviceId: string, code: string, opts: Opts = {}) {
    return this.api.post(`/api/v1/families/${familyId}/invite/${code}/action/APPROVE`, undefined, {
      action: 'Approve family join invite',
      headers: { 'x-device-id': ownerDeviceId, 'x-language': opts.language ?? 'en' },
    });
  }

  sendScamAlert(familyId: string, actorDeviceId: string, body: ScamAlertBody, opts: Opts = {}) {
    return this.api.post(`/api/v1/families/${familyId}/scam-alerts`, body, {
      action: `Trigger scam alert ${body.scriptId}`,
      headers: { 'x-device-id': actorDeviceId, 'x-language': opts.language ?? 'en' },
    });
  }

  updateDeviceStatus(familyId: string, actorDeviceId: string, targetDeviceId: string, deviceStatus: 'ACTIVE' | 'SUSPENDED', opts: Opts = {}) {
    return this.api.put(`/api/v1/families/${familyId}/devices/${targetDeviceId}`, { deviceStatus }, {
      action: `Update device status to ${deviceStatus}`,
      headers: { 'x-device-id': actorDeviceId, 'x-language': opts.language ?? 'en' },
    });
  }

  removeDevice(familyId: string, actorDeviceId: string, targetDeviceId: string, opts: Opts = {}) {
    return this.api.delete(`/api/v1/families/${familyId}/devices/${targetDeviceId}`, {
      action: 'Remove family device',
      headers: { 'x-device-id': actorDeviceId, 'x-language': opts.language ?? 'en' },
    });
  }

  updateSettings(familyId: string, actorDeviceId: string, items: { key: string; value: unknown }[], opts: Opts = {}) {
    return this.api.put(`/api/v1/settings/families/${familyId}`, { items }, {
      action: 'Update family call settings',
      headers: { 'x-device-id': actorDeviceId, 'x-language': opts.language ?? 'en' },
    });
  }

  addPhoneNumber(
    familyId: string,
    actorDeviceId: string,
    items: { phoneNumber: string; category: 'SAFELIST' | 'BLOCKLIST'; note?: string }[],
    platform: 'ANDROID' | 'IOS' = 'ANDROID',
    opts: Opts = {},
  ) {
    return this.api.post(`/api/v1/families/${familyId}/phone-numbers`, { items }, {
      action: 'Add family phone number',
      params: { platform },
      headers: { 'x-device-id': actorDeviceId, 'x-language': opts.language ?? 'en' },
    });
  }

  deletePhoneNumber(familyId: string, actorDeviceId: string, phoneNumberId: string, opts: Opts = {}) {
    return this.api.delete(`/api/v1/families/${familyId}/phone-numbers/${phoneNumberId}`, {
      action: 'Delete family phone number',
      headers: { 'x-device-id': actorDeviceId, 'x-language': opts.language ?? 'en' },
    });
  }
}
