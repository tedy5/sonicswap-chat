import { type Message as BaseMessage } from 'ai';

export interface StreamingMessage extends BaseMessage {
  streaming?: boolean;
}
