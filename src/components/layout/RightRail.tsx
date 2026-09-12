"use client";

import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import type { EmergingToken } from "@/app/api/explore/emerging/route";
import { TokenImage } from "@/components/portfolio/HoldingsTable";
import { formatCompact, formatUsd } from "@/lib/format";

export function RightRail() {
  const [tokens, setTokens] = useState<EmergingToken[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/explore/emerging?limit=8")
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
    <nav className="sticky top-14 py-4" aria-label="Context">
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Trending tokens</h2>
        </div>

        {tokens === null && (
          <div className="mt-3 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-surface-hover" />
            ))}
          </div>
        )}

        {tokens && tokens.length === 0 && (
          <p className="mt-3 text-sm text-text-secondary">No token data yet.</p>
        )}

        {tokens && tokens.length > 0 && (
          <ul className="mt-3 space-y-1">
            {tokens.map((t, i) => (
              <li key={t.mint}>
                <Link
                  href={`/token/${t.mint}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-surface-hover"
                >
                  <span className="w-4 shrink-0 text-right font-mono text-xs text-text-secondary">{i + 1}</span>
                  <TokenImage image={t.image} symbol={t.symbol} className="h-7 w-7" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{t.symbol}</span>
                    <span className="block text-xs text-text-secondary">{formatCompact(t.holders)} holders</span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-text-secondary">{formatUsd(t.priceUsd)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}