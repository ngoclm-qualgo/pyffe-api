import winston from 'winston';

// CI chạy trên máy ảo không có TTY và cần log dạng JSON (dễ cho log aggregator/artifact);
// local/dev thì in ra console dạng người đọc được, có màu.
const isCI = !!process.env.CI;

const REDACTED_KEYS = new Set([
  'access_token', 'refresh_token', 'accesstoken', 'refreshtoken', 'session', 'client_secret', 'password', 'authorization',
]);

/** Chuyển Error thành object thường và che các key nhạy cảm ở mọi độ sâu. */
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
  // Giữ nguyên các key Symbol (LEVEL/MESSAGE/SPLAT) của winston, chỉ làm sạch key chuỗi
  const { level, message, ...meta } = info;
  return Object.assign(info, sanitize(meta) as object, { level, message });
});

const json = winston.format.combine(
  winston.format.timestamp(), // datetime dạng ISO-8601
  winston.format((info) => {
    info.level = info.level.toUpperCase(); // "INFO"/"DEBUG"/"WARN"/"ERROR"
    return info;
  })(),
  sanitizeFormat(),
  winston.format.json(),
);

// Màu ANSI cho từng phần của dòng log để dễ phân biệt khi đọc terminal.
// Luôn bật (Playwright worker không có TTY nên không dò TTY được); tắt bằng biến môi trường NO_COLOR.
const useColor = !process.env.NO_COLOR;
const paint = (code: string) => (text: string) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
const c = {
  time: paint('90'), // xám
  source: paint('35'), // tím
  key: paint('34'), // xanh dương
  string: paint('38;5;180'), // be (khác xanh lá của INFO)
  number: paint('38;5;208'), // cam (khác vàng của WARN)
  other: paint('38;5;180'),
  muted: paint('90'),
};
const LEVEL_STYLE: Record<string, { badge: (t: string) => string; message: (t: string) => string }> = {
  debug: { badge: paint('1;90'), message: paint('90') },
  info: { badge: paint('1;32'), message: paint('1;36') }, // INFO xanh lá, mô tả bước in đậm cyan
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
  // LOG_STDERR=1 đưa mọi log sang stderr để stdout chỉ chứa kết quả của lệnh CLI (xem scripts/cli.ts)
  transports: [new winston.transports.Console(process.env.LOG_STDERR ? { stderrLevels: ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'] } : {})],
});

export type Logger = winston.Logger;

/** Logger con gắn cố định `source` (module/service phát sinh log) để dễ lọc khi debug. */
export function createLogger(source: string): Logger {
  return logger.child({ source });
}
