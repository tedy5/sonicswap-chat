import { createPublicClient, http } from 'viem';
import { sonic } from 'viem/chains';

export const publicClient = createPublicClient({
  chain: sonic,
  transport: http(),
});
