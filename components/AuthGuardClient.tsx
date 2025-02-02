'use client';

import { useEffect, useState } from 'react';
import { Brain, TrendUp, Shuffle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { ConnectWallet } from './ConnectWallet';

export function AuthGuardClient({ children, initialAuth }: { children: React.ReactNode; initialAuth: boolean }) {
  const { isAuthenticated, setIsAuthenticated, signIn, isConnected, isConnecting } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isConnecting && initialAuth && isConnected) {
      setIsAuthenticated(true);
    }
    if (!isConnecting) {
      setIsLoading(false);
    }
  }, [initialAuth, isConnected, setIsAuthenticated, isConnecting]);

  if (isLoading || isConnecting) {
    return (
      <div className="flex h-[calc(100vh_-_theme(spacing.16))] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white"></div>
      </div>
    );
  }

  if (!isConnected || !isAuthenticated) {
    const isConnectStep = !isConnected;

    return (
      <div className="flex min-h-[calc(100vh_-_theme(spacing.16))] flex-col items-center justify-start p-6 pt-20">
        <div className="w-full max-w-6xl">
          {/* Welcome section */}
          <div className="mb-16 text-center">
            <h1 className="mb-2 text-4xl font-bold">AI Trading Assistant</h1>
            <p className="text-muted-foreground">{isConnectStep ? 'Welcome back, connect your wallet to continue' : 'One last step - verify your wallet to start trading'}</p>
          </div>

          {/* Features grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <Card className="p-6 bg-card/50 backdrop-blur">
              <div className="flex flex-col items-center text-center">
                <Brain className="w-12 h-12 mb-4 text-primary" />
                <h2 className="text-xl font-semibold mb-2">Market Intelligence</h2>
                <p className="text-muted-foreground">Real-time analytics and insights across multiple blockchain networks</p>
              </div>
            </Card>

            <Card className="p-6 bg-card/50 backdrop-blur">
              <div className="flex flex-col items-center text-center">
                <TrendUp className="w-20 h-12 mb-4 text-primary" />
                <h2 className="text-xl font-semibold mb-2">Smart Trading</h2>
                <p className="text-muted-foreground">Execute trades and set limit orders through intuitive chat commands</p>
              </div>
            </Card>

            <Card className="p-6 bg-card/50 backdrop-blur">
              <div className="flex flex-col items-center text-center">
                <Shuffle className="w-12 h-12 mb-4 text-primary" />
                <h2 className="text-xl font-semibold mb-2">Cross-Chain Operations</h2>
                <p className="text-muted-foreground">Seamlessly transfer assets between networks with AI-powered assistance</p>
              </div>
            </Card>
          </div>
          {/* Action section */}
          <div className="flex flex-col items-center">
            <h2 className="mb-6 text-2xl font-semibold">{isConnectStep ? 'Connect Wallet' : 'Sign in'} to Start Trading</h2>
            {error && <p className="mb-4 text-center text-destructive">{error}</p>}
            {isConnectStep ? (
              <ConnectWallet />
            ) : (
              <Button
                onClick={async () => {
                  try {
                    setError(null);
                    await signIn();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Verification failed');
                  }
                }}
                size="lg"
                  className="max-w-48"

              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
