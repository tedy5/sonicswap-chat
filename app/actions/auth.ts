'use server';

import { cookies } from 'next/headers';
import { generateNonce, SiweMessage } from 'siwe';
import { supabase } from '@/supabase/server';
import {
  createSessionCookie,
  SESSION_EXPIRY,
  verifySession,
} from '@/utils/session';

export async function getNonce() {
  const nonce = generateNonce();
  const cookieStore = await cookies();

  cookieStore.set('siwe_nonce', nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 5, // 5 minutes
  });

  return nonce;
}

async function createOrGetUser(walletAddress: string) {
  // First try to get existing user
  const { data: existingUser, error: fetchError } = await supabase
    .from('users')
    .select('id')
    .eq('wallet_address', walletAddress)
    .single();

  if (fetchError) {
    throw new Error('Failed to fetch user');
  }

  if (existingUser) {
    return existingUser.id;
  }

  // If user doesn't exist, create new user
  const { data: newUser, error: insertError } = await supabase
    .from('users')
    .insert({ wallet_address: walletAddress })
    .select('id')
    .single();

  if (insertError) {
    throw new Error('Failed to create user');
  }

  return newUser.id;
}

export async function verifySignature(message: string, signature: string) {
  try {
    const siweMessage = new SiweMessage(JSON.parse(message));
    const cookieStore = await cookies();
    const nonce = cookieStore.get('siwe_nonce')?.value;

    if (!nonce) {
      throw new Error('Invalid nonce');
    }

    const fields = await siweMessage.verify({ signature, nonce });

    if (!fields.success) {
      throw new Error('Invalid signature');
    }

    // Create or get user after successful verification
    const userId = await createOrGetUser(fields.data.address);

    const sessionToken = await createSessionCookie({
      userId,
      address: fields.data.address,
    });

    cookieStore.set('user_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SESSION_EXPIRY,
    });

    cookieStore.delete('siwe_nonce');
    return { success: true };
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function checkAuth() {
  const cookieStore = await cookies();
  const session = cookieStore.get('user_session');

  if (!session) {
    return null;
  }

  const { valid, data } = await verifySession(session.value);
  return valid ? data : null;
}
