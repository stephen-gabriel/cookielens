"use client";

import Link from "next/link";
import { BadgeCheck, Search, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { WalletClaim } from "@/components/auth/WalletClaim";
import { useAuth } from "@/components/auth/AuthProvider";
import { useWallet } from "@/lib/providers";
import { timeAgo, truncateAddress } from "@/lib/format";

type ActiveWallet = {
  wallet: string;
  username: string | null;
  firstObservedAt: string | null;
  lastActivityAt: string | null;
  followerCount: number | null;
};

export default function WalletsPage() {
  const router = useRouter();
  const { account } = useWallet();
  const { me } = useAuth();
  const [query, setQuery] = useState("");
  const [wallets, setWallets] = useState<ActiveWallet[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/wallets/active", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { wallets?: ActiveWallet[] }) => {
        if (!cancelled) setWallets(data.wallets ?? []);
      })
      .catch(() => {
        if (!cancelled) setWallets([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/wallets/${q}`);
  };

  const selfUnclaimed = account && !me;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Wallets</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Every wallet CookieLens has observed on-chain. Look up any address, or browse active wallets.
        </p>
      </div>

      {selfUnclaimed && <WalletClaim surface="banner" />}

      <form onSubmit={submit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Paste any Cookie Chain address…"
            className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 font-mono text-sm text-text-primary outline-none transition focus:border-primary"
          />
        </div>
        <button
          type="submit"
          className="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-semibold text-background transition hover:bg-primary/90"
        >
          Inspect
        </button>
      </form>

      <div>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
          <TrendingUp className="h-4 w-4 text-primary" /> Active wallets
        </h2>

        {wallets === null && (
          <div className="mt-3 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-surface-hover" />
            ))}
          </div>
        )}

        {wallets && wallets.length === 0 && (
          <p className="mt-3 rounded-lg border border-border bg-surface p-4 text-sm text-text-secondary">
            No observed wallets yet — they appear as soon as the indexer starts reading the chain.
          </p>
        )}

        {wallets && wallets.length > 0 && (
          <ul className="mt-3 space-y-2">
            {wallets.map((w) => (
              <li key={w.wallet}>
                <Link
                  href={`/wallets/${w.wallet}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface p-3 transition hover:border-primary/40"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {w.username ? <BadgeCheck className="h-4 w-4 shrink-0 text-primary" /> : null}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {w.username ? `@${w.username}` : truncateAddress(w.wallet, 6)}
                      </span>
                      <span className="block truncate font-mono text-xs text-text-secondary">
                        {w.username ? truncateAddress(w.wallet, 6) : w.wallet}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-text-secondary">
                    <span className="block font-semibold">{w.followerCount ?? 0} followers</span>
                    <span className="block">{w.lastActivityAt ? timeAgo(new Date(w.lastActivityAt).getTime() / 1000) : "—"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}