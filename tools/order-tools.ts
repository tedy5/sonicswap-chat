import { tool } from 'ai';
import { formatUnits, isAddress, parseUnits, type Address } from 'viem';
import { z } from 'zod';
import { checkAuth } from '@/app/actions/auth';
import { chainId } from '@/config/chains';
import { wAddress } from '@/config/contracts';
import type { SessionData } from '@/types/session';
import { getContractBalance } from '@/utils/balances';
import { cancelLimitOrder, createLimitOrder } from '@/utils/contract-operations';
import { checkOrderExists, getUserActiveOrders } from '@/utils/orders';
import { getTokenAddress } from '@/utils/tokenAddress';
import { getTokenDecimals } from '@/utils/tokenDecimals';
import { getTokenSymbol } from '@/utils/tokenSymbol';

const limitOrderParamsSchema = z.object({
  direction: z
    .enum(['buy', 'sell'])
    .describe('Direction of the trade - "buy" means buying toToken, "sell" means selling fromToken'),
  fromToken: z
    .string()
    .describe('Token address or symbol you are spending (e.g. "S", "USDC", "USDT" or any other symbol)'),
  toToken: z
    .string()
    .describe('Token address or symbol you are receiving (e.g. "S", "USDC", "USDT" or any other symbol)'),
  fromAmount: z.string().describe('Amount of fromToken to spend (in human readable units)'),
  price: z.string().describe('At what price the order should be executed at'),
  tradingStrategy: z
    .string()
    .optional()
    .describe('If user requested the next step, then write it here with future limit price, otherwise leve it empty'),
});

