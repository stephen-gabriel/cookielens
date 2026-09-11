"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCompact, formatUsd, truncateAddress } from "@/lib/format";

export type RowHolding = {
  mint: string;
  symbol: string;
  name: string;
  image: string | null;
  amount: number;
  decimals: number;
  isCook: boolean;
  priceUsd: number | null;
  valueUsd: number | null;
};

export function TokenImage({ image, symbol, className = "h-8 w-8" }: { image: string | null; symbol: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (image && !failed) {
    return (
      <img
        src={image}
        alt={symbol}
        className={`${className} rounded-full object-cover`}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div className={`${className} flex items-center justify-center rounded-full bg-surface-hover text-xs font-bold text-text-secondary`}>
      {symbol.slice(0, 2) || "?"}
    </div>
  );
}

export function HoldingsTable({ rows }: { rows: RowHolding[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-text-secondary">
            <th className="px-4 py-3 font-medium">Token</th>
            <th className="px-4 py-3 text-right font-medium">Amount</th>
            <th className="px-4 py-3 text-right font-medium">Price</th>
            <th className="px-4 py-3 text-right font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.mint} className="border-b border-border/50 last:border-0 hover:bg-surface-hover/50">
              <td className="px-4 py-3">
                <Link href={`/token/${r.mint}`} className="flex items-center gap-3">
                  <TokenImage image={r.image} symbol={r.symbol} />
                  <div>
                    <div className="font-medium text-text-primary">
                      {r.name} <span className="ml-1 font-mono text-xs text-text-secondary">{r.symbol}</span>
                    </div>
                    <div className="font-mono text-xs text-text-secondary">{truncateAddress(r.mint, 6)}</div>
                  </div>
                </Link>
              </td>
              <td className="px-4 py-3 text-right font-mono text-text-primary">
                {formatCompact(r.amount)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-text-secondary">{formatUsd(r.priceUsd)}</td>
              <td className="px-4 py-3 text-right font-mono text-text-primary">{formatUsd(r.valueUsd)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-text-secondary">
                No tokens found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}