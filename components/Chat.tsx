'use client';

import { createIdGenerator } from 'ai';
import { Message, useChat } from 'ai/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconArrowUp } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import WelcomeCard from '@/components/WelcomeCard';
import { Swap } from './Swap';

interface ChatProps {
  userId: string;
  initialMessages: Message[];
  isAuthenticated: boolean;
}

type MessageContent = string | { type: 'text'; text: string }[] | { type: 'text'; text: string };

export function Chat({ userId, initialMessages, isAuthenticated }: ChatProps) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    id: userId,
    initialMessages,
    generateId: createIdGenerator({
      prefix: 'user',
      size: 32,
    }),
    sendExtraMessageFields: true,
  });

  console.log('Chat State:', {
    messagesCount: messages.length,
    hasInput: !!input,
    isLoading,
    isAuthenticated,
  });

  // Helper function to render message content
  const renderMessageContent = (content: MessageContent) => {
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item.type === 'text') return item.text;
          return null;
        })
        .filter(Boolean)
        .join(' ');
    }
    if (content?.type === 'text') {
      return content.text;
    }
    return JSON.stringify(content);
  };

  return (
    <div className="relative flex h-[calc(100vh_-_theme(spacing.16))] flex-col overflow-hidden pb-10">
      <div className="group w-full overflow-auto">
        <div className="mx-auto mb-24 mt-10 max-w-3xl pl-2">
          <WelcomeCard />

          {messages.map((message) => (
            <div key={message.id} className="mb-10 flex whitespace-pre-wrap">
              <Card className={`${message.role === 'user' ? 'ml-auto max-w-xl rounded-2xl rounded-tr-none bg-muted text-card-foreground' : 'max-w-xl rounded-2xl rounded-tl-none bg-card'} px-4 py-2`}>
                <div>{renderMessageContent(message.content)}</div>

                {message.toolInvocations?.map((toolInvocation) => {
                  const { toolName, toolCallId, state, args } = toolInvocation;

                  if (state === 'result' && toolInvocation.result) {
                    if (toolName === 'showSwap') {
                      return (
                        <div key={toolCallId}>
                          <Swap {...args} data={toolInvocation.result.result.data} />
                        </div>
                      );
                    }
                  } else {
                    return <div key={toolCallId}>{toolName === 'showSwap' ? <div>Setting up swap interface...</div> : null}</div>;
                  }
                })}
              </Card>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-10 w-full pr-2">
        <div className="mx-auto w-full max-w-3xl">
          <Card className="p-2">
            <form onSubmit={handleSubmit} className="flex">
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder="Ask me anything..."
                className="focus-visible:ring-none mr-2 w-[95%] border-0 border-transparent ring-0 ring-offset-0 focus:border-transparent focus:outline-none focus:ring-0 focus-visible:border-none focus-visible:outline-none focus-visible:ring-0"
              />
              <Button type="submit" disabled={!input.trim() || isLoading || !isAuthenticated}>
                <IconArrowUp />
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
