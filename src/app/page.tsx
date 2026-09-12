"use client";

import Link from "next/link";
import { Activity, ArrowRight, BarChart3, Eye, LayoutDashboard, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { RPC_URL } from "@/lib/constants";
import { getCookMarketData, type CookMarketData } from "@/lib/pricing";

const features = [
  {
    icon: LayoutDashboard,
    title: "Your portfolio, on-chain",
    desc: "Connect Nightly and see your COOK balance plus every token you hold, valued live in USD.",
    href: "/portfolio",
  },
  {
    icon: Eye,
    title: "Watch any wallet",
    desc: "Paste any Cookie Chain address — research whales, validators, and the reserve vault without connecting.",
    href: "/watch",
  },
  {
    icon: BarChart3,
    title: "Every token in one table",
    desc: "Discover every fungible token on Cookie Chain, ranked by holders. The ecosystem at a glance.",
    href: "/tokens",
  },
  {
    icon: Activity,
    title: "Activity & history",
    desc: "Dive into per-wallet transaction history straight from the chain.",
    href: "/watch",
  },
];

async function getSlotHeight() {
  try {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSlotHeight", params: [] }),
    });
    const json = (await res.json()) as { result?: number };
    return json.result ?? null;
  } catch {
    return null;
  }
}

export default function HomePage() {
  const [cook, setCook] = useState<CookMarketData | null>(null);
  const [slot, setSlot] = useState<number | null>(null);

  useEffect(() => {
    getCookMarketData().then(setCook).catch(() => setCook(null));
    getSlotHeight().then(setSlot).catch(() => setSlot(null));
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4">
      <section className="flex flex-col items-center py-20 text-center">
        <span className="rounded-full border border-border bg-surface px-4 py-1 text-xs text-text-secondary">
          Cookie Chain ecosystem analytics
        </span>
        <h1 className="mt-6 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">
          See every cookie on <span className="text-primary">Cookie Chain</span>
        </h1>
        <p className="mt-4 max-w-xl text-base text-text-secondary sm:text-lg">
          CookieLens is the portfolio tracker and market explorer for the COOK ecosystem —
          balances, prices, holders, and history in one place. No signing, no fees, no COOK required.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          <Link
            href="/portfolio"
            className="flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-background transition hover:bg-primary/90 sm:px-6 sm:py-3 sm:text-base"
          >
            Track my portfolio <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/tokens"
            className="rounded-md border border-border px-5 py-2.5 text-sm text-text-secondary transition hover:border-primary/50 hover:text-primary sm:px-6 sm:py-3 sm:text-base"
          >
            Browse tokens
          </Link>
        </div>

        <div className="mt-12 grid w-full max-w-3xl grid-cols-2 gap-3 sm:mt-16 sm:grid-cols-4 sm:gap-4">
          <div className="min-w-0 rounded-lg border border-border bg-surface p-3 sm:p-4">
            <div className="text-xs uppercase tracking-wide text-text-secondary">COOK Price</div>
            <div className="mt-1 font-mono text-sm font-bold text-primary sm:text-lg">
              {cook?.priceUsd ? `$${cook.priceUsd.toFixed(6)}` : <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
          </div>
          <div className="min-w-0 rounded-lg border border-border bg-surface p-3 sm:p-4">
            <div className="text-xs uppercase tracking-wide text-text-secondary">COOK Market Cap</div>
            <div className="mt-1 truncate font-mono text-sm font-bold sm:text-lg">
              {cook?.marketCapUsd ? `$${cook.marketCapUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
            </div>
          </div>
          <div className="min-w-0 rounded-lg border border-border bg-surface p-3 sm:p-4">
            <div className="text-xs uppercase tracking-wide text-text-secondary">Network</div>
            <div className="mt-1 truncate font-mono text-sm font-bold text-secondary sm:text-lg">Cookie Chain</div>
          </div>
          <div className="min-w-0 rounded-lg border border-border bg-surface p-3 sm:p-4">
            <div className="text-xs uppercase tracking-wide text-text-secondary">Chain Height</div>
            <div className="mt-1 truncate font-mono text-sm font-bold sm:text-lg">{slot ? slot.toLocaleString() : "—"}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 py-12 md:grid-cols-2">
        {features.map((f) => (
          <Link key={f.title} href={f.href} className="group rounded-lg border border-border bg-surface p-6 transition hover:border-primary/40">
            <f.icon className="h-5 w-5 text-secondary sm:h-6 sm:w-6" />
            <h3 className="mt-4 text-base font-semibold sm:text-lg">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{f.desc}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm text-primary opacity-0 transition group-hover:opacity-100">
              Open <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}