import { defineConfig } from '@playwright/test';
import { env, profile } from './config/env';

// Identifies this run so its report isn't overwritten by the next one; view later with `npm run report -- <env> <runId>`.
const runId = process.env.RUN_ID ?? new Date().toISOString().replace(/[:.]/g, '-');
console.log(`[run] ${runId}`);

const outDir = `test-results/${env.TEST_ENV}/${runId}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: process.env.CI ? profile.workers : undefined,
  retries: process.env.CI ? 1 : 0, // test retry, not HTTP retry
  timeout: 60_000,
  expect: { timeout: profile.pollTimeoutMs },
  use: { baseURL: env.BASE_URL },
  // Level = where the test lives. Suite (@smoke / @regression) is a tag, selected with --grep.
  projects: [
    { name: 'functional', testDir: './tests/functional' }, // one service / feature
    { name: 'e2e', testDir: './tests/e2e' },               // cross-step user journeys
  ],
  outputDir: `${outDir}/artifacts`,
  metadata: { environment: env.TEST_ENV, runId },
  reporter: [
    ['list'],
    ['html', { outputFolder: `playwright-report/${env.TEST_ENV}/${runId}`, open: 'never' }],
    ['junit', { outputFile: `${outDir}/junit.xml` }],
    ['json', { outputFile: `${outDir}/results.json` }],
  ],
});