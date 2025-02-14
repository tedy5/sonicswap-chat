import { erc20Abi, getContract, type Address } from 'viem';
import { getPublicClient } from './publicClient';

export async function getTokenSymbol(chainId: number, tokenAddress: Address): Promise<string> {
  const client = getPublicClient(chainId);

  const contract = getContract({
    address: tokenAddress,
    abi: erc20Abi,
    client,
  });

  try {
    const symbol = await contract.read.symbol();
    return symbol;
  } catch (error) {
    console.error('Error fetching token symbol:', error);
    throw new Error('Failed to fetch token symbol');
  }
}
