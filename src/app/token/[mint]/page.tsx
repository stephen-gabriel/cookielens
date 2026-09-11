"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useEffect, useState, use } from "react";
import { getAsset, type DasAsset } from "@/lib/das";
import { TokenImage } from "@/components/portfolio/HoldingsTable";
import { formatCompact, formatUsd, truncateAddress } from "@/lib/format";
import { EXPLORER_URL } from "@/lib/constants";

export default function TokenDetailPage({ params }: { params: Promise<{ mint: string }> }) {
  const { mint } = use(params);
  const [asset, setAsset] = useState<DasAsset | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAsset(mint)
      .then((a) => {
        if (cancelled) return;
        setAsset(a);
        setDone(true);
      })
      .catch(() => {
        if (cancelled) return;
        setAsset(null);
        setDone(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mint]);

  if (!done) {
    return (
      <main className="mx-auto flex max-w-2xl justify-center px-4 py-24">
        <Loader2 className="h-6 w-6 animate-spin text-text-secondary" />
      </main>
    );
  }

  if (!asset) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-xl font-bold">Token not found</h1>
        <p className="mt-2 text-text-secondary">We couldn&apos;t read metadata for {mint}.</p>
        <Link href="/tokens" className="mt-4 inline-block text-primary underline">
          Back to all tokens
        </Link>
      </main>
    );
  }

  const price = asset.token_info?.price_info?.price_per_token ?? null;
  const marketCap = asset.market_cap ?? null;
  const supply = asset.token_info?.supply ?? 0;
  const decimals = asset.token_info?.decimals ?? 0;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center gap-4">
        <TokenImage image={asset.content.links?.image ?? null} symbol={asset.content.metadata.symbol ?? "?"} className="h-16 w-16" />
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            {asset.content.metadata.name ?? "Untitled"}
            <span className="font-mono text-sm text-text-secondary">{asset.content.metadata.symbol}</span>
          </h1>
          <Link href={`${EXPLORER_URL}/address/${mint}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-primary underline">
            {truncateAddress(mint, 8)}
          </Link>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-text-secondary">Price</div>
          <div className="mt-1 font-mono text-lg font-semibold text-primary">{formatUsd(price)}</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-text-secondary">Market cap</div>
          <div className="mt-1 font-mono text-lg font-semibold">{formatUsd(marketCap)}</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-text-secondary">Total supply</div>
          <div className="mt-1 font-mono text-lg font-semibold">{formatCompact(supply)}</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-text-secondary">Decimals</div>
          <div className="mt-1 font-mono text-lg font-semibold">{decimals}</div>
        </div>
      </div>

      {asset.content.metadata.description && (
        <p className="mt-6 rounded-lg border border-border bg-surface p-4 text-sm leading-relaxed text-text-secondary">
          {asset.content.metadata.description}
        </p>
      )}
    </main>
  );
}