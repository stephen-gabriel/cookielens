import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { isValidAddress } from "@/lib/chain";
import { setSessionCookie, type Session } from "@/server/auth/session";
import { jsonError, readJson, str } from "@/server/http";

export const runtime = "nodejs";

/**
 * Re-establishes a session for a previously claimed wallet without requiring a
 * new signature. The username is permanently bound to the address in `users`,
 * and only the holder of that wallet can present its address, so logging back
 * in after a sign-out is treated like any other login.
 */
export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await readJson(req);
  const wallet = str(body?.wallet);

  if (!wallet || !isValidAddress(wallet)) {
    return jsonError("A valid wallet address is required.", 400);
  }

  const [user] = await db.select().from(users).where(eq(users.walletAddress, wallet)).limit(1);
  if (!user) {
    return NextResponse.json({ ok: true, me: null });
  }

  const session: Session = { wallet, userId: user.id, username: user.username, exp: 0 };
  const res = NextResponse.json({ ok: true, me: session });
  setSessionCookie(res, session);
  return res;
}