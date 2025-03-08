import type { Account, Address, WalletClient } from 'viem';
import { ASSISTANT_CONTRACT_ABI, ASSISTANT_CONTRACT_ADDRESS } from '@/config/contracts';
import {
  type SwapQuote,
  type SwapResult,
  type TransactionReceiptParams,
  type WithdrawResult,
} from '@/types/aggregator';
import { createMutex } from './mutex';
import { getWalletClient, publicClient, waitForTransactionReceipt } from './walletClient';

const CONFIRMATION_BLOCKS = 2;

let currentNonce: number | null = null;
const nonceMutex = createMutex();

async function getAndIncrementNonce(walletClient: WalletClient & { account: Account }): Promise<number> {
  return await nonceMutex.runExclusive(async () => {
    if (currentNonce === null) {
      const networkNonce = await publicClient.getTransactionCount({
        address: walletClient.account.address as `0x${string}`,
      });
      currentNonce = networkNonce;
      console.log(`Initial nonce fetched from network: ${currentNonce}`);
    }

    const nonceToUse = currentNonce!;
    currentNonce = nonceToUse + 1;
    return nonceToUse;
  });
}

export async function executeSwap(
  quote: SwapQuote,
  userAddress: Address,
  useContract: boolean = false
): Promise<SwapResult<{ hash: string }>> {
  try {
    console.log('Initiating swap with args:', quote);
    if (!quote.transaction) {
      return { success: false, error: 'No transaction data in quote' };
    }

    if (!process.env.ASSISTANT_PRIVATE_KEY) {
      return { success: false, error: 'Assistant private key not configured' };
    }

    const walletClient = getWalletClient();

    const nonce = await getAndIncrementNonce(walletClient);
    console.log(`Using nonce ${nonce} for swap transaction`);

    const baseGas = BigInt(1800000);
    const gasParams = {
      gas: baseGas,
      nonce,
    };

    let hash: string;
    if (useContract) {
      const args: [Address, Address, Address, bigint, Address, `0x${string}`] = [
        userAddress,
        quote.fromToken,
        quote.toToken,
        BigInt(quote.amountIn),
        quote.transaction.to,
        quote.transaction.data,
      ];

      hash = await walletClient.writeContract({
        address: ASSISTANT_CONTRACT_ADDRESS,
        abi: ASSISTANT_CONTRACT_ABI,
        functionName: 'executeSwap',
        args,
        ...gasParams,
      });
    } else {
      hash = await walletClient.writeContract({
        address: ASSISTANT_CONTRACT_ADDRESS,
        abi: ASSISTANT_CONTRACT_ABI,
        functionName: 'executeWalletSwap',
        args: [
          userAddress,
          quote.fromToken,
          quote.toToken,
          BigInt(quote.amountIn),
          BigInt(quote.minOutputAmount),
          quote.transaction.to,
          quote.transaction.data as `0x${string}`,
        ],
        ...gasParams,
      });
    }

    console.log(`Swap transaction submitted with hash: ${hash}`);

    const receipt = await waitForTransactionReceipt({
      hash: hash as `0x${string}`,
    } as TransactionReceiptParams);

    if (receipt.status === 'reverted' || !receipt.status) {
      return {
        success: false,
        error: 'Transaction failed: Reverted',
        data: { hash },
      };
    }

    const finalReceipt = await waitForTransactionReceipt({
      hash: hash as `0x${string}`,
      confirmations: CONFIRMATION_BLOCKS,
    } as TransactionReceiptParams);

    if (finalReceipt.status !== 'success') {
      return {
        success: false,
        error: 'Transaction failed during confirmation',
        data: { hash },
      };
    }

    return { success: true, data: { hash } };
  } catch (error) {
    console.error('Error executing swap:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error executing swap',
    };
  }
}

