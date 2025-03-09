'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
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
import { ChatProps, MessageContent } from '@/types/chat';

const UserMessage = memo(function UserMessage({
  message,
  renderMessageContent,
}: {
  message: Message;
  renderMessageContent: (content: MessageContent) => JSX.Element;
}) {
  return (
    <Card className="max-w-xl rounded-2xl rounded-br-sm bg-muted px-4 py-3 text-card-foreground [&_a:hover]:text-blue-600 [&_a]:text-blue-500 [&_a]:no-underline hover:[&_a]:underline [&_li]:my-0 [&_li]:leading-[normal] [&_li_p]:my-0 [&_ol+p]:mt-0 [&_ol]:my-0 [&_ol]:pl-0 [&_ol]:leading-[0] [&_ol_li]:my-0 [&_ol_li_p]:my-0 [&_p+ol]:mt-0 [&_p]:my-0 [&_ul]:pl-0 [&_ul]:leading-none">
      <div className="[&_p]:my-0">{renderMessageContent(message.content)}</div>
    </Card>
  );
});

const AIMessage = memo(function AIMessage({
  message,
  renderMessageContent,
}: {
  message: Message;
  renderMessageContent: (content: MessageContent) => JSX.Element;
  isLoading: boolean;
  isLastMessage: boolean;
}) {
  // If there's no content and no tool invocations, return null
  if (!message.content && (!message.toolInvocations || message.toolInvocations.length === 0)) {
    return null;
  }

  return (
    <>
      {message.content && (
        <Card className="max-w-xl rounded-2xl rounded-bl-sm bg-card px-4 py-3 [&_a:hover]:text-blue-600 [&_a]:text-blue-500 [&_a]:no-underline hover:[&_a]:underline [&_li]:my-0 [&_li]:leading-[normal] [&_li_p]:my-0 [&_ol+p]:mt-0 [&_ol]:my-0 [&_ol]:pl-0 [&_ol]:leading-[0] [&_ol_li]:my-0 [&_ol_li_p]:my-0 [&_p+ol]:mt-0 [&_p]:my-0 [&_ul]:pl-0 [&_ul]:leading-none">
          <div className="[&_p]:my-0">{renderMessageContent(message.content)}</div>
        </Card>
      )}

      {message.toolInvocations?.map((toolInvocation) => (
        <div
          key={toolInvocation.toolCallId}
          className="max-w-xl"
        >
          <ToolResponse toolInvocation={toolInvocation} />
        </div>
      ))}
    </>
  );
});

