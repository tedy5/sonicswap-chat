import { cookies } from 'next/headers';
import { openai } from '@ai-sdk/openai';
import { appendResponseMessages, createIdGenerator, streamText } from 'ai';
import { tools } from '@/tools/swap-tools';
import { loadChat, saveChat } from '@/utils/chat-store';
import { verifySession } from '@/utils/session';
import { DEFI_ASSISTANT_PROMPT } from '@/config/system-prompts';

const MAX_CONTEXT_MESSAGES = 10;

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('user_session');

  if (!session) {
    return new Response('Not authenticated', { status: 401 });
  }

  try {
    const { messages } = await req.json();
    const { valid, data } = await verifySession(session.value);

    if (!valid || !data?.userId) {
      return new Response('Invalid session', { status: 401 });
    }

    const userId = data.userId;

    // Save the latest user message first
    const latestMessage = messages[messages.length - 1];
    if (latestMessage.role === 'user') {
      await saveChat({
        userId,
        messages: [latestMessage],
      });
    }

    // Get context messages
    const contextMessages = messages.slice(-MAX_CONTEXT_MESSAGES);

    console.log('Context window:', {
      totalMessages: messages.length,
      contextMessages: contextMessages.length,
      droppedMessages: messages.length - contextMessages.length,
    });

    const result = streamText({
      model: openai('gpt-4o-mini'),
      messages: contextMessages,
      tools,
      system: DEFI_ASSISTANT_PROMPT,
      experimental_generateMessageId: createIdGenerator({
        prefix: 'assistant',
        size: 32,
      }),
      async onFinish({ response }) {
        try {
          const existingMessages = await loadChat(userId);

          const updatedMessages = appendResponseMessages({
            messages: existingMessages,
            responseMessages: response.messages,
          });

          await saveChat({
            userId,
            messages: updatedMessages,
          });

          console.log('Messages saved successfully');
        } catch (error) {
          console.error('Error saving messages:', error);
          throw error;
        }
      },
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Error in chat API:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
