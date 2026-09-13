"use client";

import Link from "next/link";
import { BarChart3, Loader2, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { searchFungibleAssets, type DasAsset } from "@/lib/das";
import { getCookMarketData, type CookMarketData } from "@/lib/pricing";
import { TokenImage } from "@/components/portfolio/HoldingsTable";
import { formatCompact, formatPct, formatUsd } from "@/lib/format";

const COOK_MINT = "36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1";

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
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullRows = useRef<Row[]>([]);

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
        fullRows.current = list;
        setRows(list);
        setCook(market);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tokens");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const trimmed = query.trim();
    timer.current = setTimeout(async () => {
      if (!trimmed) {
        setRows(fullRows.current);
        setSearching(false);
        return;
      }
      setSearching(true);
      try {
        const assets = await searchFungibleAssets(trimmed, 100);
        const seen = new Set<string>();
        const list: Row[] = [];
        for (const a of assets) {
          if (seen.has(a.id)) continue;
          seen.add(a.id);
          if (a.id === COOK_MINT) continue;
          list.push(toRow(a));
        }
        setRows(list);
      } catch {
        setRows([]);
      } finally {
        setSearching(false);
      }
    }, trimmed ? 250 : 0);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
        <h1 className="text-xl font-bold sm:text-2xl">All tokens on Cookie Chain</h1>
      </div>
      <p className="mt-2 text-sm text-text-secondary sm:text-base">
        Every fungible token discovered on Cookie Chain, ranked by holder count. Search by name or symbol.
      </p>

      <div className="mt-6 flex max-w-md items-center gap-2 rounded-lg border border-border bg-surface px-3">
        <Search className="h-4 w-4 shrink-0 text-text-secondary" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tokens…"
          className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-text-secondary/70"
        />
        {searching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-text-secondary" />}
      </div>

      {error && <div className="mt-6 rounded-lg border border-error/30 bg-error/5 p-4 text-sm text-error">{error}</div>}
      {loading && (
        <div className="mt-16 flex items-center justify-center gap-2 text-text-secondary">
          <Loader2 className="h-5 w-5 animate-spin" />
          Scanning Cookie Chain…
        </div>
      )}

      {!loading && (
        <div className="mt-8 overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[560px] text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-text-secondary">
                <th className="px-3 py-2.5 font-medium sm:px-4 sm:py-3">#</th>
                <th className="px-3 py-2.5 font-medium sm:px-4 sm:py-3">Token</th>
                <th className="px-3 py-2.5 text-right font-medium sm:px-4 sm:py-3">Price</th>
                <th className="px-3 py-2.5 text-right font-medium sm:px-4 sm:py-3">24h</th>
                <th className="px-3 py-2.5 text-right font-medium sm:px-4 sm:py-3">Market cap</th>
                <th className="px-3 py-2.5 text-right font-medium sm:px-4 sm:py-3">Holders</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50 bg-surface-hover/30">
                <td className="px-3 py-2.5 font-mono text-text-secondary sm:px-4 sm:py-3">1</td>
                <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                  <Link href="/token/36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1" className="flex items-center gap-2 sm:gap-3">
                    <TokenImage image={null} symbol="COOK" className="h-7 w-7 bg-primary/15 text-primary sm:h-8 sm:w-8" />
                    <div>
                      <div className="font-medium text-text-primary">
                        Cookie <span className="ml-1 font-mono text-xs text-text-secondary">COOK</span>
                      </div>
                      <div className="text-xs text-text-secondary">Native token of Cookie Chain</div>
                    </div>
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-text-primary sm:px-4 sm:py-3">{formatUsd(cook?.priceUsd)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-text-secondary sm:px-4 sm:py-3">—</td>
                <td className="px-3 py-2.5 text-right font-mono text-text-primary sm:px-4 sm:py-3">{formatUsd(cook?.marketCapUsd)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-text-primary sm:px-4 sm:py-3">—</td>
              </tr>
              {rows.map((r, i) => (
                <tr key={r.mint} className="border-b border-border/50 last:border-0 hover:bg-surface-hover/50">
                  <td className="px-3 py-2.5 font-mono text-text-secondary sm:px-4 sm:py-3">{i + 2}</td>
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                    <Link href={`/token/${r.mint}`} className="flex items-center gap-2 sm:gap-3">
                      <TokenImage image={r.image} symbol={r.symbol} />
                      <div>
                        <div className="font-medium text-text-primary">
                          {r.name} <span className="ml-1 font-mono text-xs text-text-secondary">{r.symbol}</span>
                        </div>
                        <div className="font-mono text-xs text-text-secondary">supply {formatCompact(r.supply)}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-text-primary sm:px-4 sm:py-3">{formatUsd(r.priceUsd)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-secondary sm:px-4 sm:py-3">{formatPct(r.change24h)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-text-primary sm:px-4 sm:py-3">{formatUsd(r.marketCapUsd)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-text-secondary sm:px-4 sm:py-3">
                    {r.holderCount > 0 ? formatCompact(r.holderCount) : "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-text-secondary sm:px-4">
                    {query.trim() ? "No tokens match that search." : "No tokens discovered yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}