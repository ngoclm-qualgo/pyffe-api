// src/services/auth/mailbox.ts
import { randomBytes } from 'node:crypto';

const API_BASE = 'https://api.mail.tm';

export type ReceivedEmail = { from: string; subject: string; body: string };

async function call<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API_BASE + path, {
      ...init,
      signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (res.status === 429 && attempt < 8) {
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`mail.tm ${init.method ?? 'GET'} ${path} trả lỗi HTTP ${res.status}`);
    return (await res.json()) as T;
  }
}

export class Mailbox {
  private readonly seen = new Set<string>();

  constructor(readonly address: string, private readonly token: string) {}

  /** Chờ email mới (chưa đọc qua hàm này) tới hộp thư và trả về người gửi, tiêu đề, nội dung (html nếu có, nếu không thì text). */
  async waitForEmail(timeoutMs = 45_000): Promise<ReceivedEmail> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const list = await call<{ 'hydra:member': { id: string }[] }>('/messages', {}, this.token);
      const first = list['hydra:member'].find((m) => !this.seen.has(m.id));
      if (first) {
        this.seen.add(first.id);
        const m = await call<{
          from: { address: string; name?: string };
          subject: string;
          text?: string;
          html?: string[];
        }>(`/messages/${first.id}`, {}, this.token);
        return {
          from: m.from.address,
          subject: m.subject ?? '',
          body: m.html?.join('\n') || m.text || '',
        };
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error(`Không nhận được email nào tới ${this.address} (hết thời gian chờ)`);
  }
}

/** Tạo một hộp thư ngẫu nhiên mới. */
export async function createMailbox(): Promise<Mailbox> {
  const domains = await call<{ 'hydra:member': { domain: string; isActive: boolean }[] }>('/domains');
  const domain = domains['hydra:member'].find((d) => d.isActive)?.domain;
  if (!domain) throw new Error('mail.tm không có domain khả dụng');
  const address = `pyffe-qa-${randomBytes(8).toString('hex')}@${domain}`;
  const password = randomBytes(12).toString('hex') + 'Aa1!';
  await call('/accounts', { method: 'POST', body: JSON.stringify({ address, password }) });
  const { token } = await call<{ token: string }>('/token', { method: 'POST', body: JSON.stringify({ address, password }) });
  return new Mailbox(address, token);
}

/** Phần người dùng nhìn thấy: bỏ style/script/comment/thẻ HTML (URL hạ tầng trong src/href không tính), giữ alt. */
export function visibleText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>|<!--[\s\S]*?-->/gi, ' ')
    .replace(/<img\b[^>]*\balt="([^"]*)"[^>]*>/gi, ' $1 ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}
