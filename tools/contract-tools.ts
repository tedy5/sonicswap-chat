import { tool } from 'ai';
import { formatUnits, isAddress, parseUnits, zeroAddress, type Address } from 'viem';
import { z } from 'zod';
import { checkAuth } from '@/app/actions/auth';
import { chainId } from '@/config/chains';
import { wAddress } from '@/config/contracts';
import type { SessionData } from '@/types/session';
import { getAllUserBalances, getBalances, getContractBalance } from '@/utils/balances';
import { executeWithdraw } from '@/utils/contract-operations';
import { getTokenAddress } from '@/utils/tokenAddress';
import { getTokenDecimals } from '@/utils/tokenDecimals';
import { getTokenSymbol } from '@/utils/tokenSymbol';
import { sendStreamUpdate } from '@/utils/update-stream';

const depositWithdrawParamsSchema = z.object({
  token: z
    .string()
    .describe('Token address or symbol to deposit/withdraw (e.g. "native", "ETH", "USDC" "USDT", or any other symbol)'),
  amount: z
    .string()
    .describe('Amount to deposit/withdraw (in human readable units, or "max"/"all" to withdraw entire balance)'),
});

export const depositToContractTool = tool({
  description: 'Deposit tokens into AI Assistant contract for future trades',
  parameters: depositWithdrawParamsSchema,
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
      if (isAddress(params.token)) {
        fromTokenAddress = params.token;
      } else if (params.token.toLowerCase() === 'native') {
        fromTokenAddress = zeroAddress;
      } else {
        const resolvedAddress = getTokenAddress(chainId, params.token);
        if (!resolvedAddress) {
          const content = `I couldn't find the token "${params.token}". Please use "native" for native token or provide the token's contract address.`;
          return { success: false, message: content };
        }
        fromTokenAddress = resolvedAddress;
      }
    } catch (error) {
      const content = `There was an error resolving the token: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return { success: false, message: content };
    }

    try {
      // Convert amount to base units
      const decimals = fromTokenAddress === zeroAddress ? 18 : await getTokenDecimals(chainId, fromTokenAddress);
      const amountIn = parseUnits(params.amount, decimals).toString();

      // Check if approval is needed for non-native tokens
      if (fromTokenAddress !== zeroAddress) {
        const balances = await getBalances(session.userId, session.address as Address, fromTokenAddress as Address);
        if (balances.walletBalance && BigInt(balances.walletBalance.allowance) < BigInt(amountIn)) {
          const symbol = await getTokenSymbol(chainId, fromTokenAddress as Address);
          const content = await sendStreamUpdate(
            session.userId,
            "You'll need to approve the token allowance first. This is a one-time permission needed for depositing tokens to the assistant contract.",
            false
          );
          return {
            success: true,
            shouldAbort: true,
            content,
            deposit: {
              token: fromTokenAddress,
              amount: amountIn,
              symbol,
              decimals,
              isNative: false,
            },
          };
        }
      }

      // Get token symbol for display (handle native token specially)
      const symbol =
        fromTokenAddress === zeroAddress ? 'S' : await getTokenSymbol(chainId, fromTokenAddress as Address);
      const formattedAmount = formatUnits(BigInt(amountIn), decimals);

      const content = await sendStreamUpdate(
        session.userId,
        `You can use the button below to deposit ${formattedAmount} ${symbol} into the AI Assistant contract. This will allow you to trade directly from the contract balance.`,
        false,
        1
      );

      // Return the response that will be shown in ToolResponse
      return {
        success: true,
        shouldAbort: true,
        content,
        deposit: {
          token: fromTokenAddress,
          amount: amountIn,
          symbol,
          decimals,
          isNative: fromTokenAddress === zeroAddress,
        },
      };
    } catch (error) {
      const content = `Sorry, there was an error preparing your deposit: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return { success: false, message: content };
    }
  },
});

