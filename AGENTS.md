# AGENTS.md

Playwright + TypeScript API test automation for the pyffe platform services. See [README.md](README.md) for the service list, environment setup and run commands.

## Rules (read before working in the matching area)

| When you... | Read |
| --- | --- |
| write or change tests | [rules/test-design.md](rules/test-design.md) |
| add or change logging | [rules/logging.md](rules/logging.md) |
| make a commit | [rules/commit-convention.md](rules/commit-convention.md) |

## Layout

- `tests/functional/<feature>.spec.ts` — one feature in isolation, flat (no per-service folders). `tests/e2e/*.spec.ts` — multi-step user journeys. Specs hold test cases only: ID, title, tags, order of steps. No `expect`, no service calls.
- Level (functional / e2e) is the folder and Playwright project; suite (`@smoke` / `@regression`) is a tag, exactly one per test.
- `src/steps/<area>/*.steps.ts` — user actions and outcome checks, each a `test.step`; exposed as fixtures in `src/core/fixtures/api.fixture.ts`.
- `src/services/<service>/` — API objects: one method per endpoint call, no assertions.
- `tests/data/` — static test data. `specs/` — API contracts and requirements. `config/` — environment config.

## Commands

- `npm run typecheck` — must pass before finishing.
- `npm run t -- <env> [<file>] [--type functional|e2e] [--tag smoke|regression] [--list]` — run or list tests (`env` is `dev` or `qa`; there is no default).
- `npm run validate:env:<env>` — check the environment config loads.

## Conventions

- `TEST_ENV` must always be explicit. Never run against an environment the user didn't name.
- Secrets live in gitignored `.env.<env>.local`; never commit them or log emails, OTPs or tokens.
- Test IDs (`AUTH-01`, `EMAIL-03`) are stable and unique: never reuse or renumber one.
- Use `createLogger` from `src/core/utils/logger.ts`, not `console.*`, in `src` and `scripts`.
