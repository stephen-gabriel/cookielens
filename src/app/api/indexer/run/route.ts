import path from "node:path";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// No bundling: the worker is a plain .cjs loaded at runtime (it loads
// .env.local itself). Turbopack must not statically analyze this require.
/* eslint-disable-next-line no-eval */
const runtimeRequire = eval("require") as NodeRequire;
const WORKER_PATH = path.resolve(process.cwd(), "scripts", "indexer.cjs");

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type WorkerModule = {
  runBoundedCycle: (opts?: { maxSlots?: number; maxMs?: number }) => Promise<{
    done: number;
    actions: number;
    events: number;
    head: number;
    cancelled: boolean;
  }>;
};

export const GET = handle;
export const POST = handle;

function authorized(req: NextRequest): { ok: boolean; reason?: string } {
  const secret = process.env.CRON_SECRET || process.env.INDEXER_RUN_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      return { ok: true };
    }
    return { ok: false, reason: "Indexer run secret not configured (CRON_SECRET or INDEXER_RUN_SECRET)." };
  }
  const auth = req.headers.get("authorization") ?? "";
  const token = new URL(req.url).searchParams.get("token");
  if (req.headers.get("x-vercel-cron") === "1") return { ok: true };
  if (auth === `Bearer ${secret}` || token === secret) return { ok: true };
  return { ok: false, reason: "Unauthorized." };
}

async function handle(req: NextRequest) {
  const auth = authorized(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const maxSlots = Math.max(10, Math.min(400, Number(params.get("slots")) || 200));
  const maxMs = Math.max(5000, Math.min(50000, Number(params.get("maxMs")) || 45000));

  try {
    const worker = runtimeRequire(WORKER_PATH) as WorkerModule;
    const result = await worker.runBoundedCycle({ maxSlots, maxMs });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Indexer run failed." },
      { status: 500 },
    );
  }
}