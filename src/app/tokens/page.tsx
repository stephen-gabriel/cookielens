"use client";

import Link from "next/link";
import { BarChart3, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { searchFungibleAssets, type DasAsset } from "@/lib/das";
import { getCookMarketData, type CookMarketData } from "@/lib/pricing";
import { TokenImage } from "@/components/portfolio/HoldingsTable";
import { formatCompact, formatPct, formatUsd } from "@/lib/format";

type Row = {
  mint: string;
  name: string;
  symbol: string;
  image: string | null;
  supply: number;
  decimals: number;
  holderCount: number;
  priceUsd: number | null;
  marketCapUsd: number | null;
  change24h: number | null;
  volumeUsd: number | null;
};

function toRow(a: DasAsset): Row {
  return {
    mint: a.id,
    name: a.content.metadata.name ?? a.id,
    symbol: a.content.metadata.symbol ?? a.token_info?.symbol ?? "—",
    image: a.content.links?.image ?? a.content.files?.[0]?.uri ?? null,
    supply: a.token_info?.supply ?? 0,
    decimals: a.token_info?.decimals ?? 0,
    holderCount: a.holder_count ?? 0,
    priceUsd: a.token_info?.price_info?.price_per_token ?? null,
    marketCapUsd: a.market_cap ?? null,
    change24h: a.price_change_24h ?? null,
    volumeUsd: a.volume_24h ?? null,
  };
}

export default function TokensPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [cook, setCook] = useState<CookMarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [assets, market] = await Promise.all([searchFungibleAssets(undefined, 500), getCookMarketData()]);
        const seen = new Set<string>();
        const list: Row[] = [];
        for (const a of assets) {
          if (seen.has(a.id)) continue;
          seen.add(a.id);
          if (a.content.metadata.symbol === "COOK" || a.id.startsWith("36ZrtQ")) continue;
          const row = toRow(a);
          if (row.holderCount === 0) continue;
          list.push(row);
        }
        list.sort((x, y) => y.holderCount - x.holderCount);
        setRows(list);
        setCook(market);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tokens");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">All tokens on Cookie Chain</h1>
      </div>
      <p className="mt-2 text-text-secondary">
        Every fungible token discovered on Cookie Chain, ranked by holder count.
      </p>

      {error && <div className="mt-6 rounded-lg border border-error/30 bg-error/5 p-4 text-sm text-error">{error}</div>}
      {loading && (
        <div className="mt-16 flex items-center justify-center gap-2 text-text-secondary">
          <Loader2 className="h-5 w-5 animate-spin" />
          Scanning Cookie Chain…
        </div>
      )}

      {!loading && (
        <div className="mt-8 overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-text-secondary">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Token</th>
                <th className="px-4 py-3 text-right font-medium">Price</th>
                <th className="px-4 py-3 text-right font-medium">24h</th>
                <th className="px-4 py-3 text-right font-medium">Market cap</th>
                <th className="px-4 py-3 text-right font-medium">Holders</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50 bg-surface-hover/30">
                <td className="px-4 py-3 font-mono text-text-secondary">1</td>
                <td className="px-4 py-3">
                  <Link href="/token/36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1" className="flex items-center gap-3">
                    <TokenImage image={null} symbol="COOK" className="h-8 w-8 bg-primary/15 text-primary" />
                    <div>
                      <div className="font-medium text-text-primary">
                        Cookie <span className="ml-1 font-mono text-xs text-text-secondary">COOK</span>
                      </div>
                      <div className="text-xs text-text-secondary">Native token of Cookie Chain</div>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-right font-mono text-text-primary">{formatUsd(cook?.priceUsd)}</td>
                <td className="px-4 py-3 text-right font-mono text-text-secondary">—</td>
                <td className="px-4 py-3 text-right font-mono text-text-primary">{formatUsd(cook?.marketCapUsd)}</td>
                <td className="px-4 py-3 text-right font-mono text-text-primary">—</td>
              </tr>
              {rows.map((r, i) => (
                <tr key={r.mint} className="border-b border-border/50 last:border-0 hover:bg-surface-hover/50">
                  <td className="px-4 py-3 font-mono text-text-secondary">{i + 2}</td>
                  <td className="px-4 py-3">
                    <Link href={`/token/${r.mint}`} className="flex items-center gap-3">
                      <TokenImage image={r.image} symbol={r.symbol} />
                      <div>
                        <div className="font-medium text-text-primary">
                          {r.name} <span className="ml-1 font-mono text-xs text-text-secondary">{r.symbol}</span>
                        </div>
                        <div className="font-mono text-xs text-text-secondary">supply {formatCompact(r.supply)}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-text-primary">{formatUsd(r.priceUsd)}</td>
                  <td className="px-4 py-3 text-right font-mono text-secondary">{formatPct(r.change24h)}</td>
                  <td className="px-4 py-3 text-right font-mono text-text-primary">{formatUsd(r.marketCapUsd)}</td>
                  <td className="px-4 py-3 text-right font-mono text-text-secondary">
                    {r.holderCount > 0 ? formatCompact(r.holderCount) : "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                    No tokens discovered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}