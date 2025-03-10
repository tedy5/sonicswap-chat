import { type Address } from 'viem';
import { supabase } from '@/supabase/server';
import type { LimitOrder } from '@/types/tools';

export async function getActiveOrders(userId: string): Promise<LimitOrder[]> {
  try {
    const { data, error } = await supabase
      .from('limit_orders')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) throw error;

    // Convert database records to LimitOrder objects
    const orders = data.map((order) => {
      const metadata = order.metadata || {};

      return {
        id: order.id,
        tokenIn: order.token_in as Address,
        tokenOut: order.token_out as Address,
        amountIn: BigInt(order.amount_in),
        amountOutMin: BigInt(order.amount_out_min),
        status: order.status as 'active' | 'executed' | 'cancelled',
        createdAt: new Date(order.created_at),
        executedAt: order.executed_at ? new Date(order.executed_at) : undefined,
        executionTxHash: order.execution_tx_hash || undefined,
        orderId: order.order_id || undefined,
        userAddress: metadata.userAddress as Address | undefined,
        tokenInSymbol: metadata.tokenInSymbol,
        tokenOutSymbol: metadata.tokenOutSymbol,
        tokenInDecimals: metadata.tokenInDecimals,
        tokenOutDecimals: metadata.tokenOutDecimals,
        transactionHash: metadata.transactionHash,
      };
    });

    return orders;
  } catch (error) {
    console.error('Error fetching active orders:', error);
    throw error;
  }
}

export async function getOrderById(orderId: string): Promise<LimitOrder | null> {
  try {
    const { data, error } = await supabase.from('limit_orders').select('*').eq('id', orderId).single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Order not found
      }
      throw error;
    }

    const metadata = data.metadata || {};

    return {
      id: data.id,
      tokenIn: data.token_in as Address,
      tokenOut: data.token_out as Address,
      amountIn: BigInt(data.amount_in),
      amountOutMin: BigInt(data.amount_out_min),
      status: data.status as 'active' | 'executed' | 'cancelled',
      createdAt: new Date(data.created_at),
      executedAt: data.executed_at ? new Date(data.executed_at) : undefined,
      executionTxHash: data.execution_tx_hash || undefined,
      orderId: data.order_id || undefined,
      userAddress: metadata.userAddress as Address | undefined,
      tokenInSymbol: metadata.tokenInSymbol,
      tokenOutSymbol: metadata.tokenOutSymbol,
      tokenInDecimals: metadata.tokenInDecimals,
      tokenOutDecimals: metadata.tokenOutDecimals,
      transactionHash: metadata.transactionHash,
    };
  } catch (error) {
    console.error('Error fetching order by ID:', error);
    throw error;
  }
}

export async function getUserActiveOrders(userId: string): Promise<{
  activeOrders: LimitOrder[];
  message: string;
}> {
  const orders = await getActiveOrders(userId);

  // Create a human-readable summary
  const ordersSummary = orders
    .map((order) => {
      const amountIn = formatAmount(order.amountIn, order.tokenInDecimals || 18);
      const amountOutMin = formatAmount(order.amountOutMin, order.tokenOutDecimals || 18);
      return `${amountIn} ${order.tokenInSymbol || 'tokens'} → ${amountOutMin} ${order.tokenOutSymbol || 'tokens'}`;
    })
    .join('\n');

  return {
    activeOrders: orders,
    message: orders.length
      ? `IMPORTANT: User has ${orders.length} active limit order(s):\n${ordersSummary}`
      : 'CURRENT SNAPSHOT: No active limit orders. Ignore any orders mentioned in previous messages.',
  };
}

export async function checkOrderExists(userId: string, orderId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('limit_orders')
      .select('id')
      .eq('user_id', userId)
      .eq('order_id', orderId)
      .eq('status', 'active')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No matching record found
        return false;
      }
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error checking if order exists:', error);
    return false;
  }
}

export async function storeTradingStrategy(
  userId: string,
  tokenIn: string,
  tokenOut: string,
  tradingStrategy: object
): Promise<void> {
  const { error } = await supabase.from('pending_trading_strategies').insert({
    user_id: userId,
    token_in: tokenIn.toLowerCase(),
    token_out: tokenOut.toLowerCase(),
    strategy: tradingStrategy,
  });

  if (error) throw error;
}

function formatAmount(amount: bigint, decimals: number = 18): string {
  return (Number(amount) / Math.pow(10, decimals)).toFixed(4);
}
