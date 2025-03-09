import { tool } from 'ai';
import { isAddress } from 'viem';
import { z } from 'zod';
import { chainId } from '@/config/chains';
import { wAddress } from '@/config/contracts';
import { fetchMarketData } from '@/utils/market-data';
import { getTokenAddress } from '@/utils/tokenAddress';
import { getTokenSymbol } from '@/utils/tokenSymbol';

export const marketAnalysisTool = tool({
  description: `Fetch market data for AI analysis and trading strategy creation.`,
  parameters: z.object({
    symbol: z
      .string()
      .describe('Trading pair symbol (e.g., "native", "sonic" "S", "WBTC", "WETH" or any other symbol or address)'),
  }),
  execute: async function (params) {
    try {
      // Resolve token address from symbol
      let tokenAddress: string;
      let tokenSymbol: string;

      if (isAddress(params.symbol)) {
        tokenAddress = params.symbol;
        tokenSymbol = await getTokenSymbol(chainId, tokenAddress as `0x${string}`);
      } else if (params.symbol.toLowerCase() === 'native' || params.symbol.toLowerCase() === 's') {
        tokenAddress = wAddress; // Native token address
        tokenSymbol = 'S';
      } else {
        const resolvedAddress = getTokenAddress(chainId, params.symbol);
        if (!resolvedAddress) {
          const content = `I couldn't find the token "${params.symbol}". Please use "native" for native token, "S" for Sonic, or provide the token's contract address.`;
          return { success: false, message: content };
        }
        tokenAddress = resolvedAddress;
        tokenSymbol = params.symbol.toUpperCase();
      }

      // Fetch market data using the resolved address
      const marketData = await fetchMarketData({
        symbol: tokenAddress,
      });

      // Format the response
      return {
        success: true,
        symbol: tokenSymbol,
        address: tokenAddress,
        data: marketData,
      };
    } catch (error) {
      console.error('Market Analysis Error:', {
        error,
        params,
      });

      return {
        success: false,
        message: `Error fetching market data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

export const marketTools = {
  marketAnalysis: marketAnalysisTool,
};
