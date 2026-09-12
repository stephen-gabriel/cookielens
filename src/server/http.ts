import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function readJson(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function str(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status });
}