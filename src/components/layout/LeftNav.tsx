"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Compass, Home, User, Users } from "lucide-react";

export const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/tokens", label: "Tokens", icon: BarChart3 },
  { href: "/wallets", label: "Wallets", icon: Users },
  { href: "/profile", label: "Profile", icon: User },
];

export function LeftNav() {
  const pathname = usePathname();
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav className="flex flex-col gap-1 py-4" aria-label="Main">
      {navItems.map((item) => {
        const isActive = active(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
              isActive ? "bg-surface-hover text-primary" : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
            }`}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}