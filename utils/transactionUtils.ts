import { getPublicClient } from './publicClient';

const POLLING_INTERVAL = 5000; // 5 seconds
const MAX_ATTEMPTS = 60; // 5 minutes total

export async function waitForTransaction(
  chainId: number,
  txHash: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  console.log(`Checking transaction ${txHash} on chain ${chainId}`);

  let publicClient;
  try {
    publicClient = getPublicClient(chainId);
  } catch (error) {
    console.log(`Chain ${chainId} not supported`);
    return {
      success: false,
      error: `Chain ID ${chainId} not supported for transaction verification`,
    };
  }

  let attempts = 0;

  while (attempts < MAX_ATTEMPTS) {
    try {
      console.log(`Attempt ${attempts + 1}/${MAX_ATTEMPTS} to get receipt for ${txHash}`);

      const txReceipt = await publicClient.getTransactionReceipt({
        hash: txHash as `0x${string}`,
      });

      console.log('Transaction receipt:', {
        status: txReceipt.status,
        statusType: typeof txReceipt.status,
        blockNumber: txReceipt.blockNumber,
        gasUsed: txReceipt.gasUsed.toString(),
      });

      if (txReceipt.status === undefined) {
        console.log('Transaction status is undefined, assuming success');
        return { success: true };
      }

      const success = txReceipt.status === 'success';
      console.log(`Transaction ${success ? 'succeeded' : 'failed'} with status: ${txReceipt.status}`);

      return { success };
    } catch (error) {
      console.log('Error while checking transaction:', error);

      // Check for TransactionReceiptNotFoundError or message about transaction not found
      if (
        error instanceof Error &&
        (error.message.includes('could not be found') || error.message.includes('could not find transaction'))
      ) {
        attempts++;
        console.log(`Transaction not found, attempt ${attempts}/${MAX_ATTEMPTS}`);

        if (attempts === MAX_ATTEMPTS) {
          console.log('Max attempts reached, giving up');
          return {
            success: false,
            error: 'Transaction not found after maximum attempts',
          };
        }
        await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL));
        continue;
      }

      // If it's any other error, we return it
      console.log('Unexpected error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  console.log('Timeout reached while waiting for transaction');
  return {
    success: false,
    error: 'Timeout waiting for transaction',
  };
}
