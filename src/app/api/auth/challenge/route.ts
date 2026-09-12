import { and, eq, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getDb } from "@/server/db";
import { claimChallenges, wallets } from "@/server/db/schema";
import { isValidAddress } from "@/lib/chain";
import { challengeMessage, deriveNonce } from "@/server/auth/message";
import { jsonError, readJson, str } from "@/server/http";

export const runtime = "nodejs";
const CHALLENGE_TTL_MS = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await readJson(req);
  const wallet = str(body?.wallet);
  if (!wallet || !isValidAddress(wallet)) {
    return jsonError("A valid Cookie Chain wallet address is required.", 400);
  }

  await db.insert(wallets).values({ address: wallet }).onConflictDoNothing();

  const nonce = deriveNonce();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

  await db.insert(claimChallenges).values({ wallet, nonce, expiresAt });

  // Best-effort cleanup of expired challenges for this wallet.
  await db.delete(claimChallenges).where(
    and(eq(claimChallenges.wallet, wallet), lt(claimChallenges.expiresAt, new Date())),
  );

  return NextResponse.json({
    ok: true,
    nonce,
    expiresAt: expiresAt.toISOString(),
    message: challengeMessage(wallet, nonce),
  });
}