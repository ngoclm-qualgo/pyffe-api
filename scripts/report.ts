// scripts/report.ts
// Open the HTML report for a run (each run is saved under its own runId, see playwright.config.ts).
//   npm run report -- <env>            -> most recent run
//   npm run report -- <env> <runId>    -> a specific run
//   npm run report -- <env> --list     -> list available run ids (newest first)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ENVIRONMENTS } from '../config/env-names';

const USAGE = `Usage: npm run report -- <env> [<runId> | --list]\n  env: ${ENVIRONMENTS.join(' | ')}`;
const fail = (msg: string): never => { console.error(`${msg}\n\n${USAGE}`); process.exit(1); };

const [testEnv, arg] = process.argv.slice(2);
if (!ENVIRONMENTS.includes(testEnv as never)) fail(`Invalid environment: ${testEnv ?? '(missing)'}`);

const envDir = path.resolve(`playwright-report/${testEnv}`);
const listRuns = (): string[] => {
  if (!fs.existsSync(envDir)) return [];
  return fs.readdirSync(envDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => fs.statSync(path.join(envDir, b)).mtimeMs - fs.statSync(path.join(envDir, a)).mtimeMs);
};

if (arg === '--list' || arg === '-l') {
  const runs = listRuns();
  if (!runs.length) fail(`No reports found for env "${testEnv}" in ${envDir}`);
  console.log(runs.join('\n'));
  process.exit(0);
}

const runId = arg ?? listRuns()[0];
if (!runId) fail(`No reports found for env "${testEnv}" in ${envDir}`);
const dir = path.join(envDir, runId);
if (!fs.existsSync(dir)) fail(`Report not found: ${dir}`);

console.log(`Opening report: ${dir}`);
const res = spawnSync('npx', ['playwright', 'show-report', dir], { stdio: 'inherit' });
process.exit(res.status ?? 1);
