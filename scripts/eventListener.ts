// /scripts/eventListener.ts
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { createPublicClient, erc20Abi, formatEther, formatUnits, getContract, http, parseAbiItem } from 'viem';
import { mainnet } from 'viem/chains';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const WETH_ADDRESS = '0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38' as const;

interface SwapExecutedEvent {
  user: `0x${string}`;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: bigint;
  amountOut: bigint;
}

interface WalletSwapExecutedEvent {
  user: `0x${string}`;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: bigint;
  amountOut: bigint;
}

interface LimitOrderCreatedEvent {
  orderId: `0x${string}`;
  user: `0x${string}`;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: bigint;
  amountOutMin: bigint;
}

interface LimitOrderExecutedEvent {
  orderId: `0x${string}`;
  user: `0x${string}`;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: bigint;
  amountOut: bigint;
}

interface LimitOrderCancelledEvent {
  orderId: `0x${string}`;
}

interface ReceivedEvent {
  user: `0x${string}`;
  amount: bigint;
}

interface WithdrawnEvent {
  user: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
}

interface TokenReceivedEvent {
  user: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
}

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Initialize Viem client
const client = createPublicClient({
  chain: mainnet,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL!),
});

async function getUserBalances(userId: string): Promise<{
  contractBalances: Array<{
    token: string;
    amount: bigint;
    symbol: string;
    decimals: number;
  }>;
  message: string;
}> {
  const { data, error } = await supabase
    .from('user_contract_balances')
    .select('*, balance::text')
    .eq('user_id', userId)
    .gt('balance', 0); // Only get non-zero balances

  if (error) throw error;

  const balances = data.map((balance) => ({
    token: balance.token_address,
    amount: BigInt(balance.balance),
    symbol: balance.token_symbol || '',
    decimals: balance.token_decimals,
  }));

  // Format balances for human readability
  const balancesSummary = balances
    .map((b) => {
      const amount = Number(formatUnits(b.amount, b.decimals));
      const formattedAmount =
        amount < 1
          ? amount.toFixed(6) // Use 6 decimals for small amounts
          : amount.toFixed(2); // Use 2 decimals for amounts >= 1

      return `${formattedAmount} ${b.symbol}`;
    })
    .join(', ');

  return {
    contractBalances: balances,
    message: balances.length
      ? `IMPORTANT: Inform the user about new token balances in a contract (put the currency symbol after the amount and each in new line and make both BOLD and looking nice): ${balancesSummary}. IGNORE any previous transactions or balances mentioned in earlier messages, these are the current correct balances.`
      : 'IMPORTANT: Inform the user that there are no tokens currently in contract. IGNORE any previous transactions or balances mentioned in earlier messages.',
  };
}

