const COINGECKO_IDS: Record<number, string> = {
  1: 'ethereum', // Ethereum
  10: 'ethereum', // Optimism (uses ETH)
  56: 'binancecoin', // BNB Chain
  137: 'matic-network', // Polygon
  250: 'fantom', // Fantom
  8453: 'ethereum', // Base (uses ETH)
  42161: 'ethereum', // Arbitrum One (uses ETH)
  43114: 'avalanche-2', // Avalanche
  59144: 'ethereum', // Linea (uses ETH)
  7565164: 'solana', // Solana
  245022926: 'neon', // Neon
  100: 'xdai', // Gnosis
  1088: 'metis-token', // Metis
  7171: 'bitrock', // Bitrock
  388: 'crypto-com-chain', // Cronos
  146: 'sonic-3', // Sonic
  2741: 'abstract', // Abstract
  80094: 'berachain', // Berachain
};

export async function getNativeTokenPrice(chainId: number): Promise<number | null> {
  const coinId = COINGECKO_IDS[chainId];
  if (!coinId) return null;

  try {
    const response = await fetch(`${process.env.COINGECKO_API_URL}/simple/price?ids=${coinId}&vs_currencies=usd`, {
      next: { revalidate: 60 },
    });

    if (!response.ok) throw new Error('Failed to fetch price');
    const data = await response.json();
    return data[coinId]?.usd ?? null;
  } catch (error) {
    console.error('Error fetching price:', error);
    return null;
  }
}
