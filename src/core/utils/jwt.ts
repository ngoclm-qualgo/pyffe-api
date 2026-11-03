// src/core/utils/jwt.ts
/** Reads the payload (claims) of a JWT, without verifying the signature. */
export function jwtClaims(jwt: string): Record<string, any> {
  return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
}