async function startEventListener() {
  console.log('🎧 Started listening for events...');

  // Watch for native token deposits (Received events)
  const unwatchReceived = client.watchEvent({
    address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
    event: parseAbiItem('event Received(address user, uint256 amount)'),
    onLogs: async (logs) => {
      for (const log of logs) {
        try {
          const { args } = log;
          if (!args) continue;

          const { user: userAddress, amount } = args as ReceivedEvent;

          // Look up the user's UUID using the checksum address
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('wallet_address', userAddress)
            .single();

          if (userError || !userData) {
            console.error('User not found for address:', userAddress);
            continue;
          }

          const userId = userData.id;

          // Update user_contract_balances with WETH address instead of zero address
          const { data: existingBalance } = await supabase
            .from('user_contract_balances')
            .select('balance::text')
            .eq('user_id', userId)
            .eq('token_address', WETH_ADDRESS) // Use WETH address instead of zero address
            .single();

          if (existingBalance) {
            const { error } = await supabase
              .from('user_contract_balances')
              .update({
                balance: (BigInt(existingBalance.balance) + amount).toString(),
                last_updated_at: new Date().toISOString(),
              })
              .eq('user_id', userId)
              .eq('token_address', WETH_ADDRESS); // Use WETH address

            if (error) throw error;
          } else {
            const { error } = await supabase.from('user_contract_balances').insert({
              user_id: userId,
              token_address: WETH_ADDRESS, // Use WETH address
              balance: amount.toString(),
              token_symbol: 'S', // Update symbol
              token_decimals: 18,
            });

            if (error) throw error;
          }

          // Record the deposit in trading_activities
          const { error: tradingError } = await supabase.from('trading_activities').insert({
            user_id: userId,
            transaction_hash: log.transactionHash,
            trade_type: 'DEPOSIT',
            from_token_address: '0x0000000000000000000000000000000000000000', // Keep as native ETH for the from_token
            to_token_address: WETH_ADDRESS, // But record as WETH for to_token
            from_amount: amount.toString(),
            to_amount: amount.toString(),
            status: 'COMPLETED',
            metadata: {
              symbol: 'S',
              decimals: '18',
            },
            swap_source: 'CONTRACT',
          });

          if (tradingError) throw tradingError;

          const { message: balancesMessage } = await getUserBalances(userId);

          // Send notification
          fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/stream-update`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.STREAM_UPDATE_API_KEY!,
            },
            body: JSON.stringify({
              userId,
              message:
                `Deposit completed successfully! ✨\n\n` +
                `You deposited ${formatEther(amount)} S\n\n` +
                balancesMessage,
            }),
          }).catch((error) => {
            console.error('Failed to send stream update:', error);
          });

          console.log(`✅ Processed native token deposit for user ${userAddress}`);
        } catch (error) {
          console.error('Error processing Received event:', error);
        }
      }
    },
    onError: (error) => {
      console.error('Error watching Received events:', error);
      reconnect();
    },
  });

  const unwatchTokenReceived = client.watchEvent({
    address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
    event: parseAbiItem('event TokenReceived(address user, address token, uint256 amount)'),
    onLogs: async (logs) => {
      for (const log of logs) {
        try {
          const { args } = log;
          if (!args) continue;

          const { user: userAddress, token: tokenAddress, amount } = args as TokenReceivedEvent;

          // Look up the user's UUID using the wallet address
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('wallet_address', userAddress)
            .single();

          if (userError || !userData) {
            console.error('User not found for address:', userAddress);
            continue;
          }

          const userId = userData.id;

          // Get token information
          const tokenContract = getContract({
            address: tokenAddress,
            abi: erc20Abi,
            client,
          });

          const [tokenSymbol, tokenDecimals] = await Promise.all([
            tokenContract.read.symbol(),
            tokenContract.read.decimals(),
          ]);

          // Update user_contract_balances
          const { data: existingBalance } = await supabase
            .from('user_contract_balances')
            .select('balance::text')
            .eq('user_id', userId)
            .eq('token_address', tokenAddress)
            .single();

          if (existingBalance) {
            // Convert both numbers to BigInt before addition
            const currentBalance = BigInt(existingBalance.balance);
            const depositAmount = BigInt(amount.toString());
            const newBalance = currentBalance + depositAmount;

            const { error } = await supabase
              .from('user_contract_balances')
              .update({
                balance: newBalance.toString(),
                last_updated_at: new Date().toISOString(),
              })
              .eq('user_id', userId)
              .eq('token_address', tokenAddress);

            if (error) throw error;
          } else {
            const { error } = await supabase.from('user_contract_balances').insert({
              user_id: userId,
              token_address: tokenAddress,
              balance: BigInt(amount.toString()).toString(), // Convert to BigInt here too
              token_symbol: tokenSymbol,
              token_decimals: tokenDecimals,
            });

            if (error) throw error;
          }

          // Record the deposit in trading_activities
          const { error: tradingError } = await supabase.from('trading_activities').insert({
            user_id: userId,
            transaction_hash: log.transactionHash,
            trade_type: 'DEPOSIT',
            from_token_address: tokenAddress,
            to_token_address: tokenAddress,
            from_amount: amount.toString(),
            to_amount: amount.toString(),
            status: 'COMPLETED',
            metadata: {
              symbol: tokenSymbol,
              decimals: tokenDecimals,
            },
            swap_source: 'CONTRACT',
          });

          if (tradingError) throw tradingError;

          // Get updated balances
          const { message: balancesMessage } = await getUserBalances(userId);

          // Send notification
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/stream-update`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.STREAM_UPDATE_API_KEY!,
            },
            body: JSON.stringify({
              userId,
              message:
                `Token deposit completed successfully! ✨\n\n` +
                `You deposited ${formatUnits(amount, tokenDecimals)} ${tokenSymbol}\n\n` +
                balancesMessage,
            }),
          }).catch((error) => {
            console.error('Failed to send stream update:', error);
          });

          console.log(`✅ Processed token deposit for user ${userAddress}`);
        } catch (error) {
          console.error('Error processing TokenReceived event:', error);
        }
      }
    },
    onError: (error) => {
      console.error('Error watching TokenReceived events:', error);
      reconnect();
    },
  });

  // Watch for WalletSwapExecuted events
  const unwatchWalletSwaps = client.watchEvent({
    address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
    event: parseAbiItem(
      'event WalletSwapExecuted(address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)'
    ),
    onLogs: async (logs) => {
      for (const log of logs) {
        try {
          const { args } = log;
          if (!args) continue;

          const { user: userAddress, tokenIn, tokenOut, amountIn, amountOut } = args as WalletSwapExecutedEvent;

          // Look up the user's UUID using the wallet address
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('wallet_address', userAddress)
            .single();

          if (userError || !userData) {
            console.error('User not found for address:', userAddress);
            continue;
          }

          // Get token information
          const tokenInContract = getContract({
            address: tokenIn as `0x${string}`,
            abi: erc20Abi,
            client,
          });

          const tokenOutContract = getContract({
            address: tokenOut as `0x${string}`,
            abi: erc20Abi,
            client,
          });

          const [tokenInSymbol, tokenInDecimals, tokenOutSymbol, tokenOutDecimals] = await Promise.all([
            tokenInContract.read.symbol(),
            tokenInContract.read.decimals(),
            tokenOutContract.read.symbol(),
            tokenOutContract.read.decimals(),
          ]);

          // Replace wS with S for better UX
          const finalTokenInSymbol = tokenInSymbol === 'wS' ? 'S' : tokenInSymbol;
          const finalTokenOutSymbol = tokenOutSymbol === 'wS' ? 'S' : tokenOutSymbol;

          const userId = userData.id;

          // Handle the swap execution using the database function with WALLET source
          const { error } = await supabase.rpc('handle_swap_execution', {
            p_user_id: userId,
            p_transaction_hash: log.transactionHash,
            p_token_in: tokenIn,
            p_token_out: tokenOut,
            p_amount_in: amountIn.toString(),
            p_amount_out: amountOut.toString(),
            p_token_in_symbol: finalTokenInSymbol,
            p_token_in_decimals: tokenInDecimals,
            p_token_out_symbol: finalTokenOutSymbol,
            p_token_out_decimals: tokenOutDecimals,
            p_swap_source: 'WALLET',
          });

          if (error) throw error;

          console.log(`✅ Processed WalletSwapExecuted event for user ${userAddress}`);
        } catch (error) {
          console.error('Error processing WalletSwapExecuted event:', error);
        }
      }
    },
    onError: (error) => {
      console.error('Error watching wallet swap events:', error);
      reconnect();
    },
  });

  // Watch for SwapExecuted events (contract swaps)
  const unwatchSwapExecuted = client.watchEvent({
    address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
    event: parseAbiItem(
      'event SwapExecuted(address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)'
    ),
    onLogs: async (logs) => {
      for (const log of logs) {
        try {
          const { args } = log;
          if (!args) continue;

          const { user: userAddress, tokenIn, tokenOut, amountIn, amountOut } = args as SwapExecutedEvent;

          // Look up the user's UUID using the wallet address
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('wallet_address', userAddress)
            .single();

          if (userError || !userData) {
            console.error('User not found for address:', userAddress);
            continue;
          }

          // Get token information
          const tokenInContract = getContract({
            address: tokenIn as `0x${string}`,
            abi: erc20Abi,
            client,
          });

          const tokenOutContract = getContract({
            address: tokenOut as `0x${string}`,
            abi: erc20Abi,
            client,
          });

          const [tokenInSymbol, tokenInDecimals, tokenOutSymbol, tokenOutDecimals] = await Promise.all([
            tokenInContract.read.symbol(),
            tokenInContract.read.decimals(),
            tokenOutContract.read.symbol(),
            tokenOutContract.read.decimals(),
          ]);

          // Replace wS with S for better UX
          const finalTokenInSymbol = tokenInSymbol === 'wS' ? 'S' : tokenInSymbol;
          const finalTokenOutSymbol = tokenOutSymbol === 'wS' ? 'S' : tokenOutSymbol;

          const userId = userData.id;

          // Handle the swap execution using the database function
          const { error } = await supabase.rpc('handle_swap_execution', {
            p_user_id: userId,
            p_transaction_hash: log.transactionHash,
            p_token_in: tokenIn,
            p_token_out: tokenOut,
            p_amount_in: amountIn.toString(),
            p_amount_out: amountOut.toString(),
            p_token_in_symbol: finalTokenInSymbol,
            p_token_in_decimals: tokenInDecimals,
            p_token_out_symbol: finalTokenOutSymbol,
            p_token_out_decimals: tokenOutDecimals,
            p_swap_source: 'CONTRACT',
          });

          if (error) throw error;

          console.log(`✅ Processed SwapExecuted event for user ${userAddress}`);
        } catch (error) {
          console.error('Error processing SwapExecuted event:', error);
        }
      }
    },
    onError: (error) => {
      console.error('Error watching events:', error);
      reconnect();
    },
  });

  // Watch for LimitOrderCreated events
  const unwatchLimitOrdersCreated = client.watchEvent({
    address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
    event: parseAbiItem(
      'event LimitOrderCreated(bytes32 indexed orderId, address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin)'
    ),
    onLogs: async (logs) => {
      for (const log of logs) {
        try {
          const { args } = log;
          if (!args) continue;

          const {
            orderId,
            user: userAddress,
            tokenIn,
            tokenOut,
            amountIn,
            amountOutMin,
          } = args as LimitOrderCreatedEvent;

          // Look up the user's UUID using the wallet address
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('wallet_address', userAddress)
            .single();

          if (userError || !userData) {
            console.error('User not found for address:', userAddress);
            continue;
          }

          const userId = userData.id;

          // Get token information
          const tokenInContract = getContract({
            address: tokenIn as `0x${string}`,
            abi: erc20Abi,
            client,
          });

          const tokenOutContract = getContract({
            address: tokenOut as `0x${string}`,
            abi: erc20Abi,
            client,
          });

          const [tokenInSymbol, tokenInDecimals, tokenOutSymbol, tokenOutDecimals] = await Promise.all([
            tokenInContract.read.symbol(),
            tokenInContract.read.decimals(),
            tokenOutContract.read.symbol(),
            tokenOutContract.read.decimals(),
          ]);

          // Replace wS with S for better UX
          const finalTokenInSymbol = tokenInSymbol === 'wS' ? 'S' : tokenInSymbol;
          const finalTokenOutSymbol = tokenOutSymbol === 'wS' ? 'S' : tokenOutSymbol;

          // Normalize token addresses to lowercase for consistent comparison
          const normalizedTokenIn = tokenIn.toLowerCase();
          const normalizedTokenOut = tokenOut.toLowerCase();

          // Check if there's a pending trading strategy for this order
          const { data: pendingStrategies, error: strategiesError } = await supabase
            .from('pending_trading_strategies')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'pending');

          if (strategiesError) {
            console.error('Error fetching pending strategies:', strategiesError);
          }

          // Find matching strategy with case-insensitive token address comparison
          const matchingStrategy = pendingStrategies?.find(
            (s) => s.token_in.toLowerCase() === normalizedTokenIn && s.token_out.toLowerCase() === normalizedTokenOut
          );

          // Prepare metadata with or without trading strategy
          const metadata = {
            tokenInSymbol: finalTokenInSymbol,
            tokenInDecimals,
            tokenOutSymbol: finalTokenOutSymbol,
            tokenOutDecimals,
            userAddress: userAddress,
            transactionHash: log.transactionHash,
          };

          // Add trading strategy if found
          if (matchingStrategy) {
            Object.assign(metadata, { tradingStrategy: matchingStrategy.strategy });

            // Mark the strategy as used
            const { error: updateError } = await supabase
              .from('pending_trading_strategies')
              .update({
                status: 'used',
                order_id: orderId,
              })
              .eq('id', matchingStrategy.id);

            if (updateError) {
              console.error('Error updating strategy status:', updateError);
            } else {
              console.log(`✅ Updated strategy ${matchingStrategy.id} to used with order ${orderId}`);
            }
          }

          // Insert the limit order with the user's UUID and updated schema
          const { error } = await supabase.from('limit_orders').insert({
            user_id: userId,
            token_in: tokenIn,
            token_out: tokenOut,
            amount_in: amountIn.toString(),
            amount_out_min: amountOutMin.toString(),
            order_id: orderId,
            status: 'active',
            metadata,
          });

          if (error) throw error;

          console.log(`✅ Processed LimitOrderCreated event for user ${userAddress} (UUID: ${userId})`);
        } catch (error) {
          console.error('Error processing LimitOrderCreated event:', error);
        }
      }
    },
    onError: (error) => {
      console.error('Error watching limit order events:', error);
      reconnect();
    },
  });

  // Watch for LimitOrderExecuted events
  const unwatchLimitOrdersExecuted = client.watchEvent({
    address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
    event: parseAbiItem(
      'event LimitOrderExecuted(bytes32 indexed orderId, address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)'
    ),
    onLogs: async (logs) => {
      for (const log of logs) {
        try {
          const { args } = log;
          if (!args) continue;

          const {
            orderId,
            user: userAddress,
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
          } = args as LimitOrderExecutedEvent;

          // Find the limit order in the database
          const { data: orderData, error: orderError } = await supabase
            .from('limit_orders')
            .select('id, user_id, token_in, token_out, amount_in, amount_out_min, metadata')
            .eq('order_id', orderId)
            .eq('status', 'active')
            .single();

          if (orderError || !orderData) {
            console.error('Order not found or already processed:', orderId);
            continue;
          }

          // Get token information
          const tokenInContract = getContract({
            address: tokenIn as `0x${string}`,
            abi: erc20Abi,
            client,
          });

          const tokenOutContract = getContract({
            address: tokenOut as `0x${string}`,
            abi: erc20Abi,
            client,
          });

          const [tokenInSymbol, tokenInDecimals, tokenOutSymbol, tokenOutDecimals] = await Promise.all([
            tokenInContract.read.symbol(),
            tokenInContract.read.decimals(),
            tokenOutContract.read.symbol(),
            tokenOutContract.read.decimals(),
          ]);

          // Replace wS with S for better UX
          const finalTokenInSymbol = tokenInSymbol === 'wS' ? 'S' : tokenInSymbol;
          const finalTokenOutSymbol = tokenOutSymbol === 'wS' ? 'S' : tokenOutSymbol;

          // Update the order status to executed
          const { error: updateError } = await supabase
            .from('limit_orders')
            .update({
              status: 'executed',
              executed_at: new Date().toISOString(),
              execution_tx_hash: log.transactionHash,
              metadata: {
                ...orderData.metadata,
                executedAt: new Date().toISOString(),
                executionTxHash: log.transactionHash,
                amountOut: amountOut.toString(),
                actualPrice: (
                  Number(formatUnits(amountOut, tokenOutDecimals)) / Number(formatUnits(amountIn, tokenInDecimals))
                ).toString(),
              },
            })
            .eq('id', orderData.id);

          if (updateError) throw updateError;

          // Use the handle_swap_execution function to record the swap and update balances
          const { error } = await supabase.rpc('handle_swap_execution', {
            p_user_id: orderData.user_id,
            p_transaction_hash: log.transactionHash,
            p_token_in: tokenIn,
            p_token_out: tokenOut,
            p_amount_in: amountIn.toString(),
            p_amount_out: amountOut.toString(),
            p_token_in_symbol: finalTokenInSymbol,
            p_token_in_decimals: tokenInDecimals,
            p_token_out_symbol: finalTokenOutSymbol,
            p_token_out_decimals: tokenOutDecimals,
            p_swap_source: 'CONTRACT', // Use CONTRACT as the swap source
          });

          if (error) throw error;

          // Check if there's a trading strategy in the metadata
          const tradingStrategy = orderData.metadata?.tradingStrategy;

          // Format amounts for human readability
          const formattedAmountIn = formatUnits(amountIn, tokenInDecimals);
          const formattedAmountOut = formatUnits(amountOut, tokenOutDecimals);

          // Calculate the effective price
          const effectivePrice = Number(formattedAmountOut) / Number(formattedAmountIn);
          const formattedPrice = effectivePrice.toFixed(6);

          // Prepare the notification message for the AI
          let notificationMessage =
            `NOTIFICATION: Notify user that their limit order has been successfully executed. ` +
            `${formattedAmountIn} ${finalTokenInSymbol} to ${formattedAmountOut} ${finalTokenOutSymbol} `;

          // +
          // `at a price of ${formattedPrice} ${finalTokenOutSymbol}/${finalTokenInSymbol}.\n\n `;

          // Prepare the notification message for the AI
          // let notificationMessage =
          //   `NOTIFICATION: Notify user that their limit order has been successfully executed. `;

          // Add trading strategy if it exists
          if (tradingStrategy) {
            notificationMessage += `Do the following next step without requiring user interaction: ${tradingStrategy}`;
          }

          // Send notification to user about the executed order
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/stream-update`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.STREAM_UPDATE_API_KEY!,
            },
            body: JSON.stringify({
              userId: orderData.user_id,
              message: notificationMessage,
              shouldSave: true,
              maxContextMessages: 0,
              skipHistory: true,
              promptType: 'limit',
            }),
          }).catch((error) => {
            console.error('Failed to send stream update:', error);
          });

          console.log(`✅ Processed LimitOrderExecuted event for order ${orderId}`);
        } catch (error) {
          console.error('Error processing LimitOrderExecuted event:', error);
        }
      }
    },
    onError: (error) => {
      console.error('Error watching limit order executed events:', error);
      reconnect();
    },
  });

  // Watch for LimitOrderCancelled events
  const unwatchLimitOrdersCancelled = client.watchEvent({
    address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
    event: parseAbiItem('event LimitOrderCancelled(bytes32 indexed orderId)'),
    onLogs: async (logs) => {
      for (const log of logs) {
        try {
          const { args } = log;
          if (!args) continue;

          const { orderId } = args as LimitOrderCancelledEvent;

          // Find the limit order in the database
          const { data: orderData, error: orderError } = await supabase
            .from('limit_orders')
            .select('id, user_id, token_in, token_out, amount_in, amount_out_min, metadata')
            .eq('order_id', orderId)
            .eq('status', 'active')
            .single();

          if (orderError || !orderData) {
            console.error('Order not found or already processed:', orderId);
            continue;
          }

          // Update the order status to cancelled
          const { error: updateError } = await supabase
            .from('limit_orders')
            .update({
              status: 'cancelled',
              metadata: {
                ...orderData.metadata,
                cancelledAt: new Date().toISOString(),
                cancellationTxHash: log.transactionHash,
              },
            })
            .eq('id', orderData.id);

          if (updateError) throw updateError;

          console.log(`✅ Processed LimitOrderCancelled event for order ${orderId}`);
        } catch (error) {
          console.error('Error processing LimitOrderCancelled event:', error);
        }
      }
    },
    onError: (error) => {
      console.error('Error watching limit order cancelled events:', error);
      reconnect();
    },
  });

  // Watch for Withdrawn events
  const unwatchWithdrawn = client.watchEvent({
    address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
    event: parseAbiItem('event Withdrawn(address user, address token, uint256 amount)'),
    onLogs: async (logs) => {
      for (const log of logs) {
        try {
          const { args } = log;
          if (!args) continue;

          const { user: userAddress, token: tokenAddress, amount } = args as WithdrawnEvent;

          // Look up the user's UUID using the wallet address
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('wallet_address', userAddress)
            .single();

          if (userError || !userData) {
            console.error('User not found for address:', userAddress);
            continue;
          }

          const userId = userData.id;

          // Get token information - handle WETH specially
          let tokenSymbol = 'Unknown';
          let tokenDecimals = 18; // Default to 18 decimals

          if (tokenAddress === WETH_ADDRESS) {
            tokenSymbol = 'S';
            tokenDecimals = 18;
          } else {
            try {
              const tokenContract = getContract({
                address: tokenAddress as `0x${string}`,
                abi: erc20Abi,
                client,
              });

              const [symbol, decimals] = await Promise.all([
                tokenContract.read.symbol(),
                tokenContract.read.decimals(),
              ]);

              tokenSymbol = symbol;
              tokenDecimals = decimals;
            } catch (error) {
              console.error('Error fetching token metadata:', error);
              // Continue with default values set above
            }
          }

          // Update user_contract_balances
          const { data: existingBalance } = await supabase
            .from('user_contract_balances')
            .select('balance::text')
            .eq('user_id', userId)
            .eq('token_address', tokenAddress)
            .single();

          if (existingBalance) {
            const currentBalance = BigInt(existingBalance.balance);
            const withdrawalAmount = BigInt(amount.toString());

            const newBalance = currentBalance - withdrawalAmount;
            console.log('Calculated new balance:', newBalance.toString());

            if (newBalance === 0n) {
              // Delete the row instead of updating when balance is zero
              const { error: deleteError } = await supabase
                .from('user_contract_balances')
                .delete()
                .eq('user_id', userId)
                .eq('token_address', tokenAddress);

              if (deleteError) throw deleteError;
            } else {
              // Update the balance when it's not zero
              const { error: updateError } = await supabase
                .from('user_contract_balances')
                .update({
                  balance: newBalance.toString(),
                  last_updated_at: new Date().toISOString(),
                })
                .eq('user_id', userId)
                .eq('token_address', tokenAddress);

              if (updateError) throw updateError;
            }
          }

          // Record the withdrawal in trading_activities
          const { error: tradingError } = await supabase.from('trading_activities').insert({
            user_id: userId,
            transaction_hash: log.transactionHash,
            trade_type: 'WITHDRAWAL',
            from_token_address: tokenAddress,
            to_token_address: tokenAddress === WETH_ADDRESS ? tokenAddress : tokenAddress, // No need for zero address now
            from_amount: amount.toString(),
            to_amount: amount.toString(),
            status: 'COMPLETED',
            metadata: {
              symbol: tokenSymbol,
              decimals: tokenDecimals,
            },
            swap_source: 'CONTRACT',
          });

          if (tradingError) throw tradingError;

          console.log(`✅ Processed withdrawal for user ${userAddress}`);
        } catch (error) {
          console.error('Error processing Withdrawn event:', error);
        }
      }
    },
    onError: (error) => {
      console.error('Error watching Withdrawn events:', error);
      reconnect();
    },
  });

  return () => {
    unwatchReceived();
    unwatchTokenReceived();
    unwatchWalletSwaps();
    unwatchSwapExecuted();
    unwatchLimitOrdersCreated();
    unwatchLimitOrdersExecuted();
    unwatchLimitOrdersCancelled();
    unwatchWithdrawn();
  };
}

async function reconnect() {
  console.log('Attempting to reconnect...');
  setTimeout(startEventListener, 5000);
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('Stopping event listener...');
  process.exit(0);
});

// Start the listener
startEventListener().catch(console.error);
