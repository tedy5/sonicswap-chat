import { cookies } from 'next/headers';
import { openai } from '@ai-sdk/openai';
import { appendResponseMessages, createDataStreamResponse, createIdGenerator, smoothStream, streamText } from 'ai';
import type { Message } from 'ai';
import { DEFI_ASSISTANT_PROMPT } from '@/config/system-prompts';
import { bridgeTools } from '@/tools/bridge-tools';
import { contractBalanceTools } from '@/tools/contract-tools';
import { orderTools } from '@/tools/order-tools';
import { swapTools } from '@/tools/swap-tools';
import { tokenTools } from '@/tools/token-tools';
import { loadChat, saveChat } from '@/utils/chat-store';
import { verifySession } from '@/utils/session';

const MAX_CONTEXT_MESSAGES = 8;

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('user_session');
  const abortController = new AbortController();
  const signal = abortController.signal;

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
    const contextMessages: Message[] = messages.slice(-MAX_CONTEXT_MESSAGES).map((message: Message) => {
      if (message.toolInvocations) {
        return {
          ...message,
          toolInvocations: message.toolInvocations.map((invocation) => ({
            ...invocation,
            result: 'success',
          })),
        };
      }
      return message;
    });
    console.log('Messages: ', JSON.stringify(contextMessages, null, 2));

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
            maxSteps: 5,
            abortSignal: signal,
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
            onStepFinish: async (event) => {
              console.log('Step finished:', {
                type: event.stepType,
                hasToolCalls: !!event.toolCalls?.length,
                hasToolResults: !!event.toolResults?.length,
              });

              // Log tool results, specifically looking for bridge tool results
              if (event.toolResults?.length) {
                for (const result of event.toolResults) {
                  // Check if the result has a shouldAbort property and it's true
                  if ('shouldAbort' in result.result && result.result.shouldAbort === true) {
                    try {
                      // Save the current state
                      const existingMessages = await loadChat(userId);
                      const updatedMessages = appendResponseMessages({
                        messages: existingMessages,
                        responseMessages: event.response.messages,
                      });

                      await saveChat({
                        userId,
                        messages: updatedMessages,
                      });
                      console.log('Messages saved successfully before abort');

                      // Abort after saving
                      abortController.abort();
                    } catch (error) {
                      console.error('Error saving messages before abort:', error);
                    }
                    break;
                  }
                }
              }
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
