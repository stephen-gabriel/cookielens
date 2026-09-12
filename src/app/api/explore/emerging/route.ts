import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { searchFungibleAssets } from "@/lib/das";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type EmergingToken = {
  mint: string;
  symbol: string;
  name: string;
  image: string | null;
  holders: number;
  priceUsd: number | null;
  marketCapUsd: number | null;
};

let cache: { at: number; tokens: EmergingToken[] } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 16));

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json({ ok: true, tokens: cache.tokens.slice(0, limit) });
  }

  const assets = await searchFungibleAssets(undefined, 500);
  const tokens = assets
    .filter((a) => (a.holder_count ?? 0) > 0 && a.content.metadata.symbol !== "COOK")
    .sort((a, b) => (b.holder_count ?? 0) - (a.holder_count ?? 0))
    .slice(0, limit)
    .map((a) => ({
      mint: a.id,
      symbol: a.content.metadata.symbol ?? "?",
      name: a.content.metadata.name ?? a.id,
      image: a.content.links?.image ?? a.content.files?.[0]?.uri ?? null,
      holders: a.holder_count ?? 0,
      priceUsd: a.token_info?.price_info?.price_per_token ?? null,
      marketCapUsd: a.market_cap ?? null,
    }));

  // Only cache non-empty results; empty should retry on the next request.
  if (tokens.length > 0) {
    cache = { at: Date.now(), tokens };
  }

  return NextResponse.json({ ok: true, tokens });
}