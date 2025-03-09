'use client';

import { useCallback, useEffect, useState } from 'react';
import { readContract, waitForTransactionReceipt } from '@wagmi/core';
import { Loader2 } from 'lucide-react';
import { useAccount, useSwitchChain, useWalletClient } from 'wagmi';
import { Button } from '@/components/ui/button';
import { config } from '@/config';
import { chainId } from '@/config/chains';
import { ASSISTANT_CONTRACT_ADDRESS } from '@/config/contracts';
import type { DepositButtonProps } from '@/types/tools';
import { getChainName } from '@/utils/chains';

export function DepositButton({ token, amount, isNative }: DepositButtonProps) {
  const { chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const { data: walletClient } = useWalletClient();

  const [isPending, setIsPending] = useState(false);
  const [needsAllowance, setNeedsAllowance] = useState(false);

  const isTargetChain = chain?.id === chainId;

  // Add function to check allowance
  const checkAllowance = useCallback(async () => {
    if (isNative || !walletClient) return;

    try {
      const allowance = await readContract(config, {
        address: token,
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
        args: [walletClient.account.address, ASSISTANT_CONTRACT_ADDRESS],
      });

      setNeedsAllowance(BigInt(allowance.toString()) < BigInt(amount));
    } catch (error) {
      console.error('Error checking allowance:', error);
    }
  }, [isNative, walletClient, token, amount]);

  useEffect(() => {
    if (isTargetChain) {
      checkAllowance();
    }
  }, [isTargetChain, checkAllowance]);

  const handleDeposit = async () => {
    if (!walletClient) return;

    try {
      setIsPending(true);

      if (needsAllowance && !isNative) {
        // Send approve transaction
        const approveData = {
          address: token,
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
          args: [ASSISTANT_CONTRACT_ADDRESS, BigInt(amount)],
        });

        // Wait for approval to be mined
        await waitForTransactionReceipt(config, {
          hash,
        });
        setNeedsAllowance(false);
        return;
      }

      let hash;
      if (isNative) {
        // For native token, send a regular transaction with higher gas limit
        hash = await walletClient.sendTransaction({
          to: ASSISTANT_CONTRACT_ADDRESS,
          value: BigInt(amount),
          gas: 100000n, // Higher gas limit for contract logic
        });
      } else {
        // For ERC20 tokens, use the depositToken function (not deposit)
        hash = await walletClient.writeContract({
          address: ASSISTANT_CONTRACT_ADDRESS,
          abi: [
            {
              name: 'depositToken',
              type: 'function',
              inputs: [
                { name: 'token', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'user', type: 'address' },
              ],
            },
          ],
          functionName: 'depositToken',
          args: [token, BigInt(amount), walletClient.account.address],
        });
      }

      await waitForTransactionReceipt(config, {
        hash,
      });
    } catch (error) {
      console.error('Error during deposit:', error);
    } finally {
      setIsPending(false);
    }
  };

  const handleClick = () => {
    if (!isTargetChain && switchChain) {
      switchChain({ chainId });
      return;
    }
    handleDeposit();
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
              ? 'Approving...'
              : 'Depositing...'
            : needsAllowance
              ? 'Approve'
              : 'Deposit'
          : `Switch to ${getChainName(chainId)}`}
      </Button>
    </div>
  );
}
