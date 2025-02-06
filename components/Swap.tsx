'use client';

import { Button } from '@/components/ui/button';

interface SwapProps {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  data: string;
}

export function Swap({ tokenIn, tokenOut, amountIn, data }: SwapProps) {
  const handleSwap = async () => {
    try {
      console.log(`Swapping ${amountIn} ${tokenIn} for ${tokenOut}`);
      alert(`Would swap ${amountIn} ${tokenIn} for ${tokenOut} with ${data}`);
    } catch (error) {
      console.error('Swap failed:', error);
      alert('Swap failed: ' + error);
    }
  };

  return (
    <Button size="lg" onClick={handleSwap} className="w-full">
      Swap {tokenIn} to {tokenOut}
    </Button>
  );
}
