import { jwtVerify, SignJWT } from 'jose';
import { SessionData } from '@/types/session';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET_KEY);

export const SESSION_EXPIRY = 60 * 60 * 24 * 7; // 7 days in seconds

export async function createSessionCookie(data: SessionData) {
  const jwt = await new SignJWT({
    userId: data.userId,
    address: data.address,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_EXPIRY}s`)
    .sign(JWT_SECRET);

  return jwt;
}

export async function verifySession(token: string): Promise<{ valid: boolean; data: SessionData | null }> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    if (
      typeof payload === 'object' &&
      payload !== null &&
      'userId' in payload &&
      'address' in payload &&
      typeof payload.userId === 'string' &&
      typeof payload.address === 'string'
    ) {
      return {
        valid: true,
        data: {
          userId: payload.userId,
          address: payload.address,
        },
      };
    }

    return {
      valid: false,
      data: null,
    };
  } catch (error) {
    return {
      valid: false,
      data: null,
    };
  }
}
