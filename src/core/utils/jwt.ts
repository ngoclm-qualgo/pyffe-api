// src/core/utils/jwt.ts
/** Đọc payload (claims) của một JWT, không xác minh chữ ký. */
export function jwtClaims(jwt: string): Record<string, any> {
  return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
}
