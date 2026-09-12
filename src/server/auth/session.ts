import { createHmac, timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const SESSION_COOKIE = "cookielens_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type Session = {
  wallet: string;
  userId: string;
  username: string;
  exp: number;
};

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret === "change-me-to-a-long-random-string") {
    throw new Error("SESSION_SECRET is not configured. Set it in .env.local before running the server.");
  }
  return secret;
}

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

export function createSession({ wallet, userId, username }: Omit<Session, "exp">): string {
  const payload = { wallet, userId, username, exp: Date.now() + SESSION_TTL_MS };
  const body = base64url(Buffer.from(JSON.stringify(payload)));
  const sig = createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token: string): Session | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", getSecret()).update(body).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (provided.length !== expected.length || !timingSafeEqual(expected, provided)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString()) as Session;
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
    if (!parsed.wallet || !parsed.userId || !parsed.username) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readSession(req: NextRequest): Session | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export function setSessionCookie(res: NextResponse, session: Session): void {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: createSession(session),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}