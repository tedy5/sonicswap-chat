import { type Address } from 'viem';
import { ASSISTANT_CONTRACT_ABI, ASSISTANT_CONTRACT_ADDRESS } from '@/config/contracts';
import {
  type SwapQuote,
  type SwapResult,
  type TransactionReceiptParams,
  type WithdrawResult,
} from '@/types/aggregator';
import { getWalletClient, waitForTransactionReceipt } from './walletClient';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const CONFIRMATION_BLOCKS = 2;

export async function executeSwap(
  quote: SwapQuote,
  userAddress: Address,
  useContract: boolean = false
): Promise<SwapResult<{ hash: string }>> {
  try {
    console.log('Initiating swap with args:', quote);
    if (!quote.transaction) {
      return {
        success: false,
        error: 'No transaction data in quote',
      };
    }

    if (!process.env.ASSISTANT_PRIVATE_KEY) {
      return {
        success: false,
        error: 'Assistant private key not configured',
      };
    }

    const walletClient = getWalletClient();

    const sendTransaction = async (retryCount = 0): Promise<string> => {
      try {
        console.log(`Attempting swap transaction${retryCount > 0 ? ` (retry ${retryCount}/${MAX_RETRIES})` : ''}`);

        // Increase gas by 10% for each retry
        const gasMultiplier = 1 + retryCount * 0.1;
        const baseGas = BigInt(1800000);
        const adjustedGas = BigInt(Math.floor(Number(baseGas) * gasMultiplier));

        const gasParams = {
          gas: adjustedGas,
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

        console.log(`Transaction submitted with hash: ${hash}`);
        return hash as string;
      } catch (err: any) {
        if (err.message?.includes('replacement transaction underpriced')) {
          if (retryCount >= MAX_RETRIES) {
            console.error(`Max retries (${MAX_RETRIES}) reached for replacement transaction`);
            throw new Error(`Failed after ${MAX_RETRIES} retries: ${err.message}`);
          }

          console.log(`Transaction replacement error detected. Retrying in ${RETRY_DELAY}ms...`);
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
          return sendTransaction(retryCount + 1);
        }

        console.error('Transaction error:', err);
        throw err;
      }
    };

    const hash = await sendTransaction();

    // Initial receipt check
    console.log('Waiting for initial transaction receipt...');
    const receipt = await waitForTransactionReceipt({
      hash: hash as `0x${string}`,
    } as TransactionReceiptParams);

    if (receipt.status === 'reverted' || !receipt.status) {
      console.error('Transaction reverted in initial check');
      return {
        success: false,
        error: 'Transaction failed: Reverted',
        data: { hash },
      };
    }

    // Additional confirmation check
    console.log(`Waiting for ${CONFIRMATION_BLOCKS} block confirmations...`);
    try {
      const finalReceipt = await waitForTransactionReceipt({
        hash: hash as `0x${string}`,
        confirmations: CONFIRMATION_BLOCKS,
      } as TransactionReceiptParams);

      if (finalReceipt.status !== 'success') {
        console.error('Transaction failed in final confirmation check');
        return {
          success: false,
          error: 'Transaction was replaced or failed during confirmation',
          data: { hash },
        };
      }

      console.log('Swap transaction successfully confirmed');
      return {
        success: true,
        data: { hash },
      };
    } catch (error) {
      console.error('Error during confirmation check:', error);
      return {
        success: false,
        error: 'Transaction may have been replaced during confirmation',
        data: { hash },
      };
    }
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
      console.error('Withdrawal failed: Assistant private key not configured');
      return {
        success: false,
        error: 'Assistant private key not configured',
      };
    }

    const walletClient = getWalletClient();
    console.log(`Initiating withdrawal for user ${userAddress}, token ${tokenAddress}, amount ${amount}`);

    const sendTransaction = async (retryCount = 0): Promise<string> => {
      try {
        console.log(`Attempting transaction${retryCount > 0 ? ` (retry ${retryCount}/${MAX_RETRIES})` : ''}`);

        const baseGas = BigInt(500000);
        const hash = await walletClient.writeContract({
          address: ASSISTANT_CONTRACT_ADDRESS,
          abi: ASSISTANT_CONTRACT_ABI,
          functionName: 'withdraw',
          args: [userAddress, tokenAddress, BigInt(amount)],
          gas: baseGas,
        });

        console.log(`Transaction submitted with hash: ${hash}`);
        return hash as string;
      } catch (err: any) {
        // Handle replacement transaction error
        if (err.message?.includes('replacement transaction underpriced')) {
          if (retryCount >= MAX_RETRIES) {
            console.error(`Max retries (${MAX_RETRIES}) reached for replacement transaction`);
            throw new Error(`Failed after ${MAX_RETRIES} retries: ${err.message}`);
          }

          console.log(`Transaction replacement error detected. Retrying in ${RETRY_DELAY}ms...`);
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
          return sendTransaction(retryCount + 1);
        }

        // Handle other errors
        console.error('Transaction error:', err);
        throw err;
      }
    };

    const hash = await sendTransaction();

    // Initial receipt check
    console.log('Waiting for initial transaction receipt...');
    const receipt = await waitForTransactionReceipt({
      hash: hash as `0x${string}`,
    } as TransactionReceiptParams);

    if (receipt.status === 'reverted' || !receipt.status) {
      console.error('Transaction reverted in initial check');
      return {
        success: false,
        error: 'Transaction failed: Reverted',
        data: { hash },
      };
    }

    // Additional confirmation check
    console.log(`Waiting for ${CONFIRMATION_BLOCKS} block confirmations...`);
    try {
      const finalReceipt = await waitForTransactionReceipt({
        hash: hash as `0x${string}`,
        confirmations: CONFIRMATION_BLOCKS,
      } as TransactionReceiptParams);

      if (finalReceipt.status !== 'success') {
        console.error('Transaction failed in final confirmation check');
        return {
          success: false,
          error: 'Transaction was replaced or failed during confirmation',
          data: { hash },
        };
      }

      console.log('Transaction successfully confirmed');
      return {
        success: true,
        data: { hash },
      };
    } catch (error) {
      console.error('Error during confirmation check:', error);
      return {
        success: false,
        error: 'Transaction may have been replaced during confirmation',
        data: { hash },
      };
    }
  } catch (error) {
    console.error('Withdrawal error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during withdrawal',
    };
  }
}
