# API calls guideline

Which APIs are called, in what order, to get the values the tests and CLI commands need. Contracts live in [auth-service.yml](auth-service.yml); the code is in `src/services/auth/auth.service.ts`.

| I need | Flow | Command |
| --- | --- | --- |
| `accessToken` for a **new** owner | [1. Login](#1-owner-login-accesstoken) with a fresh mail.tm email | `npm run -s owner:login:new:<env>` |
| `accessToken` for an **existing** owner | [1. Login](#1-owner-login-accesstoken) with a known email | `npm run -s owner:login:existing:<env> [-- --email a@b.c]` |
| `familyId` | [3. Create family](#3-create-family-familyid) | automatic — see `src/core/fixtures/family-provisioning.ts` |

## 1. Owner login (`accessToken`)

All steps call the same endpoint, `POST /api/v1/auth/challenge/anonymous`. The `challengeName` in the body selects the step. The server's response names the next challenge, and the client follows it (at most 5 rounds).

```
(new email only) mail.tm: create a disposable mailbox
        │
        ▼
1  INIT_CHALLENGE         clientMetadata { type: EMAIL, email }
        │  ← challengeName + session
        ▼
2  TERM_CONDITION         session, clientMetadata { action: ACCEPTED }     (only if the server asks)
        │  ← challengeName + session
        ▼
3  EMAIL_OTP_REQUIRED     session, clientMetadata { code }
        │                 code = AUTH_TEST_OTP, or read from the mail.tm inbox
        ▼
   response.result = { accessToken, refreshToken }
```

Every request body also has `authFlow: "LOGIN"`.

| Step | Endpoint | `challengeName` | Notes |
| --- | --- | --- | --- |
| 1 | `POST /api/v1/auth/challenge/anonymous` | `INIT_CHALLENGE` | The server emails an OTP to the address. |
| 2 | same | `TERM_CONDITION` | Skipped when the server doesn't ask for it. |
| 3 | same | `EMAIL_OTP_REQUIRED` | The last response carries the tokens in `result`. |

Required headers, built by `buildHeaders` in `request-signer.ts`: `x-device-id`, `x-device-information`, `x-language`, `x-correlation-id`, `x-country-code` (encrypted with `ENCRYPTION_KEY`) and `x-signature` (HMAC-SHA256 of the body with `HMAC_SECRET`). Requests without them are rejected.

**New vs existing email**

| | New owner | Existing owner |
| --- | --- | --- |
| Email | Random mail.tm address (`provisionEmailAddress`) | `--email`, or `TEST_USER_EMAIL` |
| OTP | Read from the mail.tm inbox (`getVerificationCode`), or `AUTH_TEST_OTP` | Must set `AUTH_TEST_OTP`, because a fixed address can't be read |
| Result | A new account is created on first login | Logs in to the account that already exists |

The access token is short-lived (about 60 seconds in the sample env). `TokenManager` renews it for tests:

| Step | Endpoint | Body | Headers |
| --- | --- | --- | --- |
| Refresh | `POST /api/v1/auth/refresh` | `{ refreshToken }` | signed headers + `Authorization: Bearer <accessToken>` |

If refresh fails, it runs the login flow again.

## 2. Calling other APIs with the token

Authenticated calls (family, settings, devices, ...) go through `ApiClient` and send:

- `Authorization: Bearer <accessToken>`
- `X-Correlation-ID`, one per test or flow
- `X-Request-ID`, one per call
- `x-device-id`, where the endpoint needs the acting device (family endpoints)

## 3. Create family (`familyId`)

**Implemented**, using the contract in [familyservice.yml](familyservice.yml). The `family` worker fixture
(`src/core/fixtures/api.fixture.ts` + `src/core/fixtures/family-provisioning.ts`) does this automatically once
per worker — no manual `FAMILY_ID`/`ACTOR_DEVICE_ID` needed unless you want to override with a pre-existing family.

```
accessToken (owner)  ──►  POST /api/v1/families {name, countryCode}  ──►  familyId = response.id
```

| Item | Value |
| --- | --- |
| Method and path | `POST /api/v1/families` |
| Request body | `{ name: string (2-32 chars), countryCode: string }` (`CreateFamilyPayload`) |
| Required headers | `Authorization`, `x-device-id` (becomes the owner device) |
| `familyId` location in response | `response.id` (`Family201`) |
| Reuse on conflict | `409 FAMILY_OWNER_ALREADY_EXISTS` (owner already has a family, e.g. a fixed `TEST_USER_EMAIL` reused across runs) → `GET /api/v1/families` with the same `x-device-id`, read `response.deviceFamily.familyId` |
| Delete (teardown) | `DELETE /api/v1/families/{id}` — only succeeds once the owner is the sole remaining member |

A second device (`TARGET_DEVICE_ID`, for `DEVICE-01`/`DEVICE-02`) joins via the companion pairing flow, also
automated (`targetDevice` fixture):

```
companion onboards (onboardCompanion, no email/OTP)
        │
        ▼
POST /api/v1/companions/requests {requestType: JOIN}   ──►  pairing code
        │
        ▼
owner: POST /api/v1/families/{id}/invite/{code}/action/APPROVE   ──►  deviceId (= TARGET_DEVICE_ID)
```

Known family endpoints that take a `familyId` (see [notification-push-postman-curl-guide.md](notification-push-postman-curl-guide.md)):

| Action | Endpoint |
| --- | --- |
| Scam alert | `POST /api/v1/families/{familyId}/scam-alerts` |
| Activate or suspend device | `PUT /api/v1/families/{familyId}/devices/{deviceId}` |
| Remove device | `DELETE /api/v1/families/{familyId}/devices/{deviceId}` |
| Update call settings | `PUT /api/v1/settings/families/{familyId}` |
| Add phone number | `POST /api/v1/families/{familyId}/phone-numbers` |

Note: `PUT /api/v1/settings/families/{familyId}` and `POST/DELETE /api/v1/families/{familyId}/phone-numbers` go
through **Call Service**, not Family Service (see the notification guide, sections 4/5). Verified live against QA:
a request signed exactly like the (working) Family Service calls still gets `403 DEVICE_NOT_AUTHORIZED` from Call
Service for the same family/device. Call Service apparently authorizes devices through a different, undocumented
mechanism — there's no `specs/callservice.yml` equivalent to confirm the contract. Until that's available, override
with a pre-provisioned `FAMILY_ID`/`ACTOR_DEVICE_ID` (one Call Service already accepts) to run `FAMILY-01/02/03`.

## Safety

- `TEST_ENV` is always explicit (`dev` or `qa`). Never run these commands against an environment you weren't told to use.
- The commands print a live `accessToken` to stdout. Don't paste it into logs, tickets or commits. The logger redacts tokens automatically, but stdout isn't logged.
