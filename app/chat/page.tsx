import { cookies } from 'next/headers';
import { AuthGuard } from '@/components/AuthGuard';
import { Chat } from '@/components/Chat';
import { loadChat } from '@/utils/chat-store';
import { verifySession } from '@/utils/session';

export default async function ChatPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('user_session');

  if (!session) {
    return <AuthGuard />;
  }

  try {
    const { valid, data } = await verifySession(session.value);

    if (!valid || !data?.userId) {
      return <AuthGuard />;
    }

    const userId = data.userId;
    const messages = await loadChat(userId);

    return (
      <AuthGuard>
        <Chat
          userId={userId}
          initialMessages={messages}
          isAuthenticated={true}
        />
      </AuthGuard>
    );
  } catch (error) {
    console.error('Error in ChatPage:', error);
    return <AuthGuard />;
  }
}
