"use client";

import Link from "next/link";
import { LayoutDashboard, Loader2, RefreshCw } from "lucide-react";
import { useWallet } from "@/lib/providers";
import { usePortfolio } from "@/hooks/usePortfolio";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { SendCookPanel } from "@/components/wallet/SendCookPanel";
import { formatNative, formatUsd } from "@/lib/format";

export default function PortfolioPage() {
  const { account, connectedWallet } = useWallet();
  const address = account?.address ?? null;
  const { data, loading, error, refresh } = usePortfolio(address);

  if (!connectedWallet || !account) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center">
        <LayoutDashboard className="h-10 w-10 text-text-secondary sm:h-12 sm:w-12" />
        <h1 className="mt-4 text-xl font-bold sm:text-2xl">Connect your wallet</h1>
        <p className="mt-2 max-w-md text-sm text-text-secondary sm:text-base">
          Connect your Nightly wallet to see your COOK balance and every token you hold on Cookie Chain.
        </p>
        <Link href="/" className="mt-6 text-primary underline">
          Back to overview
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Portfolio</h1>
          <p className="break-all font-mono text-xs text-text-secondary sm:text-sm">{account.address}</p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-text-secondary transition hover:border-primary/50 hover:text-primary disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-error/30 bg-error/5 p-4 text-sm text-error">{error}</div>
      )}

      {loading && !data && (
        <div className="mt-16 flex items-center justify-center gap-2 text-text-secondary">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading balances from Cookie Chain…
        </div>
      )}

      {data && !loading && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
              <div className="text-xs uppercase tracking-wide text-text-secondary">Total Value</div>
              <div className="mt-1 truncate font-mono text-xl font-bold text-primary sm:text-2xl">{formatUsd(data.totalUsd)}</div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
              <div className="text-xs uppercase tracking-wide text-text-secondary">COOK Balance</div>
              <div className="mt-1 truncate font-mono text-xl font-bold sm:text-2xl">
                {formatNative(Math.round(data.cookBalance * 1e9))}
                <span className="ml-1 text-xs text-text-secondary sm:text-sm">COOK</span>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
              <div className="text-xs uppercase tracking-wide text-text-secondary">COOK Value</div>
              <div className="mt-1 truncate font-mono text-xl font-bold sm:text-2xl">{formatUsd(data.cookUsdValue)}</div>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="mb-3 text-base font-semibold sm:text-lg">Holdings</h2>
            <HoldingsTable rows={data.tokenHoldings.map((h) => h)} />
          </div>

          <div className="mt-8">
            <SendCookPanel cookBalance={data.cookBalance} onSent={refresh} />
          </div>
        </>
      )}
    </div>
  );
}