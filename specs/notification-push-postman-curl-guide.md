# Notification Push Postman and curl Guide

This guide summarizes current notification scenarios and provides Postman/curl requests only for APIs available in both dev and QA. Scenarios without a QA trigger remain listed for business-flow coverage.

## Safety and prerequisites

- Use disposable non-production users, families, devices, and audiences.
- Register valid FCM tokens for the test devices before running these calls.
- Use an audience containing only test devices for admin campaigns.
- A successful API response confirms that the trigger was accepted, not that FCM delivery succeeded. Verify the physical device and Notification Service dispatch status.

## Variables

Replace the placeholders in each command, or define these shell variables:

```bash
API_BASE_URL='<DEV_OR_QA_PYFFE_API_BASE_URL>'
ADMIN_BASE_URL='<DEV_OR_QA_PYFFE_ADMIN_API_BASE_URL>'
ACCESS_TOKEN='<JWT_ACCESS_TOKEN>'
ADMIN_ACCESS_TOKEN='<BACKOFFICE_JWT_WITH_NOTIFICATION_PERMISSION>'
FAMILY_ID='<TEST_FAMILY_UUID>'
ACTOR_DEVICE_ID='<ACTOR_DEVICE_UUID>'
TARGET_DEVICE_ID='<TARGET_DEVICE_UUID>'
PHONE_NUMBER_ID='<CREATED_FAMILY_PHONE_NUMBER_UUID>'
AUDIENCE_ID='<TEST_ONLY_AUDIENCE_UUID>'
```

Postman can import any command below using **Import → Raw text**.

## API test matrix

