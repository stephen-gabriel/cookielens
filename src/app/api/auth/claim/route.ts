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

  if (!wallet || !isValidAddress(wallet)) return jsonError("A valid wallet address is required.", 400);
  if (!nonce) return jsonError("Nonce is required.", 400);
  if (!signature) return jsonError("Signature is required.", 400);
  if (!username || !isValidUsername(username)) return jsonError("Username must be 3-24 characters: letters, numbers, underscores.", 400);

  const [challenge] = await db
    .select()
    .from(claimChallenges)
    .where(and(eq(claimChallenges.wallet, wallet), eq(claimChallenges.nonce, nonce)))
    .limit(1);

  if (!challenge || challenge.consumed) return jsonError("Challenge not found or already used.", 401);
  if (challenge.expiresAt < new Date()) return jsonError("Challenge expired. Request a new one.", 401);

  const message = challengeMessage(wallet, nonce);
  if (!verifySignedMessage(message, wallet, signature)) {
    return jsonError("Signature verification failed.", 401);
  }

  const result = await db.transaction(async (tx) => {
    await tx.update(claimChallenges).set({ consumed: true }).where(eq(claimChallenges.id, challenge.id));

    const [existing] = await tx.select().from(users).where(eq(users.walletAddress, wallet)).limit(1);
    let user;
    if (existing) {
      if (existing.username !== username) {
        await tx.update(users).set({ username }).where(eq(users.id, existing.id));
      }
      user = { ...existing, username };
    } else {
      const [created] = await tx
        .insert(users)
        .values({ walletAddress: wallet, username })
        .onConflictDoNothing()
        .returning();
      if (!created) {
        // Username taken by another wallet.
        return { conflict: true } as const;
      }
      user = created;
    }
    return { user } as const;
  });

  if ("conflict" in result) return jsonError("Username is already taken.", 409);

  const res = NextResponse.json({
    ok: true,
    profile: {
      wallet,
      username: result.user.username,
      userId: result.user.id,
      verified: true,
    },
  });
  setSessionCookie(res, {
    wallet,
    userId: result.user.id,
    username: result.user.username,
    exp: 0,
  });
  return res;
}