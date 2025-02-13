import { Message } from 'ai';
import { supabase } from '@/supabase/server';

export async function loadChat(userId: string): Promise<Message[]> {
  const { data: messages, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return messages.map(
    (msg): Message => ({
      id: msg.id,
      content: msg.content,
      role: msg.role,
      createdAt: new Date(msg.created_at),
      toolInvocations: msg.tool_invocations,
    })
  );
}

export async function saveChat({ userId, messages }: { userId: string; messages: Message[] }): Promise<void> {
  const { error } = await supabase.from('chat_messages').upsert(
    messages.map((msg) => ({
      id: msg.id,
      user_id: userId,
      content: msg.content,
      role: msg.role,
      created_at: msg.createdAt,
      tool_invocations: msg.toolInvocations || null,
    }))
  );

  if (error) {
    console.error('Error saving messages:', error);
    throw error;
  }
}
