import { createIndexer } from "../../../../server/indexer/engine";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const indexer = createIndexer(process.env);

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

export const GET = handle;
export const POST = handle;

async function handle(req: NextRequest) {
  const auth = authorized(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const maxSlots = Math.max(10, Math.min(400, Number(params.get("slots")) || 200));
  const maxMs = Math.max(5000, Math.min(50000, Number(params.get("maxMs")) || 9000));

  try {
    const result = await indexer.runBoundedCycle({ maxSlots, maxMs });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Indexer run failed." },
      { status: 500 },
    );
  }
}