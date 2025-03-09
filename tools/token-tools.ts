import { tool } from 'ai';
import { isAddress, zeroAddress, type Address } from 'viem';
import { z } from 'zod';
import { checkAuth } from '@/app/actions/auth';
import type { SessionData } from '@/types/session';
import { getChainIds } from '@/utils/chainId';
import { getTokenAddress } from '@/utils/tokenAddress';
import { getTokenDecimals } from '@/utils/tokenDecimals';
import { getTokenSymbol } from '@/utils/tokenSymbol';
import { sendStreamUpdate } from '@/utils/update-stream';

export const addTokenTool = tool({
  description: `Get token details for adding to a wallet.`,
  parameters: z.object({
    chainName: z
      .enum([
        'ethereum',
        'optimism',
        'bsc',
        'polygon',
        'fantom',
        'base',
        'arbitrum',
        'avalanche',
        'linea',
        'gnosis',
        'metis',
        'sonic',
        'cronos',
        'neon',
        'bitrock',
        'abstract',
        'berachain',
      ])
      .describe(
        'Chain name for the token. Must be one of: ethereum, optimism, bsc, polygon, fantom, base, arbitrum, avalanche, linea, gnosis, metis, sonic, cronos, neon, bitrock, abstract, berachain'
      ),
    token: z
      .string()
      .describe(
        'Token identifier. Can be: 1) Token symbol (e.g., "USDC", "USDT", any other ticker/symbol..) 2) Token address in hex format (e.g., "0x123...def")'
      ),
  }),
  execute: async function (params) {
    const session = (await checkAuth()) as SessionData;

    try {
      const chain = getChainIds(params.chainName);

      // Handle token address
      let tokenAddress: Address;
      if (isAddress(params.token)) {
        tokenAddress = params.token;
      } else {
        const resolvedAddress = getTokenAddress(chain.chainId, params.token);
        if (resolvedAddress === null || resolvedAddress === zeroAddress) {
          const errorMessage = `Could not find token "${params.token}" on ${params.chainName}. Please try provide full token contract addressand verify the token exists on ${params.chainName}`;

          return {
            type: 'system',
            message: errorMessage,
          };
        }
        tokenAddress = resolvedAddress;
      }

      try {
        const [decimals, symbol] = await Promise.all([
          getTokenDecimals(chain.chainId, tokenAddress),
          getTokenSymbol(chain.chainId, tokenAddress),
        ]);

        const message = await sendStreamUpdate(
          session.userId,
          'A brief, friendly message explaining to the user that they can click the button below to add this token to their wallet and may need to approve a wallet popup. Include the token symbol in the message.',
          false,
          1
        );

        return {
          chainId: chain.chainId,
          tokenAddress: tokenAddress as Address,
          symbol: symbol,
          decimals,
          message,
          shouldAbort: true,
        };
      } catch (error) {
        return {
          type: 'system',
          message: 'Please try again or use a different token.',
        };
      }
    } catch (error) {
      console.error('Add Token Error:', {
        error,
        params,
      });

      return {
        type: 'system',
        message: 'Token service is temporarily unavailable. Please try again later.',
      };
    }
  },
});

export const tokenTools = {
  addToken: addTokenTool,
};
