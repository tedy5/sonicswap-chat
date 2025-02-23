import { zeroAddress, type Address } from 'viem';
import { chainId } from '@/config/chains';
import { ASSISTANT_CONTRACT_ABI, ASSISTANT_CONTRACT_ADDRESS, wAddress } from '@/config/contracts';
import { supabase } from '@/supabase/server';
import { getTokenDecimals } from '@/utils/tokenDecimals';
import { getTokenSymbol } from '@/utils/tokenSymbol';
import { getPublicClient } from './publicClient';

export interface TokenBalance {
  token: Address;
  amount: bigint;
  allowance: bigint;
  symbol?: string;
  decimals?: number;
}

export interface ContractBalance {
  token: Address;
  amount: bigint;
  symbol?: string;
  decimals?: number;
}

export interface BalanceResponse {
  walletBalance: TokenBalance;
  contractBalance: ContractBalance[] | undefined;
}

export async function getBalances(
  userId: string,
  userAddress: Address,
  tokenAddress: Address
): Promise<BalanceResponse> {
  // Fetch both balances in parallel
  const [walletBalance, contractBalance] = await Promise.all([
    getWalletBalance(userAddress, tokenAddress),
    getContractBalances(userId, tokenAddress),
  ]);

  return {
    walletBalance,
    contractBalance: contractBalance ? [contractBalance] : undefined,
  };
}

async function getWalletBalance(userAddress: Address, tokenAddress: Address): Promise<TokenBalance> {
  const publicClient = getPublicClient(146);

  try {
    const [balance, allowance] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress,
        abi: [
          {
            name: 'balanceOf',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ name: '', type: 'uint256' }],
          },
        ],
        functionName: 'balanceOf',
        args: [userAddress],
      }),
      publicClient.readContract({
        address: tokenAddress,
        abi: [
          {
            name: 'allowance',
            type: 'function',
            stateMutability: 'view',
            inputs: [
              { name: 'owner', type: 'address' },
              { name: 'spender', type: 'address' },
            ],
            outputs: [{ name: '', type: 'uint256' }],
          },
        ],
        functionName: 'allowance',
        args: [userAddress, process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Address],
      }),
    ]);

    return {
      token: tokenAddress,
      amount: balance,
      allowance,
    };
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    throw error;
  }
}

export async function getContractBalance(userAddress: Address, tokenAddress: Address): Promise<ContractBalance | null> {
  try {
    const publicClient = getPublicClient(chainId);

    // If requesting native token balance, check WETH balance instead
    const checkAddress = tokenAddress === zeroAddress ? wAddress : tokenAddress;

    // Get balance from contract using imported ABI
    const balance = await publicClient.readContract({
      address: ASSISTANT_CONTRACT_ADDRESS,
      abi: ASSISTANT_CONTRACT_ABI,
      functionName: 'getUserBalance',
      args: [userAddress, checkAddress],
    });

    // If balance is 0, return null
    if (balance === 0n) {
      return null;
    }

    // For display purposes, we still use native token symbol and address
    // even though internally it's stored as WETH
    const displayAddress = tokenAddress === zeroAddress ? zeroAddress : tokenAddress;
    let symbol: string | undefined;
    let decimals: number | undefined;

    if (tokenAddress === zeroAddress) {
      symbol = 'S';
      decimals = 18;
    } else {
      try {
        [symbol, decimals] = await Promise.all([
          getTokenSymbol(chainId, tokenAddress),
          getTokenDecimals(chainId, tokenAddress),
        ]);
      } catch (error) {
        console.warn('Failed to fetch token metadata:', error);
        // Continue without metadata
      }
    }

    return {
      token: displayAddress, // Return the original requested token address
      amount: balance,
      symbol,
      decimals,
    };
  } catch (error) {
    console.error('Error fetching contract balance from blockchain:', error);
    throw error;
  }
}

export async function getContractBalances(userId: string, tokenAddress: Address): Promise<ContractBalance | null> {
  try {
    const { data, error } = await supabase
      .from('user_contract_balances')
      .select('balance')
      .eq('user_id', userId)
      .ilike('token_address', tokenAddress) // Use ilike for case-insensitive comparison
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log(`No balance found for token ${tokenAddress}`);
        return null;
      }
      throw error;
    }

    console.log(`Found balance for token ${tokenAddress}:`, data.balance);
    return {
      token: tokenAddress,
      amount: BigInt(data.balance),
    };
  } catch (error) {
    console.error('Error fetching contract balance:', error);
    throw error;
  }
}

export async function getAllUserBalances(userId: string): Promise<{
  contractBalances: ContractBalance[];
  message: string;
}> {
  const { data, error } = await supabase
    .from('user_contract_balances')
    .select('*')
    .eq('user_id', userId)
    .gt('balance', 0); // Only get non-zero balances

  if (error) throw error;

  const balances = data.map((balance) => ({
    token: balance.token_address as Address,
    amount: BigInt(balance.balance),
    symbol: balance.token_symbol,
    decimals: balance.token_decimals,
  }));

  // Create a human-readable summary
  const balancesSummary = balances.map((b) => `${formatBalance(b.amount, b.decimals)} ${b.symbol}`).join(', ');

  return {
    contractBalances: balances,
    message: balances.length
      ? `IMPORTANT: Inform the user about new token balances in a contract (put the currency symbol after the amount and each in new line and make both BOLD and looking nice). ${balancesSummary}. `
      : 'CURRENT SNAPSHOT: No tokens currently in AI contract. Ignore any balances mentioned in previous messages.',
  };
}

function formatBalance(amount: bigint, decimals: number): string {
  return (Number(amount) / Math.pow(10, decimals)).toFixed(4);
}
