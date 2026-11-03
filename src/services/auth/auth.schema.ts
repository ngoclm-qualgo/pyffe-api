// src/services/auth/auth.schema.ts
import { z } from 'zod';

const tokenPair = z.object({ accessToken: z.string().min(1), refreshToken: z.string().min(1) });
export type TokenResponse = z.infer<typeof tokenPair>;

// Success response for every challenge step (AuthChallengeResponse in specs/auth-service.yml)
export const challengeResponseSchema = z
  .object({
    authFlow: z.string(),
    challengeName: z.string(), // next challenge the client must complete
    challengeParameters: z.record(z.string(), z.unknown()).optional(),
    session: z.string().optional(),
    result: z.unknown().optional(), // holds tokens when the flow completes
  })
  .passthrough();
export type ChallengeResponse = z.infer<typeof challengeResponseSchema>;

/** Extract tokens from `result`, or from the body itself (refresh response is AuthTokens). */
export function extractTokens(body: unknown): TokenResponse | undefined {
  const obj = body as { result?: unknown } | null;
  const nested = tokenPair.safeParse(obj?.result);
  if (nested.success) return nested.data;
  const flat = tokenPair.safeParse(body);
  return flat.success ? flat.data : undefined;
}

// Error response (HumaErrorResponse in specs/auth-service.yml)
export const problemSchema = z.object({
  title: z.string(),
  detail: z.string(),
  errorCode: z.string(),
});
