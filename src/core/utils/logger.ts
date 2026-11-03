import winston from 'winston';

// CI runs on a VM without a TTY and needs JSON-formatted logs (easy for log aggregators/artifacts);
// local/dev prints human-readable, colored console output.
const isCI = !!process.env.CI;

const REDACTED_KEYS = new Set([
  'access_token', 'refresh_token', 'accesstoken', 'refreshtoken', 'session', 'client_secret', 'password', 'authorization',
]);

/** Converts Error into a plain object and redacts sensitive keys at any depth. */
function sanitize(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value instanceof Error) {
    return { type: value.name, message: value.message, stack: value.stack };
  }
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((v) => sanitize(v, seen));
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, REDACTED_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : sanitize(v, seen)]),
  );
}

const sanitizeFormat = winston.format((info) => {
  // Keep winston's Symbol keys (LEVEL/MESSAGE/SPLAT) intact, only sanitize string keys
  const { level, message, ...meta } = info;
  return Object.assign(info, sanitize(meta) as object, { level, message });
});

const json = winston.format.combine(
  winston.format.timestamp(), // ISO-8601 datetime
  winston.format((info) => {
    info.level = info.level.toUpperCase(); // "INFO"/"DEBUG"/"WARN"/"ERROR"
    return info;
  })(),
  sanitizeFormat(),
  winston.format.json(),
);

// ANSI colors for each part of the log line, to tell them apart when reading the terminal.
// Always on (Playwright workers have no TTY so it can't be detected); disable with the NO_COLOR env var.
const useColor = !process.env.NO_COLOR;
const paint = (code: string) => (text: string) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
const c = {
  time: paint('90'), // gray
  source: paint('35'), // purple
  key: paint('34'), // blue
  string: paint('38;5;180'), // beige (distinct from INFO's green)
  number: paint('38;5;208'), // orange (distinct from WARN's yellow)
  other: paint('38;5;180'),
  muted: paint('90'),
};
const LEVEL_STYLE: Record<string, { badge: (t: string) => string; message: (t: string) => string }> = {
  debug: { badge: paint('1;90'), message: paint('90') },
  info: { badge: paint('1;32'), message: paint('1;36') }, // INFO green, step description bold cyan
  warn: { badge: paint('1;33'), message: paint('1;33') },
  error: { badge: paint('1;31'), message: paint('1;31') },
};
const statusColor = (n: number) => paint(n >= 500 ? '1;31' : n >= 400 ? '1;33' : n >= 200 && n < 300 ? '1;32' : '36')(String(n));

function formatValue(key: string, v: unknown): string {
  if (key === 'status' && typeof v === 'number') return statusColor(v);
  if (typeof v === 'string') return c.string(JSON.stringify(v));
  if (typeof v === 'number') return c.number(String(v));
  if (v !== null && typeof v === 'object') return c.other(JSON.stringify(v, null, 2).replace(/\n/g, '\n    '));
  return c.other(String(v));
}

const pretty = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  sanitizeFormat(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const { source, ...rest } = meta as Record<string, unknown>;
    const style = LEVEL_STYLE[level] ?? LEVEL_STYLE.info;
    const head = [
      c.time(`[${timestamp}]`),
      style.badge(level.toUpperCase().padEnd(5)),
      source ? c.source(`(${source})`) : '',
      style.message(String(message)),
    ].filter(Boolean).join(' ');
    const lines = Object.entries(rest).filter(([, v]) => v !== undefined).map(([k, v]) => `    ${c.key(k)}${c.muted(':')} ${formatValue(k, v)}`);
    return [head, ...lines].join('\n');
  }),
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  defaultMeta: { env: process.env.TEST_ENV },
  format: isCI ? json : pretty,
  // LOG_STDERR=1 routes all logs to stderr so stdout only contains the CLI command's result (see scripts/cli.ts)
  transports: [new winston.transports.Console(process.env.LOG_STDERR ? { stderrLevels: ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'] } : {})],
});

export type Logger = winston.Logger;

/** Child logger with a fixed `source` (the module/service emitting the log) to make debugging filters easier. */
export function createLogger(source: string): Logger {
  return logger.child({ source });
}
