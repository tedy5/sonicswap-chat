'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAccount, useSignMessage } from 'wagmi';
import {
  autoAuthenticateAddress,
  checkAddressHasSession,
  checkAuth,
  signOut as serverSignOut,
  verifySignature,
} from '@/app/actions/auth';

export function useAuth() {
  const { address, isConnected, isConnecting } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authenticatedAddress, setAuthenticatedAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      if (!isConnected) {
        setIsAuthenticated(false);
        setAuthenticatedAddress(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const authData = await checkAuth();

        if (authData) {
          setIsAuthenticated(true);
          setAuthenticatedAddress(authData.address);

          if (address && authData.address !== address) {
            const hasSession = await checkAddressHasSession(address);

            if (hasSession) {
              const result = await autoAuthenticateAddress(address);

              if (result.success) {
                setIsAuthenticated(true);
                setAuthenticatedAddress(address);
                toast.success('Automatically signed in with connected wallet');
              } else {
                setIsAuthenticated(false);
                toast.info('Wallet address changed. Please sign in again.');
              }
            } else {
              setIsAuthenticated(false);
              toast.info('Wallet address changed. Please sign in again.');
            }
          }
        } else {
          if (address) {
            const hasSession = await checkAddressHasSession(address);

            if (hasSession) {
              const result = await autoAuthenticateAddress(address);

              if (result.success) {
                setIsAuthenticated(true);
                setAuthenticatedAddress(address);
                toast.success('Automatically signed in with connected wallet');
              } else {
                setIsAuthenticated(false);
                setAuthenticatedAddress(null);
              }
            } else {
              setIsAuthenticated(false);
              setAuthenticatedAddress(null);
            }
          }
        }
      } catch (error) {
        setIsAuthenticated(false);
        setAuthenticatedAddress(null);
      } finally {
        setIsLoading(false);
      }
    };

    verifyAuth();
  }, [isConnected, address]);

  const signIn = async () => {
    if (!address) {
      return;
    }

    try {
      setIsLoading(true);

      // Simple message for the user to sign
      const message = `Sign this message to login to the app.

Address:
${address}`;

      // User signs this simple message
      const signature = await signMessageAsync({
        message: message,
      });

      // Send to server for verification
      await verifySignature(message, signature);

      setIsAuthenticated(true);
      setAuthenticatedAddress(address);
      toast.success('Successfully signed in');
    } catch (error) {
      setIsAuthenticated(false);
      setAuthenticatedAddress(null);
      toast.error('Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await serverSignOut();
    } catch (error) {
      // Error handling is silent
    }

    setIsAuthenticated(false);
    setAuthenticatedAddress(null);
    toast.success('Signed out successfully');
  };

  return {
    isAuthenticated,
    isLoading,
    authenticatedAddress,
    signIn,
    signOut,
    isConnected,
    isConnecting,
    currentAddress: address,
  };
}
