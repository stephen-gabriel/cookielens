"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { WalletButton } from "@/components/wallet/WalletButton";

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/tokens", label: "Tokens" },
  { href: "/watch", label: "Watch" },
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" onClick={() => setOpen(false)} className="flex shrink-0 items-center gap-2">
          <span className="text-2xl">🍪</span>
          <span className="whitespace-nowrap text-lg font-bold tracking-tight">
            Cookie<span className="text-primary">Lens</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
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

        <div className="flex shrink-0 items-center gap-2">
          <div className="min-w-0">
            <WalletButton />
          </div>
          <button
            type="button"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border text-text-secondary transition hover:border-primary/50 hover:text-primary md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-border bg-background/95 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`rounded-md px-3 py-2.5 text-sm transition ${
                  pathname === item.href
                    ? "bg-surface-hover text-primary"
                    : "text-text-secondary hover:bg-surface-hover"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}