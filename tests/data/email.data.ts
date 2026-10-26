// tests/data/email.data.ts
// Dữ liệu test cho kiểm tra email thông báo của Pyffe (xem specs/requirement.md).

/** Ngôn ngữ Pyffe hỗ trợ: giá trị gửi qua header x-language. */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'fr', name: 'French' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'es', name: 'Spanish' },
  { code: 'fil', name: 'Filipino' }, // cần xác nhận backend nhận 'fil' hay 'tl'
] as const;

/**
 * Nội dung email OTP onboarding kỳ vọng theo ngôn ngữ — "<OTP_CODE>" là nơi chèn mã OTP thực tế khi so khớp.
 * Hiện chỉ có bản tiếng Anh được xác nhận; bổ sung ngôn ngữ khác khi có bản dịch chính thức.
 */
export const EMAIL_CONTENT_TEMPLATES: Partial<Record<string, string>> = {
  en: `Sign in to the Pyffe app
Thanks for getting started with Pyffe.
Use the verification code below to create your account.
<OTP_CODE>
This code will expire in 10 minutes and can only be used once.
For your security, please do not share this code with anyone.
Best regards,
The Pyffe Team`,
};
