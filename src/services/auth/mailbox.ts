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
    if (!res.ok) throw new Error(`mail.tm ${init.method ?? 'GET'} ${path} returned HTTP error ${res.status}`);
    return (await res.json()) as T;
  }
}

export class Mailbox {
  private readonly seen = new Set<string>();

  constructor(readonly address: string, private readonly token: string) {}

  /** Wait for a new email (not yet read via this function) to arrive and return sender, subject, body (html if present, otherwise text). */
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
    throw new Error(`No email received at ${this.address} (timed out)`);
  }
}

/** Create a new random mailbox. */
export async function createMailbox(): Promise<Mailbox> {
  const domains = await call<{ 'hydra:member': { domain: string; isActive: boolean }[] }>('/domains');
  const domain = domains['hydra:member'].find((d) => d.isActive)?.domain;
  if (!domain) throw new Error('mail.tm has no available domain');
  const address = `pyffe-qa-${randomBytes(8).toString('hex')}@${domain}`;
  const password = randomBytes(12).toString('hex') + 'Aa1!';
  await call('/accounts', { method: 'POST', body: JSON.stringify({ address, password }) });
  const { token } = await call<{ token: string }>('/token', { method: 'POST', body: JSON.stringify({ address, password }) });
  return new Mailbox(address, token);
}

/** Visible-to-user part: strip style/script/comment/HTML tags (infrastructure URLs in src/href, image alt text, don't count). */
export function visibleText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>|<!--[\s\S]*?-->/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}

/** Alt text of the email's logo <img>, for verifying the image itself rather than body content. */
export function logoAltText(html: string): string | undefined {
  return html.match(/<img\b[^>]*\balt="([^"]*)"[^>]*>/i)?.[1];
}
