// src/core/client/api-error.ts
export type ApiErrorKind = 'transport' | 'http' | 'contract' | 'business';
export class ApiError extends Error {
  constructor(public kind: ApiErrorKind, message: string, public status?: number) {
    super(message);
  }
}