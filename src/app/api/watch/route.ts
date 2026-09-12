import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getDb } from "@/server/db";
import { watches } from "@/server/db/schema";
import { isValidAddress } from "@/lib/chain";
import { readSession } from "@/server/auth/session";
import { jsonError, readJson, str } from "@/server/http";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const db = getDb();
  const session = readSession(req);
  if (!session) return jsonError("Sign in to watch tokens.", 401);

  const body = await readJson(req);
  const mint = str(body?.mint);
  if (!mint || !isValidAddress(mint)) return jsonError("A valid token mint is required.", 400);

  await db
    .insert(watches)
    .values({ walletAddress: session.wallet, tokenMint: mint })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true, watching: true });
}

export async function DELETE(req: NextRequest) {
  const db = getDb();
  const session = readSession(req);
  if (!session) return jsonError("Sign in to manage watches.", 401);

  const body = await readJson(req);
  const mint = str(body?.mint);
  if (!mint) return jsonError("A valid token mint is required.", 400);

  await db
    .delete(watches)
    .where(and(eq(watches.walletAddress, session.wallet), eq(watches.tokenMint, mint)));

  return NextResponse.json({ ok: true, watching: false });
}