export const withdrawFromContractTool = tool({
  description: 'Withdraw tokens from AI Assistant contract back to user wallet',
  parameters: depositWithdrawParamsSchema,
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
      // Resolve token - convert native/zeroAddress to WETH immediately
      let tokenAddress: string;
      if (isAddress(params.token)) {
        tokenAddress = params.token;
      } else if (params.token.toLowerCase() === 'native') {
        tokenAddress = wAddress; // Use WETH instead of zeroAddress
      } else {
        const resolvedAddress = getTokenAddress(chainId, params.token);
        if (!resolvedAddress) {
          const content = `I couldn't find the token "${params.token}". Please use "native" for native token or provide the token's contract address.`;
          return { success: false, message: content };
        }
        tokenAddress = resolvedAddress;
      }

      // Get decimals - still use 18 for native/WETH
      const decimals = tokenAddress === wAddress ? 18 : await getTokenDecimals(chainId, tokenAddress);

      // Handle max amount
      let amountIn: string;
      if (params.amount.toLowerCase() === 'max' || params.amount.toLowerCase() === 'all') {
        const contractBalance = await getContractBalance(session.address as Address, tokenAddress as Address);
        if (!contractBalance || contractBalance.amount === 0n) {
          // Use 'S' for display when it's WETH
          const symbol = tokenAddress === wAddress ? 'S' : await getTokenSymbol(chainId, tokenAddress as Address);
          const content = `You don't have any ${symbol} in the contract to withdraw.`;
          return { success: false, message: content };
        }
        amountIn = contractBalance.amount.toString();
      } else {
        amountIn = parseUnits(params.amount, decimals).toString();
      }

      // Check balance for non-max withdrawals
      if (params.amount.toLowerCase() !== 'max' && params.amount.toLowerCase() !== 'all') {
        const contractBalance = await getContractBalance(session.address as Address, tokenAddress as Address);
        if (!contractBalance || contractBalance.amount < BigInt(amountIn)) {
          const symbol = tokenAddress === wAddress ? 'S' : await getTokenSymbol(chainId, tokenAddress as Address);
          const content = `Insufficient balance. You have ${formatUnits(contractBalance?.amount || 0n, decimals)} ${symbol} in the contract.`;
          return { success: false, message: content };
        }
      }

      // Execute withdrawal
      const withdrawResult = await executeWithdraw(session.address as Address, tokenAddress as Address, amountIn);

      if (!withdrawResult.success || !withdrawResult.data) {
        const content = `Sorry, the withdrawal failed: ${withdrawResult.error}`;
        return { success: false, message: content };
      }

      // Get symbol for display - still show 'S' for wS
      const symbol = tokenAddress === wAddress ? 'S' : await getTokenSymbol(chainId, tokenAddress as Address);
      const formattedAmount = formatUnits(BigInt(amountIn), decimals);
      const message = `Successfully processed withdrawal of ${formattedAmount} ${symbol} from the AI Assistant contract to your wallet. [View on Sonicscan](https://sonicscan.org/tx/${withdrawResult.data.hash}) `;

      return {
        success: true,
        message: message,
      };
    } catch (error) {
      const content = `Sorry, there was an error preparing your withdrawal: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return { success: false, message: content };
    }
  },
});

export const checkBalancesTool = tool({
  description: 'Check user contract balances for all tokens',
  parameters: z.object({}),
  execute: async function () {
    const sessionResult = await checkAuth();
    if (!sessionResult) {
      return {
        success: false,
        error: 'Authentication required',
      };
    }
    const session = sessionResult as SessionData;

    console.log('CheckBalances tool invoked');

    try {
      // Use the existing getAllUserBalances function
      const { contractBalances } = await getAllUserBalances(session.userId);

      // Format balances for display
      if (contractBalances.length === 0) {
        const content = "You don't have any tokens in the contract";
        return {
          success: true,
          content,
          balances: [],
        };
      }

      // Format balances into a simple human-readable format
      const formattedBalances = contractBalances.map((balance) => {
        const formattedAmount = formatUnits(balance.amount, balance.decimals || 18);

        return `${formattedAmount} ${balance.symbol || 'Unknown'}`;
      });

      return {
        success: true,
        balances: formattedBalances,
      };
    } catch (error) {
      const content = `Sorry, there was an error checking your balances: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return { success: false, message: content };
    }
  },
});

export const contractBalanceTools = {
  deposit: depositToContractTool,
  withdraw: withdrawFromContractTool,
  checkBalances: checkBalancesTool,
};
