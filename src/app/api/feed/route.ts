import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { readSession } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { follows, socialEvents, tokens, users, activities } from "@/server/db/schema";
import type { FeedEvent } from "@/lib/events";
import { short } from "@/lib/indexer-format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/feed?tab=discover|following — Social Events, newest first. */
export async function GET(req: NextRequest) {
  const tab = req.nextUrl.searchParams.get("tab") ?? "discover";
  const session = readSession(req);
  const viewerWallet = session?.wallet ?? null;

  const db = getDb();
  const limit = 50;

  const selectFields = {
    id: socialEvents.id,
    archetype: socialEvents.archetype,
    wallet: socialEvents.wallet,
    tokenMint: socialEvents.tokenMint,
    payload: socialEvents.payload,
    significance: socialEvents.significance,
    createdAt: socialEvents.createdAt,
    tokenSymbol: tokens.symbol,
    tokenName: tokens.name,
    username: viewerWallet ? users.username : sql<string | null>`NULL`,
  };

  const base = viewerWallet
    ? db
        .select(selectFields)
        .from(socialEvents)
        .leftJoin(tokens, eq(socialEvents.tokenMint, tokens.mint))
        .leftJoin(
          follows,
          and(
            eq(follows.followeeWallet, socialEvents.wallet),
            eq(follows.followerWallet, viewerWallet)
          )
        )
        .leftJoin(users, eq(users.walletAddress, follows.followeeWallet))
        .orderBy(desc(socialEvents.createdAt))
    : db
        .select(selectFields)
        .from(socialEvents)
        .leftJoin(tokens, eq(socialEvents.tokenMint, tokens.mint))
        .orderBy(desc(socialEvents.createdAt));

  try {
    if (tab === "following") {
      if (!session) {
        return NextResponse.json({ ok: false, error: "Sign in to see your Following feed." }, { status: 401 });
      }
      const following = await db
        .select({ followee: follows.followeeWallet })
        .from(follows)
        .where(eq(follows.followerWallet, session.wallet))
        .limit(1000);
      const walletsList = following.map((f) => f.followee);
      if (walletsList.length === 0) {
        return NextResponse.json({ ok: true, events: [] });
      }

      const actRows = await db
        .select({
          id: activities.id,
          signature: activities.signature,
          wallet: activities.wallet,
          tokenMint: activities.tokenMint,
          type: activities.type,
          amount: activities.amount,
          valueUsd: activities.valueUsd,
          timestamp: activities.timestamp,
          slot: activities.slot,
          meta: activities.meta,
          tokenSymbol: tokens.symbol,
          tokenName: tokens.name,
          tokenDecimals: tokens.decimals,
          username: users.username,
        })
        .from(activities)
        .leftJoin(tokens, eq(activities.tokenMint, tokens.mint))
        .leftJoin(users, eq(users.walletAddress, activities.wallet))
        .where(inArray(activities.wallet, walletsList))
        .orderBy(desc(activities.timestamp))
        .limit(limit);

      const allWallets = new Set<string>();
      for (const r of actRows) {
        if (r.wallet) allWallets.add(r.wallet);
        const meta = r.meta as { counter?: string } | null;
        if (meta?.counter) allWallets.add(meta.counter);
      }
      const userRows = await db
        .select({ walletAddress: users.walletAddress, username: users.username })
        .from(users)
        .where(inArray(users.walletAddress, [...allWallets]));
      const usernameMap = new Map<string, string>();
      for (const u of userRows) {
        if (u.username) usernameMap.set(u.walletAddress, u.username);
      }

      const events: FeedEvent[] = actRows.map((r) => {
        const meta = r.meta as { counter?: string } | null;
        const sender = r.wallet;
        const counter = meta?.counter;
        const senderUser = usernameMap.get(sender) ?? r.username;
        const counterUser = counter ? usernameMap.get(counter) : null;
        const tokenSym = r.tokenSymbol ?? (r.tokenMint === "So11111111111111111111111111111111111111112" ? "COOK" : r.tokenMint ? r.tokenMint.slice(0, 4) : "COOK");
        const decimals = r.tokenMint === "So11111111111111111111111111111111111111112" ? 9 : (r.tokenDecimals ?? 9);
        const rawAmt = r.amount ? Number(r.amount) : 0;
        const amtNum = rawAmt / Math.pow(10, decimals);
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
          title = `@${senderUser} performed ${r.type}`;
        } else {
          title = `${short(sender)} performed ${r.type}`;
        }

        return {
          id: r.id,
          archetype: "network_activity" as const,
          wallet: r.wallet,
          username: senderUser ?? null,
          token: r.tokenMint
            ? { mint: r.tokenMint, symbol: tokenSym, name: r.tokenName ?? r.tokenMint }
            : null,
          payload: {
            title,
            amount: amtStr ? `${amtStr} ${tokenSym}` : undefined,
          },
          significance: Number(r.valueUsd ?? 0) || 1,
          createdAt: r.timestamp.toISOString(),
        };
      });

      return NextResponse.json({ ok: true, events });
    }

    const rows = await base.limit(limit);
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
  username: string | null;
  tokenMint: string | null;
  payload: unknown;
  significance: string;
  createdAt: Date;
  tokenSymbol: string | null;
  tokenName: string | null;
};

function mapEvents(rows: Row[]): FeedEvent[] {
  return rows.map((r) => {
    let payload =
      typeof r.payload === "object" && r.payload !== null
        ? (r.payload as FeedEvent["payload"])
        : { title: "Activity on Cookie Chain" };

    if (r.username && r.wallet && payload.title) {
      const shortAddr = short(r.wallet);
      if (payload.title.includes(shortAddr)) {
        payload = {
          ...payload,
          title: payload.title.replaceAll(shortAddr, `@${r.username}`),
        };
      } else if (payload.title.includes(r.wallet)) {
        payload = {
          ...payload,
          title: payload.title.replaceAll(r.wallet, `@${r.username}`),
        };
      }
    }

    return {
      id: r.id,
      archetype: r.archetype as FeedEvent["archetype"],
      wallet: r.wallet ?? null,
      username: r.username ?? null,
      token: r.tokenMint ? { mint: r.tokenMint, symbol: r.tokenSymbol ?? "?", name: r.tokenName ?? r.tokenMint } : null,
      payload,
      significance: Number(r.significance),
      createdAt: r.createdAt.toISOString(),
    };
  });
}