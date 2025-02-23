'use client';

import { useCallback, useState } from 'react';
import { waitForTransactionReceipt } from '@wagmi/core';
import { Loader2 } from 'lucide-react';
import { formatUnits } from 'viem';
import { useWalletClient } from 'wagmi';
import { Button } from '@/components/ui/button';
import { config } from '@/config';
import { ApproveButtonProps } from '@/types/tools';

export function ApproveButton({ fromAddress, toAddress, spender, amount, symbol, decimals, isMaxApproval }: ApproveButtonProps) {
  const { data: walletClient } = useWalletClient();
  const [isPending, setIsPending] = useState(false);

  const handleApprove = useCallback(async () => {
    if (!walletClient) return;

    try {
      setIsPending(true);

      // Send approve transaction
      const hash = await walletClient.writeContract({
        address: fromAddress,
        abi: [
          {
            name: 'approve',
            type: 'function',
            inputs: [
              { name: 'spender', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
            outputs: [{ name: '', type: 'bool' }],
          },
        ],
        functionName: 'approve',
        args: [spender, BigInt(amount)],
      });

      // Wait for approval to be mined
      await waitForTransactionReceipt(config, { hash });

      // Notify the backend about the approval
      await fetch('/api/track/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tx: hash,
          fromTokenAddress: fromAddress,
          toTokenAddress: toAddress,
          amountIn: amount,
          userAddress: walletClient.account.address,
        }),
      });
    } catch (error) {
      console.error('Approval error:', error);

      // Create a clean error object with just the user-friendly message
      const cleanError = new Error(String(error).split('Request Arguments:')[0].trim());

      // Notify backend about the error
      await fetch('/api/swap/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: true,
          type: 'approval',
          fromAddress,
          amount,
          errorMessage: cleanError.message,
        }),
      });
    } finally {
      setIsPending(false);
    }
  }, [walletClient, fromAddress, toAddress, spender, amount]);

  return (
    <Button
      size="lg"
      onClick={handleApprove}
      className="w-full"
      disabled={isPending}
    >
      {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
      {isPending
        ? `Approving ${symbol}..`
        : isMaxApproval
          ? `Approve Max ${symbol}`
          : `Approve ${formatUnits(BigInt(amount), decimals)} ${symbol}`}
    </Button>
  );
}
