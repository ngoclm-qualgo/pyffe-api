# pyffe-api

## Running tests

### Prerequisites
- Node.js 22 (matches CI, see `.github/workflows/api-tests.yml`)
- Install dependencies: `npm install`

### 1. Configure the environment
Tests require an explicit `TEST_ENV` (`dev` or `qa`) — there is no default, to avoid running against the wrong environment by accident.

Non-secret values (base URLs, country code) live in the committed `config/environments/<env>.env` files. Secrets (test user email, OTP, HMAC/encryption keys) go in a local, gitignored `.env.<env>.local` file:

```bash
cp .env.example .env.qa.local
# then fill in TEST_USER_EMAIL, HMAC_SECRET, ENCRYPTION_KEY, etc.
```

#### Getting the email OTP for onboarding
The email onboarding flow (`AuthService.onboarding`) needs a verification code. Pick one:

- **Fixed code (recommended for stable test environments):** set `AUTH_TEST_OTP` in `.env.<env>.local` to whatever static code the backend accepts for the test user in that environment.
- **Real code via mail.tm (free, no signup/API key):** leave `AUTH_TEST_OTP` and `TEST_USER_EMAIL` empty. `AuthService.onboarding` creates a disposable mail.tm inbox for each onboarding (`provisionEmailAddress` in `otp-provider.ts`), sends the init request to that address, polls the inbox, and extracts the 6-digit code from the email. Nothing to configure. A fixed `TEST_USER_EMAIL` cannot be read this way, so pair it with `AUTH_TEST_OTP`.

  mail.tm is a free community service with no uptime SLA and it rate-limits (HTTP 429, retried with backoff). The email-content tests in `tests/functional/onboarding.spec.ts` (email OTP section) create one inbox per language, so run them with `--workers=1` if you see 429 errors: `npm run t -- qa onboarding --name EMAIL -- --workers=1`.

Verify the config loads correctly before running tests:

```bash
npm run validate:env:dev
npm run validate:env:qa
```

### 2. Run the tests

Every command below exists in a `:dev` and a `:qa` flavor. Pick the environment, then the scope you need:

| Goal | Command |
| --- | --- |
| Run everything | `npm run test:dev` / `npm run test:qa` |
| Run the `@smoke` suite (any level) | `npm run test:smoke:dev` / `npm run test:smoke:qa` |
| Run the `@regression` suite (any level) | `npm run test:regression:dev` / `npm run test:regression:qa` |
| Run every notification-push scenario ([spec](specs/notification-push-postman-curl-guide.md)) | `npm run test:notification:dev` / `npm run test:notification:qa` |
| Run all functional tests | `npm run test:functional:dev` / `npm run test:functional:qa` |
| Run all e2e journeys | `npm run test:e2e:dev` / `npm run test:e2e:qa` |
| Run one test by ID/name | `npm run test:case:dev -- "AUTH-01"` / `npm run test:case:qa -- "AUTH-01"` |
| List tests without running them | `npm run test:list:dev` / `npm run test:list:qa` |
| Re-run only what failed last time | `npm run test:failed:dev` / `npm run test:failed:qa` |
| Interactive UI mode (pick/debug tests visually) | `npm run test:ui:dev` / `npm run test:ui:qa` |

Tests are classified by **level** (`tests/functional/`, `tests/e2e/` = Playwright projects) and **suite** (`@smoke` / `@regression` tags); see [rules/test-design.md](rules/test-design.md).

Every command accepts additional standard Playwright CLI flags after `--`, e.g. a specific file or combining a suite with a service:

```bash
npm run test:qa -- tests/functional/onboarding.spec.ts
npm run test:functional:qa -- --grep @smoke # smoke tests of one level
npm run test:case:qa -- "AUTH-01|AUTH-02"   # grep accepts a regex, so you can OR test IDs
npm run test:qa -- --repeat-each=3          # check for flakiness
```

**Selecting tests by level / file / service / ID / name** (see [rules/test-design.md](rules/test-design.md) for how tests are organised) — `npm run t -- <env> [<file>] [options]` is a single runner that combines selectors (they are AND-ed). Spec files are discovered from `tests/functional/` and `tests/e2e/`, so a new file works with no `package.json` change.

| Selector | Example |
| --- | --- |
| Level | `npm run t -- qa --type e2e` |
| Service (by `@svc-*` tag) | `npm run t -- qa --service notification` |
| File (feature, without `.spec.ts`) | `npm run t -- qa onboarding` / `npm run t -- qa session-refresh` |
| Test ID (comma = OR) | `npm run t -- qa --id AUTH-01,AUTH-03` |
| Test name (substring/regex) | `npm run t -- qa --name "refresh"` |
| Tag | `npm run t -- qa --type functional --tag smoke` |
| Combined | `npm run t -- qa onboarding --id AUTH-04` |
| Dry run | add `--list` |
| Playwright flags | after a second `--`: `npm run t -- qa session-refresh -- --workers=1` |

**New feature:** add `tests/functional/<feature>.spec.ts` — the `t` runner and the `functional` project pick it up with no `package.json` change.

### 3. View the report

```bash
npm run report
```

HTML/JUnit/JSON reports and run artifacts are written under `playwright-report/<env>/` and `test-results/<env>/`.

### Other useful commands

```bash
npm run typecheck   # type-check the whole project without emitting
```

### CI
`.github/workflows/api-tests.yml` runs smoke tests on dev for every pull request, and regression tests on qa nightly (18:00 UTC). It can also be triggered manually (`workflow_dispatch`) with a chosen environment and suite. Each environment maps to a GitHub Environment holding its own secrets (`TEST_USER_EMAIL`, `AUTH_TEST_OTP`, `HMAC_SECRET`, `ENCRYPTION_KEY`, ...).

### Logging
See [rules/logging.md](./rules/logging.md).
