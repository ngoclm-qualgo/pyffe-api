// src/services/auth/auth.schema.ts
import { z } from 'zod';

const tokenPair = z.object({ accessToken: z.string().min(1), refreshToken: z.string().min(1) });
export type TokenResponse = z.infer<typeof tokenPair>;

// Response thành công của mọi bước challenge (AuthChallengeResponse trong specs/auth-service.yml)
export const challengeResponseSchema = z
  .object({
    authFlow: z.string(),
    challengeName: z.string(), // challenge kế tiếp client phải làm
    challengeParameters: z.record(z.string(), z.unknown()).optional(),
    session: z.string().optional(),
    result: z.unknown().optional(), // chứa token khi luồng hoàn tất
  })
  .passthrough();
export type ChallengeResponse = z.infer<typeof challengeResponseSchema>;

/** Lấy token từ `result` hoặc từ chính body (response của refresh là AuthTokens). */
export function extractTokens(body: unknown): TokenResponse | undefined {
  const obj = body as { result?: unknown } | null;
  const nested = tokenPair.safeParse(obj?.result);
  if (nested.success) return nested.data;
  const flat = tokenPair.safeParse(body);
  return flat.success ? flat.data : undefined;
}

// Response lỗi (HumaErrorResponse trong specs/auth-service.yml)
export const problemSchema = z.object({
  title: z.string(),
  detail: z.string(),
  errorCode: z.string(),
});
