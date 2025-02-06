'use client';

import { Button } from '@/components/ui/button';
import { useAccount, useSwitchChain } from 'wagmi';
import { sonic } from 'viem/chains';

interface SwapProps {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  data: string;
}

export function Swap({ tokenIn, tokenOut, amountIn, data }: SwapProps) {
  const { chain } = useAccount();
  const { switchChain } = useSwitchChain();

  const isSonicChain = chain?.id === sonic.id;

  const handleSwap = async () => {
    try {
      console.log(`Swapping ${amountIn} ${tokenIn} for ${tokenOut}`);
      alert(`Would swap ${amountIn} ${tokenIn} for ${tokenOut} with ${data}`);
    } catch (error) {
      console.error('Swap failed:', error);
      alert('Swap failed: ' + error);
    }
  };

  const handleClick = () => {
    if (!isSonicChain && switchChain) {
      switchChain({ chainId: sonic.id });
      return;
    }
    handleSwap();
  };

  return (
    <Button
      size="lg"
      onClick={handleClick}
      className="w-full"
    >
      {isSonicChain
        ? `Swap ${tokenIn} to ${tokenOut}`
        : 'Switch to Sonic'
      }
    </Button>
  );
}