| Area | Scenario | API | Required state | Expected recipient | curl |
| --- | --- | --- | --- | --- | --- |
| Scam alert | Scam detected, call blocked, browsing override, or device leaves family | `POST /api/v1/families/{familyId}/scam-alerts` | Actor is an active family device | Family owners and origin device; copy varies by `scriptId` and alert preferences | [Scam alert](#1-scam-alert) |
| Subscription | Create or change plan | Not available in QA | Subscription plan changes through the real purchase lifecycle | Eligible account and family devices receive reload; silent on Android and visible on iOS | — |
| Subscription | Cancellation scheduled | Not available in QA | Active subscription is scheduled for cancellation | Owner and family devices receive visible recipient-specific copy | — |
| Subscription | Subscription expired | Not available in QA | Existing subscription expires with protected devices | Owner and devices affected by expiry | — |
| Subscription | Deferred plan applied | Not available in QA | A pending plan change is applied at renewal | Eligible account and family devices receive subscription reload | — |
| Device | Suspended device activated | `PUT /api/v1/families/{familyId}/devices/{deviceId}` | Owner changes target from `SUSPENDED` to `ACTIVE` | Activated target device | [Activate device](#2-activate-a-suspended-family-device) |
| Family | Device removed | `DELETE /api/v1/families/{familyId}/devices/{deviceId}` | Owner removes a different member device | Removed target device | [Remove device](#3-remove-a-member-device) |
| Family | Settings synchronized | `PUT /api/v1/settings/families/{familyId}` | Caller has family access and the call-blocking subscription benefit | Devices belonging to users other than the actor | [Update settings](#4-update-family-call-settings) |
| Family | Phone data synchronized | `POST /api/v1/families/{familyId}/phone-numbers` | Caller has family access; phone number is valid E.164 | Family devices other than the actor device | [Add phone number](#5-add-a-family-phone-number) |
| Admin | Product announcement | `POST /api/v1/admin/notifications` | Backoffice token has `create` access on `notifications`; test audience has an active build | Devices in the test audience | [Product announcement](#6-product-announcement) |
| Admin | Community update | `POST /api/v1/admin/notifications` | Backoffice token has `create` access on `notifications`; test audience has an active build | Devices in the test audience | [Community update](#7-community-update) |

## 1. Scam alert

Use the current UTC time for `eventAt`.

```bash
curl --request POST \
  "$API_BASE_URL/api/v1/families/$FAMILY_ID/scam-alerts" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json' \
  --header 'x-language: en' \
  --header 'x-correlation-id: postman-scam-brand-test-001' \
  --header "x-device-id: $ACTOR_DEVICE_ID" \
  --data-raw '{
    "scriptId": "SMS_SCAM",
    "category": "SMS",
    "level": 3,
    "eventAt": "2026-10-23T10:00:00Z",
    "payload": {
      "appName": "Messages",
      "deviceName": "Pyffe Test Android",
      "familyName": "Pyffe Test Family",
      "scamCheckResult": {
        "verdict": "SCAM",
        "confidence": 0.95,
        "riskScore": 0.9,
        "recommendation": "Do not reply or share personal information.",
        "modelType": "DEVICE_ONLY",
        "modelVersion": "postman-brand-test"
      }
    }
  }'
```

Expected result: the API returns `204`, publishes the asynchronous scam-alert event, and eligible family owners plus the origin device receive localized copy. Recipient alert preferences can suppress delivery.

### Scam-alert variants

Each supported `scriptId` resolves to different notification copy:

| `scriptId` | Category | Expected notification behavior |
| --- | --- | --- |
| `CALL_BLOCKED_FAMILY` | `CALL` | Pyffe blocked a number because it is in the family blocklist. |
| `CALL_BLOCKED_SCAM` | `CALL` | Pyffe blocked a number identified by the community as scam. |
| `CALL_BLOCKED_SPAM` | `CALL` | Pyffe blocked a number identified by the community as spam. |
| `CALL_BLOCKLIST_ADDED` | `CALL` | Generic family security-alert copy. |
| `SMS_SCAM` | `SMS` | Origin device and other family recipients receive different title/body copy. A level-2 `SMS_SCAM` push is intentionally skipped. |
| `BROWSING_OVERRIDE` | `BROWSING` | A family device visited a site Pyffe flagged as malicious. |
| `DEVICE_LEAVES_FAMILY` | `FAMILY` | Copy includes `payload.deviceName` and `payload.familyName`; both values are required. |

To test a call-block variant, set the script variable and run the same endpoint:

```bash
SCAM_SCRIPT_ID='CALL_BLOCKED_FAMILY'
```

Use `CALL_BLOCKED_SCAM` and `CALL_BLOCKED_SPAM` in separate runs.

```bash
curl --request POST \
  "$API_BASE_URL/api/v1/families/$FAMILY_ID/scam-alerts" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json' \
  --header 'x-language: en' \
  --header 'x-correlation-id: postman-call-block-brand-test-001' \
  --header "x-device-id: $ACTOR_DEVICE_ID" \
  --data-raw "{
    \"scriptId\": \"$SCAM_SCRIPT_ID\",
    \"category\": \"CALL\",
    \"level\": 3,
    \"eventAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"payload\": {
      \"deviceName\": \"Pyffe Test Android\",
      \"familyName\": \"Pyffe Test Family\"
    }
  }"
```

For Postman, duplicate the scam-alert request and change `scriptId` for each row. Use `{{$isoTimestamp}}` as `eventAt`.

### Subscription lifecycle scenarios

Keep these scenarios in the QA test scope, but do not call a simulation API:

| Scenario | Business trigger | Expected notification |
| --- | --- | --- |
| Plan changed | A real purchase changes the subscription plan | Eligible devices reload subscription data |
| Cancellation scheduled | An active subscription is scheduled for cancellation | The owner and protected family devices receive recipient-specific cancellation copy |
| Subscription expired | The subscription reaches its expiry state | The owner receives an affected-device summary, and newly suspended devices receive plan-ended copy |
| Deferred plan applied | A pending plan is activated at renewal | Eligible devices reload subscription data |

These scenarios require an approved real subscription lifecycle or internal event-testing process in QA.

## 2. Activate a suspended family device

The caller must be the family owner, and the target device must already have `SUSPENDED` status. Updating an already-active device does not send this notification.

```bash
curl --request PUT \
  "$API_BASE_URL/api/v1/families/$FAMILY_ID/devices/$TARGET_DEVICE_ID" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json' \
  --header 'x-language: en' \
  --header 'x-correlation-id: postman-device-activate-001' \
  --header "x-device-id: $ACTOR_DEVICE_ID" \
  --data-raw '{
    "deviceStatus": "ACTIVE"
  }'
```

Expected result: the activated target device receives the device-activated push.

## 3. Remove a member device

Use the owner token and a different member device as `TARGET_DEVICE_ID`.

```bash
curl --request DELETE \
  "$API_BASE_URL/api/v1/families/$FAMILY_ID/devices/$TARGET_DEVICE_ID" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header 'Accept: application/json' \
  --header 'x-language: en' \
  --header 'x-correlation-id: postman-device-remove-001' \
  --header "x-device-id: $ACTOR_DEVICE_ID"
```

Expected result: after the asynchronous member-change event is processed, the removed device receives removal copy. The notification is skipped when a device removes itself.

## 4. Update family call settings

This public Call Service route publishes the family-setting event consumed by Family Service. It requires the call-blocking subscription benefit.

```bash
curl --request PUT \
  "$API_BASE_URL/api/v1/settings/families/$FAMILY_ID" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json' \
  --header 'x-language: en' \
  --header 'x-correlation-id: postman-family-settings-001' \
  --header "x-device-id: $ACTOR_DEVICE_ID" \
  --data-raw '{
    "items": [
      {
        "key": "AUTO_BLOCK_SCAM_CALL",
        "value": true
      }
    ]
  }'
```

Expected result: the API returns `204`; Family Service asynchronously tells devices belonging to other users in the family to synchronize settings. Android delivery is silent, while iOS delivery is visible and delayed by the configured scheduling window.

## 5. Add a family phone number

This public Call Service route publishes the phone-data event consumed by Family Service. Use `SAFELIST` to test synchronization alone; `BLOCKLIST` also produces a `CALL_BLOCKLIST_ADDED` scam alert.

```bash
curl --request POST \
  "$API_BASE_URL/api/v1/families/$FAMILY_ID/phone-numbers?platform=ANDROID" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json' \
  --header 'x-language: en' \
  --header 'x-correlation-id: postman-family-phone-number-001' \
  --header "x-device-id: $ACTOR_DEVICE_ID" \
  --data-raw '{
    "items": [
      {
        "phoneNumber": "+84912345678",
        "category": "SAFELIST",
        "note": "Notification synchronization test"
      }
    ]
  }'
```

Expected result: the family phone number is created; Family Service asynchronously tells all other family devices to synchronize phone data. Android delivery is silent, while iOS delivery is visible and delayed by the configured scheduling window.

The equivalent delete route also triggers the same synchronization flow. Set `PHONE_NUMBER_ID` from the create response, then run:

```bash
curl --request DELETE \
  "$API_BASE_URL/api/v1/families/$FAMILY_ID/phone-numbers/$PHONE_NUMBER_ID" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header 'Accept: application/json' \
  --header 'x-language: en' \
  --header 'x-correlation-id: postman-family-phone-number-delete-001' \
  --header "x-device-id: $ACTOR_DEVICE_ID"
```

## 6. Product announcement

Use a backoffice JWT with `create` access on `notifications`; do not reuse an application-user JWT unless it carries that permission.

```bash
curl --request POST \
  "$ADMIN_BASE_URL/api/v1/admin/notifications" \
  --header "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json' \
  --header 'x-language: en' \
  --header 'x-correlation-id: postman-product-announcement-001' \
  --data-raw "{
    \"title\": \"Pyffe security update\",
    \"description\": \"Open Pyffe to review the latest protection update.\",
    \"type\": \"product_announcement\",
    \"actionType\": \"open_web\",
    \"targetUrl\": \"https://pyffe.com\",
    \"campaignId\": \"PYFFE_PRODUCT_$(date +%s)\",
    \"audienceId\": \"$AUDIENCE_ID\",
    \"deliveryMode\": \"immediate\"
  }"
```

Expected result: the campaign is created and immediately dispatched when the audience has an active completed build.

## 7. Community update

```bash
curl --request POST \
  "$ADMIN_BASE_URL/api/v1/admin/notifications" \
  --header "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json' \
  --header 'x-language: en' \
  --header 'x-correlation-id: postman-community-update-001' \
  --data-raw "{
    \"title\": \"Pyffe community update\",
    \"description\": \"A new Pyffe community update is available.\",
    \"type\": \"community_update\",
    \"actionType\": \"open_web\",
    \"targetUrl\": \"https://pyffe.com\",
    \"campaignId\": \"PYFFE_COMMUNITY_$(date +%s)\",
    \"audienceId\": \"$AUDIENCE_ID\",
    \"deliveryMode\": \"immediate\"
  }"
```

Expected result: the campaign is created and immediately dispatched when the audience has an active completed build.

## Admin dispatch verification

Save the `data.id` from the create response as `NOTIFICATION_ID`, then refresh and inspect delivery status:

```bash
NOTIFICATION_ID='<CREATED_NOTIFICATION_UUID>'
```

```bash
curl --request POST \
  "$ADMIN_BASE_URL/api/v1/admin/notifications/$NOTIFICATION_ID/refresh-status" \
  --header "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  --header 'Accept: application/json' \
  --header 'x-correlation-id: postman-notification-refresh-001'
```

```bash
curl --request GET \
  "$ADMIN_BASE_URL/api/v1/admin/notifications/$NOTIFICATION_ID/dispatches" \
  --header "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  --header 'Accept: application/json' \
  --header 'x-correlation-id: postman-notification-dispatches-001'
```

## Validation checklist

For every expected push, verify:

- Correct recipient and device.
- English and Vietnamese copy.
- No user-visible `Kinshield` or `KinShield`.
- Expected `Pyffe` product name and application icon.
- Correct sound, deep link, and tap behavior.
- Foreground, background, and terminated application behavior.
- No duplicate delivery.
- Notification Service reports a successful dispatch.

Updating `featureCodes` is not a notification scenario: the current notification helper has no production caller, so no push should be expected from that change.

VPN reconnection is not included because no active producer or current Pyffe business flow exists.

Subscription cancellation, expiry, renewal, and plan-change scenarios remain in scope, but their simulation APIs are dev-only and cannot be run in QA. Test them in QA only through an approved real subscription lifecycle or internal event-testing process.
