'use client';

import { useEffect, useState } from 'react';
import { SiweMessage } from 'siwe';
import { toast } from 'sonner';
import { useAccount, useSignMessage } from 'wagmi';
import { getNonce, verifySignature } from '@/app/actions/auth';

export function useAuth() {
  const { address, isConnected, isConnecting } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (!isConnected) {
      setIsAuthenticated(false);
    }
  }, [isConnected]);

  const signIn = async () => {
    try {
      const nonce = await getNonce();

      const message = new SiweMessage({
        domain: window.location.host,
        address: address,
        statement:
          'Sign-in with Ethereum. This is not a transaction and does not give SonicSwap or anyone else permission to send transactions or interact with your assets.',
        uri: window.location.origin,
        version: '1',
        chainId: 146,
        nonce,
      });

      const preparedMessage = message.prepareMessage();
      const signature = await signMessageAsync({
        message: preparedMessage,
      });

      await verifySignature(JSON.stringify(message), signature);

      setIsAuthenticated(true);
      toast.success('Successfully signed in');
    } catch (error) {
      setIsAuthenticated(false);
      toast.error('Failed to sign in');
    }
  };

  return {
    isAuthenticated,
    setIsAuthenticated,
    signIn,
    isConnected,
    isConnecting,
  };
}
