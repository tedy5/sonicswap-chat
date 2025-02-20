import { tool } from 'ai';
import { formatUnits, isAddress, parseUnits, zeroAddress, type Address } from 'viem';
import { z } from 'zod';
import { checkAuth } from '@/app/actions/auth';
import { chainId } from '@/config/chains';
import type { SessionData } from '@/types/session';
import { executeSwap, getQuote } from '@/utils/aggregator';
import { getBalances } from '@/utils/balances';
import { getTokenAddress } from '@/utils/tokenAddress';
import { getTokenDecimals } from '@/utils/tokenDecimals';
import { getTokenSymbol } from '@/utils/tokenSymbol';
import { sendStreamUpdate } from '@/utils/update-stream';

const swapParamsSchema = z.object({
  fromToken: z.string().describe('Source token address or symbol (e.g. "ETH", "USDC", or contract address)'),
  toToken: z.string().describe('Destination token address or symbol (e.g. "ETH", "USDC", or contract address)'),
  amount: z.string().describe('Amount to swap (in human readable units)'),
  useContract: z.boolean().optional().describe('Whether to use contract balance for swap'),
});

export const getSwapQuoteTool = tool({
  description: 'Get swap quote with available options',
  parameters: swapParamsSchema,
  execute: async function (params) {
    const sessionResult = await checkAuth();
    if (!sessionResult) {
      return {
        success: false,
        error: 'Authentication required',
      };
    }
    const session = sessionResult as SessionData;

    // Resolve fromToken
    let fromTokenAddress: string;
    try {
      if (isAddress(params.fromToken)) {
        fromTokenAddress = params.fromToken;
      } else if (params.fromToken.toLowerCase() === 'native') {
        fromTokenAddress = zeroAddress;
      } else {
        const resolvedAddress = getTokenAddress(chainId, params.fromToken);
        if (!resolvedAddress) {
          const content = await sendStreamUpdate(
            session.userId,
            `I couldn't find the token "${params.fromToken}". Please provide the token's contract address.`,
            false
          );
          return { success: false, content };
        }
        fromTokenAddress = resolvedAddress;
      }
    } catch (error) {
      const content = await sendStreamUpdate(
        session.userId,
        `There was an error resolving the source token: ${error instanceof Error ? error.message : 'Unknown error'}`,
        false
      );
      return { success: false, content };
    }

    // Resolve toToken
    let toTokenAddress: string;
    try {
      if (isAddress(params.toToken)) {
        toTokenAddress = params.toToken;
      } else if (params.toToken.toLowerCase() === 'native') {
        toTokenAddress = zeroAddress;
      } else {
        const resolvedAddress = getTokenAddress(chainId, params.toToken);
        if (!resolvedAddress) {
          const content = await sendStreamUpdate(
            session.userId,
            `I couldn't find the token "${params.toToken}". Please provide the token's contract address.`,
            false
          );
          return { success: false, content };
        }
        toTokenAddress = resolvedAddress;
      }
    } catch (error) {
      const content = await sendStreamUpdate(
        session.userId,
        `There was an error resolving the destination token: ${error instanceof Error ? error.message : 'Unknown error'}`,
        false
      );
      return { success: false, content };
    }

    try {
      // Convert amount to base units
      const decimals = await getTokenDecimals(chainId, fromTokenAddress);
      const amountIn = parseUnits(params.amount, decimals).toString();

      // Get user's balances and check approval
      const balances = await getBalances(session.userId, session.address as Address, fromTokenAddress as Address);

      // Check if approval is needed
      if (
        !params.useContract &&
        balances.walletBalance &&
        BigInt(balances.walletBalance.allowance) < BigInt(amountIn)
      ) {
        const symbol = await getTokenSymbol(chainId, fromTokenAddress as Address);
        const content = await sendStreamUpdate(
          session.userId,
          "You'll need to approve the token allowance first. This is a one-time permission needed for the assistant to swap tokens on your behalf.",
          false
        );
        return {
          success: true,
          content,
          needsApproval: {
            fromAddress: fromTokenAddress as Address,
            toAddress: toTokenAddress as Address,
            amount: amountIn,
            symbol,
            decimals,
          },
        };
      }

      // Get quote from aggregator
      const quoteResult = await getQuote(fromTokenAddress as Address, toTokenAddress as Address, amountIn);

      if (!quoteResult.success || !quoteResult.data) {
        const content = await sendStreamUpdate(
          session.userId,
          `Sorry, I couldn't get a quote for your swap: ${quoteResult.error || 'Unknown error'}`,
          false
        );
        return { success: false, content };
      }

      const toDecimals = await getTokenDecimals(chainId, toTokenAddress);
      const output = formatUnits(BigInt(quoteResult.data.expectedOutput), toDecimals);

      const content = await sendStreamUpdate(
        session.userId,
        `You're set to receive approximately ${output} ${params.toToken}. Would you like to proceed with the swap? 🚀`,
        false
      );

      return {
        success: true,
        content,
        quote: quoteResult.data,
      };
    } catch (error) {
      const content = await sendStreamUpdate(
        session.userId,
        `Sorry, there was an error preparing your swap: ${error instanceof Error ? error.message : 'Unknown error'}`,
        false
      );
      return { success: false, content };
    }
  },
});

