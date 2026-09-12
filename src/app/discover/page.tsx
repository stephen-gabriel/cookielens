"use client";

import Link from "next/link";
import { BarChart3, Compass } from "lucide-react";
import { useEffect, useState } from "react";
import { TokenImage } from "@/components/portfolio/HoldingsTable";
import { formatCompact, formatUsd } from "@/lib/format";
import type { EmergingToken } from "@/app/api/explore/emerging/route";

export default function DiscoverPage() {
  const [tokens, setTokens] = useState<EmergingToken[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/explore/emerging?limit=24", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { tokens?: EmergingToken[] }) => {
        if (!cancelled) setTokens(data.tokens ?? []);
      })
      .catch(() => {
        if (!cancelled) setTokens([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Compass className="h-5 w-5 text-primary" /> Discover
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Tokens on Cookie Chain right now, ranked by holder count. Full table, watchlists, and per-token pages below.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {tokens === null &&
          Array.from({ length: 9 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-surface-hover" />)}

        {tokens !== null && tokens.length === 0 && (
          <p className="col-span-full rounded-lg border border-border bg-surface p-4 text-sm text-text-secondary">
            Token data is warming up. Check back shortly.
          </p>
        )}

        {tokens?.map((t, i) => (
          <Link
            key={t.mint}
            href={`/token/${t.mint}`}
            className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 transition hover:border-primary/40"
          >
            <span className="w-5 shrink-0 text-right font-mono text-xs text-text-secondary">{i + 1}</span>
            <TokenImage image={t.image} symbol={t.symbol} className="h-10 w-10" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{t.symbol}</span>
              <span className="block truncate text-xs text-text-secondary">{t.name}</span>
              <span className="mt-0.5 block text-xs text-text-secondary">{formatCompact(t.holders)} holders</span>
            </span>
            <span className="shrink-0 font-mono text-xs text-text-secondary">{formatUsd(t.priceUsd)}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/tokens" className="flex items-center justify-between rounded-lg border border-border bg-surface p-4 transition hover:border-primary/40">
          <span className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-secondary" />
            <span>
              <span className="block text-sm font-semibold">Full token table</span>
              <span className="block text-xs text-text-secondary">Every fungible token, ranked and filterable.</span>
            </span>
          </span>
          <span className="text-text-secondary">→</span>
        </Link>
        <Link href="/wallets" className="flex items-center justify-between rounded-lg border border-border bg-surface p-4 transition hover:border-primary/40">
          <span className="flex items-center gap-3">
            <Compass className="h-5 w-5 text-secondary" />
            <span>
              <span className="block text-sm font-semibold">Wallet directory</span>
              <span className="block text-xs text-text-secondary">Follow wallets and inspect activity.</span>
            </span>
          </span>
          <span className="text-text-secondary">→</span>
        </Link>
      </div>
    </div>
  );
}