// src/core/fixtures/family-provisioning.ts
// Logic to set up family/device preconditions for notification tests (scam-alert, device, settings, phone-number):
// auth -> create family -> (optionally) companion joins -> returns FAMILY_ID/ACTOR_DEVICE_ID/TARGET_DEVICE_ID to the fixture,
// no manual declaration needed in .env.<env>.local. See specs/familyservice.yml and specs/api-calls-guideline.md section 3.
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
 * Creates a new family for the owner device. If the owner already has a family from a previous run (fixed
 * TEST_USER_EMAIL, previous cleanup didn't fully run), the API returns 409 FAMILY_OWNER_ALREADY_EXISTS — in that
 * case, fetch the existing family via list-my-families instead of failing, so the suite can still run.
 */
export async function provisionFamily(familyService: FamilyService, ownerDeviceId: string, log: Logger): Promise<string> {
  const res = await familyService.create(ownerDeviceId, { name: `Pyffe Automation ${Date.now()}`, countryCode: env.COUNTRY_CODE });
  if (res.status() === 201) return ((await res.json()) as Family201).id;

  if (res.status() === 409) {
    const body = (await res.json().catch(() => undefined)) as ProblemResponse | undefined;
    if (body?.errorCode === 'FAMILY_OWNER_ALREADY_EXISTS') {
      log.warn('Owner already has a family from a previous run, reusing it', { ownerDeviceId });
      const existing = await familyService.listMine(ownerDeviceId);
      const familyId = ((await existing.json()) as ListMyFamilies200).deviceFamily?.familyId;
      if (familyId) return familyId;
    }
  }
  throw new ApiError('http', `Failed to create family with status ${res.status()}`, res.status());
}

/**
 * Companion device onboarding (no email/OTP needed) -> requests JOIN -> owner approves via pairing code.
 * Returns the deviceId of the device that joined the family (used as TARGET_DEVICE_ID). Cleanup is done by the
 * OWNER (removeDevice) in the fixture, not by the companion self-LEAVE: changing deviceStatus (SUSPENDED/ACTIVE)
 * appears to invalidate the companion's JWT, so the companion can no longer call the API afterward.
 */
export async function provisionCompanionDevice(
  companionService: CompanionService,
  companionDeviceId: string,
  familyService: FamilyService,
  familyId: string,
  ownerDeviceId: string,
): Promise<string> {
  const joinRes = await companionService.createRequest(companionDeviceId, 'JOIN');
  if (joinRes.status() !== 201) throw new ApiError('http', `Companion JOIN failed with status ${joinRes.status()}`, joinRes.status());
  const { code } = (await joinRes.json()) as ApprovalRequestCode201;

  const approveRes = await familyService.approveInvite(familyId, ownerDeviceId, code);
  if (approveRes.status() !== 200) throw new ApiError('http', `Owner approval of invite failed with status ${approveRes.status()}`, approveRes.status());
  const { deviceId } = (await approveRes.json()) as FamilyInviteApprovalByCode200;

  return deviceId;
}
