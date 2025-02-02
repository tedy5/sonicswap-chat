import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/Header';
import { Providers } from '@/providers';
import '@rainbow-me/rainbowkit/styles.css';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({
  subsets: ['latin'],
  display: 'block',
  variable: '--font-inter',
  preload: true,
  fallback: ['system-ui', 'arial'],
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: 'SonicSwap AI Chat Agent',
  description: 'AI assistant for SonicSwap - helping you navigate DeFi trading, swaps, and blockchain interactions with natural conversation.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} dark font-sans`} suppressHydrationWarning={true}>
      <body className={`${inter.className} font-sans`}>
        <Toaster position="top-center" richColors />
        <div className="relative flex min-h-screen flex-col">
          <div className="absolute bottom-0 left-0 right-0 top-0 -z-20 bg-[#0a0b1e]" />
          <Providers>
            <Header />
            <main>{children}</main>
          </Providers>
        </div>
      </body>
    </html>
  );
}
