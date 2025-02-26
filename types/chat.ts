import { Message, type Message as BaseMessage } from 'ai';

export interface StreamingMessage extends BaseMessage {
  streaming?: boolean;
}

export interface ChatProps {
  userId: string;
  initialMessages: Message[];
  isAuthenticated: boolean;
}

export type MessageContent = string | { type: 'text'; text: string }[] | { type: 'text'; text: string };
