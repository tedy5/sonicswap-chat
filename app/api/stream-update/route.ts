import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { type Address } from 'viem';
import { supabase } from '@/supabase/server';
import { createSessionCookie } from '@/utils/session';
import { sendStreamUpdate } from '@/utils/update-stream';

export async function POST(request: NextRequest) {
  // Verify API key
  const apiKey = request.headers.get('x-api-key');
  if (apiKey !== process.env.STREAM_UPDATE_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { userId, message, shouldSave, maxContextMessages, skipHistory, promptType } = await request.json();

    if (!userId || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get user data from the database
    const { data: user } = await supabase.from('users').select('id, wallet_address').eq('id', userId).single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create a session token using the existing function
    const sessionToken = await createSessionCookie({
      userId: user.id,
      address: user.wallet_address as Address,
    });

    // Set the session cookie for this request
    const cookieStore = await cookies();
    cookieStore.set('user_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    await sendStreamUpdate(
      userId,
      message,
      shouldSave !== undefined ? shouldSave : true,
      maxContextMessages !== undefined ? maxContextMessages : 2,
      skipHistory !== undefined ? skipHistory : false,
      promptType || 'stream'
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending stream update:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
