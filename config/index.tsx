import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sonic } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'SonicSwap AI Chat',
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID!,
  chains: [
    sonic
  ],
  ssr: true,
});