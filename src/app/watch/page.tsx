"use client";

import Link from "next/link";
import { Eye, Loader2, Search } from "lucide-react";
import { useState } from "react";
import { usePortfolio } from "@/hooks/usePortfolio";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { isValidAddress } from "@/lib/chain";
import { formatNative, formatUsd } from "@/lib/format";

export default function WatchPage() {
  const [input, setInput] = useState("");
  const [searched, setSearched] = useState<string | null>(null);
  const { data, loading, error } = usePortfolio(searched);

  const submit = () => {
    const value = input.trim();
    if (!isValidAddress(value)) return;
    setSearched(value);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center gap-2">
        <Eye className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
        <h1 className="text-xl font-bold sm:text-2xl">Watch any wallet</h1>
      </div>
      <p className="mt-2 text-sm text-text-secondary sm:text-base">
        Paste any Cookie Chain address to see its COOK balance and token holdings — no connection needed.
      </p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="e.g. G3mm95M4ns7mk8oseWGJnirvgyMahMz3vZEUhdJn8oGX"
          className="w-full rounded-md border border-border bg-surface px-3 py-2.5 font-mono text-xs text-text-primary outline-none transition focus:border-primary sm:text-sm"
        />
        <button
          onClick={submit}
          disabled={!isValidAddress(input.trim()) || loading}
          className="flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-background transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Track
        </button>
      </div>

      {input.trim() && !isValidAddress(input.trim()) && (
        <p className="mt-2 text-sm text-error">That doesn&apos;t look like a valid Cookie Chain address.</p>
      )}

      {error && (
        <div className="mt-6 rounded-lg border border-error/30 bg-error/5 p-4 text-sm text-error">{error}</div>
      )}

      {loading && searched && (
        <div className="mt-16 flex items-center justify-center gap-2 text-text-secondary">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading balances…
        </div>
      )}

      {data && !loading && (
        <>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <h2 className="break-all font-mono text-xs text-text-secondary sm:text-sm">{data.address}</h2>
            <div className="flex items-center gap-4">
              <div className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
                <span className="mr-2 text-text-secondary">Total</span>
                <span className="font-mono font-semibold text-primary">{formatUsd(data.totalUsd)}</span>
              </div>
              <div className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
                <span className="mr-2 text-text-secondary">COOK</span>
                <span className="font-mono">{formatNative(Math.round(data.cookBalance * 1e9))} COOK</span>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <HoldingsTable rows={data.tokenHoldings} />
          </div>
        </>
      )}

      {!searched && (
        <div className="mt-16 rounded-lg border border-dashed border-border p-8 text-center text-sm text-text-secondary sm:p-10 sm:text-base">
          <p>Try a known address:</p>
          <Link
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setInput("G3mm95M4ns7mk8oseWGJnirvgyMahMz3vZEUhdJn8oGX");
              setSearched("G3mm95M4ns7mk8oseWGJnirvgyMahMz3vZEUhdJn8oGX");
            }}
            className="mt-2 inline-block font-mono text-xs text-primary underline"
          >
            Cookie Chain reserve vault → 379M+ COOK
          </Link>
        </div>
      )}
    </div>
  );
}