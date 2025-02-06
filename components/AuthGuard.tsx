import { cookies } from 'next/headers';
import { AuthGuardClient } from './AuthGuardClient';

export async function AuthGuard({ children = <div /> }: { children?: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = cookieStore.get('user_session');
  const initialAuth = !!session;

  return <AuthGuardClient initialAuth={initialAuth}>{children}</AuthGuardClient>;
}