async function resolveTokenAndAmount(
  params: {
    fromToken: string;
    toToken: string;
    amount: string;
    useContract?: boolean;
  },
  session: SessionData
) {
  // Resolve fromToken
  let fromTokenAddress: string;
  if (isAddress(params.fromToken)) {
    fromTokenAddress = params.fromToken;
  } else if (params.fromToken.toLowerCase() === 'native') {
    fromTokenAddress = zeroAddress;
  } else {
    const resolvedAddress = getTokenAddress(chainId, params.fromToken);
    if (!resolvedAddress) {
      throw new Error(`Could not find token "${params.fromToken}". Please provide the token's contract address.`);
    }
    fromTokenAddress = resolvedAddress;
  }

  // Resolve toToken
  let toTokenAddress: string;
  if (isAddress(params.toToken)) {
    toTokenAddress = params.toToken;
  } else if (params.toToken.toLowerCase() === 'native') {
    toTokenAddress = zeroAddress;
  } else {
    const resolvedAddress = getTokenAddress(chainId, params.toToken);
    if (!resolvedAddress) {
      throw new Error(`Could not find token "${params.toToken}". Please provide the token's contract address.`);
    }
    toTokenAddress = resolvedAddress;
  }

  // Convert amount to base units
  const decimals = await getTokenDecimals(chainId, fromTokenAddress);
  const amountIn = parseUnits(params.amount, decimals).toString();

  // Get user's balances and check approval
  const balances = await getBalances(session.userId, session.address as Address, fromTokenAddress as Address);

  // Check if approval is needed
  if (!params.useContract && balances.walletBalance && BigInt(balances.walletBalance.allowance) < BigInt(amountIn)) {
    const symbol = await getTokenSymbol(chainId, fromTokenAddress as Address);
    throw {
      type: 'approval_needed',
      needsApproval: {
        fromAddress: fromTokenAddress as Address,
        toAddress: toTokenAddress as Address,
        amount: amountIn,
        symbol,
        decimals,
      },
    };
  }

  return {
    fromTokenAddress: fromTokenAddress as Address,
    toTokenAddress: toTokenAddress as Address,
    amountIn,
  };
}

export const executeSwapTool = tool({
  description: 'Execute swap transaction',
  parameters: swapParamsSchema,
  execute: async function (params) {
    const sessionResult = await checkAuth();
    if (!sessionResult) {
      return {
        success: false,
        error: 'Authentication required',
      };
    }
    const session = sessionResult as SessionData;

    try {
      // Resolve tokens and amount
      const { fromTokenAddress, toTokenAddress, amountIn } = await resolveTokenAndAmount(params, session);

      // Get quote from aggregator
      const quoteResult = await getQuote(fromTokenAddress, toTokenAddress, amountIn);

      if (!quoteResult.success || !quoteResult.data) {
        const content = await sendStreamUpdate(
          session.userId,
          `Sorry, I couldn't get a quote for your swap: ${quoteResult.error || 'Unknown error'}`,
          false
        );
        return { success: false, content };
      }

      // Execute the swap
      const swapResult = await executeSwap(quoteResult.data, session.address as Address, params.useContract ?? false);

      if (!swapResult.success || !swapResult.data) {
        const content = await sendStreamUpdate(
          session.userId,
          `Sorry, the swap failed: ${swapResult.error}${
            swapResult.data?.hash
              ? `\n\nYou can check the transaction here: [View on Sonicscan](https://sonicscan.org/tx/${swapResult.data.hash})`
              : ''
          }`,
          false
        );
        return { success: false, content };
      }

      const content = await sendStreamUpdate(
        session.userId,
        `Great news! Your swap was successful! 🎉\n\n` +
          `You can check the details here: [View on Sonicscan](https://sonicscan.org/tx/${swapResult.data.hash})`,
        false
      );

      return {
        success: true,
        content,
      };
    } catch (error) {
      // Handle approval needed case
      if (error && typeof error === 'object' && 'type' in error && error.type === 'approval_needed') {
        const content = await sendStreamUpdate(
          session.userId,
          "You'll need to approve the token allowance first. This is a one-time permission needed for the assistant to swap tokens on your behalf.",
          false
        );
        return {
          success: false,
          content,
        };
      }

      // Handle other errors
      const content = await sendStreamUpdate(
        session.userId,
        `Sorry, there was an unexpected error with your swap: ${error instanceof Error ? error.message : 'Unknown error'}`,
        false
      );
      return { success: false, content };
    }
  },
});

export const swapTools = {
  getQuote: getSwapQuoteTool,
  executeSwap: executeSwapTool,
};
