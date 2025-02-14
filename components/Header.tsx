import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ConnectWallet } from './ConnectWallet';

export function Header() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 items-center bg-header px-4">
        <div className="flex h-full items-center border-r pr-4">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold"
          >
            <span className="text-xl">SonicSwap</span>
          </Link>
        </div>

        <nav className="mx-6 hidden flex-1 items-center space-x-4 md:flex lg:space-x-6">
          <Button
            asChild
            variant="ghost"
          >
            <Link
              href="/chat"
              className="text-sm font-semibold"
            >
              Chat
            </Link>
          </Button>
        </nav>
        <div className="flex items-center">
          <ConnectWallet />
        </div>
      </div>
    </header>
  );
}
