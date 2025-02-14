import { getDefaultConfig } from '@rainbow-me/rainbowkit';
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

export const config = getDefaultConfig({
  appName: 'SonicSwap AI Chat',
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID!,
  chains: [mainnet, bsc, polygon, arbitrum, avalanche, fantom, linea, optimism, base, gnosis, metis, sonic, cronos, neonMainnet],
  ssr: true,
});
