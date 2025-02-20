import { type Address } from 'viem';
import { chainId } from '@/config/chains';
import { ASSISTANT_CONTRACT_ABI, ASSISTANT_CONTRACT_ADDRESS } from '@/config/contracts';
import {
  type OdosQuoteRequest,
  type OdosQuoteResponse,
  type OdosSwapRequest,
  type OdosSwapResponse,
  type SwapQuote,
  type SwapResult,
} from '@/types/aggregator';
import { getWalletClient, waitForTransactionReceipt } from './walletClient';

const SLIPPAGE = 1; // 1% slippage

export async function getQuote(fromToken: Address, toToken: Address, amount: string): Promise<SwapResult<SwapQuote>> {
  try {
    if (!process.env.ODOS_API_URL) {
      return {
        success: false,
        error: 'ODOS_API_URL not configured',
      };
    }

    // Get initial quote
    const quoteResponse = await fetchOdosQuote({
      chainId: chainId,
      inputTokens: [
        {
          tokenAddress: fromToken,
          amount: amount,
        },
      ],
      outputTokens: [
        {
          tokenAddress: toToken,
          proportion: 1,
        },
      ],
      userAddr: ASSISTANT_CONTRACT_ADDRESS,
      slippageLimitPercent: SLIPPAGE,
      disableRFQs: true,
      compact: true,
    });

    if (!quoteResponse.success || !quoteResponse.data) {
      return {
        success: false,
        error: quoteResponse.error || 'Failed to get quote',
      };
    }

    // Get swap data
    const swapResponse = await fetchOdosSwapData({
      userAddr: ASSISTANT_CONTRACT_ADDRESS,
      pathId: quoteResponse.data.pathId,
    });

    if (!swapResponse.success || !swapResponse.data) {
      return {
        success: false,
        error: swapResponse.error || 'Failed to get swap data',
      };
    }

    // Calculate minimum amount out with slippage
    const minOutputAmount = calculateMinOutput(swapResponse.data.outputTokens[0].amount, SLIPPAGE);

    return {
      success: true,
      data: {
        pathId: quoteResponse.data.pathId,
        fromToken,
        toToken,
        amountIn: amount,
        expectedOutput: swapResponse.data.outputTokens[0].amount,
        price: quoteResponse.data.price,
        priceImpact: quoteResponse.data.priceImpact,
        transaction: {
          to: swapResponse.data.transaction.to as Address,
          data: swapResponse.data.transaction.data,
        },
        minOutputAmount,
      },
    };
  } catch (error) {
    console.error('Error getting swap quote:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error getting quote',
    };
  }
}

export async function executeSwap(
  quote: SwapQuote,
  userAddress: Address,
  useContract: boolean = false
): Promise<SwapResult<{ hash: string }>> {
  try {
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
    let hash: string;

    if (useContract) {
      hash = await walletClient.writeContract({
        address: ASSISTANT_CONTRACT_ADDRESS,
        abi: ASSISTANT_CONTRACT_ABI,
        functionName: 'executeSwap',
        args: [
          ASSISTANT_CONTRACT_ADDRESS,
          quote.fromToken,
          quote.toToken,
          BigInt(quote.amountIn),
          quote.transaction.to,
          quote.transaction.data as `0x${string}`,
        ],
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
      });
    }

    // Wait for transaction receipt and check status
    const receipt = await waitForTransactionReceipt({
      hash: hash as `0x${string}`,
    });

    if (receipt.status === 'reverted') {
      return {
        success: false,
        error: 'Transaction failed: Reverted',
        data: { hash },
      };
    }

    return {
      success: true,
      data: { hash },
    };
  } catch (error) {
    console.error('Error executing swap:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error executing swap',
    };
  }
}

async function fetchOdosQuote(request: OdosQuoteRequest): Promise<SwapResult<OdosQuoteResponse>> {
  try {
    const response = await fetch(`${process.env.ODOS_API_URL}/sor/quote/v2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Odos quote failed: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error fetching quote',
    };
  }
}

async function fetchOdosSwapData(request: OdosSwapRequest): Promise<SwapResult<OdosSwapResponse>> {
  try {
    const response = await fetch(`${process.env.ODOS_API_URL}/sor/assemble`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Odos swap data failed: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error fetching swap data',
    };
  }
}

function calculateMinOutput(amount: string, slippagePercent: number): string {
  const outputAmount = BigInt(amount);
  const slippageFactor = 100n - BigInt(Math.floor(slippagePercent * 100));
  return ((outputAmount * slippageFactor) / 100n).toString();
}
