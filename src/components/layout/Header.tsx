"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "@/components/wallet/WalletButton";

const navItems = [
  { href: "/", label: "Explore" },
  { href: "/bake", label: "Bake" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🍪</span>
          <span className="text-lg font-bold tracking-tight">
            Cookie<span className="text-primary">Pump</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm transition hover:bg-surface-hover ${
                pathname === item.href ? "text-primary" : "text-text-secondary"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <WalletButton />
      </div>
    </header>
  );
}