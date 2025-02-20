import { Message } from 'ai';
import { checkAuth } from '@/app/actions/auth';
import { clients } from '@/utils/update-stream';

export async function GET(req: Request) {
  const session = await checkAuth();
  if (!session?.userId) {
    return new Response('Not authenticated', { status: 401 });
  }

  const userId = session.userId;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const handler = (message: Message & { streaming?: boolean }) => {
        // Wrap the message in a messages array and preserve the streaming flag
        const data = JSON.stringify({
          messages: [
            {
              ...message,
              // Keep the streaming flag if it exists
              streaming: message.streaming,
            },
          ],
        });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      if (!clients.has(userId)) {
        clients.set(userId, new Set());
      }
      clients.get(userId)?.add(handler);

      req.signal.addEventListener('abort', () => {
        clients.get(userId)?.delete(handler);
        if (clients.get(userId)?.size === 0) {
          clients.delete(userId);
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
