import { type Address } from 'viem';
import { chainId } from '@/config/chains';
import { ASSISTANT_CONTRACT_ADDRESS } from '@/config/contracts';
import {
  type OdosQuoteRequest,
  type OdosQuoteResponse,
  type OdosSwapRequest,
  type OdosSwapResponse,
  type SwapQuote,
  type SwapResult,
} from '@/types/aggregator';

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
          data: swapResponse.data.transaction.data as `0x${string}`,
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
  const slippageFactor = BigInt(Math.floor(slippagePercent * 100));
  return ((outputAmount * (1000n - slippageFactor)) / 1000n).toString();
}
