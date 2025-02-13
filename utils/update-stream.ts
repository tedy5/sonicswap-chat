import { openai } from '@ai-sdk/openai';
import { createDataStreamResponse, createIdGenerator, Message, streamText } from 'ai';
import { loadChat, saveChat } from '@/utils/chat-store';

const MAX_CONTEXT_MESSAGES = 10;

export const clients = new Map<string, Set<(message: Message) => void>>();

const generateMessageId = createIdGenerator({
  prefix: 'system',
  size: 32,
});

export async function sendStreamUpdate(userId: string, context: string) {
  console.log('Attempting to send update for userId:', userId);
  console.log('Current clients:', clients);
  console.log('Context:', context);

  const existingMessages = await loadChat(userId);
  const contextMessages = existingMessages.slice(-MAX_CONTEXT_MESSAGES).map((msg) => ({
    role: msg.role as 'system' | 'user' | 'assistant',
    content: msg.content,
  }));

  console.log('Previous context messages:', JSON.stringify(contextMessages, null, 2));

  const messages = [
    {
      role: 'system' as const,
      content: `You are a helpful AI assistant, helping users to bridge tokens, trade, etc.
                Respond naturally about transaction status updates.
                Keep responses concise and friendly.
                If links are provided, display each on a new line with hover text.
                Vary your emoji usage and phrasing based on the conversation history.
                Important: Review the previous messages to ensure your response style differs from your last response.`,
    },
    ...contextMessages,
    {
      role: 'user' as const,
      content: `Transaction Update: ${context}`,
    },
  ];

  console.log('Final messages being sent to AI:', JSON.stringify(messages, null, 2));

  return createDataStreamResponse({
    execute: async (dataStream) => {
      try {
        const result = streamText({
          model: openai('gpt-4o'),
          messages,
          experimental_generateMessageId: generateMessageId,
          onFinish: async (event) => {
            try {
              // Format messages
              const formattedMessages = event.response.messages.map((msg) => ({
                id: msg.id,
                content:
                  typeof msg.content === 'string'
                    ? msg.content
                    : msg.content.map((part) => ('text' in part ? part.text : JSON.stringify(part))).join(''),
                role: msg.role === 'tool' ? 'assistant' : msg.role,
                createdAt: new Date(),
              }));

              // Save to database
              await saveChat({
                userId,
                messages: formattedMessages,
              });
              console.log('Messages saved to database');

              // Broadcast to clients
              const userClients = clients.get(userId);
              console.log('Found clients for userId:', userId, !!userClients);
              if (userClients) {
                formattedMessages.forEach((message) => {
                  userClients.forEach((handler) => handler(message));
                });
                console.log('Messages broadcast to clients');
              }

              dataStream.writeMessageAnnotation({ saved: true });
            } catch (error) {
              console.error('Error handling messages:', error);
              dataStream.writeMessageAnnotation({ saved: false, error: String(error) });
              throw error;
            }
          },
        });

        console.log('StreamText initialized, merging into dataStream');
        // console.log(result)
        result.mergeIntoDataStream(dataStream);
        console.log('DataStream merge completed');
      } catch (error) {
        console.error('Error in dataStream execution:', error);
        throw error;
      }
    },
  });
}
