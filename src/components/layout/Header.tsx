"use client";

import Link from "next/link";
import { WalletButton } from "@/components/wallet/WalletButton";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="text-xl">🍪</span>
          <span className="whitespace-nowrap text-base font-bold tracking-tight sm:text-lg">
            Cookie<span className="text-primary">Lens</span>
          </span>
        </Link>
        <div className="min-w-0">
          <WalletButton />
        </div>
      </div>
    </header>
  );
}