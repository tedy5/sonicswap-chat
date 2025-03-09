import { tool } from 'ai';
import { formatUnits, isAddress, parseUnits, type Address } from 'viem';
import { z } from 'zod';
import { checkAuth } from '@/app/actions/auth';
import { chainId } from '@/config/chains';
import { wAddress } from '@/config/contracts';
import type { SessionData } from '@/types/session';
import { getQuote } from '@/utils/aggregator';
import { getAllUserBalances, getBalances, getContractBalances } from '@/utils/balances';
import { executeSwap } from '@/utils/contract-operations';
import { getTokenAddress } from '@/utils/tokenAddress';
import { getTokenDecimals } from '@/utils/tokenDecimals';
import { getTokenSymbol } from '@/utils/tokenSymbol';
import { sendStreamUpdate } from '@/utils/update-stream';

const swapParamsSchema = z.object({
  fromToken: z.string().describe('Source token address or symbol (e.g. "ETH", "USDC", or contract address)'),
  toToken: z.string().describe('Destination token address or symbol (e.g. "ETH", "USDC", or contract address)'),
  amount: z.string().describe('Amount to swap (in human readable units)'),
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

    console.log('Params: ', params);

    // Resolve fromToken
    let fromTokenAddress: string;
    try {
      if (isAddress(params.fromToken)) {
        fromTokenAddress = params.fromToken;
      } else if (params.fromToken.toLowerCase() === 'native') {
        fromTokenAddress = wAddress;
      } else {
        const resolvedAddress = getTokenAddress(chainId, params.fromToken);
        if (!resolvedAddress) {
          const content = `I couldn't find the token "${params.fromToken}". Please provide the token's contract address.`;
          return { success: false, content };
        }
        fromTokenAddress = resolvedAddress;
      }
    } catch (error) {
      const content = `There was an error resolving the source token: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return { success: false, content };
    }

    // Resolve toToken
    let toTokenAddress: string;
    try {
      if (isAddress(params.toToken)) {
        toTokenAddress = params.toToken;
      } else if (params.toToken.toLowerCase() === 'native') {
        toTokenAddress = wAddress;
      } else {
        const resolvedAddress = getTokenAddress(chainId, params.toToken);
        if (!resolvedAddress) {
          const content = `I couldn't find the token "${params.toToken}". Please provide the token's contract address.`;
          return { success: false, content };
        }
        toTokenAddress = resolvedAddress;
      }
    } catch (error) {
      const content = `There was an error resolving the destination token: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return { success: false, content };
    }

    try {
      // Convert amount to base units
      const decimals = await getTokenDecimals(chainId, fromTokenAddress);
      const amountIn = parseUnits(params.amount, decimals).toString();

      // Check if user has contract balance for the source token
      const contractBalance = await getContractBalances(session.userId, fromTokenAddress as Address);
      const useContract = contractBalance && contractBalance.amount > 0n ? 'contract' : 'wallet';

      // If using wallet, check for approval
      if (useContract === 'wallet') {
        const balances = await getBalances(session.userId, session.address as Address, fromTokenAddress as Address);
        if (balances.walletBalance && BigInt(balances.walletBalance.allowance) < BigInt(amountIn)) {
          const symbol = await getTokenSymbol(chainId, fromTokenAddress as Address);
          const content = await sendStreamUpdate(
            session.userId,
            "You'll need to approve the token allowance first. This is a one-time permission needed for the assistant to swap tokens on your behalf.",
            false,
            1
          );
          return {
            success: true,
            shouldAbort: true,
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
      }

      // Get quote from aggregator
      const quoteResult = await getQuote(fromTokenAddress as Address, toTokenAddress as Address, amountIn);

      if (!quoteResult.success || !quoteResult.data) {
        const content = `Sorry, I couldn't get a quote for your swap: ${quoteResult.error || 'Unknown error'}`;
        return { success: false, content };
      }

      const toDecimals = await getTokenDecimals(chainId, toTokenAddress);
      const estimatedAmountOut = Number(formatUnits(BigInt(quoteResult.data.expectedOutput), toDecimals)).toFixed(4);
      const content = `You're set to receive approximately ${estimatedAmountOut} ${params.toToken}.`;

      console.log('Return: ', {
        success: true,
        content,
        quote: {
          fromToken: params.fromToken,
          toToken: params.toToken,
          amountIn: params.amount,
          estimatedAmountOut: estimatedAmountOut,
        },
      });

      return {
        success: true,
        content,
        quote: {
          fromToken: params.fromToken,
          toToken: params.toToken,
          amountIn: params.amount,
          estimatedAmountOut: estimatedAmountOut,
        },
      };
    } catch (error) {
      const content = `Sorry, there was an error preparing your swap: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return { success: false, content };
    }
  },
});

async function resolveTokenAndAmount(
  params: {
    fromToken: string;
    toToken: string;
    amount: string;
    useContract?: string;
  },
  session: SessionData
) {
  // Resolve fromToken
  let fromTokenAddress: string;
  if (isAddress(params.fromToken)) {
    fromTokenAddress = params.fromToken;
  } else if (params.fromToken.toLowerCase() === 'native') {
    fromTokenAddress = wAddress;
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
    toTokenAddress = wAddress;
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
  if (
    params.useContract === 'wallet' &&
    balances.walletBalance &&
    BigInt(balances.walletBalance.allowance) < BigInt(amountIn)
  ) {
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

      // Check if user has contract balance
      const contractBalance = await getContractBalances(session.userId, fromTokenAddress as Address);
      const useContract = contractBalance && contractBalance.amount > 0n ? 'contract' : 'wallet';

      // If using wallet, check for approval
      if (useContract === 'wallet') {
        const balances = await getBalances(session.userId, session.address as Address, fromTokenAddress as Address);
        if (balances.walletBalance && BigInt(balances.walletBalance.allowance) < BigInt(amountIn)) {
          const symbol = await getTokenSymbol(chainId, fromTokenAddress as Address);
          const decimals = await getTokenDecimals(chainId, fromTokenAddress);

          const content = await sendStreamUpdate(
            session.userId,
            "You'll need to approve the token allowance first. Please use the button below to approve.",
            false,
            1
          );

          return {
            success: true,
            content,
            shouldAbort: true,
            needsApproval: {
              fromAddress: fromTokenAddress as Address,
              toAddress: toTokenAddress as Address,
              amount: amountIn,
              symbol,
              decimals,
            },
          };
        }
      }

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
      console.log('Executing the swap now');
      const swapResult = await executeSwap(quoteResult.data, session.address as Address, useContract === 'contract');

      if (!swapResult.success || !swapResult.data) {
        const content = `Sorry, the swap failed: ${swapResult.error}`;
        return { success: false, content };
      }

      console.log('Starting stream to the user');
      await new Promise((resolve) => setTimeout(resolve, 2000));

      let message;
      if (useContract === 'contract') {
        const { message: balancesMessage } = await getAllUserBalances(session.userId);
        message = balancesMessage + `Inform the user that the swap was successful!`;
      } else {
        message = `Inform the user that the swap from their wallet was successful! Write this in new line: [View on Sonicscan](https://sonicscan.org/tx/${swapResult.data.hash} and then nice message in new line after that.`;
      }

      return {
        success: true,
        message: message,
      };
    } catch (error) {
      // Handle approval needed case
      if (error && typeof error === 'object' && 'type' in error && error.type === 'approval_needed') {
        const content =
          "You'll need to approve the token allowance first. This is a one-time permission needed for the assistant to swap tokens on your behalf.";
        return {
          success: false,
          content,
        };
      }

      // Handle other errors
      const content = `Sorry, there was an unexpected error with your swap: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return { success: false, content };
    }
  },
});

export const swapTools = {
  getQuote: getSwapQuoteTool,
  executeSwap: executeSwapTool,
};
