import { tool } from 'ai';
import { isAddress, parseUnits, zeroAddress } from 'viem';
import { z } from 'zod';
import { checkAuth } from '@/app/actions/auth';
import { SessionData } from '@/types/session';
import { getChainIds } from '@/utils/chainId';
import { getTokenAddress } from '@/utils/tokenAddress';
import { getTokenDecimals } from '@/utils/tokenDecimals';
import { getNativeTokenPrice } from '@/utils/tokenPrices';
import { sendStreamUpdate } from '@/utils/update-stream';

export const bridgeTool = tool({
  description: `Get a bridge quote and transaction details between chains.`,
  parameters: z.object({
    srcChainName: z
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
        'Chain name for the source token. Must be one of: ethereum, optimism, bsc, polygon, fantom, base, arbitrum, avalanche, linea, gnosis, metis, sonic, cronos, neon, bitrock, abstract, berachain'
      ),
    dstChainName: z
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
        'Chain name for the destination token. Must be one of: ethereum, optimism, bsc, polygon, fantom, base, arbitrum, avalanche, linea, gnosis, metis, sonic, cronos, neon, bitrock, abstract, berachain'
      ),
    srcToken: z
      .string()
      .describe(
        'Token identifier for the source chain. Can be: 1) Token symbol (e.g., "USDC", "USDT", ...any other ticker) 2) Token address in hex format (e.g., "0x123...def") 3) Specify "native" to use the chain\'s native token (ETH for Ethereum, BNB for BSC, MATIC for Polygon, etc.). If empty/native, defaults to 0x0000000000000000000000000000000000000000'
      ),
    dstToken: z
      .string()
      .describe(
        'Token identifier for the destination chain. Can be: 1) Token symbol (e.g., "USDC", "USDT") 2) Token address in hex format (e.g., "0x123...def") 3) Leave empty or specify "native" to use the chain\'s native token (ETH for Ethereum, BNB for BSC, MATIC for Polygon, etc.). If empty/native, defaults to 0x0000000000000000000000000000000000000000'
      ),
    amount: z
      .string()
      .describe(
        'Amount to bridge in human readable format (e.g., "1" for 1 ETH, "0.5" for 0.5 ETH, NOT in wei/base units)'
      ),
  }),
  execute: async function (params, { toolCallId, abortSignal }) {
    const session = (await checkAuth()) as SessionData;

    try {
      const srcChain = getChainIds(params.srcChainName);
      const dstChain = getChainIds(params.dstChainName);

      // Handle source token
      let srcTokenAddress: string;
      if (isAddress(params.srcToken)) {
        srcTokenAddress = params.srcToken;
      } else if (params.srcToken.toLowerCase() === 'native') {
        srcTokenAddress = zeroAddress;
      } else {
        const resolvedAddress = getTokenAddress(srcChain.chainId, params.srcToken);
        if (resolvedAddress === null) {
          return {
            type: 'system',
            message: `Could not find token "${params.srcToken}" on ${params.srcChainName}. Please provide the token's contract address.`,
          };
        }
        srcTokenAddress = resolvedAddress;
      }

      // Handle destination token
      let dstTokenAddress: string;
      if (isAddress(params.dstToken)) {
        dstTokenAddress = params.dstToken;
      } else if (params.dstToken.toLowerCase() === 'native') {
        dstTokenAddress = zeroAddress;
      } else {
        const resolvedAddress = getTokenAddress(dstChain.chainId, params.dstToken);
        if (resolvedAddress === null) {
          return {
            type: 'system',
            message: `Could not find token "${params.dstToken}" on ${params.dstChainName}. Please provide the token's contract address.`,
          };
        }
        dstTokenAddress = resolvedAddress;
      }

      const decimals = await getTokenDecimals(srcChain.chainId, srcTokenAddress);
      const amountIn = parseUnits(params.amount, decimals).toString();

      const queryParams = new URLSearchParams({
        srcChainId: srcChain.bridgeId.toString(),
        srcChainTokenIn: srcTokenAddress,
        srcChainTokenInAmount: amountIn.toString(),
        dstChainId: dstChain.bridgeId.toString(),
        dstChainTokenOut: dstTokenAddress,
        dstChainTokenOutAmount: 'auto',
        // Always include user address parameters
        dstChainTokenOutRecipient: session.address,
        srcChainOrderAuthorityAddress: session.address,
        dstChainOrderAuthorityAddress: session.address,
      });

      const url = `https://dln.debridge.finance/v1.0/dln/order/create-tx?${queryParams}`;
      console.log('Bridge API Call:', {
        url,
        params,
        amountIn,
      });

      const [response, nativeTokenPrice] = await Promise.all([fetch(url), getNativeTokenPrice(srcChain.chainId)]);

      if (!response.ok) {
        console.error('Bridge API Error:', {
          status: response.status,
          statusText: response.statusText,
          url,
        });

        // Parse error response
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.errorMessage || 'Unknown error';

        // Return helpful messages based on error type
        if (response.status === 400) {
          const context = `Unable to create bridge transaction: ${errorMessage}
            Common issues:
            - The token pair is not supported
            - The amount is too low or too high
            - The chain pair doesn't support this type of bridge

            Please try:
            1. A different chain pair
            2. A different token
            3. Adjusting the amount
            4. Using a popular token like USDC`;
          await sendStreamUpdate(session.userId, context);
        } else {
          await sendStreamUpdate(session.userId, 'Bridge service is temporarily unavailable. Please try again later.');
        }
        return {
          type: 'system',
          message: 'Bridge service is temporarily unavailable. Please try again later.',
          shouldAbort: true,
        };
      }

      const data = await response.json();
      console.log('Bridge API Response:', {
        toolCallId,
        data,
      });

      const message = await sendStreamUpdate(
        session.userId,
        'Notify the user to use the modal below to bridge tokens',
        false,
        0,
        true,
        'stream'
      );

      // Return combined response with both quote and transaction details
      return {
        message: message,
        srcChainId: srcChain.chainId,
        dstChainId: dstChain.chainId,
        estimation: data.estimation,
        nativeTokenPrice: nativeTokenPrice,
        approximateDelay: data.order?.approximateFulfillmentDelay,
        srcChainNativeSymbol: srcChain.nativeSymbol,
        orderId: data.orderId,
        fixFee: data.fixFee,
        amount: params.amount,
        tx: data.tx,
        shouldAbort: true,
      };
    } catch (error) {
      console.error('Bridge Error:', {
        toolCallId,
        error,
        params,
      });

      return {
        type: 'system',
        message: 'Bridge service is temporarily unavailable. Please try again later.',
      };
    }
  },
});

export const bridgeTools = {
  bridge: bridgeTool,
};
