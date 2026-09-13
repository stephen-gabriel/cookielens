import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getDb } from "@/server/db";
import { claimChallenges, users } from "@/server/db/schema";
import { isValidAddress } from "@/lib/chain";
import { challengeMessage, isValidUsername, verifySignedMessage } from "@/server/auth/message";
import { setSessionCookie } from "@/server/auth/session";
import { jsonError, readJson, str } from "@/server/http";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await readJson(req);
  const wallet = str(body?.wallet);
  const nonce = str(body?.nonce);
  const signature = str(body?.signature);
  const username = str(body?.username);
  const signedMessage = str(body?.signedMessage);

  if (!wallet || !isValidAddress(wallet)) return jsonError("A valid wallet address is required.", 400);
  if (!nonce) return jsonError("Nonce is required.", 400);
  if (!signature) return jsonError("Signature is required.", 400);
  if (!username || !isValidUsername(username)) return jsonError("Username must be 3-24 characters: letters, numbers, underscores.", 400);

  const [challenge] = await db
    .select()
    .from(claimChallenges)
    .where(and(eq(claimChallenges.wallet, wallet), eq(claimChallenges.nonce, nonce)))
    .limit(1);

  if (!challenge || challenge.consumed) {
    // A retried claim after a prior partial success must not look like a
    // forgery — re-issue the pre-signed proof isn't possible, so tell the
    // client to start the flow over.
    return jsonError("Challenge already consumed. Refresh and try again.", 409);
  }
  if (challenge.expiresAt < new Date()) return jsonError("Challenge expired. Request a new one.", 401);

  const message = challengeMessage(wallet, nonce);
  if (!verifySignedMessage(message, wallet, signature, signedMessage)) {
    return jsonError("Signature verification failed.", 401);
  }

  // neon-http has no .transaction(); run the steps sequentially. The
  // challenge is consumed as its own statement and signer identity is
  // already proven by the verified signature.
  await db
    .update(claimChallenges)
    .set({ consumed: true })
    .where(and(eq(claimChallenges.wallet, wallet), eq(claimChallenges.nonce, nonce)));

  const [existing] = await db.select().from(users).where(eq(users.walletAddress, wallet)).limit(1);
  let user;
  if (existing) {
    if (existing.username !== username) {
      await db.update(users).set({ username }).where(eq(users.id, existing.id));
    }
    user = { ...existing, username };
  } else {
    const [created] = await db
      .insert(users)
      .values({ walletAddress: wallet, username })
      .onConflictDoNothing()
      .returning();
    if (!created) {
      // Username taken by another wallet.
      return jsonError("Username is already taken.", 409);
    }
    user = created;
  }

  const res = NextResponse.json({
    ok: true,
    profile: {
      wallet,
      username: user.username,
      userId: user.id,
      verified: true,
    },
  });
  setSessionCookie(res, {
    wallet,
    userId: user.id,
    username: user.username,
    exp: 0,
  });
  return res;
}