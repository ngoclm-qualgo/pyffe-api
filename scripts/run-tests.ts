// scripts/run-tests.ts
// Chạy test theo service / file / id-tên / tag, ví dụ:
//   npm run t -- qa onboarding                      (một file feature, tìm trong functional và e2e)
//   npm run t -- qa --type e2e                 (mọi journey trong tests/e2e)
//   npm run t -- qa --type functional --tag smoke
//   npm run t -- qa --service notification     (mọi scenario có đi qua service đó, theo tag @svc-*)
//   npm run t -- qa --id AUTH-01,AUTH-03
//   npm run t -- qa session-refresh --tag smoke
//   npm run t -- qa --name "refresh token" -- --workers=1   (sau `--` thứ hai: cờ Playwright)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ENVIRONMENTS } from '../config/env-names';

// Level = thư mục trong tests/ (cũng là Playwright project), mỗi thư mục phẳng, một file = một feature. Suite (smoke/regression) là tag.
const TYPES = ['functional', 'e2e'];

const USAGE = `Usage: npm run t -- <env> [<file>] [options] [-- <playwright flags>]

  <env>             ${ENVIRONMENTS.join(' | ')}
  --type            ${TYPES.join(' | ')} (comma-separated)
  -f, --file        spec file name without .spec.ts (comma-separated; searched in the chosen types)
  -s, --service     scenarios touching a service, by @svc-<name> tag (comma-separated, OR)
  -i, --id          test ID prefix, e.g. AUTH-01 (comma-separated, OR)
  -n, --name        substring/regex of the test title
  -t, --tag         smoke | regression | negative | ... (without @)
  -l, --list        list matching tests without running them
  -h, --help`;

const fail = (msg: string): never => { console.error(`${msg}\n\n${USAGE}`); process.exit(1); };
const csv = (v?: string) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sep = process.argv.indexOf('--', 2);
const own = sep === -1 ? process.argv.slice(2) : process.argv.slice(2, sep);
const passthrough = sep === -1 ? [] : process.argv.slice(sep + 1);

const { values, positionals } = parseArgs({
  args: own,
  allowPositionals: true,
  options: {
    type: { type: 'string' },
    service: { type: 'string', short: 's' },
    file: { type: 'string', short: 'f' },
    id: { type: 'string', short: 'i' },
    name: { type: 'string', short: 'n' },
    tag: { type: 'string', short: 't' },
    list: { type: 'boolean', short: 'l' },
    help: { type: 'boolean', short: 'h' },
  },
});
if (values.help) { console.log(USAGE); process.exit(0); }

const [testEnv, target, ...extra] = positionals;
if (!ENVIRONMENTS.includes(testEnv as never)) fail(`Môi trường không hợp lệ: ${testEnv ?? '(thiếu)'}`);
if (extra.length) fail(`Tham số thừa: ${extra.join(' ')}`);

const files = csv(values.file ?? target);
const types = csv(values.type);
for (const t of types) if (!TYPES.includes(t)) fail(`Type "${t}" không hợp lệ. Có: ${TYPES.join(', ')}`);
const searchTypes = types.length ? types : TYPES;

const specs: string[] = [];
if (files.length) {
  for (const f of files) {
    const hits = searchTypes.map((t) => `tests/${t}/${f}.spec.ts`).filter((p) => fs.existsSync(path.resolve(p)));
    if (!hits.length) fail(`Không tìm thấy file "${f}.spec.ts" trong: ${searchTypes.map((t) => `tests/${t}`).join(', ')}`);
    specs.push(...hits);
  }
} else if (types.length) {
  specs.push(...types.map((t) => `tests/${t}`));
}

const greps: string[] = [];
const ids = csv(values.id);
if (ids.length) greps.push(`\\b(${ids.map(escapeRe).join('|')})\\b`);
if (values.name) greps.push(values.name);
const services = csv(values.service);
if (services.length) greps.push(`@svc-(${services.map(escapeRe).join('|')})\\b`);
if (values.tag) greps.push(`@${values.tag.replace(/^@/, '')}\\b`);

// Playwright chỉ nhận một --grep, nên các điều kiện được AND bằng lookahead
const grep = greps.length === 1 ? greps[0] : greps.length ? greps.map((g) => `(?=.*${g})`).join('') : undefined;

const args = ['playwright', 'test', ...(values.list ? ['--list'] : []), ...specs, ...(grep ? ['--grep', grep] : []), ...passthrough];
console.log(`[${testEnv}] npx ${args.join(' ')}`);
const res = spawnSync('npx', args, { stdio: 'inherit', env: { ...process.env, TEST_ENV: testEnv } });
process.exit(res.status ?? 1);
