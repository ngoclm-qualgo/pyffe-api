# pyffe-api

Playwright-based API test automation suite for the pyffe platform services (see `README.md` for the full service list and test-running instructions).

## Commit Convention

This repo follows [Conventional Commits](https://www.conventionalcommits.org/). Every commit message (and every commit an agent makes) MUST follow this format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

| Type | Use for |
| --- | --- |
| `feat` | New test coverage, new fixtures/services/clients, new capability |
| `fix` | Fixing a broken test, flaky test, or bug in test infra |
| `test` | Test-only changes that aren't new coverage (e.g. reorganizing specs, adjusting tags like `@smoke`/`@regression`) |
| `refactor` | Restructuring code (services, core) with no behavior change |
| `chore` | Tooling, deps, config, housekeeping (no src/tests behavior change) |
| `docs` | README, CLAUDE.md, comments-only changes |
| `ci` | Changes to `.github/workflows/*` |
| `build` | Changes to `package.json`, `tsconfig.json`, `playwright.config.ts` build/runtime setup |
| `revert` | Reverting a previous commit |

### Scope

Scope is required and should name the area touched. Prefer the narrowest accurate scope:

- **Service scopes** (mirrors `src/services/<name>/` / `tests/<name>/`), using the short names from the README service table: `auth`, `back-office`, `call`, `consent`, `dns`, `family`, `ingestion`, `notification`, `platform-config`, `subscription`, `data-standardization`, `data-serving`, `litellm-proxy`.
- **Infra scopes**: `core` (`src/core` — `client/` api client+error, `fixtures/` Playwright test fixtures, `utils/` logger/retry/cleanup), `config` (`config/environments`, `config/env.ts`), `scripts` (`scripts/*`), `env` (`.env.example`, env validation).
- Use `deps` for dependency bumps, `ci` commits may omit a secondary scope if the workflow itself is the scope.
- If a change truly spans multiple scopes, pick the primary one — don't invent a combined scope like `auth+clients`.

### Subject

- Imperative mood, present tense: "add", not "added"/"adds".
- Lowercase first letter, no trailing period.
- Keep to ~72 characters; put detail in the body instead.

### Body (optional, encouraged for non-trivial changes)

- Explain **why**, not just what — the diff already shows what changed.
- Wrap at ~72 chars per line.

### Footer (optional)

- Breaking changes: `BREAKING CHANGE: <description>`.
- Reference tickets/issues if applicable: `Refs: PYF-123`.

### Examples

```
feat(auth): add regression coverage for expired OTP onboarding

fix(core): retry api-client on 429 with backoff

test(auth): move refresh-token specs under @regression tag

chore(config): switch otp-provider to guerrilla mail

docs(readme): document real-OTP vs fixed-OTP onboarding setup

ci(api-tests): run regression suite nightly against qa
```

### Agent rules

- One logical change per commit — don't bundle an unrelated `chore` into a `feat` commit.
- Never commit secrets (`.env*.local` is gitignored — keep it that way).
- Only commit when explicitly asked to; stage specific files, not `git add -A`.
- Append `Co-Authored-By: Claude <noreply@anthropic.com>` (or the active model's name) as a trailer on commits made by an agent.
