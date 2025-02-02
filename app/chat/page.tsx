import { AuthGuard } from '@/components/AuthGuard';

export default async function ChatPage() {

  return (
    <AuthGuard>
      <div>Hello</div>
    </AuthGuard>
  );
}
