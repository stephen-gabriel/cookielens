import { count, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getDb } from "@/server/db";
import { activities, follows, tokens, users, wallets } from "@/server/db/schema";
import { isValidAddress } from "@/lib/chain";
import { readSession } from "@/server/auth/session";
import { jsonError } from "@/server/http";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await ctx.params;
  if (!isValidAddress(wallet)) return jsonError("Not a valid Cookie Chain address.", 400);
  const db = getDb();
  const session = readSession(_req);

  const [walletRow] = await db.select().from(wallets).where(eq(wallets.address, wallet)).limit(1);
  const [user] = await db
    .select({ id: users.id, username: users.username, claimedAt: users.claimedAt })
    .from(users)
    .where(eq(users.walletAddress, wallet))
    .limit(1);

  const [followersRow] = await db
    .select({ n: count() })
    .from(follows)
    .where(eq(follows.followeeWallet, wallet));
  const [followingRow] = await db
    .select({ n: count() })
    .from(follows)
    .where(eq(follows.followerWallet, wallet));

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
      tokenMint: activities.tokenMint,
      tokenSymbol: tokens.symbol,
      tokenName: tokens.name,
    })
    .from(activities)
    .leftJoin(tokens, eq(activities.tokenMint, tokens.mint))
    .where(eq(activities.wallet, wallet))
    .orderBy(desc(activities.timestamp))
    .limit(10);

  let isFollowing = false;
  if (session) {
    const [follow] = await db
      .select({ n: count() })
      .from(follows)
      .where(sql`${follows.followerWallet} = ${session.wallet} AND ${follows.followeeWallet} = ${wallet}`);
    isFollowing = Number(follow?.n ?? 0) > 0;
  }

  return NextResponse.json({
    ok: true,
    wallet: {
      address: wallet,
      verified: !!user,
      username: user?.username ?? null,
      claimedAt: user?.claimedAt?.toISOString() ?? null,
      firstObservedAt: walletRow?.firstObservedAt?.toISOString() ?? null,
      lastActivityAt: walletRow?.lastActivityAt?.toISOString() ?? null,
      daysActive:
        walletRow?.firstObservedAt && walletRow?.lastActivityAt
          ? Math.max(1, Math.round((walletRow.lastActivityAt.getTime() - walletRow.firstObservedAt.getTime()) / 86400000))
          : 0,
      txCount: walletRow?.txCount ?? 0,
      tokenInteractions: walletRow?.tokenInteractions ?? 0,
      followers: Number(followersRow?.n ?? 0),
      following: Number(followingRow?.n ?? 0),
    },
    isFollowing,
    recentActivity: recent.map((r) => ({
      id: r.id,
      signature: r.signature,
      type: r.type,
      amount: r.amount ? Number(r.amount) : null,
      valueUsd: r.valueUsd ? Number(r.valueUsd) : null,
      timestamp: r.timestamp.toISOString(),
      slot: r.slot,
      token: r.tokenMint
        ? { mint: r.tokenMint, symbol: r.tokenSymbol, name: r.tokenName }
        : null,
    })),
  });
}