import { NextRequest, NextResponse } from 'next/server';
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
