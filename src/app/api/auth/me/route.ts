import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { clearSessionCookie, readSession, type Session } from "@/server/auth/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const db = getDb();
  const session = readSession(req);
  if (!session) {
    return NextResponse.json({ ok: true, me: null });
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) {
    const res = NextResponse.json({ ok: true, me: null });
    clearSessionCookie(res);
    return res;
  }

  const me: Session = { ...session, username: user.username };
  return NextResponse.json({ ok: true, me });
}