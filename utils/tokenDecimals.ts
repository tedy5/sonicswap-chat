import { erc20Abi, getContract } from 'viem';
import { getPublicClient } from './publicClient';

const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000';

export async function getTokenDecimals(chainId: number, tokenAddress: string): Promise<number> {
  if (tokenAddress === NATIVE_TOKEN) return 18;

  const client = getPublicClient(chainId);

  const contract = getContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    client,
  });

  try {
    const decimals = await contract.read.decimals();
    return decimals;
  } catch (error) {
    console.error('Error fetching token decimals:', error);
    throw new Error('Failed to fetch token decimals');
  }
}
