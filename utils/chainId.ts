type ChainInfo = {
  chainId: number;
  bridgeId: number;
  nativeSymbol: string; // Add this field
};

const bridgeIdMap = {
  neon: { chainId: 245022926, bridgeId: 100000001, nativeSymbol: 'NEON' },
  gnosis: { chainId: 100, bridgeId: 100000002, nativeSymbol: 'xDAI' },
  metis: { chainId: 1088, bridgeId: 100000004, nativeSymbol: 'METIS' },
  bitrock: { chainId: 7171, bridgeId: 100000005, nativeSymbol: 'BROCK' },
  cronos: { chainId: 388, bridgeId: 100000010, nativeSymbol: 'CRO' },
  sonic: { chainId: 146, bridgeId: 100000014, nativeSymbol: 'SONIC' },
  abstract: { chainId: 2741, bridgeId: 100000017, nativeSymbol: 'ABS' },
  berachain: { chainId: 80094, bridgeId: 100000020, nativeSymbol: 'BERA' },
  ethereum: { chainId: 1, bridgeId: 1, nativeSymbol: 'ETH' },
  optimism: { chainId: 10, bridgeId: 10, nativeSymbol: 'ETH' },
  bsc: { chainId: 56, bridgeId: 56, nativeSymbol: 'BNB' },
  polygon: { chainId: 137, bridgeId: 137, nativeSymbol: 'MATIC' },
  fantom: { chainId: 250, bridgeId: 250, nativeSymbol: 'FTM' },
  base: { chainId: 8453, bridgeId: 8453, nativeSymbol: 'ETH' },
  arbitrum: { chainId: 42161, bridgeId: 42161, nativeSymbol: 'ETH' },
  avalanche: { chainId: 43114, bridgeId: 43114, nativeSymbol: 'AVAX' },
  linea: { chainId: 59144, bridgeId: 59144, nativeSymbol: 'ETH' },
} as const;

export type SupportedChain = keyof typeof bridgeIdMap;

export function getChainIds(chain: SupportedChain): ChainInfo {
  const chainInfo = bridgeIdMap[chain];
  if (!chainInfo) {
    throw new Error(`Unsupported chain: ${chain}`);
  }
  return chainInfo;
}

export function getBridgeToChainId(bridgeId: number): number {
  const chainInfo = Object.values(bridgeIdMap).find((info) => info.bridgeId === bridgeId);
  if (!chainInfo) {
    throw new Error(`Unsupported bridge ID: ${bridgeId}`);
  }
  return chainInfo.chainId;
}
