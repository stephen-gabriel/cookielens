"use client";

import Link from "next/link";
import { ArrowRight, Flame, ShieldCheck, Zap } from "lucide-react";

const stats = [
  { label: "Time to launch", value: "< 60s" },
  { label: "Fee per transaction", value: "~$0.000005" },
  { label: "Program deploy", value: "~$0.05" },
];

const features = [
  {
    icon: Zap,
    title: "Fair bonding curve",
    desc: "Every token launches on a trustless CookieBox DBC curve. Prices rise as people buy — anyone in early is priced equally.",
  },
  {
    icon: ShieldCheck,
    title: "Auto liquidity",
    desc: "When the curve fills, liquidity migrates to CookieBox DAMM automatically. No rug, no manual LP.",
  },
  {
    icon: Flame,
    title: "Zero gatekeeping",
    desc: "No approvals, no whitelists. Connect your Nightly wallet and bake a token in under a minute.",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-4">
      <section className="flex flex-col items-center py-24 text-center">
        <span className="rounded-full border border-border bg-surface px-4 py-1 text-xs text-text-secondary">
          Cookie Chain Hackathon · SVM memecoin launchpad
        </span>
        <h1 className="mt-6 max-w-3xl text-5xl font-bold leading-tight tracking-tight">
          Bake your memecoin on{" "}
          <span className="text-primary">Cookie Chain</span> in 60 seconds
        </h1>
        <p className="mt-4 max-w-xl text-lg text-text-secondary">
          Fair bonding curves, instant trading, zero gatekeeping. The mint goes
          in the oven, the chart goes brrr.
        </p>
        <div className="mt-8 flex items-center gap-4">
          <Link
            href="/bake"
            className="flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-base font-semibold text-background transition hover:bg-primary/90"
          >
            Bake a Token <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/explore"
            className="rounded-md border border-border px-6 py-3 text-base text-text-secondary transition hover:border-primary/50 hover:text-primary"
          >
            Explore
          </Link>
        </div>

        <div className="mt-16 grid w-full max-w-3xl grid-cols-3 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-surface p-4">
              <div className="font-mono text-2xl font-bold text-primary">{s.value}</div>
              <div className="mt-1 text-sm text-text-secondary">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 py-12 md:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-lg border border-border bg-surface p-6">
            <f.icon className="h-6 w-6 text-secondary" />
            <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}