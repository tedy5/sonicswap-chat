import { createPublicClient, http, type PublicClient } from 'viem';
import { chainConfig, RPC_URLS } from '@/config/chains';

export function getPublicClient(chainId: number): PublicClient {
  const chain = chainConfig[chainId];

  if (!chain) {
    throw new Error(`Chain ID ${chainId} not supported`);
  }

  return createPublicClient({
    chain,
    transport: http(RPC_URLS[chainId]),
  });
}
