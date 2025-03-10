import path from 'path';
import dotenv from 'dotenv';
import { createPublicClient, createWalletClient, erc20Abi, formatUnits, http, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sonic } from 'viem/chains';
import { ASSISTANT_CONTRACT_ABI } from '../config/contracts';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.NEXT_PUBLIC_CONTRACT_ADDRESS) {
  console.error('NEXT_PUBLIC_CONTRACT_ADDRESS environment variable is required');
  process.exit(1);
}
const ASSISTANT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Address;

// Ensure required environment variables are set
if (!process.env.EXECUTOR_PRIVATE_KEY) {
  console.error('EXECUTOR_PRIVATE_KEY environment variable is required');
  process.exit(1);
}

if (!process.env.NEXT_PUBLIC_RPC_URL) {
  console.error('NEXT_PUBLIC_RPC_URL environment variable is required');
  process.exit(1);
}

if (!process.env.ODOS_API_URL) {
  console.error('ODOS_API_URL environment variable is required');
  process.exit(1);
}

// Initialize Viem clients
const publicClient = createPublicClient({
  chain: sonic,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL),
});

const account = privateKeyToAccount(process.env.EXECUTOR_PRIVATE_KEY as `0x${string}`);

const walletClient = createWalletClient({
  account,
  chain: sonic,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL),
});

// Batch size for fetching orders
const BATCH_SIZE = 10;
const SLIPPAGE = 5; // 1% slippage

// Cache for token decimals to avoid repeated calls
const tokenDecimalsCache: Record<string, number> = {};

// Function to get token decimals
async function getTokenDecimals(tokenAddress: Address): Promise<number> {
  // Check cache first
  if (tokenDecimalsCache[tokenAddress]) {
    return tokenDecimalsCache[tokenAddress];
  }

  try {
    const decimals = (await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'decimals',
    })) as number;

    // Cache the result
    tokenDecimalsCache[tokenAddress] = decimals;
    return decimals;
  } catch (error) {
    console.error(`Error fetching decimals for token ${tokenAddress}:`, error);
    return 18; // Default to 18 as fallback
  }
}

// Odos aggregator types
interface OdosQuoteRequest {
  chainId: number;
  inputTokens: {
    tokenAddress: Address;
    amount: string;
  }[];
  outputTokens: {
    tokenAddress: Address;
    proportion: number;
  }[];
  userAddr: Address;
  slippageLimitPercent: number;
  disableRFQs?: boolean;
  compact?: boolean;
}

interface OdosQuoteResponse {
  pathId: string;
  price: string;
  priceImpact: string;
  // Other fields...
}

interface OdosSwapRequest {
  userAddr: Address;
  pathId: string;
  simulate?: boolean;
}

interface OdosSwapResponse {
  outputTokens: {
    tokenAddress: Address;
    amount: string;
  }[];
  transaction: {
    to: string;
    data: string;
  };
  // Other fields...
}

interface SwapQuote {
  pathId: string;
  fromToken: Address;
  toToken: Address;
  amountIn: string;
  expectedOutput: string;
  price: string;
  priceImpact: string;
  transaction: {
    to: Address;
    data: `0x${string}`;
  };
  minOutputAmount: string;
}

