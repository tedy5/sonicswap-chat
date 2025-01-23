import type { Metadata } from "next";
import { Inter } from 'next/font/google';
import "./globals.css";
import { Header } from "@/components/Header";
import { Providers } from '@/providers';
import '@rainbow-me/rainbowkit/styles.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'block',
  variable: '--font-inter',
  preload: true,
  fallback: ['system-ui', 'arial'],
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: "AppKit Example App",
  description: "Powered by WalletConnect"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {

  return (
    <html lang="en" className={`${inter.variable} font-sans dark`} suppressHydrationWarning={true}>
      <head>
      </head>
      <body className={`${inter.className} font-sans`}>
        <div className="min-h-screen flex flex-col relative">
          <div className="absolute -z-20 bottom-0 left-0 right-0 top-0 bg-[#0a0b1e]" />
          <Providers>
            <Header />
            <main>
              {children}
            </main>
          </Providers>
        </div>
      </body>
    </html>
  )
}

