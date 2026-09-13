"use client";

import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useState, use } from "react";
import toast from "react-hot-toast";
import { getAsset, type DasAsset } from "@/lib/das";
import { BackButton } from "@/components/ui/BackButton";
import { TokenImage } from "@/components/portfolio/HoldingsTable";
import { SwapPanel } from "@/components/swap/SwapPanel";
import { formatCompact, formatPct, formatUsd, truncateAddress } from "@/lib/format";
import { EXPLORER_URL } from "@/lib/constants";
import { useAuth } from "@/components/auth/AuthProvider";

type RecentActivity = {
  id: number;
  signature: string;
  wallet: string;
  type: string;
  amount: number | null;
  valueUsd: number | null;
  timestamp: string;
  slot: number | null;
};

type TokenCtx = {
  ok: boolean;
  activity: { buyers: number; sellers: number };
  community: {
    holders: number;
    holdersDelta: number | null;
    buyers1h: number;
    sellers1h: number;
    volume24h: number | null;
    verifiedBuyers: number;
  };
  recentActivity: RecentActivity[];
  isWatched: boolean;
  error?: string;
};

export default function TokenDetailPage({ params }: { params: Promise<{ mint: string }> }) {
  const { mint } = use(params);
  const { me } = useAuth();
  const [asset, setAsset] = useState<DasAsset | null>(null);
  const [ctx, setCtx] = useState<TokenCtx | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => {
    let cancelled = false;
    Promise.all([
      getAsset(mint),
      fetch(`/api/token/${encodeURIComponent(mint)}`, { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => null),
    ])
      .then(([a, c]) => {
        if (cancelled) return;
        setAsset(a);
        setCtx(c && c.ok ? c : null);
        setDone(true);
      })
      .catch(() => {
        if (cancelled) return;
        setDone(true);
      });
    return () => {
      cancelled = true;
    };
  };

  useEffect(load, [mint]);

  const toggleWatch = async () => {
    if (!ctx || busy) return;
    if (!me) {
      toast.error("Sign in to watch this token.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/watch", {
        method: ctx.isWatched ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mint }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Watch failed.");
      setCtx({ ...ctx, isWatched: !ctx.isWatched });
      toast.success(ctx.isWatched ? "Unwatched." : `Watching ${asset?.content.metadata.symbol ?? "token"}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Watch failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!done) {
    return (
      <div className="mx-auto flex max-w-2xl justify-center px-4 py-24">
        <Loader2 className="h-6 w-6 animate-spin text-text-secondary" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-xl font-bold">Token not found</h1>
        <p className="mt-2 text-text-secondary">We couldn&apos;t read metadata for {mint}.</p>
        <Link href="/tokens" className="mt-4 inline-block text-primary underline">
          Back to all tokens
        </Link>
      </div>
    );
  }

  const price = asset.token_info?.price_info?.price_per_token ?? null;
  const marketCap = asset.market_cap ?? null;
  const supply = asset.token_info?.supply ?? 0;
  const decimals = asset.token_info?.decimals ?? 9;
  const community = ctx?.community;

  const buyers = ctx?.recentActivity
    .filter((a) => ["buy", "transfer", "swap"].includes(a.type))
    .filter((a, i, arr) => arr.findIndex((x) => x.wallet === a.wallet) === i)
    .slice(0, 6) ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <BackButton />
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <TokenImage image={asset.content.links?.image ?? null} symbol={asset.content.metadata.symbol ?? "?"} className="h-16 w-16" />
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold sm:text-2xl">
            <span className="break-words">{asset.content.metadata.name ?? "Untitled"}</span>
            <span className="font-mono text-xs text-text-secondary sm:text-sm">{asset.content.metadata.symbol}</span>
          </h1>
          <Link href={`${EXPLORER_URL}/address/${mint}`} target="_blank" rel="noreferrer" className="break-all font-mono text-xs text-primary underline">
            {truncateAddress(mint, 8)}
          </Link>
        </div>
        <button
          onClick={toggleWatch}
          disabled={busy || !ctx}
          className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition disabled:opacity-60 ${
            ctx?.isWatched
              ? "border border-border text-text-secondary hover:border-primary/50 hover:text-primary"
              : "bg-primary text-background hover:bg-primary/90"
          }`}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : ctx?.isWatched ? (
            <>
              <EyeOff className="h-4 w-4" /> Watching
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" /> Watch
            </>
          )}
        </button>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4">
        <div className="rounded-lg border border-border bg-surface p-3 sm:p-4">
          <div className="text-xs uppercase tracking-wide text-text-secondary">Price</div>
          <div className="mt-1 font-mono text-base font-semibold text-primary sm:text-lg">{formatUsd(price)}</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3 sm:p-4">
          <div className="text-xs uppercase tracking-wide text-text-secondary">Market cap</div>
          <div className="mt-1 font-mono text-base font-semibold sm:text-lg">{formatUsd(marketCap)}</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3 sm:p-4">
          <div className="text-xs uppercase tracking-wide text-text-secondary">Holders</div>
          <div className="mt-1 font-mono text-base font-semibold sm:text-lg">
            {formatCompact(community?.holders ?? null)}
            {community?.holdersDelta !== null && community?.holdersDelta !== undefined && community.holdersDelta !== 0 && (
              <span className={`ml-2 text-xs ${community.holdersDelta > 0 ? "text-primary" : "text-error"}`}>
                {formatPct(community.holdersDelta)}
              </span>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3 sm:p-4">
          <div className="text-xs uppercase tracking-wide text-text-secondary">Total supply</div>
          <div className="mt-1 font-mono text-base font-semibold sm:text-lg">{formatCompact(supply)}</div>
        </div>
      </div>

      <div className="mt-6">
        <SwapPanel
          mint={mint}
          symbol={asset.content.metadata.symbol ?? "Token"}
          decimals={decimals}
        />
      </div>

      {community && (
        <section className="mt-6 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">Community activity</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <CommunityStat label="Buyers (1h)" value={String(community.buyers1h)} />
            <CommunityStat label="Sellers (1h)" value={String(community.sellers1h)} />
            <CommunityStat label="Verified wallets" value={String(community.verifiedBuyers)} />
            <CommunityStat label="Volume 24h" value={formatUsd(community.volume24h)} />
          </div>

          {buyers.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs uppercase tracking-wide text-text-secondary">Recent buyers</h3>
              <ul className="mt-2 space-y-1.5">
                {buyers.map((b) => (
                  <li key={`${b.wallet}-${b.signature}`} className="flex items-center justify-between text-sm">
                    <Link href={`/wallets/${b.wallet}`} className="font-mono text-primary underline">
                      {truncateAddress(b.wallet, 6)}
                    </Link>
                    <span className="text-xs capitalize text-text-secondary">
                      {b.type} {b.amount ? formatCompact(b.amount) : ""} · {formatUsd(b.valueUsd)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {asset.content.metadata.description && (
        <p className="mt-6 rounded-lg border border-border bg-surface p-4 text-sm leading-relaxed text-text-secondary">
          {asset.content.metadata.description}
        </p>
      )}
    </div>
  );
}

function CommunityStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-2.5">
      <div className="truncate font-mono text-base font-bold">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-text-secondary">{label}</div>
    </div>
  );
}