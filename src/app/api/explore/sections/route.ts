import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type MomentumToken = {
  mint: string;
  symbol: string;
  name: string;
  buyers1h: number;
  sellers1h: number;
  holdersPct: number | null;
};

export type LargeMovement = {
  id: number;
  wallet: string | null;
  tokenMint: string | null;
  symbol: string | null;
  title: string;
  amount: string | null;
  significance: number;
};

export type CommunityToken = {
  mint: string;
  symbol: string | null;
  name: string | null;
  wallets: number;
  actions: number;
  verifiedWallets: number;
};

type SectionState = { momentum: MomentumToken[]; largeMovements: LargeMovement[]; community: CommunityToken[] };

let cache: { at: number; state: SectionState } | null = null;
const CACHE_TTL_MS = 60 * 1000;

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json({ ok: true, ...cache.state });
  }

  const db = getDb();

  const momentumRows = (await db.execute(sql`
    select distinct on (ts."mint") ts."mint", ts."sampled_at", ts."buyers_1h", ts."sellers_1h", ts."holder_count",
           t."symbol", t."name", t."holder_count" as "holders_now"
    from token_stats ts
    left join tokens t on t."mint" = ts."mint"
    where ts."sampled_at" > now() - interval '24 hours'
    order by ts."mint", ts."sampled_at" desc
    limit 120`)) as unknown as {
    rows?: { mint: string; buyers_1h: number; sellers_1h: number; holder_count: string; holders_now: string; symbol: string | null; name: string | null }[];
  };

  const momentum: MomentumToken[] = (momentumRows.rows ?? [])
    .map((r) => {
      const holders = Number(r.holder_count);
      const holdersNow = Number(r.holders_now);
      return {
        mint: r.mint,
        symbol: r.symbol ?? r.mint.slice(0, 4),
        name: r.name ?? r.mint,
        buyers1h: Number(r.buyers_1h ?? 0),
        sellers1h: Number(r.sellers_1h ?? 0),
        holdersPct: holdersNow > 0 && holders > 0 ? ((holdersNow - holders) / holders) * 100 : null,
      };
    })
    .filter((t) => t.buyers1h + t.sellers1h > 0)
    .sort((a, b) => b.buyers1h - a.buyers1h)
    .slice(0, 12);

  const movementRows = (await db.execute(sql`
    select e."id", e."wallet", e."token_mint", e."significance", e."created_at",
           e."payload" ->> 'title' as "title", e."payload" ->> 'amount' as "amount",
           t."symbol"
    from social_events e
    left join tokens t on t."mint" = e."token_mint"
    where e."archetype" = 'large_movement'
    order by e."created_at" desc
    limit 12`)) as unknown as {
    rows?: { id: number; wallet: string | null; token_mint: string | null; significance: string; title: string | null; amount: string | null; symbol: string | null }[];
  };

  const largeMovements: LargeMovement[] = (movementRows.rows ?? []).map((r) => ({
    id: r.id,
    wallet: r.wallet,
    tokenMint: r.token_mint,
    symbol: r.symbol,
    title: r.title ?? "",
    amount: r.amount,
    significance: Number(r.significance),
  }));

  const communityRows = (await db.execute(sql`
    select a."token_mint", t."symbol", t."name",
           count(distinct a."wallet")::int as "wallets",
           count(*)::int as "actions",
           count(distinct case when u."wallet_address" is not null then a."wallet" end)::int as "verified"
    from activities a
    left join tokens t on t."mint" = a."token_mint"
    left join users u on u."wallet_address" = a."wallet"
    where a."token_mint" is not null and a."timestamp" > now() - interval '24 hours'
    group by a."token_mint", t."symbol", t."name"
    having count(distinct a."wallet") >= 3
    order by "wallets" desc, "actions" desc
    limit 12`)) as unknown as {
    rows?: { token_mint: string; symbol: string | null; name: string | null; wallets: number; actions: number; verified: number }[];
  };

  const community: CommunityToken[] = (communityRows.rows ?? []).map((r) => ({
    mint: r.token_mint,
    symbol: r.symbol,
    name: r.name,
    wallets: Number(r.wallets),
    actions: Number(r.actions),
    verifiedWallets: Number(r.verified),
  }));

  const state: SectionState = { momentum, largeMovements, community };
  if (state.momentum.length > 0 || state.largeMovements.length > 0 || state.community.length > 0) {
    cache = { at: Date.now(), state };
  }
  return NextResponse.json({ ok: true, ...state });
}