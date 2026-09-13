"use client";

import Link from "next/link";
import { BarChart3, Compass, Flame, Sparkles, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { TokenImage } from "@/components/portfolio/HoldingsTable";
import { formatCompact, formatPct, formatUsd } from "@/lib/format";
import type { EmergingToken } from "@/app/api/explore/emerging/route";
import type { CommunityToken, LargeMovement, MomentumToken } from "@/app/api/explore/sections/route";

type Sections = { momentum: MomentumToken[]; largeMovements: LargeMovement[]; community: CommunityToken[] };

export default function DiscoverPage() {
  const [tokens, setTokens] = useState<EmergingToken[] | null>(null);
  const [sections, setSections] = useState<Sections | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/explore/emerging?limit=24", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/explore/sections", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([emerging, secs]) => {
        if (cancelled) return;
        setTokens(emerging.tokens ?? []);
        setSections((secs.ok ? secs : null) as Sections | null);
      })
      .catch(() => {
        if (cancelled) return;
        setTokens([]);
        setSections(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Compass className="h-5 w-5 text-primary" /> Discover
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          What&apos;s moving on Cookie Chain: momentum, large transfers, and the tokens wallets are rallying around.
        </p>
      </div>

      {sections !== null && (sections.momentum[0] ?? sections.largeMovements[0] ?? sections.community[0]) && (
        <>
          <section>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Flame className="h-4 w-4 text-primary" /> Token momentum (24h)
            </h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sections.momentum.slice(0, 6).map((t) => (
                <Link key={t.mint} href={`/token/${t.mint}`} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 transition hover:border-primary/40">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{t.symbol}</span>
                    <span className="text-xs text-text-secondary">
                      {t.buyers1h} buyers / {t.sellers1h} sellers
                    </span>
                  </span>
                  <span className={`shrink-0 text-xs font-mono ${(t.holdersPct ?? 0) >= 0 ? "text-primary" : "text-error"}`}>
                    {t.holdersPct !== null ? formatPct(t.holdersPct) : "—"}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" /> Notable moves
            </h2>
            <ul className="mt-3 space-y-2">
              {sections.largeMovements.slice(0, 6).map((m) => (
                <li key={m.id}>
                  <Link href={m.tokenMint ? `/token/${m.tokenMint}` : "#"} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 text-sm transition hover:border-primary/40">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{m.symbol ?? "moved"}</span>
                      <span className="truncate text-xs text-text-secondary">{m.title || `${m.amount ?? ""}`}</span>
                    </span>
                    <span className="shrink-0 font-mono text-xs text-text-secondary">{formatUsd(m.significance)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4 text-primary" /> Community activity (24h)
            </h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sections.community.slice(0, 6).map((c) => (
                <Link key={c.mint} href={`/token/${c.mint}`} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 transition hover:border-primary/40">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{c.symbol ?? "token"}</span>
                    <span className="text-xs text-text-secondary">
                      {c.wallets} wallets · {c.actions} actions · {c.verifiedWallets} verified
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}

      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <BarChart3 className="h-4 w-4 text-primary" /> By holder count
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-3">
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
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/tokens" className="flex items-center justify-between rounded-lg border border-border bg-surface p-4 transition hover:border-primary/40">
          <span className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-secondary" />
            <span>
              <span className="block text-sm font-semibold">Full token table</span>
              <span className="block text-xs text-text-secondary">Every fungible token, ranked, searchable.</span>
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