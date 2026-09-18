import { count, desc, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getDb } from "@/server/db";
import { activities, follows, tokens, users, wallets } from "@/server/db/schema";
import { isValidAddress, getRecentSignatures } from "@/lib/chain";
import { readSession } from "@/server/auth/session";
import { jsonError } from "@/server/http";
import { short } from "@/lib/indexer-format";

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
      meta: activities.meta,
    })
    .from(activities)
    .leftJoin(tokens, eq(activities.tokenMint, tokens.mint))
    .where(eq(activities.wallet, wallet))
    .orderBy(desc(activities.timestamp))
    .limit(10);

  const walletAddresses = new Set<string>([wallet]);
  for (const r of recent) {
    if (r.wallet) walletAddresses.add(r.wallet);
    const meta = r.meta as { counter?: string } | null;
    if (meta?.counter) walletAddresses.add(meta.counter);
  }

  const userRows = await db
    .select({ walletAddress: users.walletAddress, username: users.username })
    .from(users)
    .where(inArray(users.walletAddress, [...walletAddresses]));

  const usernameMap = new Map<string, string>();
  for (const u of userRows) {
    if (u.username) usernameMap.set(u.walletAddress, u.username);
  }

  const recentActivity = recent.map((r) => {
    const meta = r.meta as { counter?: string } | null;
    const sender = r.wallet;
    const counter = meta?.counter;
    const senderUser = usernameMap.get(sender);
    const counterUser = counter ? usernameMap.get(counter) : null;
    const tokenSym = r.tokenSymbol ?? (r.tokenMint === "So11111111111111111111111111111111111111112" ? "COOK" : r.tokenMint ? r.tokenMint.slice(0, 4) : "COOK");
    const rawAmt = r.amount ? Number(r.amount) : 0;
    const divisor = r.tokenMint === "So11111111111111111111111111111111111111112" ? 1e9 : 1;
    const amtNum = rawAmt / divisor;
    const amtStr = amtNum > 0 ? amtNum.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "";

    let title = `${r.type.toUpperCase()}`;
    if (r.type === "transfer" && counter) {
      if (senderUser && counterUser) {
        title = `@${senderUser} sent @${counterUser} ${amtStr} ${tokenSym}`;
      } else if (senderUser) {
        title = `@${senderUser} sent ${short(counter)} ${amtStr} ${tokenSym}`;
      } else if (counterUser) {
        title = `${short(sender)} sent @${counterUser} ${amtStr} ${tokenSym}`;
      } else {
        title = `${short(sender)} sent ${short(counter)} ${amtStr} ${tokenSym}`;
      }
    } else if (senderUser) {
      title = `@${senderUser} ${r.type}`;
    }

    return {
      id: r.id,
      signature: r.signature,
      type: r.type,
      title,
      amount: r.amount ? Number(r.amount) : null,
      valueUsd: r.valueUsd ? Number(r.valueUsd) : null,
      timestamp: r.timestamp.toISOString(),
      slot: r.slot,
      token: r.tokenMint
        ? { mint: r.tokenMint, symbol: r.tokenSymbol, name: r.tokenName }
        : null,
    };
  });

  if (recentActivity.length === 0) {
    const sigs = await getRecentSignatures(wallet, 10).catch(() => []);
    recentActivity.push(
      ...sigs.map((s, idx) => ({
        id: -(idx + 1),
        signature: s.signature,
        type: "transfer" as any,
        title: `Transaction ${s.signature.slice(0, 8)}…`,
        amount: null,
        valueUsd: null,
        timestamp: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : new Date().toISOString(),
        slot: null,
        token: null,
      }))
    );
  }

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
    recentActivity,
  });
}