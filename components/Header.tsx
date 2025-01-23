import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Connect } from "./ConnectButton";


export function Header() {

  return (
    <header className="border-b">
      <div className="flex h-14 items-center px-4 mx-auto bg-header">
        <div className="border-r h-full flex items-center pr-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="text-xl">SonicSwap</span>
          </Link>
        </div>

        <nav className="mx-6 hidden md:flex items-center space-x-4 lg:space-x-6 flex-1">
          <Button asChild variant="ghost">
            <Link href="/chat" className="text-sm font-semibold">Chat</Link>
          </Button>
        </nav>
        <div className="flex items-center">
          <Connect />
        </div>

      </div>
    </header>
  );
}