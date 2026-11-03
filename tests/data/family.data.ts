// tests/data/family.data.ts
// Static test data for family-related notification scenarios (scam-alert, device, settings, phone number).
// See specs/notification-push-postman-curl-guide.md.

export type ScamAlertScenario = {
  scriptId: string;
  category: 'SMS' | 'CALL' | 'BROWSING' | 'FAMILY';
  payload: Record<string, unknown>;
};

const DEVICE_NAME = 'Pyffe Test Android';
const FAMILY_NAME = 'Pyffe Test Family';

/** Each scriptId corresponds to a different notification content variant (see the "Scam-alert variants" table in the guide). */
export const SCAM_ALERT_SCENARIOS: ScamAlertScenario[] = [
  {
    scriptId: 'SMS_SCAM',
    category: 'SMS',
    payload: {
      appName: 'Messages',
      deviceName: DEVICE_NAME,
      familyName: FAMILY_NAME,
      scamCheckResult: {
        verdict: 'SCAM',
        confidence: 0.95,
        riskScore: 0.9,
        recommendation: 'Do not reply or share personal information.',
        modelType: 'DEVICE_ONLY',
        modelVersion: 'pyffe-api-automation',
      },
    },
  },
  { scriptId: 'CALL_BLOCKED_FAMILY', category: 'CALL', payload: { deviceName: DEVICE_NAME, familyName: FAMILY_NAME } },
  { scriptId: 'CALL_BLOCKED_SCAM', category: 'CALL', payload: { deviceName: DEVICE_NAME, familyName: FAMILY_NAME } },
  { scriptId: 'CALL_BLOCKED_SPAM', category: 'CALL', payload: { deviceName: DEVICE_NAME, familyName: FAMILY_NAME } },
  { scriptId: 'CALL_BLOCKLIST_ADDED', category: 'CALL', payload: { deviceName: DEVICE_NAME, familyName: FAMILY_NAME } },
  { scriptId: 'BROWSING_OVERRIDE', category: 'BROWSING', payload: { deviceName: DEVICE_NAME, familyName: FAMILY_NAME } },
  { scriptId: 'DEVICE_LEAVES_FAMILY', category: 'FAMILY', payload: { deviceName: DEVICE_NAME, familyName: FAMILY_NAME } },
];

/** scriptId used for level-specific tests — level 2 of SMS_SCAM is still accepted by the API but push is deliberately suppressed. */
export const SMS_SCAM_SCENARIO = SCAM_ALERT_SCENARIOS[0];
export const SMS_SCAM_SUPPRESSED_LEVEL = 2;
