// src/core/utils/brand-check.ts
// Shared check: notification/email content no longer mentions the old brand, in any language.
import { expect } from '@playwright/test';
import { FORBIDDEN_BRANDS } from '../../../tests/data/brand.data';

/** Finds snippets still mentioning the old brand, with surrounding text to show where it appears. */
export function findForbiddenBrandMentions(content: string): string[] {
  return FORBIDDEN_BRANDS.flatMap((b) =>
    [...content.matchAll(new RegExp(`.{0,60}${b}.{0,60}`, 'gi'))].map((m) => `${b}: …${m[0].replace(/\s+/g, ' ')}…`),
  );
}

export function expectNoForbiddenBrand(content: string, label: string) {
  const found = findForbiddenBrandMentions(content);
  expect(found, `${label} still mentions the old brand (${FORBIDDEN_BRANDS.join('/')})`).toEqual([]);
}
