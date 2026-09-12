"use client";

import Link from "next/link";
import { Activity, Compass, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { WalletClaim } from "@/components/auth/WalletClaim";
import { useAuth } from "@/components/auth/AuthProvider";
import { EventCard } from "@/components/feed/EventCard";
import { TokenImage } from "@/components/portfolio/HoldingsTable";
import { getCookMarketData, type CookMarketData } from "@/lib/pricing";
import { formatCompact, formatUsd } from "@/lib/format";
import type { EmergingToken } from "@/app/api/explore/emerging/route";
import type { FeedEvent } from "@/lib/events";

type Tab = "following" | "discover";

export default function HomePage() {
  const { me, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("following");
  const [cook, setCook] = useState<CookMarketData | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [feed, setFeed] = useState<{ tab: Tab; events: FeedEvent[] | null; error: string | null }>({
    tab: "following",
    events: null,
    error: null,
  });
  const [emerging, setEmerging] = useState<EmergingToken[] | null>(null);

  useEffect(() => {
    getCookMarketData().then(setCook).catch(() => setCook(null));
    fetch("https://rpc.cookiescan.io", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSlot", params: [] }),
    })
      .then((res) => res.json())
      .then((json) => setSlot(typeof json.result === "number" ? json.result : null))
      .catch(() => setSlot(null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/feed?tab=${tab}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { ok?: boolean; events?: FeedEvent[]; error?: string }) => {
        if (cancelled) return;
        if (!data.ok) {
          setFeed({ tab, events: data.events ?? [], error: data.error ?? "Feed unavailable." });
        } else {
          setFeed({ tab, events: data.events ?? [], error: null });
        }
      })
      .catch(() => {
        if (!cancelled) setFeed({ tab, events: [], error: "Feed unavailable right now." });
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  useEffect(() => {
    if (tab !== "discover") return;
    let cancelled = false;
    fetch("/api/explore/emerging?limit=10")
      .then((res) => res.json())
      .then((data: { tokens?: EmergingToken[] }) => {
        if (!cancelled) setEmerging(data.tokens ?? []);
      })
      .catch(() => {
        if (!cancelled) setEmerging([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const loadingFeed = feed.tab !== tab || (feed.events === null && !feed.error);

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="min-w-0 rounded-lg border border-border bg-surface p-3">
          <div className="text-[11px] uppercase tracking-wide text-text-secondary">COOK Price</div>
          <div className="mt-1 font-mono text-sm font-bold text-primary">
            {cook?.priceUsd ? `$${cook.priceUsd.toFixed(6)}` : "—"}
          </div>
        </div>
        <div className="min-w-0 rounded-lg border border-border bg-surface p-3">
          <div className="text-[11px] uppercase tracking-wide text-text-secondary">Market Cap</div>
          <div className="mt-1 truncate font-mono text-sm font-bold">{cook?.marketCapUsd ? formatUsd(cook.marketCapUsd) : "—"}</div>
        </div>
        <div className="min-w-0 rounded-lg border border-border bg-surface p-3">
          <div className="text-[11px] uppercase tracking-wide text-text-secondary">Network</div>
          <div className="mt-1 truncate font-mono text-sm font-bold text-secondary">Cookie Chain</div>
        </div>
        <div className="min-w-0 rounded-lg border border-border bg-surface p-3">
          <div className="text-[11px] uppercase tracking-wide text-text-secondary">Chain Height</div>
          <div className="mt-1 truncate font-mono text-sm font-bold">
            {slot !== null ? slot.toLocaleString() : "—"}
          </div>
        </div>
      </section>

      <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
        <TabButton active={tab === "following"} label="Following" icon={UserPlus} onClick={() => setTab("following")} />
        <TabButton active={tab === "discover"} label="Discover" icon={Compass} onClick={() => setTab("discover")} />
      </div>

      {tab === "following" && !loadingFeed && !authLoading && !me && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-surface p-4 text-sm text-text-secondary">
            <p className="font-semibold text-text-primary">Sign in to build a Following feed.</p>
            <p className="mt-1">Claim your wallet, then follow the wallets whose moves matter to you. Their significant on-chain activity shows up here.</p>
          </div>
          <WalletClaim surface="banner" />
        </div>
      )}

      {!loadingFeed && feed.error && (
        <div className="rounded-lg border border-border bg-surface p-6 text-center">
          <Activity className="mx-auto h-6 w-6 text-text-secondary" />
          <p className="mt-2 text-sm font-semibold">{feed.error}</p>
          <p className="mt-1 text-sm text-text-secondary">Activity appears once the indexer is live.</p>
        </div>
      )}

      {loadingFeed && !authLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-surface-hover" />
          ))}
        </div>
      )}

      {tab === "following" && !loadingFeed && feed.events !== null && me && feed.events.length === 0 && !feed.error && (
        <div className="rounded-lg border border-border bg-surface p-6 text-center">
          <UserPlus className="mx-auto h-6 w-6 text-text-secondary" />
          <p className="mt-2 text-sm font-semibold text-text-primary">You aren&apos;t following any wallets yet.</p>
          <p className="mt-1 text-sm text-text-secondary">
            Browse the wallet directory, then follow the ones whose activity matters.
          </p>
          <Link href="/wallets" className="mt-3 inline-block text-sm text-primary underline">
            Explore wallets →
          </Link>
        </div>
      )}

      {!loadingFeed && feed.events !== null && feed.events.length > 0 && (
        <div className="space-y-3">
          {feed.events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}

      {tab === "discover" && !loadingFeed && feed.events !== null && feed.events.length === 0 && !feed.error && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Emerging on Cookie Chain</h2>
            <span className="text-xs text-text-secondary">by holder count</span>
          </div>

          {emerging === null && (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-surface-hover" />
              ))}
            </div>
          )}

          {emerging && emerging.length === 0 && (
            <p className="rounded-lg border border-border bg-surface p-4 text-sm text-text-secondary">
              Token data is warming up. Check back shortly.
            </p>
          )}

          {emerging && emerging.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {emerging.map((t) => (
                <Link
                  key={t.mint}
                  href={`/token/${t.mint}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 transition hover:border-primary/40"
                >
                  <TokenImage image={t.image} symbol={t.symbol} className="h-10 w-10" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{t.symbol}</span>
                    <span className="block truncate text-xs text-text-secondary">{t.name}</span>
                    <span className="mt-0.5 block text-xs text-text-secondary">
                      {formatCompact(t.holders)} holders
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-text-secondary">{formatUsd(t.priceUsd)}</span>
                </Link>
              ))}
            </div>
          )}

          <p className="text-xs text-text-secondary">
            The significance engine surfaces classified on-chain activity here once the indexer is live.
          </p>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: typeof UserPlus;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition ${
        active ? "bg-surface-hover text-primary" : "text-text-secondary hover:text-text-primary"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}