export const submitLimitOrderTool = tool({
  description: 'Submit a limit order to buy/sell tokens at a specific price',
  parameters: limitOrderParamsSchema,
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
      console.log('Order tools invoked. Params: ', params);
      // Resolve fromToken
      let fromTokenAddress: string;
      if (isAddress(params.fromToken)) {
        fromTokenAddress = params.fromToken;
      } else if (params.fromToken.toLowerCase() === 'native') {
        fromTokenAddress = wAddress; // Use wrapped native token for limit orders
      } else {
        const resolvedAddress = getTokenAddress(chainId, params.fromToken);
        if (!resolvedAddress) {
          const content = `I couldn't find the token "${params.fromToken}". Please use "native" for native token or provide the token's contract address.`;
          return { success: false, content };
        }
        fromTokenAddress = resolvedAddress;
      }

      // Resolve toToken
      let toTokenAddress: string;
      if (isAddress(params.toToken)) {
        toTokenAddress = params.toToken;
      } else if (params.toToken.toLowerCase() === 'native') {
        toTokenAddress = wAddress; // Use wrapped native token for limit orders
      } else {
        const resolvedAddress = getTokenAddress(chainId, params.toToken);
        if (!resolvedAddress) {
          const content = `I couldn't find the token "${params.toToken}". Please use "native" for native token or provide the token's contract address.`;
          return { success: false, content };
        }
        toTokenAddress = resolvedAddress;
      }

      // Get decimals for both tokens
      const fromDecimals = await getTokenDecimals(chainId, fromTokenAddress as Address);
      const toDecimals = await getTokenDecimals(chainId, toTokenAddress as Address);

      // Convert amount to base units
      const amountIn = parseUnits(params.fromAmount, fromDecimals).toString();

      // Calculate minimum amount out based on price
      const minAmountOut = parseUnits(
        (Number(params.fromAmount) * Number(params.price)).toString(),
        toDecimals
      ).toString();

      // Check contract balance
      const contractBalance = await getContractBalance(session.address as Address, fromTokenAddress as Address);
      if (!contractBalance || contractBalance.amount < BigInt(amountIn)) {
        const fromSymbol =
          fromTokenAddress === wAddress ? 'S' : await getTokenSymbol(chainId, fromTokenAddress as Address);
        const content = `Insufficient balance. You have ${formatUnits(contractBalance?.amount || 0n, fromDecimals)} ${fromSymbol} in the contract. Please deposit more tokens first.`;
        return { success: false, content };
      }

      const limitOrderResult = await createLimitOrder(
        session.address as Address,
        fromTokenAddress as Address,
        toTokenAddress as Address,
        amountIn,
        minAmountOut
      );

      return {
        success: limitOrderResult.success,
      };
    } catch (error) {
      const content = `Sorry, there was an error submitting your limit order: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return { success: false, content };
    }
  },
});

const cancelLimitOrderParamsSchema = z.object({
  orderId: z
    .string()
    .describe('The ID of the limit order to cancel. You get the ID by invoking orderTools.getActiveOrders'),
});

export const cancelLimitOrderTool = tool({
  description: 'Cancel a previously submitted limit order',
  parameters: cancelLimitOrderParamsSchema,
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
      console.log('Cancel order tool invoked. Params: ', params);

      // First check if the order exists and belongs to the user
      const orderExists = await checkOrderExists(session.userId, params.orderId);
      if (!orderExists) {
        // If order doesn't exist, get all active orders to show the user
        const { activeOrders } = await getUserActiveOrders(session.userId);

        // Format orders for display
        const formattedOrders = activeOrders.map((order) => {
          const fromAmount = formatUnits(order.amountIn, order.tokenInDecimals || 18);
          const toAmount = formatUnits(order.amountOutMin, order.tokenOutDecimals || 18);
          const price = (Number(toAmount) / Number(fromAmount)).toFixed(6);

          return {
            fromToken: order.tokenInSymbol || order.tokenIn,
            toToken: order.tokenOutSymbol || order.tokenOut,
            fromAmount,
            toAmount,
            price,
          };
        });

        let content = `Order with ID ${params.orderId} does not exist.`;

        if (activeOrders.length > 0) {
          content += ` Here are your active orders:\n`;
          return {
            success: false,
            content,
            orders: formattedOrders,
            count: activeOrders.length,
          };
        } else {
          content += ` You don't have any active orders.`;
          return {
            success: false,
            content,
            orders: [],
            count: 0,
          };
        }
      }

      // Call the contract operation to cancel the limit order
      const cancelResult = await cancelLimitOrder(params.orderId);

      if (!cancelResult.success) {
        const content = `Failed to cancel limit order: ${cancelResult.error}`;
        return { success: false, content };
      }

      const content = `Limit order ${params.orderId} has been successfully cancelled.`;

      return {
        success: true,
        content,
      };
    } catch (error) {
      const content = `Sorry, there was an error cancelling your limit order: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return { success: false, content };
    }
  },
});

const getActiveOrdersParamsSchema = z.object({});

export const getActiveOrdersTool = tool({
  description: 'Get all active limit orders for the current user',
  parameters: getActiveOrdersParamsSchema,
  execute: async function () {
    const sessionResult = await checkAuth();
    if (!sessionResult) {
      return {
        success: false,
        error: 'Authentication required',
      };
    }
    const session = sessionResult as SessionData;

    try {
      console.log('Get active orders tool invoked');

      // Get active orders for the current user
      const { activeOrders } = await getUserActiveOrders(session.userId);

      // Format orders for display
      const formattedOrders = activeOrders.map((order) => {
        const fromAmount = formatUnits(order.amountIn, order.tokenInDecimals || 18);
        const toAmount = formatUnits(order.amountOutMin, order.tokenOutDecimals || 18);
        const price = (Number(toAmount) / Number(fromAmount)).toFixed(6);

        return {
          orderId: order.orderId,
          fromToken: order.tokenInSymbol || order.tokenIn,
          toToken: order.tokenOutSymbol || order.tokenOut,
          fromAmount,
          toAmount,
          price,
          createdAt: order.createdAt.toISOString(),
        };
      });

      return {
        success: true,
        orders: formattedOrders,
        count: activeOrders.length,
        message:
          activeOrders.length > 0
            ? `Found ${activeOrders.length} active limit order(s).`
            : 'No active limit orders found.',
      };
    } catch (error) {
      const content = `Sorry, there was an error retrieving your active orders: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return { success: false, content };
    }
  },
});

export const orderTools = {
  submitLimitOrder: submitLimitOrderTool,
  cancelLimitOrder: cancelLimitOrderTool,
  getActiveOrders: getActiveOrdersTool,
};
