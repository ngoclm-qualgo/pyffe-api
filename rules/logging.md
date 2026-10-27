# Logging

All logging goes through the shared [winston](https://github.com/winstonjs/winston) logger in `src/core/utils/logger.ts` — don't use `console.*` in `src`/`scripts`.

## Format

Every entry has:

- `timestamp` — ISO-8601 datetime
- `level` — `DEBUG` / `INFO` / `WARN` / `ERROR`
- `source` — the module/service that emitted the log (e.g. `api-client`, `cleanup`, `validate-env`)
- `message` — the human-readable message
- contextual fields relevant to the log site — `testId`, `correlationId`, `requestId`, `method`, `endpoint`, `status`, `durationMs`, `err`, etc.

This is the shape most test runners and log collectors expect: a leveled, timestamped, sourced line that's easy to grep/filter in a CI log and easy to parse if ingested by a log aggregator.

## Messages describe user actions

`msg`/`message` says **what the user did**, not which function ran or what the HTTP layer did. Technical detail (`method`, `endpoint`, `status`, `durationMs`) goes in the fields.

| Do | Don't |
| --- | --- |
| `Enter email to log in` | `initEmailRaw called` / `request completed` |
| `Accept terms & conditions` | `POST /challenge TERM_CONDITION` |
| `Refresh onboarding session` | `refreshRaw` |
| `Enter OTP code failed` (on transport error) | `request failed` |

- `AuthService` logs one line per user step, plus `Start onboarding …` / `Onboarded …` around a whole flow. Never log the email, OTP, or tokens.
- `ApiClient` logs the action passed in the call: `api.get('/v1/families', { action: 'View family list' })`. Without `action` it falls back to `GET /v1/families`, so pass one for every new call.
- Failures reuse the action with a ` failed` suffix.

## Usage

```ts
import { createLogger } from './logger';

const log = createLogger('my-module');

log.debug('Open family settings', { familyId });
log.info('Accept terms & conditions', { status, durationMs });
log.warn('Test data clean-up incomplete', { failed });
log.error('Enter OTP code failed', { err });
```

`createLogger('<source>')` returns a child logger tagged with that source. Request-scoped loggers (per test) additionally carry `testId` and `correlationId` (see `src/core/fixtures/api.fixture.ts`), and each HTTP call carries its own `requestId` (see `src/core/client/api-client.ts`).

## Output mode

- **Locally** (`CI` env var unset): logs are pretty-printed and colorized.

  ```
  [2026-10-26 10:15:30.123] INFO (api-client): View family list
      testId: "auth > onboarding"
      correlationId: "a1b2c3d4-..."
      requestId: "e5f6a7b8-..."
      method: "GET"
      endpoint: "/v1/families"
      status: 200
      durationMs: 142
  ```

- **In CI** (`CI` env var set, as GitHub Actions does by default): logs are newline-delimited JSON, so they can be collected/parsed as build artifacts or shipped to a log aggregator.

  ```json
  {"level":"INFO","timestamp":"2026-10-26T10:15:30.123Z","env":"qa","source":"api-client","testId":"auth > onboarding","correlationId":"a1b2c3d4-...","requestId":"e5f6a7b8-...","method":"GET","endpoint":"/v1/families","status":200,"durationMs":142,"message":"View family list"}
  ```

## Verbosity

Control it with `LOG_LEVEL` (`debug` | `info` | `warn` | `error`, default `info`) in `.env.<env>.local` or the shell environment.

## Secrets

Tokens, passwords, and auth headers are redacted automatically — see the `redact` config in `src/core/utils/logger.ts`.
