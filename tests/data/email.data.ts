// tests/data/email.data.ts
// Test data for checking Pyffe notification emails (see specs/requirement.md).
import fs from 'node:fs';
import path from 'node:path';
import { parseEmailTemplates } from '../../src/core/utils/csv-parser';

/** Languages Pyffe supports: values sent via the x-language header. */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'fr', name: 'French' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'es', name: 'Spanish' },
  { code: 'fil', name: 'Filipino' },
] as const;

/**
 * Expected onboarding OTP email subject/content per language, loaded from email-templates.csv
 * (columns: language, title, content). "<OTP_CODE>" in content is where the actual OTP code is
 * substituted when matching.
 */
export const EMAIL_SUBJECT_TEMPLATES: Partial<Record<string, string>> = {};
export const EMAIL_CONTENT_TEMPLATES: Partial<Record<string, string>> = {};

const csvPath = path.resolve(__dirname, 'email-templates.csv');
const [header, ...rows] = parseEmailTemplates(fs.readFileSync(csvPath, 'utf-8'));
const languageCol = header.indexOf('language');
const titleCol = header.indexOf('title');
const contentCol = header.indexOf('content');
if (languageCol === -1 || titleCol === -1 || contentCol === -1) {
  throw new Error(`${csvPath} must have columns: language, title, content`);
}
for (const row of rows) {
  const language = row[languageCol];
  if (!language) continue;
  EMAIL_SUBJECT_TEMPLATES[language] = row[titleCol];
  EMAIL_CONTENT_TEMPLATES[language] = row[contentCol];
}
