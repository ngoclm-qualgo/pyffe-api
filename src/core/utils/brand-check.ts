// src/core/utils/brand-check.ts
// Kiểm tra dùng chung: nội dung thông báo/email không còn nhắc tới thương hiệu cũ, ở mọi ngôn ngữ.
import { expect } from '@playwright/test';
import { FORBIDDEN_BRANDS } from '../../../tests/data/brand.data';

/** Tìm các đoạn còn nhắc thương hiệu cũ, kèm văn bản xung quanh để biết xuất hiện ở đâu. */
export function findForbiddenBrandMentions(content: string): string[] {
  return FORBIDDEN_BRANDS.flatMap((b) =>
    [...content.matchAll(new RegExp(`.{0,60}${b}.{0,60}`, 'gi'))].map((m) => `${b}: …${m[0].replace(/\s+/g, ' ')}…`),
  );
}

export function expectNoForbiddenBrand(content: string, label: string) {
  const found = findForbiddenBrandMentions(content);
  expect(found, `${label} còn nhắc tới thương hiệu cũ (${FORBIDDEN_BRANDS.join('/')})`).toEqual([]);
}
