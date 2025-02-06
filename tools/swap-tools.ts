import { tool as createTool } from 'ai';
import { z } from 'zod';

export const swapTool = createTool({
  description: 'Show a swap interface for trading tokens',
  parameters: z.object({
    tokenIn: z.string().describe('The input token symbol (e.g., ETH, USDC)'),
    tokenOut: z.string().describe('The output token symbol (e.g., ETH, USDC)'),
    amountIn: z.string().describe('The input amount as a string (e.g., "1.0")'),
  }),
  execute: async function ({ tokenIn, tokenOut, amountIn }) {
    const data = 'test_data';

    return {
      result: {
        success: true,
        tokenIn,
        tokenOut,
        amountIn,
        data,
      },
    };
  },
});

export const tools = {
  showSwap: swapTool,
};
