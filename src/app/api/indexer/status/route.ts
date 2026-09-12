import { NextResponse } from "next/server";

import { getDb } from "@/server/db";
import { indexerState } from "@/server/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/indexer/status — where the standalone worker's watermark sits. */
export async function GET() {
  try {
    const rows = await getDb().select().from(indexerState);
    const state = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const head = Number(state.last_head ?? 0) || null;
    const processed = Number(state.start_slot ?? 0) || null;
    const lag = head !== null && processed !== null ? Math.max(0, head - processed) : null;
    return NextResponse.json({
      ok: true,
      lastRun: state.last_run ?? null,
      head,
      processed,
      lag,
    });
  } catch (err) {
    console.error("[indexer/status]", err);
    return NextResponse.json({ ok: false, error: "Indexer status unavailable" }, { status: 500 });
  }
}