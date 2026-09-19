"use client";

import Link from "next/link";
import { BarChart3, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
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
  const [page, setPage] = useState(1);
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

  const filtered = rows.filter((r) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return r.name.toLowerCase().includes(q) || r.symbol.toLowerCase().includes(q) || r.mint.toLowerCase().includes(q);
  });

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const showCook = currentPage === 1 && (!query.trim() || "cookie cook".includes(query.trim().toLowerCase()) || COOK_MINT.toLowerCase().includes(query.trim().toLowerCase()));

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
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search tokens…"
          className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-text-secondary/70"
        />
      </div>

      {error && <div className="mt-6 rounded-lg border border-error/30 bg-error/5 p-4 text-sm text-error">{error}</div>}
      {loading && (
        <div className="mt-16 flex items-center justify-center gap-2 text-text-secondary">
          <Loader2 className="h-5 w-5 animate-spin" />
          Scanning Cookie Chain…
        </div>
      )}

      {!loading && (
        <>
          <div className="mt-8 overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full table-fixed text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-text-secondary">
                  <th className="w-12 px-2 py-2.5 font-medium sm:px-4 sm:py-3">#</th>
                  <th className="px-2 py-2.5 font-medium sm:px-4 sm:py-3">Token</th>
                  <th className="w-24 px-2 py-2.5 text-right font-medium sm:px-4 sm:py-3">Price</th>
                  <th className="w-20 px-2 py-2.5 text-right font-medium sm:px-4 sm:py-3">24h</th>
                  <th className="w-28 px-2 py-2.5 text-right font-medium sm:px-4 sm:py-3">M.Cap</th>
                  <th className="w-20 px-2 py-2.5 text-right font-medium sm:px-4 sm:py-3">Holders</th>
                </tr>
              </thead>
              <tbody>
                {showCook && (
                  <tr className="border-b border-border/50 bg-surface-hover/30">
                    <td className="w-12 px-2 py-2.5 font-mono text-text-secondary sm:px-4 sm:py-3">1</td>
                    <td className="px-2 py-2.5 sm:px-4 sm:py-3">
                      <Link href={`/token/${COOK_MINT}`} className="flex items-center gap-2">
                        <TokenImage image={null} symbol="COOK" className="h-7 w-7 shrink-0 bg-primary/15 text-primary sm:h-8 sm:w-8" />
                        <div className="min-w-0 flex-1 truncate">
                          <div className="truncate font-medium text-text-primary">
                            Cookie <span className="ml-1 font-mono text-xs text-text-secondary">COOK</span>
                          </div>
                          <div className="truncate text-xs text-text-secondary">Native token</div>
                        </div>
                      </Link>
                    </td>
                    <td className="w-24 px-2 py-2.5 text-right font-mono text-text-primary sm:px-4 sm:py-3">{formatUsd(cook?.priceUsd)}</td>
                    <td className="w-20 px-2 py-2.5 text-right font-mono text-text-secondary sm:px-4 sm:py-3">—</td>
                    <td className="w-28 px-2 py-2.5 text-right font-mono text-text-primary sm:px-4 sm:py-3">{formatUsd(cook?.marketCapUsd)}</td>
                    <td className="w-20 px-2 py-2.5 text-right font-mono text-text-primary sm:px-4 sm:py-3">—</td>
                  </tr>
                )}
                {paginated.map((r, i) => {
                  const absoluteIndex = (currentPage - 1) * pageSize + i + (showCook ? 2 : 1);
                  return (
                    <tr key={r.mint} className="border-b border-border/50 last:border-0 hover:bg-surface-hover/50">
                      <td className="w-12 px-2 py-2.5 font-mono text-text-secondary sm:px-4 sm:py-3">{absoluteIndex}</td>
                      <td className="px-2 py-2.5 sm:px-4 sm:py-3">
                        <Link href={`/token/${r.mint}`} className="flex items-center gap-2">
                          <TokenImage image={r.image} symbol={r.symbol} className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />
                          <div className="min-w-0 flex-1 truncate">
                            <div className="truncate font-medium text-text-primary">
                              {r.name} <span className="ml-1 font-mono text-xs text-text-secondary">{r.symbol}</span>
                            </div>
                            <div className="truncate font-mono text-xs text-text-secondary">supply {formatCompact(r.supply)}</div>
                          </div>
                        </Link>
                      </td>
                      <td className="w-24 px-2 py-2.5 text-right font-mono text-text-primary sm:px-4 sm:py-3">{formatUsd(r.priceUsd)}</td>
                      <td className="w-20 px-2 py-2.5 text-right font-mono text-secondary sm:px-4 sm:py-3">{formatPct(r.change24h)}</td>
                      <td className="w-28 px-2 py-2.5 text-right font-mono text-text-primary sm:px-4 sm:py-3">{formatUsd(r.marketCapUsd)}</td>
                      <td className="w-20 px-2 py-2.5 text-right font-mono text-text-secondary sm:px-4 sm:py-3">
                        {r.holderCount > 0 ? formatCompact(r.holderCount) : "—"}
                      </td>
                    </tr>
                  );
                })}
                {!showCook && paginated.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-text-secondary sm:px-4">
                      {query.trim() ? "No tokens match that search." : "No tokens discovered yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm text-text-secondary">
              <div>
                Showing page <span className="font-semibold text-text-primary">{currentPage}</span> of{" "}
                <span className="font-semibold text-text-primary">{totalPages}</span> ({filtered.length} tokens)
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="flex cursor-pointer items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="flex cursor-pointer items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
