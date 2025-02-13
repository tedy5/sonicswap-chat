export const chainMap: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  56: 'BNB Chain',
  137: 'Polygon',
  250: 'Fantom',
  8453: 'Base',
  42161: 'Arbitrum One',
  43114: 'Avalanche',
  59144: 'Linea',
  7565164: 'Solana',
  245022926: 'Neon',
  100: 'Gnosis',
  1088: 'Metis',
  7171: 'Bitrock',
  388: 'Cronos',
  146: 'Sonic',
  2741: 'Abstract',
  80094: 'Berachain',
} as const;

export const getChainName = (chainId: number): string => {
  return chainMap[chainId] || 'Unknown Chain';
};
