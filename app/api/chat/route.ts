import { cookies } from 'next/headers';
import { openai } from '@ai-sdk/openai';
import { appendResponseMessages, createDataStreamResponse, createIdGenerator, smoothStream, streamText } from 'ai';
import { DEFI_ASSISTANT_PROMPT } from '@/config/system-prompts';
import { bridgeTools } from '@/tools/bridge-tools';
import { contractBalanceTools } from '@/tools/contract-tools';
import { orderTools } from '@/tools/order-tools';
import { swapTools } from '@/tools/swap-tools';
import { tokenTools } from '@/tools/token-tools';
import { loadChat, saveChat } from '@/utils/chat-store';
import { verifySession } from '@/utils/session';

const MAX_CONTEXT_MESSAGES = 4;

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
    const contextMessages = messages.slice(-MAX_CONTEXT_MESSAGES);

    console.log('Starting AI request:', {
      userId,
      messageCount: contextMessages.length,
      lastMessageContent: contextMessages[contextMessages.length - 1]?.content,
    });

    return createDataStreamResponse({
      execute: async (dataStream) => {
        console.log('DataStream execution started');

        try {
          // Save the latest user message first
          const latestMessage = messages[messages.length - 1];
          if (latestMessage.role === 'user') {
            await saveChat({
              userId,
              messages: [latestMessage],
            });
            console.log('Saved latest user message');
          }

          console.log('Initializing streamText');
          const result = streamText({
            model: openai('gpt-4o'),
            experimental_transform: smoothStream(),
            messages: contextMessages,
            tools: {
              ...bridgeTools,
              ...tokenTools,
              ...swapTools,
              ...contractBalanceTools,
              ...orderTools,
            },
            system: DEFI_ASSISTANT_PROMPT,
            experimental_generateMessageId: createIdGenerator({
              prefix: 'assistant',
              size: 32,
            }),
            onChunk: async (event) => {
              console.log('AI Chunk received:', {
                type: event.chunk,
                content: 'textDelta' in event ? event.textDelta : undefined,
                toolCall: 'toolName' in event ? event.toolName : undefined,
              });
            },
            onStepFinish: async (event) => {
              console.log('Step finished:', {
                type: event.stepType,
                hasToolCalls: !!event.toolCalls?.length,
                hasToolResults: !!event.toolResults?.length,
              });
            },
            onFinish: async (event) => {
              console.log('AI Stream finished:', {
                stepCount: event.steps.length,
                hasResponse: !!event.response,
                messageCount: event.response.messages.length,
              });
              try {
                const existingMessages = await loadChat(userId);
                const updatedMessages = appendResponseMessages({
                  messages: existingMessages,
                  responseMessages: event.response.messages,
                });
                await saveChat({
                  userId,
                  messages: updatedMessages,
                });
                console.log('Messages saved successfully');
                dataStream.writeMessageAnnotation({ saved: true });
              } catch (error) {
                console.error('Error saving messages:', error);
                dataStream.writeMessageAnnotation({ saved: false, error: String(error) });
                throw error;
              }
            },
          });

          console.log('StreamText initialized, merging into dataStream');
          result.mergeIntoDataStream(dataStream);
          console.log('DataStream merge completed');
        } catch (error) {
          console.error('Error in dataStream execution:', error);
          throw error;
        }
      },
    });
  } catch (error) {
    console.error('Fatal error in chat API:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