interface SwapResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Odos aggregator functions
async function getQuote(fromToken: Address, toToken: Address, amount: string): Promise<SwapResult<SwapQuote>> {
  try {
    console.log(`Requesting quote: ${fromToken} → ${toToken}, amount: ${amount}`);

    // Get initial quote
    const quoteResponse = await fetchOdosQuote({
      chainId: 146,
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

    console.log(`Quote received with pathId: ${quoteResponse.data.pathId}`);

    // Get swap data
    const swapResponse = await fetchOdosSwapData({
      userAddr: ASSISTANT_CONTRACT_ADDRESS,
      pathId: quoteResponse.data.pathId,
      simulate: false,
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
      const errorText = await response.text();
      console.error(`Odos quote error response: ${errorText}`);
      return {
        success: false,
        error: `Odos quote failed: ${response.statusText} - ${errorText}`,
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
      const errorText = await response.text();
      console.error(`Odos swap data error response: ${errorText}`);
      return {
        success: false,
        error: `Odos swap data failed: ${response.statusText} - ${errorText}`,
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

interface OrderDetails {
  orderId: `0x${string}`;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  amountOutMin: bigint;
}

async function fetchActiveOrders(): Promise<OrderDetails[]> {
  try {
    // Get total number of active orders
    console.log('Calling getTotalActiveOrders...');
    const totalOrders = (await publicClient.readContract({
      address: ASSISTANT_CONTRACT_ADDRESS as Address,
      abi: ASSISTANT_CONTRACT_ABI,
      functionName: 'getTotalActiveOrders',
      account: account.address,
    })) as bigint;

    console.log(`Total active orders: ${totalOrders}`);

    if (totalOrders === 0n) {
      return [];
    }

    // Fetch orders in batches
    const allOrders: OrderDetails[] = [];
    let offset = 0;

    while (offset < Number(totalOrders)) {
      const [orders] = (await publicClient.readContract({
        address: ASSISTANT_CONTRACT_ADDRESS as Address,
        abi: ASSISTANT_CONTRACT_ABI,
        functionName: 'getActiveOrders',
        args: [BigInt(offset), BigInt(BATCH_SIZE)],
        account: account.address,
      })) as [OrderDetails[], bigint];

      allOrders.push(...orders);
      offset += BATCH_SIZE;
    }

    return allOrders;
  } catch (error) {
    console.error('Error fetching active orders:', error);
    return [];
  }
}

async function checkAndExecuteOrders() {
  try {
    console.log('Fetching active limit orders...');
    const activeOrders = await fetchActiveOrders();

    if (activeOrders.length === 0) {
      console.log('No active orders found');
      return;
    }

    console.log(`Found ${activeOrders.length} active orders. Checking market prices...`);

    for (const order of activeOrders) {
      try {
        // Get token decimals
        const tokenInDecimals = await getTokenDecimals(order.tokenIn);
        const tokenOutDecimals = await getTokenDecimals(order.tokenOut);

        console.log(`\nChecking order ${order.orderId}:`);
        console.log(`  Token In: ${order.tokenIn} (${tokenInDecimals} decimals)`);
        console.log(`  Token Out: ${order.tokenOut} (${tokenOutDecimals} decimals)`);
        console.log(`  Amount In: ${formatUnits(order.amountIn, tokenInDecimals)}`);
        console.log(`  Min Amount Out: ${formatUnits(order.amountOutMin, tokenOutDecimals)}`);

        // Get current market price using our direct Odos implementation
        const quoteResult = await getQuote(order.tokenIn, order.tokenOut, order.amountIn.toString());

        if (!quoteResult.success || !quoteResult.data) {
          console.log(`  Failed to get quote: ${quoteResult.error}`);
          continue;
        }

        const quote = quoteResult.data;
        const expectedOutput = BigInt(quote.expectedOutput);

        console.log(`  Current market price: ${formatUnits(expectedOutput, tokenOutDecimals)}`);
        console.log(`  Required minimum: ${formatUnits(order.amountOutMin, tokenOutDecimals)}`);

        // Check if the current price meets or exceeds the minimum required output
        if (expectedOutput >= order.amountOutMin) {
          console.log(`  ✅ Market price is favorable. Executing order...`);
          console.log(order.orderId, quote.transaction.to, quote.transaction.data);

          // Execute the order
          const txHash = await walletClient.writeContract({
            address: ASSISTANT_CONTRACT_ADDRESS,
            abi: ASSISTANT_CONTRACT_ABI,
            functionName: 'executeLimitOrder',
            args: [order.orderId, quote.transaction.to, quote.transaction.data],
          });

          console.log(`  🎉 Order executed! Transaction hash: ${txHash}`);

          // Wait for transaction confirmation
          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
          console.log(`  Transaction confirmed in block ${receipt.blockNumber}`);
        } else {
          console.log(`  ❌ Market price is not favorable yet. Skipping.`);
        }
      } catch (error) {
        console.error(`  Error processing order ${order.orderId}:`, error);
      }
    }

    console.log('\nFinished checking all orders');
  } catch (error) {
    console.error('Error in checkAndExecuteOrders:', error);
  }
}

// Run the script
async function main() {
  console.log('Starting limit order execution script...');
  console.log(`Using account: ${account.address}`);
  console.log('Checking for orders every 30 seconds...');

  // Flag to track if the script is running
  let isRunning = false;

  // Set up interval to run every 30 seconds
  setInterval(async () => {
    // Skip if already running to prevent overlapping executions
    if (isRunning) {
      console.log('Previous execution still in progress, skipping...');
      return;
    }

    isRunning = true;
    console.log(`\n[${new Date().toISOString()}] Checking for orders...`);

    try {
      await checkAndExecuteOrders();
    } catch (error) {
      console.error('Error during execution:', error);
    } finally {
      isRunning = false;
    }
  }, 30000); // 30 seconds in milliseconds

  // Run once immediately on startup
  try {
    isRunning = true;
    await checkAndExecuteOrders();
  } catch (error) {
    console.error('Error during initial execution:', error);
  } finally {
    isRunning = false;
  }

  // Keep the process running
  console.log('Script is now running in the background. Press Ctrl+C to stop.');
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nStopping limit order execution script...');
  process.exit(0);
});

// Start the script
main().catch((error) => {
  console.error('Fatal error in main process:', error);
  process.exit(1);
});
