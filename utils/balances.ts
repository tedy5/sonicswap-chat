import { type Address } from 'viem';
import { supabase } from '@/supabase/server';
import { getPublicClient } from './publicClient';

export interface TokenBalance {
  token: Address;
  amount: bigint;
  allowance: bigint;
}

export interface ContractBalance {
  token: Address;
  amount: bigint;
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
    getContractBalance(userId, tokenAddress),
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

async function getContractBalance(userId: string, tokenAddress: Address): Promise<ContractBalance | null> {
  try {
    const { data, error } = await supabase
      .from('user_contract_balances')
      .select('balance')
      .eq('user_id', userId)
      .eq('token_address', tokenAddress)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return {
      token: tokenAddress,
      amount: BigInt(data.balance),
    };
  } catch (error) {
    console.error('Error fetching contract balance:', error);
    throw error;
  }
}
