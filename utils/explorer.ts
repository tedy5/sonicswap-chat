type Explorer = {
  url: string;
  name: string;
};

const explorers: Record<number, Explorer> = {
  // Mainnet chains
  1: { url: 'https://etherscan.io', name: 'Etherscan' },
  10: { url: 'https://optimistic.etherscan.io', name: 'Optimism Explorer' },
  56: { url: 'https://bscscan.com', name: 'BscScan' },
  137: { url: 'https://polygonscan.com', name: 'Polygonscan' },
  250: { url: 'https://explorer.fantom.network', name: 'Fantom Explorer' },
  42161: { url: 'https://arbiscan.io', name: 'Arbiscan' },
  43114: { url: 'https://snowtrace.io', name: 'Snowtrace' },
  59144: { url: 'https://lineascan.build', name: 'LineaScan' },
  8453: { url: 'https://basescan.org', name: 'Basescan' },
  245022934: { url: 'https://neonscan.org', name: 'NeonScan' },
  100: { url: 'https://gnosisscan.io', name: 'GnosisScan' },
  1890: { url: 'https://lightlinkscan.io', name: 'LightLink Explorer' },
  1088: { url: 'https://andromeda-explorer.metis.io', name: 'Metis Explorer' },
  7171: { url: 'https://explorer.bit-rock.io', name: 'BitRock Explorer' },
  146: { url: 'https://sonicscan.org/', name: 'Sonicscan' },
  4158: { url: 'https://scan.crossfi.com', name: 'CrossFi Explorer' },
  388: { url: 'https://cronoscan.com', name: 'CronoScan' },
  2741: { url: 'https://goerli.abstractscan.com', name: 'AbstractScan' },
  80094: { url: 'https://artio.beratrail.io', name: 'Bera Explorer' },
  7565164: { url: 'https://solscan.io', name: 'SolScan' },
};

export const getExplorerInfo = (chainId: number) => {
  return explorers[chainId];
};

export const getExplorerUrl = (chainId: number, hash: string) => {
  const explorer = explorers[chainId];
  return `${explorer.url}/tx/${hash}`;
};
