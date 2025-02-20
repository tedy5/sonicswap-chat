import { openai } from '@ai-sdk/openai';
import { createDataStreamResponse, createIdGenerator, smoothStream, streamText } from 'ai';
import { UPDATE_STREAM_PROMPT } from '@/config/update-prompts';
import { tokenTools } from '@/tools/token-tools';
import { type StreamingMessage } from '@/types/chat';
import { loadChat, saveChat } from '@/utils/chat-store';

const MAX_CONTEXT_MESSAGES = 10;

export const clients = new Map<string, Set<(message: StreamingMessage) => void>>();

const generateMessageId = createIdGenerator({
  prefix: 'stream',
  size: 32,
});

export async function sendStreamUpdate(userId: string, context: string, shouldSave: boolean = true) {
  console.log('Attempting to send update for userId:', userId);
  const userClients = clients.get(userId);
  console.log('Current clients for userId:', userId, userClients ? userClients.size : 0);

  const existingMessages = await loadChat(userId);
  const contextMessages = existingMessages.slice(-MAX_CONTEXT_MESSAGES).map((msg) => ({
    role: msg.role as 'system' | 'user' | 'assistant',
    content: msg.content,
  }));

  // Create a promise that will resolve when the message is saved
  return new Promise((resolve, reject) => {
    createDataStreamResponse({
      execute: async (dataStream) => {
        try {
          // Generate a single messageId for the entire stream
          const streamMessageId = generateMessageId();
          let accumulatedContent = ''; // Track accumulated content
          const result = streamText({
            model: openai('gpt-4o'),
            experimental_transform: smoothStream(),
            messages: [
              {
                role: 'system' as const,
                content: UPDATE_STREAM_PROMPT,
              },
              ...contextMessages,
              {
                role: 'system' as const,
                content: `${context}`,
              },
            ],
            tools: {
              ...tokenTools,
            },
            experimental_generateMessageId: generateMessageId,
            onChunk: async (event) => {
              const currentClients = clients.get(userId);
              if (currentClients && 'chunk' in event) {
                const chunk = event.chunk;
                if ('textDelta' in chunk && (chunk.type === 'text-delta' || chunk.type === 'reasoning')) {
                  accumulatedContent += chunk.textDelta;
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
            },

            onFinish: async (event) => {
              try {
                console.log('Raw messages:', JSON.stringify(event.response.messages, null, 2));

                const formattedMessages: StreamingMessage[] = [];

                for (const msg of event.response.messages) {
                  if (msg.role === 'assistant') {
                    const message: StreamingMessage = {
                      id: streamMessageId,
                      role: 'assistant',
                      content: accumulatedContent,
                      createdAt: new Date(),
                    };

                    // Handle tool calls if present
                    if (Array.isArray(msg.content)) {
                      const toolCall = msg.content.find((item) => item.type === 'tool-call');
                      if (toolCall) {
                        message.toolInvocations = [
                          {
                            toolName: toolCall.toolName,
                            toolCallId: toolCall.toolCallId,
                            args: toolCall.args,
                            state: 'call',
                            step: 0,
                          },
                        ];
                      }
                    }
                    formattedMessages.push(message);
                  } else if (msg.role === 'tool') {
                    // Find the last assistant message and update it with the tool result
                    const lastMessage = formattedMessages[formattedMessages.length - 1];
                    if (lastMessage && lastMessage.role === 'assistant' && Array.isArray(msg.content)) {
                      const toolResult = msg.content.find((item) => item.type === 'tool-result');
                      if (toolResult) {
                        lastMessage.toolInvocations = [
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
                }

                // console.log('Formatted messages:', JSON.stringify(formattedMessages, null, 2));

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
                // console.log('Adding 5 second delay before resolving...');
                // await new Promise(r => setTimeout(r, 5000)); // 5 second delay
                // console.log('Delay complete, resolving now');
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
          console.log('DataStream merge completed');
        } catch (error) {
          console.error('Error in dataStream execution:', error);
          reject(error);
        }
      },
    });
  });
}
