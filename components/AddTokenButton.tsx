'use client';

import { useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAccount, useSwitchChain } from 'wagmi';
import { Button } from '@/components/ui/button';
import { getChainName } from '@/utils/chains';

interface AddTokenButtonProps {
  chainId: number;
  tokenAddress: `0x${string}`;
  tokenSymbol: string;
  tokenDecimals?: number;
  tokenImage?: string;
  message?: string;
}

export function AddTokenButton({ chainId, tokenAddress, tokenSymbol, tokenDecimals = 18, tokenImage, message }: AddTokenButtonProps) {
  const { chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const [isPending, setIsPending] = useState(false);

  const isTargetChain = chain?.id === chainId;

  const handleAddToken = useCallback(async () => {
    try {
      setIsPending(true);
      await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: tokenAddress,
            symbol: tokenSymbol,
            decimals: tokenDecimals,
            image: tokenImage,
          },
        },
      });
    } catch (error) {
      console.error('Error adding token to wallet:', error);
    } finally {
      setIsPending(false);
    }
  }, [tokenAddress, tokenSymbol, tokenDecimals, tokenImage]);

  const handleClick = () => {
    if (!isTargetChain && switchChain) {
      switchChain({ chainId });
      return;
    }
    handleAddToken();
  };

  return (
    <div className="space-y-2">
      {message && <p>{message}</p>}
      <Button
        size="lg"
        onClick={handleClick}
        className="w-full"
        disabled={isPending}
      >
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isTargetChain ? (isPending ? `Adding ${tokenSymbol}...` : `Add ${tokenSymbol} to Wallet`) : `Switch to ${getChainName(chainId)}`}
      </Button>
    </div>
  );
}
