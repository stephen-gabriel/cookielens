"use client";

import Link from "next/link";
import { ArrowUpRight, UserPlus } from "lucide-react";
import { ARCHETYPE_EMOJI, ARCHETYPE_LABEL, type FeedEvent } from "@/lib/events";
import { formatPct, timeAgo } from "@/lib/format";

function MetricChip({ label, value, tone }: { label: string; value: string; tone: "pos" | "neg" | "neutral" }) {
  const color = tone === "pos" ? "text-primary" : tone === "neg" ? "text-error" : "text-text-secondary";
  return (
    <span className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs">
      <span className={color}>{value}</span>
      <span className="ml-1 text-text-secondary">{label}</span>
    </span>
  );
}

export function EventCard({ event }: { event: FeedEvent }) {
  const { payload, token, wallet, username, archetype, createdAt } = event;
  const metrics = payload.metrics;
  const social = payload.social;

  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
          <span>{ARCHETYPE_EMOJI[archetype]}</span>
          <span className="uppercase tracking-wide">{ARCHETYPE_LABEL[archetype]}</span>
          {username && (
            <>
              <span>·</span>
              <span className="font-semibold text-primary">@{username}</span>
            </>
          )}
          <span>·</span>
          <time>{timeAgo(new Date(createdAt).getTime() / 1000)}</time>
        </div>
        {token && (
          <Link
            href={`/token/${token.mint}`}
            className="shrink-0 font-mono text-xs text-primary underline"
          >
            {token.symbol}
          </Link>
        )}
      </header>

      <h3 className="mt-2 text-sm font-semibold leading-relaxed sm:text-base">{payload.title}</h3>

      {payload.amount && (
        <p className="mt-1 font-mono text-sm text-text-secondary">{payload.amount}</p>
      )}

      {metrics && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {metrics.volumePct !== undefined && (
            <MetricChip label="volume" value={formatPct(metrics.volumePct)} tone={metrics.volumePct >= 0 ? "pos" : "neg"} />
          )}
          {metrics.holdersPct !== undefined && (
            <MetricChip label="holders" value={formatPct(metrics.holdersPct)} tone={metrics.holdersPct >= 0 ? "pos" : "neg"} />
          )}
          {metrics.newHolders !== undefined && (
            <MetricChip label="new holders" value={String(metrics.newHolders)} tone="neutral" />
          )}
          {metrics.buyers !== undefined && <MetricChip label="buyers" value={String(metrics.buyers)} tone="neutral" />}
          {metrics.sellers !== undefined && <MetricChip label="sellers" value={String(metrics.sellers)} tone="neutral" />}
        </div>
      )}

      {social && (social.followedWallets !== undefined || social.verifiedWallets !== undefined) && (
        <p className="mt-2 text-xs text-text-secondary">
          {social.followedWallets ? `${social.followedWallets} wallets you follow` : ""}
          {social.followedWallets && social.verifiedWallets ? " · " : ""}
          {social.verifiedWallets ? `${social.verifiedWallets} verified wallets` : ""}
        </p>
      )}

      <footer className="mt-3 flex flex-wrap items-center gap-2">
        {token && (
          <Link
            href={`/token/${token.mint}`}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-text-secondary transition hover:border-primary/50 hover:text-primary"
          >
            Explore <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
        {wallet && (
          <Link
            href={`/wallets/${wallet}`}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-secondary transition hover:border-secondary/50 hover:text-secondary"
          >
            <UserPlus className="h-3 w-3" /> {username ? `@${username}` : "Inspect wallet"}
          </Link>
        )}
      </footer>
    </article>
  );
}