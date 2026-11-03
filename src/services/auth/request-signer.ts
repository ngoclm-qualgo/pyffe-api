// src/services/auth/request-signer.ts: reimplements Postman's prerequest script logic
import { createCipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { env } from '../../../config/env';

export type DeviceContext = {
  id: string;
  info: { brand: string; osVersion: string; appVersion: string; deviceName: string };
};

export function defaultDevice(): DeviceContext {
  return {
    id: env.DEVICE_ID || `autotest-${randomBytes(8).toString('hex')}`, // stable per AuthService
    info: { brand: 'Playwright', osVersion: '1', appVersion: '1.0.0', deviceName: 'api-automation' },
  };
}

// Recursively sort keys
function sortKeys(v: unknown): unknown {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return v;
  const o = v as Record<string, unknown>;
  return Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortKeys(o[k])]));
}

// Each line is key=value; object values get JSON.stringify; joined by newline
export function canonicalString(body: Record<string, unknown>): string {
  const sorted = sortKeys(body) as Record<string, unknown>;
  return Object.keys(sorted)
    .map((k) => {
      const val = sorted[k];
      return `${k}=${val !== null && typeof val === 'object' ? JSON.stringify(val) : val}`;
    })
    .join('\n');
}

export function hmacSignature(body: Record<string, unknown>): string {
  return createHmac('sha256', env.HMAC_SECRET).update(canonicalString(body)).digest('hex');
}

// AES-CFB, all-zero IV, plaintext: <country code>:<30-minute frame number>
export function countryCodeHeader(now = Date.now()): string {
  const key = Buffer.from(env.ENCRYPTION_KEY, 'utf8');
  const cipher = createCipheriv(`aes-${key.length * 8}-cfb`, key, Buffer.alloc(16, 0));
  const plain = `${env.COUNTRY_CODE}:${Math.floor(now / (30 * 60 * 1000))}`;
  return Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]).toString('hex');
}

export function buildHeaders(body: Record<string, unknown>, device: DeviceContext, correlationId: string, language = 'en') {
  return {
    'x-device-id': device.id,
    'x-device-information': Buffer.from(JSON.stringify(device.info)).toString('base64'),
    'x-language': language,
    'x-correlation-id': correlationId,
    'x-country-code': countryCodeHeader(),
    'x-signature': hmacSignature(body),
  };
}

// Companion flow: codeChallenge = base64url(SHA-256(codeVerifier))
export function pkcePair() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}