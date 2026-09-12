import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getDb } from "@/server/db";
import { follows, wallets } from "@/server/db/schema";
import { isValidAddress } from "@/lib/chain";
import { readSession } from "@/server/auth/session";
import { jsonError, readJson, str } from "@/server/http";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const db = getDb();
  const session = readSession(req);
  if (!session) return jsonError("Sign in to follow wallets.", 401);

  const body = await readJson(req);
  const followee = str(body?.followeeWallet);
  if (!followee || !isValidAddress(followee)) return jsonError("A valid wallet address is required.", 400);
  if (followee === session.wallet) return jsonError("You cannot follow yourself.", 400);

  // Ensure both wallets exist (followee may be unclaimed — that's fine).
  await db.insert(wallets).values({ address: followee }).onConflictDoNothing();

  await db
    .insert(follows)
    .values({ followerWallet: session.wallet, followeeWallet: followee })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true, following: true });
}

export async function DELETE(req: NextRequest) {
  const db = getDb();
  const session = readSession(req);
  if (!session) return jsonError("Sign in to manage follows.", 401);

  const body = await readJson(req);
  const followee = str(body?.followeeWallet);
  if (!followee || !isValidAddress(followee)) return jsonError("A valid wallet address is required.", 400);

  await db
    .delete(follows)
    .where(and(eq(follows.followerWallet, session.wallet), eq(follows.followeeWallet, followee)));

  return NextResponse.json({ ok: true, following: false });
}