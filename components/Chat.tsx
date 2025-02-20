'use client';

import { useEffect, useRef } from 'react';
import { createIdGenerator } from 'ai';
import { Message, useChat } from 'ai/react';
import { MarkdownContent } from '@/components/MarkdownContent';
import { ToolResponse } from '@/components/ToolResponse';
import { TypingIndicator } from '@/components/TypingIndicator';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconArrowUp } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import WelcomeCard from '@/components/WelcomeCard';

interface ChatProps {
  userId: string;
  initialMessages: Message[];
  isAuthenticated: boolean;
}

type MessageContent = string | { type: 'text'; text: string }[] | { type: 'text'; text: string };

export function Chat({ userId, initialMessages, isAuthenticated }: ChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getUniqueDisplayId = (message: Message, index: number) => {
    if (message.content && message.toolInvocations?.length) {
      // If message has both content and tool invocations, make the content ID unique
      return `${message.id}-content-${index}`;
    }
    return message.id;
  };

  // Main chat stream
  const { messages, setMessages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    id: userId,
    initialMessages,
    generateId: createIdGenerator({
      prefix: 'user',
      size: 32,
    }),
    sendExtraMessageFields: true,
  });

  // Updates stream
  useEffect(() => {
    let eventSource: EventSource;

    const connectSSE = () => {
      console.log('Connecting to SSE...');
      eventSource = new EventSource('/api/updates');

      eventSource.onopen = () => {
        console.log('SSE connection opened');
      };

      eventSource.onmessage = (event) => {
        console.log('SSE message received:', event.data);
        const data = JSON.parse(event.data);
        if (data.messages) {
          setMessages((prevMessages) => {
            const [newMessage] = data.messages;

            // Handle streaming updates
            if (newMessage.streaming) {
              const existingIndex = prevMessages.findIndex((msg) => msg.id === newMessage.id);

              if (existingIndex !== -1) {
                // Update existing message
                const updatedMessages = [...prevMessages];
                updatedMessages[existingIndex] = {
                  ...updatedMessages[existingIndex],
                  ...newMessage,
                  // Preserve any existing tool invocations
                  toolInvocations: updatedMessages[existingIndex].toolInvocations,
                };
                return updatedMessages;
              } else {
                // Add as new message
                return [...prevMessages, newMessage];
              }
            }

            // For non-streaming messages (e.g., tool results)
            return [...prevMessages, ...data.messages];
          });
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        eventSource.close();
        setTimeout(connectSSE, 1000);
      };
    };

    connectSSE();

    return () => {
      console.log('Cleaning up SSE connection...');
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [setMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  console.log('Chat State:', {
    messagesCount: messages.length,
    hasInput: !!input,
    isLoading,
    isAuthenticated,
  });

  const renderMessageContent = (content: MessageContent) => {
    return <MarkdownContent content={content} />;
  };

  function renderMessage(message: Message) {
    const isUserMessage = message.role === 'user';
    const isLastMessage = message === messages[messages.length - 1];

    const showTypingIndicator =
      isLoading &&
      isLastMessage &&
      !isUserMessage &&
      !message.content &&
      (!message.toolInvocations || message.toolInvocations.length === 0);

    return (
      <div className={`flex flex-col gap-2 ${isUserMessage ? 'items-end' : 'items-start'}`}>
        {/* Main message bubble */}
        {message.content && (
          <Card
            className={`${
              isUserMessage ? 'rounded-2xl rounded-tr-sm bg-muted text-card-foreground' : 'rounded-2xl rounded-tl-sm bg-card'
            } max-w-xl px-4 py-3 [&_a:hover]:text-blue-600 [&_a]:text-blue-500 [&_a]:no-underline hover:[&_a]:underline [&_li]:my-0 [&_li]:leading-[normal] [&_li_p]:my-0 [&_ol+p]:mt-0 [&_ol]:my-0 [&_ol]:pl-0 [&_ol]:leading-[0] [&_ol_li]:my-0 [&_ol_li_p]:my-0 [&_p+ol]:mt-0 [&_p]:my-0 [&_ul]:pl-0 [&_ul]:leading-none`}
          >
            <div className="[&_p]:my-0">{renderMessageContent(message.content)}</div>
          </Card>
        )}

        {/* Tool responses section */}
        {message.toolInvocations?.map((toolInvocation) => (
          <div
            key={toolInvocation.toolCallId}
            className="max-w-xl"
          >
            <ToolResponse toolInvocation={toolInvocation} />
          </div>
        ))}
        {showTypingIndicator && <TypingIndicator />}
      </div>
    );
  }

  return (
    <div className="relative flex h-[calc(100vh_-_theme(spacing.16))] flex-col overflow-hidden pb-10">
      <div className="group w-full overflow-auto">
        <div className="mx-auto mb-24 mt-10 max-w-3xl pl-2">
          <WelcomeCard />

          {messages
            .reduce((unique: Message[], message, index) => {
              // Find the last occurrence of this message ID
              const lastIndex = messages.findLastIndex((m) => m.id === message.id);
              // Only keep the message if this is its last occurrence
              if (index === lastIndex) {
                unique.push(message);
              }
              return unique;
            }, [])
            .map((message, index) => (
              <div
                key={getUniqueDisplayId(message, index)}
                className={`mb-10 flex whitespace-pre-wrap ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {renderMessage(message)}
              </div>
            ))}

          {/* Add typing indicator when waiting for first response */}
          {isLoading && (messages.length === 0 || messages[messages.length - 1].role === 'user') && (
            <div className="mb-10 flex justify-start">
              <TypingIndicator />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-10 w-full pr-2">
        <div className="mx-auto w-full max-w-3xl">
          <Card className="p-2">
            <form
              onSubmit={handleSubmit}
              className="flex"
            >
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder="Ask me anything..."
                className="focus-visible:ring-none mr-2 w-[95%] border-0 border-transparent ring-0 ring-offset-0 focus:border-transparent focus:outline-none focus:ring-0 focus-visible:border-none focus-visible:outline-none focus-visible:ring-0"
              />
              <Button
                type="submit"
                disabled={!input.trim() || isLoading || !isAuthenticated}
              >
                <IconArrowUp />
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
