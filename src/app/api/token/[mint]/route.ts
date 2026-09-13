import { and, count, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getDb } from "@/server/db";
import { activities, tokens, tokenStats, watches } from "@/server/db/schema";
import { isValidAddress } from "@/lib/chain";
import { readSession } from "@/server/auth/session";
import { jsonError } from "@/server/http";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ mint: string }> }) {
  const { mint } = await ctx.params;
  if (!isValidAddress(mint)) return jsonError("Not a valid token mint.", 400);
  const db = getDb();
  const session = readSession(_req);

  const [token] = await db.select().from(tokens).where(eq(tokens.mint, mint)).limit(1);

  const [buyersRow] = await db
    .select({ n: count() })
    .from(activities)
    .where(and(eq(activities.tokenMint, mint), eq(activities.type, "buy")));
  const [sellersRow] = await db
    .select({ n: count() })
    .from(activities)
    .where(and(eq(activities.tokenMint, mint), eq(activities.type, "sell")));

  const [statsRow] = await db
    .select({
      holderCount: tokenStats.holderCount,
      buyers1h: tokenStats.buyers1h,
      sellers1h: tokenStats.sellers1h,
      volume24h: tokenStats.volume24h,
      sampledAt: tokenStats.sampledAt,
    })
    .from(tokenStats)
    .where(eq(tokenStats.mint, mint))
    .orderBy(desc(tokenStats.sampledAt))
    .limit(1);

  const verifiedRow = (await db.execute(sql`
    select count(distinct a.wallet)::int as n from activities a
    where a.token_mint = ${mint}
      and a.timestamp > now() - interval '24 hours'
      and exists (select 1 from users u where u.wallet_address = a.wallet)`)) as unknown as {
    rows?: { n: number }[];
  };
  const verifiedBuyers = Number(verifiedRow.rows?.[0]?.n ?? 0);

  const recent = await db
    .select({
      id: activities.id,
      signature: activities.signature,
      wallet: activities.wallet,
      type: activities.type,
      amount: activities.amount,
      valueUsd: activities.valueUsd,
      timestamp: activities.timestamp,
      slot: activities.slot,
    })
    .from(activities)
    .where(eq(activities.tokenMint, mint))
    .orderBy(desc(activities.timestamp))
    .limit(15);

  let isWatched = false;
  if (session) {
    const [watch] = await db
      .select({ n: count() })
      .from(watches)
      .where(sql`${watches.walletAddress} = ${session.wallet} AND ${watches.tokenMint} = ${mint}`);
    isWatched = Number(watch?.n ?? 0) > 0;
  }

  return NextResponse.json({
    ok: true,
    token: token
      ? {
          mint: token.mint,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          priceUsd: token.priceUsd ? Number(token.priceUsd) : null,
          marketCap: token.marketCap ? Number(token.marketCap) : null,
          holderCount: token.holderCount,
          volume24h: token.volume24h ? Number(token.volume24h) : null,
          firstObservedAt: token.firstObservedAt.toISOString(),
          updatedAt: token.updatedAt.toISOString(),
        }
      : null,
    activity: {
      buyers: Number(buyersRow?.n ?? 0),
      sellers: Number(sellersRow?.n ?? 0),
    },
    community: {
      holders: token?.holderCount ?? 0,
      holdersDelta:
        statsRow && statsRow.holderCount !== null && Number(statsRow.holderCount) > 0
          ? (token?.holderCount ?? 0) - Number(statsRow.holderCount)
          : null,
      buyers1h: statsRow ? Number(statsRow.buyers1h ?? 0) : 0,
      sellers1h: statsRow ? Number(statsRow.sellers1h ?? 0) : 0,
      volume24h: token?.volume24h ? Number(token.volume24h) : null,
      verifiedBuyers,
    },
    recentActivity: recent.map((r) => ({
      id: r.id,
      signature: r.signature,
      wallet: r.wallet,
      type: r.type,
      amount: r.amount ? Number(r.amount) : null,
      valueUsd: r.valueUsd ? Number(r.valueUsd) : null,
      timestamp: r.timestamp.toISOString(),
      slot: r.slot,
    })),
    isWatched,
  });
}