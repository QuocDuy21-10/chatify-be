export interface JwtAccessPayload {
  sub: string;
  type: 'access';
  iss?: string;
  iat?: number;
  exp?: number;
}
export interface JwtRefreshPayload {
  sub: string;
  type: 'refresh';
  iss?: string;
  iat?: number;
  exp?: number;
}
export type JwtPayload = JwtAccessPayload | JwtRefreshPayload;

export function isAccessTokenPayload(
  payload: JwtPayload,
): payload is JwtAccessPayload {
  return payload.type === 'access';
}

export function isRefreshTokenPayload(
  payload: JwtPayload,
): payload is JwtRefreshPayload {
  return payload.type === 'refresh';
}
