import { type Chain } from 'viem';
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

export const RPC_URLS: { [chainId: number]: string } = {
  1: 'https://eth.llamarpc.com',
  10: 'https://optimism.llamarpc.com',
  56: 'https://binance.llamarpc.com',
  137: 'https://polygon.llamarpc.com',
  250: 'https://rpc.ftm.tools',
  8453: 'https://base.llamarpc.com',
  42161: 'https://arbitrum.llamarpc.com',
  43114: 'https://avalanche.llamarpc.com',
  59144: 'https://rpc.linea.build',
  100: 'https://rpc.gnosis.gateway.fm',
  1088: 'https://andromeda.metis.io/?owner=1088',
  146: 'https://rpc.soniclabs.com',
  388: 'https://cronos.blockpi.network/v1/rpc/public',
  245022926: 'https://neon-proxy-mainnet.solana.p2p.org',
};

export const chainConfig: { [key: number]: Chain } = {
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

export const chainId = 146;
