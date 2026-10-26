# Test design

Tests are organised around **scenarios** (what a user does and what they should get), not around endpoints or services. A service is just something a scenario passes through; it is recorded as a tag.

## Classification

Every test is classified on three independent axes. Don't mix them.

| Axis | Values | Expressed as | Answers |
| --- | --- | --- | --- |
| **Level** | `functional`, `e2e` | folder + Playwright project | *What* is under test? |
| **Suite** | `@smoke`, `@regression` | tag on the `describe` (exactly one) | *When* does it run? |
| **Modifier** | `@negative`, `@svc-*` | tags | polarity, services touched |

- **Functional** — one feature/service behaviour, checked in isolation (happy path, validation, error codes, contract). Lives flat in `tests/functional/<feature>.spec.ts`.
- **E2E** — a user journey of several steps (possibly several services) where each step depends on the previous one's output. Lives flat in `tests/e2e/<journey>.spec.ts`; IDs `E2E-nn`.
- **Smoke** — the small set of critical, fast checks that say "the system is alive"; runs on every PR. Can be functional or e2e.
- **Regression** — everything else; runs nightly. Can be functional or e2e.

Smoke and regression are *selections*, not locations: a smoke test sits next to its functional siblings and is picked by tag, so there is never a separate "smoke" copy of a test.

## Layout

```
tests/
  functional/
    <feature>.spec.ts     # one feature / scenario family, named after the behaviour (no sub-folders)
  e2e/
    <journey>.spec.ts     # cross-step user flow (e.g. sign up -> create family -> invite member)
  data/                   # static test data, shared by specs
src/
  services/<service>/     # API objects (the "pages"): one method per endpoint call, no assertions
  steps/<area>/           # steps: user actions + outcome checks, built on services, wrapped in test.step
```

- **File** = one feature a QA would name in a test plan. No per-service folders: a new service or feature just adds files. Keep all of a feature's cases together (`onboarding.spec.ts`, `session-refresh.spec.ts`) and use one `describe` per suite/polarity inside it (success `@smoke`, failures `@regression @negative`), since tags live on the `describe`.
- A journey that touches several services carries a `@svc-*` tag for each.
- Playwright projects `functional` and `e2e` (see `playwright.config.ts`) map to the two folders.

Three code layers, each with one job:

| Layer | Knows about | Does |
| --- | --- | --- |
| Spec (`tests/`) | test ID, title, tags, order of steps | lists the steps of a test case; no `expect`, no service calls |
| Steps (`src/steps/`) | user language, expected outcomes | one method per user action / check, each a `test.step`; returns data for the next step |
| Service (`src/services/`) | endpoints, headers, signing | sends requests, returns raw responses or tokens |

## Test case

```ts
test.describe('Gia hạn phiên onboarding', { tag: ['@svc-auth', '@regression'] }, () => {
  test('AUTH-08 refresh token cũ bị từ chối sau khi đã dùng', { tag: '@negative' }, async ({ authService }) => {
    const t1 = await test.step('Người dùng onboarding', () => authService.onboarding());
    await test.step('Gia hạn phiên lần đầu thành công', async () => { /* ... */ });
    await test.step('Dùng lại refresh token cũ bị từ chối', async () => { /* ... */ });
  });
});
```

- **Title** = `<ID> <expected behaviour>`. IDs are stable and unique (`AUTH-01`, `EMAIL-03`); never reuse or renumber one.
- **Steps** = `test.step('<user action>')`, in the order a user performs them. They show up in the HTML report and trace, and read the same as the log lines (see [logging.md](logging.md)). Assertions that verify the outcome go in the last step.
- A spec reads like the test plan: `const t1 = await sessionSteps.onbarding(); await sessionSteps.refreshSessionOk(t1);`. Step classes are exposed as fixtures in `src/core/fixtures/api.fixture.ts` (`onboardingSteps`, `sessionSteps`).
- Put preconditions in fixtures/`beforeAll`, not in steps; clean up created data through the `cleanup` fixture.

## Tags

Use Playwright's `tag` option, not text in the title.

| Kind | Tags | Meaning |
| --- | --- | --- |
| Suite | `@smoke` | Critical happy paths; fast; runs on every PR |
| | `@regression` | Everything else; runs nightly |
| Polarity | `@negative` | Expected rejection / error path |
| Service | `@svc-auth`, `@svc-notification`, ... | Services the scenario goes through |

Every test has exactly one suite tag (set on the `describe`), and at least one `@svc-*` tag. The level is not a tag: it comes from the folder/project.

## Running

```bash
npm run test:smoke:qa                        # suite: every @smoke test, any level
npm run test:regression:qa                   # suite: every @regression test
npm run test:functional:qa                   # level: all functional tests
npm run test:e2e:qa                          # level: all e2e journeys
npm run t -- qa session-refresh              # one feature file
npm run t -- qa --type e2e                   # the e2e folder
npm run t -- qa --service notification       # everything passing through a service
npm run t -- qa --id AUTH-08                 # one test case
npm run t -- qa --type functional --tag smoke   # level + suite
npm run t -- qa --service auth --tag negative   # failure paths of a service
```

## Adding a scenario

1. Decide the level: one feature in isolation -> `tests/functional/<feature>.spec.ts`; a multi-step journey -> `tests/e2e/`. Name the file after the behaviour.
2. Write the title with the next free ID, steps in user language, and the tags above (one suite tag, at least one `@svc-*`).
3. Add the endpoint call to `src/services/<service>` (never call endpoints from a spec or step), then add the user action / check to `src/steps/<area>/<name>.steps.ts` as a `test.step` method and expose the class as a fixture. The spec only calls steps.
4. Run `npm run t -- <env> <file> --list` to check the title and tags, then run it.
