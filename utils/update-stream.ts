import { openai } from '@ai-sdk/openai';
import { createDataStreamResponse, createIdGenerator, smoothStream, streamText } from 'ai';
import { UPDATE_LIMIT_PROMPT } from '@/config/limit-prompt';
import { UPDATE_STREAM_PROMPT } from '@/config/update-prompts';
import { orderTools } from '@/tools/order-tools';
import { tokenTools } from '@/tools/token-tools';
import { type StreamingMessage } from '@/types/chat';
import { loadChat, saveChat } from '@/utils/chat-store';

export const clients = new Map<string, Set<(message: StreamingMessage) => void>>();

const generateMessageId = createIdGenerator({
  prefix: 'stream',
  size: 32,
});

export async function sendStreamUpdate(
  userId: string,
  context: string,
  shouldSave: boolean = true,
  maxContextMessages = 10,
  skipHistory: boolean = false,
  promptType: 'stream' | 'limit' = 'stream'
) {
  console.log('Attempting to send update for userId:', userId);
  const userClients = clients.get(userId);
  console.log('Current clients for userId:', userId, userClients ? userClients.size : 0);
  console.log('Context received: ' + context);

  // Only load history if not skipping
  let contextMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
  if (!skipHistory && maxContextMessages > 0) {
    const existingMessages = await loadChat(userId);
    contextMessages = existingMessages.slice(-maxContextMessages).map((msg) => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }));
  }

  // Select the appropriate system prompt based on promptType
  const systemPrompt = promptType === 'stream' ? UPDATE_STREAM_PROMPT : UPDATE_LIMIT_PROMPT;

  // Create a promise that will resolve when the message is saved
  return new Promise((resolve, reject) => {
    let accumulatedContent = '';
    createDataStreamResponse({
      execute: async (dataStream) => {
        try {
          const streamMessageId = generateMessageId();

          const result = streamText({
            model: openai('gpt-4o'),
            maxSteps: 5,
            experimental_transform: smoothStream(),
            messages: [
              {
                role: 'system' as const,
                content: systemPrompt,
              },
              ...contextMessages,
              {
                role: 'system' as const,
                content: `${context}`,
              },
            ],
            tools: {
              ...tokenTools,
              ...orderTools,
            },
            experimental_generateMessageId: generateMessageId,
            onChunk: async (event) => {
              const currentClients = clients.get(userId);
              if ('chunk' in event) {
                const chunk = event.chunk;
                if ('textDelta' in chunk && (chunk.type === 'text-delta' || chunk.type === 'reasoning')) {
                  accumulatedContent += chunk.textDelta;
                  if (currentClients) {
                    currentClients.forEach((handler) =>
                      handler({
                        id: streamMessageId,
                        role: 'assistant',
                        content: accumulatedContent,
                        createdAt: new Date(),
                        streaming: true,
                      } as StreamingMessage)
                    );
                  }
                }
              }
            },

            onFinish: async (event) => {
              try {
                console.log('Raw messages:', JSON.stringify(event.response.messages, null, 2));

                // Create a single assistant message
                const assistantMessage: StreamingMessage = {
                  id: streamMessageId,
                  role: 'assistant',
                  content: accumulatedContent,
                  createdAt: new Date(),
                };

                const formattedMessages: StreamingMessage[] = [assistantMessage];

                // Process tool calls and results
                for (const msg of event.response.messages) {
                  if (msg.role === 'assistant' && Array.isArray(msg.content)) {
                    const toolCall = msg.content.find((item) => item.type === 'tool-call');
                    if (toolCall) {
                      assistantMessage.toolInvocations = [
                        {
                          toolName: toolCall.toolName,
                          toolCallId: toolCall.toolCallId,
                          args: toolCall.args,
                          state: 'call',
                          step: 0,
                        },
                      ];
                    }
                  } else if (msg.role === 'tool' && Array.isArray(msg.content)) {
                    const toolResult = msg.content.find((item) => item.type === 'tool-result');
                    if (toolResult) {
                      assistantMessage.toolInvocations = [
                        {
                          toolName: toolResult.toolName,
                          toolCallId: toolResult.toolCallId,
                          args: {},
                          result: toolResult.result,
                          state: 'result',
                          step: 0,
                        },
                      ];
                    }
                  }
                }

                // Save to database
                if (shouldSave) {
                  await saveChat({
                    userId,
                    messages: formattedMessages,
                  });
                }

                // Broadcast final messages to clients
                const userClients = clients.get(userId);
                if (userClients) {
                  formattedMessages.forEach((message) => {
                    userClients.forEach((handler) => handler(message));
                  });
                  console.log('Messages broadcast to clients');
                }

                dataStream.writeMessageAnnotation({ saved: true });
                resolve(accumulatedContent);
              } catch (error) {
                console.error('Error handling messages:', error);
                dataStream.writeMessageAnnotation({ saved: false, error: String(error) });
                throw error;
              }
            },
          });

          console.log('StreamText initialized, merging into dataStream');
          result.mergeIntoDataStream(dataStream);
        } catch (error) {
          console.error('Error in dataStream execution:', error);
          reject(error);
        }
      },
    });
  });
}
