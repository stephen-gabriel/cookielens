import { desc, eq, isNotNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/server/db";
import { follows, users, wallets } from "@/server/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/wallets/active — recently observed wallets with follower counts. */
export async function GET() {
  const db = getDb();

  try {
    const followerCount = db
      .select({ target: follows.followeeWallet, count: sql<number>`count(*)::int`.as("follower_count") })
      .from(follows)
      .groupBy(follows.followeeWallet)
      .as("follower_count");

    const rows = await db
      .select({
        wallet: wallets.address,
        username: users.username,
        firstObservedAt: wallets.firstObservedAt,
        lastActivityAt: wallets.lastActivityAt,
        followerCount: followerCount.count,
      })
      .from(wallets)
      .leftJoin(users, eq(users.walletAddress, wallets.address))
      .leftJoin(followerCount, eq(followerCount.target, wallets.address))
      .where(isNotNull(wallets.lastActivityAt))
      .orderBy(desc(wallets.lastActivityAt))
      .limit(30);

    return NextResponse.json({ ok: true, wallets: rows });
  } catch (err) {
    console.error("[wallets/active]", err);
    return NextResponse.json({ ok: false, error: "Wallets unavailable" }, { status: 500 });
  }
}