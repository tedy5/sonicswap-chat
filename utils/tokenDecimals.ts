import { createPublicClient, erc20Abi, getContract, http, type Chain } from 'viem';
import {
  arbitrum,
  avalanche,
  base,
  bsc,
  cronos,
  fantom,
  gnosis,
  linea,
  mainnet,
  metis,
  neonMainnet,
  optimism,
  polygon,
  sonic,
} from 'wagmi/chains';

const RPC_URLS: { [chainId: number]: string } = {
  1: 'https://eth.llamarpc.com',
  10: 'https://optimism.llamarpc.com',
  56: 'https://binance.llamarpc.com',
  137: 'https://polygon.llamarpc.com',
  250: 'https://rpc.ftm.tools', // Fantom
  8453: 'https://base.llamarpc.com',
  42161: 'https://arbitrum.llamarpc.com',
  43114: 'https://avalanche.llamarpc.com',
  // Add other chains as needed
};

const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000';

// Map chainId to viem chain configuration
const chainConfig: { [key: number]: Chain } = {
  1: mainnet,
  10: optimism,
  56: bsc,
  137: polygon,
  250: fantom,
  8453: base,
  42161: arbitrum,
  43114: avalanche,
  59144: linea,
  100: gnosis,
  1088: metis,
  146: sonic,
  388: cronos,
  245022926: neonMainnet,
};

export async function getTokenDecimals(chainId: number, tokenAddress: string): Promise<number> {
  if (tokenAddress === NATIVE_TOKEN) return 18;

  const chain = chainConfig[chainId];

  if (!chain) {
    throw new Error(`Chain ID ${chainId} not supported for token decimals verification`);
  }

  const client = createPublicClient({
    chain,
    transport: http(RPC_URLS[chainId]),
  });

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
