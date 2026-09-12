import { desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { readSession } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { follows, socialEvents, tokens } from "@/server/db/schema";
import type { FeedEvent } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/feed?tab=discover|following — Social Events, newest first. */
export async function GET(req: NextRequest) {
  const tab = req.nextUrl.searchParams.get("tab") ?? "discover";

  const db = getDb();
  const limit = 50;

  const base = db
    .select({
      id: socialEvents.id,
      archetype: socialEvents.archetype,
      wallet: socialEvents.wallet,
      tokenMint: socialEvents.tokenMint,
      payload: socialEvents.payload,
      significance: socialEvents.significance,
      createdAt: socialEvents.createdAt,
      tokenSymbol: tokens.symbol,
      tokenName: tokens.name,
    })
    .from(socialEvents)
    .leftJoin(tokens, eq(socialEvents.tokenMint, tokens.mint))
    .orderBy(desc(socialEvents.createdAt));

  try {
    if (tab === "following") {
      const session = readSession(req);
      if (!session) {
        return NextResponse.json({ ok: false, error: "Sign in to see your Following feed." }, { status: 401 });
      }
      const following = await db
        .select({ followee: follows.followeeWallet })
        .from(follows)
        .where(eq(follows.followerWallet, session.wallet))
        .limit(1000);
      const wallets = following.map((f) => f.followee);
      if (wallets.length === 0) {
        return NextResponse.json({ ok: true, events: [] });
      }
      const rows = await base.where(inArray(socialEvents.wallet, wallets)).limit(limit);
      return NextResponse.json({ ok: true, events: mapEvents(rows) });
    }

    const rows = await base.where(eq(socialEvents.archetype, "significant_entry")).limit(limit);
    return NextResponse.json({ ok: true, events: mapEvents(rows) });
  } catch (err) {
    console.error("[feed]", err);
    return NextResponse.json({ ok: false, error: "Feed unavailable" }, { status: 500 });
  }
}

type Row = {
  id: number;
  archetype: string;
  wallet: string | null;
  tokenMint: string | null;
  payload: unknown;
  significance: string;
  createdAt: Date;
  tokenSymbol: string | null;
  tokenName: string | null;
};

function mapEvents(rows: Row[]): FeedEvent[] {
  return rows.map((r) => ({
    id: r.id,
    archetype: r.archetype as FeedEvent["archetype"],
    wallet: r.wallet ?? null,
    token: r.tokenMint ? { mint: r.tokenMint, symbol: r.tokenSymbol ?? "?", name: r.tokenName ?? r.tokenMint } : null,
    payload:
      typeof r.payload === "object" && r.payload !== null
        ? (r.payload as FeedEvent["payload"])
        : { title: "Activity on Cookie Chain" },
    significance: Number(r.significance),
    createdAt: r.createdAt.toISOString(),
  }));
}