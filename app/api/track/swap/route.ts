import { formatUnits, type Address } from 'viem';
import { checkAuth } from '@/app/actions/auth';
import { chainId } from '@/config/chains';
import { getQuote } from '@/utils/aggregator';
import { getExplorerInfo, getExplorerUrl } from '@/utils/explorer';
import { getTokenDecimals } from '@/utils/tokenDecimals';
import { waitForTransaction } from '@/utils/transactionUtils';
import { sendStreamUpdate } from '@/utils/update-stream';

const activePolls = new Map<string, boolean>();

interface SwapRequestBody {
  tx: string;
  fromTokenAddress: string;
  toTokenAddress: string;
  amountIn: string;
  userAddress: string;
}

async function pollSwapStatus(
  txHash: string,
  userId: string,
  fromTokenAddress: string,
  toTokenAddress: string,
  amountIn: string,
  userAddress: string
) {
  try {
    const { success, error } = await waitForTransaction(chainId, txHash); // Assuming chainId 1 for now

    if (error) {
      console.error('Error verifying transaction:', error);
      const explorer = getExplorerInfo(chainId);
      const explorerUrl = getExplorerUrl(chainId, txHash);

      await sendStreamUpdate(
        userId,
        `Transaction failed. Please try again. [View on ${explorer.name}](${explorerUrl})\n`
      );
      return;
    }

    if (success) {
      // Get quote after approval is confirmed

      console.log('Getting quote with args:', {
        fromTokenAddress,
        toTokenAddress,
        amountIn,
        userAddress,
      });

      const quote = await getQuote(fromTokenAddress as Address, toTokenAddress as Address, amountIn);

      if (!quote.success || !quote.data) {
        await sendStreamUpdate(userId, `Failed to get quote: ${quote.error || 'Unknown error'}`);
        return;
      }

      const toDecimals = await getTokenDecimals(chainId, toTokenAddress);
      const amountOut = formatUnits(BigInt(quote.data.expectedOutput), toDecimals);

      await sendStreamUpdate(
        userId,
        `We have now allowance to perform the swap, output is: ${amountOut}. Do you want to proceed with the swap?`
      );
    }
  } catch (error) {
    console.error('Error polling swap status:', error);
    await sendStreamUpdate(
      userId,
      `There was an error tracking your transaction. Please try again or contact support.`
    );
  }
}

export async function POST(req: Request) {
  const session = await checkAuth();
  if (!session?.address) {
    return new Response('Not authenticated', { status: 401 });
  }

  try {
    const body = (await req.json()) as SwapRequestBody;
    const { tx, fromTokenAddress, toTokenAddress, amountIn, userAddress } = body;

    console.log('Received POST request with body:', body);

    if (activePolls.get(tx)) {
      return new Response(JSON.stringify({ success: true, message: 'Already tracking' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    activePolls.set(tx, true);

    // Start polling for status updates
    pollSwapStatus(tx, session.userId, fromTokenAddress, toTokenAddress, amountIn, userAddress).finally(() => {
      // Clean up when polling is done
      activePolls.delete(tx);
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error tracking swap:', error);
    return new Response(JSON.stringify({ error: 'Failed to track swap transaction' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
