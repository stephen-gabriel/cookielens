import { count, desc, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getDb } from "@/server/db";
import { activities, follows, tokens, users, wallets } from "@/server/db/schema";
import { isValidAddress, getRecentSignatures } from "@/lib/chain";
import { readSession } from "@/server/auth/session";
import { jsonError } from "@/server/http";
import { short } from "@/lib/indexer-format";
import { truncateAddress } from "@/lib/format";

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
      tokenDecimals: tokens.decimals,
      meta: activities.meta,
    })
    .from(activities)
    .leftJoin(tokens, eq(activities.tokenMint, tokens.mint))
    .where(sql`${activities.wallet} = ${wallet} OR ${activities.meta}->>'counter' = ${wallet} OR ${activities.meta}->>'owner' = ${wallet}`)
    .orderBy(desc(activities.timestamp))
    .limit(10);

  const walletAddresses = new Set<string>([wallet]);
  for (const r of recent) {
    if (r.wallet) walletAddresses.add(r.wallet);
    const meta = r.meta as { counter?: string; owner?: string } | null;
    if (meta?.counter) walletAddresses.add(meta.counter);
    if (meta?.owner) walletAddresses.add(meta.owner);
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
    const meta = r.meta as { counter?: string; owner?: string } | null;
    const sender = meta?.owner ?? r.wallet;
    const counter = meta?.counter;
    const senderUser = usernameMap.get(sender);
    const counterUser = counter ? usernameMap.get(counter) : null;
    const tokenSym = r.tokenSymbol ?? (r.tokenMint === "So11111111111111111111111111111111111111112" ? "COOK" : r.tokenMint ? r.tokenMint.slice(0, 4) : "COOK");
    const decimals = r.tokenMint === "So11111111111111111111111111111111111111112" ? 9 : (r.tokenDecimals ?? 9);
    const rawAmt = r.amount ? Number(r.amount) : 0;
    const amtNum = rawAmt / Math.pow(10, decimals);
    const amtStr = amtNum > 0 ? amtNum.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "";

    let title = `${r.type.toUpperCase()}`;
    try {
      if (r.type === "transfer") {
        const dest = counter ? (counterUser ? `@${counterUser}` : truncateAddress(counter, 4)) : null;
        const src = senderUser ? `@${senderUser}` : truncateAddress(sender, 4);
        if (sender === wallet) {
          title = dest ? `Sent ${amtStr ? amtStr + " " : ""}${tokenSym} -> ${dest}` : `Sent ${amtStr ? amtStr + " " : ""}${tokenSym}`;
        } else if (counter === wallet) {
          title = `Received ${amtStr ? amtStr + " " : ""}${tokenSym} from ${src}`;
        } else {
          title = dest ? `Transfer ${amtStr ? amtStr + " " : ""}${tokenSym} -> ${dest}` : `Transfer ${amtStr ? amtStr + " " : ""}${tokenSym}`;
        }
      } else if (r.type === "swap") {
        title = `Swapped ${amtStr ? amtStr + " " : ""}${tokenSym}`;
      } else if (r.type === "buy") {
        title = `Bought ${amtStr ? amtStr + " " : ""}${tokenSym}`;
      } else if (r.type === "sell") {
        title = `Sold ${amtStr ? amtStr + " " : ""}${tokenSym}`;
      } else if (r.type === "liquidity_add") {
        title = `Added liquidity ${tokenSym}`;
      } else if (r.type === "liquidity_remove") {
        title = `Removed liquidity ${tokenSym}`;
      } else if (r.type === "token_create") {
        title = `Created token ${tokenSym}`;
      } else {
        title = `${r.type.toUpperCase()} ${amtStr ? amtStr + " " : ""}${tokenSym}`.trim();
      }
    } catch {
      title = `Transaction ${r.signature.slice(0, 8)}…`;
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