export async function executeWithdraw(
  userAddress: Address,
  tokenAddress: Address,
  amount: string
): Promise<WithdrawResult<{ hash: string }>> {
  try {
    if (!process.env.ASSISTANT_PRIVATE_KEY) {
      return { success: false, error: 'Assistant private key not configured' };
    }

    const walletClient = getWalletClient();
    console.log(`Initiating withdrawal for user ${userAddress}, token ${tokenAddress}, amount ${amount}`);

    const nonce = await getAndIncrementNonce(walletClient);
    console.log(`Using nonce ${nonce} for withdrawal transaction`);

    const baseGas = BigInt(500000);
    const hash = await walletClient.writeContract({
      address: ASSISTANT_CONTRACT_ADDRESS,
      abi: ASSISTANT_CONTRACT_ABI,
      functionName: 'withdraw',
      args: [userAddress, tokenAddress, BigInt(amount)],
      gas: baseGas,
      nonce,
    });

    console.log(`Withdrawal transaction submitted with hash: ${hash}`);

    const receipt = await waitForTransactionReceipt({
      hash: hash as `0x${string}`,
    } as TransactionReceiptParams);

    if (receipt.status === 'reverted' || !receipt.status) {
      return {
        success: false,
        error: 'Transaction failed: Reverted',
        data: { hash },
      };
    }

    const finalReceipt = await waitForTransactionReceipt({
      hash: hash as `0x${string}`,
      confirmations: CONFIRMATION_BLOCKS,
    } as TransactionReceiptParams);

    if (finalReceipt.status !== 'success') {
      return {
        success: false,
        error: 'Transaction failed during confirmation',
        data: { hash },
      };
    }

    return { success: true, data: { hash } };
  } catch (error) {
    console.error('Withdrawal error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during withdrawal',
    };
  }
}

export async function createLimitOrder(
  userAddress: Address,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: string,
  amountOutMin: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.ASSISTANT_PRIVATE_KEY) {
      return { success: false, error: 'Assistant private key not configured' };
    }

    const walletClient = getWalletClient();
    console.log(
      `Creating limit order for user ${userAddress}, tokenIn ${tokenIn}, tokenOut ${tokenOut}, amountIn ${amountIn}, amountOutMin ${amountOutMin}`
    );

    const nonce = await getAndIncrementNonce(walletClient);
    console.log(`Using nonce ${nonce} for limit order transaction`);

    const baseGas = BigInt(500000);

    // This only returns the transaction hash
    const hash = await walletClient.writeContract({
      address: ASSISTANT_CONTRACT_ADDRESS,
      abi: ASSISTANT_CONTRACT_ABI,
      functionName: 'createLimitOrder',
      args: [userAddress, tokenIn, tokenOut, BigInt(amountIn), BigInt(amountOutMin)],
      gas: baseGas,
      nonce,
    });

    console.log(`Limit order transaction submitted with hash: ${hash}`);

    const receipt = await waitForTransactionReceipt({
      hash: hash as `0x${string}`,
    } as TransactionReceiptParams);

    if (receipt.status === 'reverted' || !receipt.status) {
      return {
        success: false,
        error: 'Transaction failed: Reverted',
      };
    }

    const finalReceipt = await waitForTransactionReceipt({
      hash: hash as `0x${string}`,
      confirmations: CONFIRMATION_BLOCKS,
    } as TransactionReceiptParams);

    if (finalReceipt.status !== 'success') {
      return {
        success: false,
        error: 'Transaction failed during confirmation',
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Limit order error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating limit order',
    };
  }
}

export async function cancelLimitOrder(
  orderId: string
): Promise<{ success: boolean; data?: { hash: string }; error?: string }> {
  try {
    if (!process.env.ASSISTANT_PRIVATE_KEY) {
      return { success: false, error: 'Assistant private key not configured' };
    }

    const walletClient = getWalletClient();
    console.log(`Cancelling limit order with ID: ${orderId}`);

    const nonce = await getAndIncrementNonce(walletClient);
    console.log(`Using nonce ${nonce} for cancel limit order transaction`);

    const baseGas = BigInt(300000);
    const hash = await walletClient.writeContract({
      address: ASSISTANT_CONTRACT_ADDRESS,
      abi: ASSISTANT_CONTRACT_ABI,
      functionName: 'cancelLimitOrder',
      args: [orderId as `0x${string}`],
      gas: baseGas,
      nonce,
    });

    console.log(`Cancel limit order transaction submitted with hash: ${hash}`);

    const receipt = await waitForTransactionReceipt({
      hash: hash as `0x${string}`,
    } as TransactionReceiptParams);

    if (receipt.status === 'reverted' || !receipt.status) {
      return {
        success: false,
        error: 'Transaction failed: Reverted',
        data: { hash },
      };
    }

    const finalReceipt = await waitForTransactionReceipt({
      hash: hash as `0x${string}`,
      confirmations: CONFIRMATION_BLOCKS,
    } as TransactionReceiptParams);

    if (finalReceipt.status !== 'success') {
      return {
        success: false,
        error: 'Transaction failed during confirmation',
        data: { hash },
      };
    }

    return {
      success: true,
      data: { hash },
    };
  } catch (error) {
    console.error('Cancel limit order error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error cancelling limit order',
    };
  }
}
