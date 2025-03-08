'use client';

import { useCallback, useEffect, useState } from 'react';
import { readContract, waitForTransactionReceipt } from '@wagmi/core';
import { Loader2 } from 'lucide-react';
import { useAccount, useSwitchChain, useWalletClient } from 'wagmi';
import { Button } from '@/components/ui/button';
import { config } from '@/config';
import { BridgeButtonProps } from '@/types/bridge';
import { getChainName } from '@/utils/chains';

export function BridgeButton({ srcChainId, dstChainId, data, messageId, tokenIn, tokenOut, amount }: BridgeButtonProps) {
  const { chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const { data: walletClient } = useWalletClient();

  const [isPending, setIsPending] = useState(false);
  const [needsAllowance, setNeedsAllowance] = useState(false);

  const isTargetChain = chain?.id === srcChainId;
  const isNativeToken = tokenIn.address === '0x0000000000000000000000000000000000000000';

  // Add function to check allowance
  const checkAllowance = useCallback(async () => {
    console.log('isNativeToken: ' + isNativeToken);
    if (isNativeToken || !walletClient) return;

    try {
      const allowance = await readContract(config, {
        address: tokenIn.address as `0x${string}`,
        abi: [
          {
            name: 'allowance',
            type: 'function',
            stateMutability: 'view',
            inputs: [
              { name: 'owner', type: 'address' },
              { name: 'spender', type: 'address' },
            ],
            outputs: [{ name: '', type: 'uint256' }],
          },
        ],
        functionName: 'allowance',
        args: [walletClient.account.address, data.to],
      });

      setNeedsAllowance(allowance < BigInt(amount));
    } catch (error) {
      console.error('Error checking allowance:', error);
    }
  }, [isNativeToken, walletClient, tokenIn.address, data.to, amount]);

  useEffect(() => {
    if (isTargetChain) {
      checkAllowance();
    }
  }, [isTargetChain, checkAllowance]);

  // Modify handleBridge to handle allowance approval
  const handleBridge = async () => {
    if (!walletClient) return;

    try {
      setIsPending(true);

      if (needsAllowance && !isNativeToken) {
        // Send approve transaction
        const approveData = {
          address: tokenIn.address as `0x${string}`,
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
        };

        const hash = await walletClient.writeContract({
          ...approveData,
          functionName: 'approve',
          args: [data.to, BigInt(amount)],
        });

        // Wait for approval to be mined
        await waitForTransactionReceipt(config, {
          hash,
        });
        setNeedsAllowance(false);
        return;
      }

      const hash = await walletClient.sendTransaction({
        to: data.to,
        data: data.data as `0x${string}`,
        value: data.value ? BigInt(data.value) : 0n,
      });

      // Start tracking the bridge transaction
      await fetch('/api/track/bridge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          txHash: hash,
          messageId,
          tokenIn: {
            address: tokenIn.address,
            chainId: srcChainId,
            symbol: tokenIn.symbol,
            decimals: tokenIn.decimals,
          },
          tokenOut: {
            address: tokenOut.address,
            chainId: dstChainId,
            symbol: tokenOut.symbol,
            decimals: tokenOut.decimals,
          },
          amount,
        }),
      });
    } catch (error) {
      // Create a clean error object with just the user-friendly message
      const cleanError = new Error(String(error).split('Request Arguments:')[0].trim());

      await fetch('/api/track/bridge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: true,
          messageId,
          tokenIn: {
            address: tokenIn.address,
            chainId: srcChainId,
            symbol: tokenIn.symbol,
            decimals: tokenIn.decimals,
          },
          tokenOut: {
            address: tokenOut.address,
            chainId: dstChainId,
            symbol: tokenOut.symbol,
            decimals: tokenOut.decimals,
          },
          amount,
          errorMessage: cleanError.message,
        }),
      });
    } finally {
      setIsPending(false);
    }
  };

  const handleClick = () => {
    if (!isTargetChain && switchChain) {
      switchChain({ chainId: srcChainId });
      return;
    }
    handleBridge();
  };

  return (
    <div className="space-y-2">
      <Button
        size="lg"
        onClick={handleClick}
        className="w-full"
        disabled={isPending}
      >
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isTargetChain
          ? isPending
            ? needsAllowance
              ? `Approving ${tokenIn.symbol}...`
              : 'Bridging...'
            : needsAllowance
              ? `Approve ${tokenIn.symbol}`
              : 'Bridge'
          : `Switch to ${getChainName(srcChainId)}`}
      </Button>
    </div>
  );
}