export function Chat({ userId, initialMessages, isAuthenticated }: ChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [visibleMessagesCount, setVisibleMessagesCount] = useState(50);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const getUniqueDisplayId = useCallback((message: Message, index: number) => {
    if (message.content && message.toolInvocations?.length) {
      return `${message.id}-content-${index}`;
    }
    return message.id;
  }, []);

  const { messages, setMessages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    id: userId,
    initialMessages,
    generateId: createIdGenerator({
      prefix: 'user',
      size: 32,
    }),
    sendExtraMessageFields: true,
  });

  const loadMoreMessages = useCallback(() => {
    setVisibleMessagesCount((prev) => prev + 2);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setVisibleMessagesCount(50);
  }, [setMessages]);

  const isWaitingForResponse = useCallback(() => {
    if (!messages.length) return false;
    const lastMessage = messages[messages.length - 1];

    // Debug logging
    console.log('Checking waiting state:', {
      messageId: lastMessage.id,
      role: lastMessage.role,
      hasContent: !!lastMessage.content,
      toolInvocations: lastMessage.toolInvocations,
      timestamp: new Date().toISOString(),
    });

    // If the last message is from the user, we're waiting for a response
    if (lastMessage.role === 'user') {
      return true;
    }

    // For assistant messages, we're waiting if:
    // 1. There's no content yet, regardless of tool invocation state
    if (lastMessage.role === 'assistant') {
      const hasContent = !!lastMessage.content;

      // More detailed logging
      console.log('Assistant message state:', {
        hasContent,
        hasToolInvocationsInProgress: lastMessage.toolInvocations?.some((tool) => tool.state === 'partial-call' || tool.state === 'call'),
        toolStates: lastMessage.toolInvocations?.map((t) => t.state),
        isWaiting: !hasContent,
        timestamp: new Date().toISOString(),
      });

      // Show typing indicator as long as there's no content yet
      return !hasContent;
    }

    return false;
  }, [messages]);

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
  }, [messages, scrollToBottom]);

  // useEffect(() => {
  //   console.log('Chat State:', {
  //     messagesCount: messages.length,
  //     hasInput: !!input,
  //     isLoading,
  //     isAuthenticated,
  //   });
  // }, [messages.length, input, isLoading, isAuthenticated]);

  const renderMessageContent = useCallback((content: MessageContent) => {
    return <MarkdownContent content={content} />;
  }, []);

  const renderMessage = useCallback(
    (message: Message) => {
      const isUserMessage = message.role === 'user';
      const isLastMessage = message === messages[messages.length - 1];

      // For user messages
      if (isUserMessage) {
        return (
          <div className="flex flex-col items-end">
            <UserMessage
              message={message}
              renderMessageContent={renderMessageContent}
            />
          </div>
        );
      }

      // For assistant messages
      if (!isUserMessage) {
        // Show typing indicator when:
        // 1. It's the last message AND
        // 2. We're waiting for a response (which now means no content yet)
        if (isLastMessage && isWaitingForResponse()) {
          return (
            <div className="flex flex-col items-start">
              <Card className="max-w-xl rounded-2xl rounded-tl-sm bg-card px-5 py-4">
                <TypingIndicator />
              </Card>
            </div>
          );
        }

        // Skip empty messages that aren't waiting
        if (!message.content && (!message.toolInvocations || message.toolInvocations.length === 0)) {
          return null;
        }

        // Normal message with content
        return (
          <div className="flex flex-col items-start">
            <AIMessage
              message={message}
              renderMessageContent={renderMessageContent}
              isLoading={isLoading}
              isLastMessage={isLastMessage}
            />
          </div>
        );
      }

      return null; // Shouldn't reach here
    },
    [messages, isLoading, renderMessageContent, isWaitingForResponse]
  );

  const uniqueMessages = useMemo(
    () =>
      messages
        .reduce((unique: Message[], message, index) => {
          const lastIndex = messages.findLastIndex((m) => m.id === message.id);
          if (index === lastIndex) {
            unique.push(message);
          }
          return unique;
        }, [])
        .slice(-visibleMessagesCount),
    [messages, visibleMessagesCount]
  );

  const ChatHeader = useMemo(
    () => (
      <div className="mb-4 flex justify-between">
        <WelcomeCard />
        {messages.length > 0 && (
          <Button
            onClick={clearMessages}
            variant="ghost"
            className="text-red-500 hover:text-red-700"
          >
            Clear Chat
          </Button>
        )}
      </div>
    ),
    [messages.length, clearMessages]
  );

  const ChatInput = useMemo(
    () => (
      <div className="fixed inset-x-0 bottom-10 w-full px-4 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <Card className="border shadow-sm">
            <form
              onSubmit={handleSubmit}
              className="flex items-center p-2"
            >
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder="Type your message here..."
                className="mr-3 flex-1 border-0 bg-transparent focus-visible:ring-0"
                disabled={isLoading || !isAuthenticated}
              />
              <Button
                type="submit"
                disabled={!input.trim() || isLoading || !isAuthenticated}
                className="h-9 w-9 rounded-full p-0"
                aria-label="Send message"
              >
                <IconArrowUp className="h-4 w-4" />
              </Button>
            </form>
          </Card>
        </div>
      </div>
    ),
    [input, handleSubmit, handleInputChange, isLoading, isAuthenticated]
  );

  return (
    <div className="relative flex h-[calc(100vh_-_theme(spacing.16))] flex-col overflow-hidden pb-10">
      <div className="group w-full overflow-auto">
        <div className="mx-auto mb-24 mt-10 max-w-3xl pl-2">
          {ChatHeader}

          {messages.length > visibleMessagesCount && (
            <Button
              onClick={loadMoreMessages}
              variant="outline"
              className="mb-4 w-full"
            >
              Load Previous Messages
            </Button>
          )}

          <div className="space-y-10">
            {uniqueMessages.map((message, index) => {
              const renderedMessage = renderMessage(message);
              if (!renderedMessage) return null;

              return (
                <div
                  key={getUniqueDisplayId(message, index)}
                  className={`flex whitespace-pre-wrap ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {renderedMessage}
                </div>
              );
            })}
          </div>

          {/* Show typing indicator when the last message is from user */}
          {messages.length > 0 && messages[messages.length - 1].role === 'user' && isWaitingForResponse() && (
            <div className="mt-10 flex justify-start">
              <Card className="max-w-xl rounded-2xl rounded-tl-sm bg-card px-5 py-4">
                <TypingIndicator />
              </Card>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {ChatInput}
    </div>
  );
}
