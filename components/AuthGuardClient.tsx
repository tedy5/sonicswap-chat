'use client';

import { useEffect, useState } from 'react';
import { Brain, Shuffle, TrendUp } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { AuthPageProps } from '@/types/chat';
import { ConnectWallet } from './ConnectWallet';

function SignatureLoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <Card className="max-w-md bg-card p-6 backdrop-blur">
        <div className="flex flex-col items-center text-center">
          <h3 className="text-xl font-semibold">Waiting for signature</h3>
          <p className="mt-2 text-muted-foreground">
            Please check your wallet and sign the message to verify your identity. This won&apos;t cost any gas fees or initiate
            transactions.
          </p>
          <div className="mt-6">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function AuthPage({ isConnectStep, error, signIn, setError }: AuthPageProps) {
  return (
    <div className="flex min-h-[calc(100vh_-_theme(spacing.16))] flex-col items-center justify-start p-6 pt-20">
      <div className="w-full max-w-6xl">
        {/* Welcome section */}
        <div className="mb-16 text-center">
          <h1 className="mb-2 text-4xl font-bold">AI Trading Assistant</h1>
          <p className="text-muted-foreground">
            {isConnectStep ? 'Welcome, connect your wallet to continue' : 'One last step - verify your wallet to start trading'}
          </p>
        </div>

        {/* Features grid */}
        <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card className="bg-card/50 p-6 backdrop-blur transition-colors hover:bg-card/70">
            <div className="flex flex-col items-center text-center">
              <Brain className="mb-4 h-12 w-12 text-primary" />
              <h2 className="mb-2 text-xl font-semibold">Market Analysis</h2>
              <p className="text-muted-foreground">Real-time analytics and insights on the Sonic Network blockchain</p>
            </div>
          </Card>

          <Card className="bg-card/50 p-6 backdrop-blur transition-colors hover:bg-card/70">
            <div className="flex flex-col items-center text-center">
              <TrendUp className="mb-4 h-12 w-12 text-primary" />
              <h2 className="mb-2 text-xl font-semibold">Smart Trading</h2>
              <p className="text-muted-foreground">Execute trades, set limit orders, and deploy strategies using natural language</p>
            </div>
          </Card>

          <Card className="bg-card/50 p-6 backdrop-blur transition-colors hover:bg-card/70">
            <div className="flex flex-col items-center text-center">
              <Shuffle className="mb-4 h-12 w-12 text-primary" />
              <h2 className="mb-2 text-xl font-semibold">Cross-Chain Operations</h2>
              <p className="text-muted-foreground">Seamlessly bridge assets between Sonic Network and other blockchains</p>
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

export function AuthGuardClient({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, signIn, isConnected, isConnecting, isLoading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasCompletedAuth, setHasCompletedAuth] = useState(false);

  useEffect(() => {
    // Only set initializing to false when we've determined the initial auth state
    if (!isConnecting && !authLoading) {
      // Add a small delay to prevent flashing states
      const timer = setTimeout(() => {
        setIsInitializing(false);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isConnecting, authLoading]);

  // Track when authentication is fully completed
  useEffect(() => {
    if (isAuthenticated && isConnected && !isInitializing) {
      // Add a small delay to ensure stability
      const timer = setTimeout(() => {
        setHasCompletedAuth(true);
      }, 200);

      return () => clearTimeout(timer);
    } else if (!isAuthenticated || !isConnected) {
      setHasCompletedAuth(false);
    }
  }, [isAuthenticated, isConnected, isInitializing]);

  // Modified signIn function that tracks signing state
  const handleSignIn = async () => {
    try {
      setError(null);
      setIsSigning(true);
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsSigning(false);
    }
  };

  // Show nothing during initial load to prevent flashing
  if (isInitializing) {
    return null;
  }

  // Only show authenticated content when we're sure authentication is complete
  if (!isConnected || !isAuthenticated || !hasCompletedAuth) {
    const isConnectStep = !isConnected;

    return (
      <>
        <AuthPage
          isConnectStep={isConnectStep}
          error={error}
          signIn={handleSignIn}
          setError={setError}
        />
        {isSigning && <SignatureLoadingOverlay />}
      </>
    );
  }

  return <>{children}</>;
}
