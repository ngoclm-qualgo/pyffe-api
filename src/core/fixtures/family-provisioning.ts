// src/core/fixtures/family-provisioning.ts
// Logic dựng precondition family/device cho các test notification (scam-alert, device, settings, phone-number):
// auth -> tạo family -> (tùy chọn) companion join -> trả FAMILY_ID/ACTOR_DEVICE_ID/TARGET_DEVICE_ID cho fixture,
// không cần khai báo tay trong .env.<env>.local. Xem specs/familyservice.yml và specs/api-calls-guideline.md mục 3.
import { env } from '../../../config/env';
import { ApiError } from '../client/api-error';
import type { FamilyService } from '../../services/family/family.service';
import type { CompanionService } from '../../services/family/companion.service';
import type { Logger } from '../utils/logger';

type Family201 = { id: string };
type ListMyFamilies200 = { deviceFamily?: { familyId?: string } };
type ProblemResponse = { errorCode?: string };
type ApprovalRequestCode201 = { code: string };
type FamilyInviteApprovalByCode200 = { deviceId: string };

/**
 * Tạo family mới cho owner device. Nếu owner đã có family từ lần chạy trước (TEST_USER_EMAIL cố định, cleanup
 * trước đó không chạy hết) thì API trả 409 FAMILY_OWNER_ALREADY_EXISTS — khi đó lấy lại family hiện có qua
 * list-my-families thay vì fail, để suite vẫn chạy được.
 */
export async function provisionFamily(familyService: FamilyService, ownerDeviceId: string, log: Logger): Promise<string> {
  const res = await familyService.create(ownerDeviceId, { name: `Pyffe Automation ${Date.now()}`, countryCode: env.COUNTRY_CODE });
  if (res.status() === 201) return ((await res.json()) as Family201).id;

  if (res.status() === 409) {
    const body = (await res.json().catch(() => undefined)) as ProblemResponse | undefined;
    if (body?.errorCode === 'FAMILY_OWNER_ALREADY_EXISTS') {
      log.warn('Owner đã có family từ lần chạy trước, dùng lại family đó', { ownerDeviceId });
      const existing = await familyService.listMine(ownerDeviceId);
      const familyId = ((await existing.json()) as ListMyFamilies200).deviceFamily?.familyId;
      if (familyId) return familyId;
    }
  }
  throw new ApiError('http', `Tạo family thất bại với status ${res.status()}`, res.status());
}

/**
 * Companion device onboarding (không cần email/OTP) -> xin JOIN -> owner duyệt bằng pairing code.
 * Trả deviceId của thiết bị vừa vào family (dùng làm TARGET_DEVICE_ID). Dọn dẹp do OWNER thực hiện
 * (removeDevice) ở fixture, không phải companion tự LEAVE: đổi deviceStatus (SUSPENDED/ACTIVE) dường như
 * vô hiệu hóa JWT của companion, nên companion không còn gọi API được sau đó.
 */
export async function provisionCompanionDevice(
  companionService: CompanionService,
  companionDeviceId: string,
  familyService: FamilyService,
  familyId: string,
  ownerDeviceId: string,
): Promise<string> {
  const joinRes = await companionService.createRequest(companionDeviceId, 'JOIN');
  if (joinRes.status() !== 201) throw new ApiError('http', `Companion JOIN thất bại với status ${joinRes.status()}`, joinRes.status());
  const { code } = (await joinRes.json()) as ApprovalRequestCode201;

  const approveRes = await familyService.approveInvite(familyId, ownerDeviceId, code);
  if (approveRes.status() !== 200) throw new ApiError('http', `Owner duyệt invite thất bại với status ${approveRes.status()}`, approveRes.status());
  const { deviceId } = (await approveRes.json()) as FamilyInviteApprovalByCode200;

  return deviceId;
}
