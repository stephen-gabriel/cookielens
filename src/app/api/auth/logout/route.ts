import { NextResponse } from "next/server";

import { clearSessionCookie } from "@/server/auth/session";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}