import { Message } from 'ai';
import { checkAuth } from '@/app/actions/auth';
import { clients } from '@/utils/update-stream';

export async function GET(req: Request) {
  const session = await checkAuth();
  if (!session?.userId) {
    return new Response('Not authenticated', { status: 401 });
  }

  const userId = session.userId;
  console.log('New SSE connection request for userId:', userId);
  console.log('Current clients before connection:', clients);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const handler = (message: Message) => {
        const data = JSON.stringify({ messages: [message] });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      if (!clients.has(userId)) {
        clients.set(userId, new Set());
        console.log('Created new client Set for userId:', userId);
      }
      clients.get(userId)?.add(handler);
      console.log('Added handler for userId:', userId);
      console.log('Current clients after connection:', clients);

      req.signal.addEventListener('abort', () => {
        console.log('Client disconnected for userId:', userId);
        clients.get(userId)?.delete(handler);
        if (clients.get(userId)?.size === 0) {
          clients.delete(userId);
          console.log('Removed empty client Set for userId:', userId);
        }
        console.log('Current clients after disconnection:', clients);
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
