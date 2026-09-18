/* eslint-disable @typescript-eslint/no-explicit-any, prefer-const */
import { neon } from "@neondatabase/serverless";

import { fmtAmount, short } from "@/lib/indexer-format";
import { communitySignificance, pumpSignificance, shouldEmitConvergence } from "@/lib/significance";

const COOK_DECIMALS = 9;
const COOK_PRICE_USD = 0.00008877;
const SYS_PROGRAM_ID = "11111111111111111111111111111111";
const VOTE_PROGRAM_ID = "Vote111111111111111111111111111111111111111";

export type Engine = ReturnType<typeof createIndexer>;

export function createIndexer(env: NodeJS.ProcessEnv) {
  const RPC_URL = env.RPC_URL || "https://rpc.cookiescan.io";
  const COOK_MINT = env.COOK_MINT || "36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1";
  const TOKEN_PROGRAM_ID =
    env.SPL_TOKEN_PROGRAM_ID || "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

  const CONSENSUS_PROGRAMS = new Set([
    VOTE_PROGRAM_ID,
    "ComputeBudget111111111111111111111111111111",
    "AxKTyYasazUhkBHsi9HceQ8YEhTbkeohZ9aUH51QyXiy", // block-mine hash sampler
    "57rnijHYbPEGX75L4pQvNB9Drt4WWtyL4DvQVeB1iV1H",
    "HN7egj4JfDGSjHkumZ2ZugJu7kAShny5A62Tr3tYSS3N",
  ]);

  const CONCURRENCY = Math.max(1, Math.min(8, Number(env.INDEXER_CONCURRENCY) || 4));
  const BATCH = Math.max(10, Math.min(1000, Number(env.INDEXER_BATCH) || 300));
  const LARGE_USD = Number(env.INDEXER_LARGE_USD) || 100;
  const COOK_LARGE_COOKS = Number(env.INDEXER_LARGE_COOKS) || 1_000_000;

  const sql = neon(env.DATABASE_URL ?? "");

  // ---- RPC --------------------------------------------------------------------
  let rpcSeq = 0;
  async function rpc(method: string, params: unknown[], attempts = 3) {
    for (let a = 0; a < attempts; a++) {
      try {
        const res = await fetch(RPC_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcSeq, method, params }),
        });
        const json = await res.json();
        if (json.error) throw new Error(`${method}: ${JSON.stringify(json.error).slice(0, 200)}`);
        return json.result;
      } catch (err) {
        if (a === attempts - 1) throw err;
        await new Promise((r) => setTimeout(r, 800 * (a + 1)));
      }
    }
  }

  // ---- DB ---------------------------------------------------------------------
  async function getState(key: string, fallback: string | null = null) {
    const rows = (await sql`select value from indexer_state where key = ${key}`) as { value: string }[];
    return rows.length ? rows[0].value : fallback;
  }
  async function setState(key: string, value: string) {
    await sql`
      insert into indexer_state (key, value, updated_at) values (${key}, ${value}, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()`;
  }

  async function upsertWallet(address: string | null, lastActivityAt: unknown, tokenMints: Set<string>) {
    if (!address) return;
    const ts =
      typeof lastActivityAt === "number"
        ? new Date(lastActivityAt * 1000).toISOString()
        : lastActivityAt ?? new Date().toISOString();
    await sql`
      insert into wallets (address, first_observed_at, last_activity_at, tx_count, token_interactions)
      values (${address}, now(), ${ts}, 1, ${tokenMints ? tokenMints.size : 0})
      on conflict (address) do update set
        last_activity_at = greatest(wallets.last_activity_at, excluded.last_activity_at),
        tx_count = wallets.tx_count + 1,
        token_interactions = wallets.token_interactions + excluded.token_interactions`;
  }

  async function upsertTokenFromAsset(mint: string) {
    if (mint === COOK_MINT) {
      await sql`
        insert into tokens (mint, symbol, name, decimals)
        values (${mint}, 'COOK', 'COOK', ${COOK_DECIMALS})
        on conflict (mint) do nothing`;
      return;
    }
    try {
      const res = await fetch("https://api.cookiescan.io", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "das", method: "getAsset", params: { id: mint } }),
      });
      const j = await res.json();
      const a = j?.result;
      if (!a) return;
      const metadata = a.content?.metadata ?? {};
      const info = a.token_info ?? {};
      await sql`
        insert into tokens (mint, symbol, name, decimals, price_usd, market_cap, holder_count, volume_24h, updated_at)
        values (${mint}, ${metadata.symbol ?? null}, ${metadata.name ?? null},
                ${a.token_info?.decimals ?? info.decimals ?? 0},
                ${a.token_info?.price_info?.price_per_token ?? null},
                ${a.market_cap ?? null},
                ${a.holder_count ?? 0},
                ${a.volume_24h ?? null}, now())
        on conflict (mint) do update set
          symbol = coalesce(excluded.symbol, tokens.symbol),
          name = coalesce(excluded.name, tokens.name),
          price_usd = coalesce(excluded.price_usd, tokens.price_usd),
          market_cap = coalesce(excluded.market_cap, tokens.market_cap),
          holder_count = excluded.holder_count,
          volume_24h = coalesce(excluded.volume_24h, tokens.volume_24h),
          updated_at = now()`;
    } catch {
      /* asset metadata optional */
    }
  }

  // ---- Transaction parsing ----------------------------------------------------
  function tokenAccountMintMap(meta: any, accountKeys: string[]) {
    const map = new Map<string, string>();
    for (const list of [meta?.preTokenBalances ?? [], meta?.postTokenBalances ?? []]) {
      for (const b of list) {
        const key = accountKeys[b.accountIndex];
        if (key && b.mint) map.set(key, b.mint);
      }
    }
    return map;
  }

  function tokenMintOfAccount(account: string, meta: any, accountKeys: string[]) {
    return tokenAccountMintMap(meta, accountKeys).get(account) ?? null;
  }

  function parseParsedInstr(instr: any, accountKeys: string[], meta: any) {
    const parsed = instr.parsed;
    if (!parsed?.type || !parsed.info) return [];
    const pid = instr.programId;
    if (pid === SYS_PROGRAM_ID && parsed.type === "transfer") {
      const lamports = Number(parsed.info.lamports ?? 0) || 0;
      if (lamports <= 0) return [];
      return [
        {
          type: "transfer",
          tokenMint: COOK_MINT,
          amount: String(lamports),
          wallet: parsed.info.source,
          counter: parsed.info.destination,
          usd: (lamports / 10 ** COOK_DECIMALS) * COOK_PRICE_USD,
        },
      ];
    }
    if (pid === TOKEN_PROGRAM_ID) {
      const info = parsed.info;
      const type = parsed.type;
      if (type === "transfer" || type === "transferChecked") {
        const mint = info.mint ?? tokenMintOfAccount(info.source, meta, accountKeys);
        if (!mint) return [];
        const amountRaw = info.tokenAmount?.amount ?? info.amount ?? "0";
        const amount = Number(amountRaw) || 0;
        if (amount <= 0) return [];
        return [
          {
            type: "transfer",
            tokenMint: mint,
            amount: amountRaw,
            wallet: info.authority ?? info.source,
            counter: info.destination,
            usd: null,
          },
        ];
      }
      if (type === "mintTo") {
        const amount = Number(info.amount ?? "0") || 0;
        if (amount <= 0) return [];
        return [
          {
            type: "transfer",
            tokenMint: info.mint,
            amount: info.amount,
            wallet: info.mintAuthority ?? info.account,
            counter: info.account,
            usd: null,
          },
        ];
      }
    }
    return [];
  }

  function parseTransaction(entry: any, blockTime: number, slot: number) {
    const meta = entry.meta ?? {};
    const tx = entry.transaction ?? {};
    if (meta.err) return null;
    const sig = tx.signatures?.[0];
    if (!sig) return null;
    const accountKeys = (tx.message?.accountKeys ?? []).map((k: any) =>
      typeof k === "string" ? k : k.pubkey,
    );
    const outer = tx.message?.instructions ?? [];
    const inner = (meta.innerInstructions ?? []).flatMap((p: any) => p.instructions ?? []);
    const allInstr = [...outer, ...inner];
    if (allInstr.every((i) => CONSENSUS_PROGRAMS.has(i.programId))) return null;

    const acts = [];
    for (const instr of allInstr) {
      for (const a of parseParsedInstr(instr, accountKeys, meta)) {
        a.usd = a.usd ?? null;
        acts.push(a);
      }
    }
    if (acts.length === 0) return null;

    const tokens = new Set(acts.map((a: any) => a.tokenMint));
    if (tokens.size > 1) {
      for (const a of acts) a.type = "swap";
    }

    acts.sort((x: any, y: any) => (y.usd ?? 0) - (x.usd ?? 0) || Number(y.amount ?? 0) - Number(x.amount ?? 0));
    const dominant = acts[0];

    const programIds = new Set(allInstr.map((i) => i.programId));
    const feePayer = accountKeys[0] ?? null;
    return { sig, slot, blockTime, feePayer, act: dominant, tokens, programIds };
  }

  // ---- Significance engine -----------------------------------------------------
  async function getUsername(wallet: string) {
    const rows = (await sql`select username from users where wallet_address = ${wallet} limit 1`) as { username: string | null }[];
    return rows[0]?.username ?? null;
  }
  async function tokenSymbol(mint: string) {
    const rows = (await sql`select symbol from tokens where mint = ${mint}`) as {
      symbol: string | null;
    }[];
    return rows[0]?.symbol ?? (mint === COOK_MINT ? "COOK" : mint.slice(0, 4));
  }
  async function hasPriorActivity(wallet: string, mint: string, excludeSignature: string) {
    const rows = (await sql`
      select 1 as hit from activities where wallet = ${wallet}
        and token_mint = ${mint} and signature <> ${excludeSignature} limit 1`) as { hit: number }[];
    return rows.length > 0;
  }
  async function verifiedWalletCount(addresses: string[]) {
    if (addresses.length === 0) return 0;
    const rows = (await sql`
      select count(distinct wallet_address)::int as n from users
      where wallet_address = any(${addresses})`) as { n: number }[];
    return Number(rows[0]?.n ?? 0);
  }

  async function runSignificance(cycleActs: Activity[]) {
    const events: SocialEvent[] = [];
    for (const act of cycleActs) {
      if (act.type !== "transfer") continue;
      const prior = await hasPriorActivity(act.wallet, act.tokenMint, act.sig);
      if (prior) continue;
      const senderUser = await getUsername(act.wallet);
      const counterUser = act.counter ? await getUsername(act.counter) : null;
      const sym = await tokenSymbol(act.tokenMint);
      const amt = fmtAmount(act.amount);

      let title = `${short(act.wallet)} entered ${sym}`;
      if (act.counter) {
        if (senderUser && counterUser) {
          title = `@${senderUser} sent @${counterUser} ${amt} ${sym}`;
        } else if (senderUser) {
          title = `@${senderUser} sent ${short(act.counter)} ${amt} ${sym}`;
        } else if (counterUser) {
          title = `${short(act.wallet)} sent @${counterUser} ${amt} ${sym}`;
        }
      }

      events.push({
        archetype: "significant_entry",
        wallet: act.wallet,
        tokenMint: act.tokenMint,
        significance: 100 + (Number(act.usd) || 0) / 10,
        payload: { title },
        sourceActivityId: act.id,
      });
    }

    for (const act of cycleActs) {
      const usd = Number(act.usd) || 0;
      const cooks = act.tokenMint === COOK_MINT ? Number(act.amount ?? 0) / 10 ** COOK_DECIMALS : 0;
      const isLargeCook = cooks >= COOK_LARGE_COOKS;
      if (!isLargeCook && usd < LARGE_USD) continue;
      if (act.type === "swap" && usd < LARGE_USD * 10 && !isLargeCook) continue;
      const senderUser = await getUsername(act.wallet);
      const counterUser = act.counter ? await getUsername(act.counter) : null;
      const sym = await tokenSymbol(act.tokenMint);
      const amt = fmtAmount(act.amount);

      let title = `${short(act.wallet)} moved ${amt} ${sym}`;
      if (act.type === "transfer" && act.counter) {
        if (senderUser && counterUser) {
          title = `@${senderUser} sent @${counterUser} ${amt} ${sym}`;
        } else if (senderUser) {
          title = `@${senderUser} sent ${short(act.counter)} ${amt} ${sym}`;
        } else if (counterUser) {
          title = `${short(act.wallet)} sent @${counterUser} ${amt} ${sym}`;
        }
      }

      events.push({
        archetype: "large_movement",
        wallet: act.wallet,
        tokenMint: act.tokenMint,
        significance: Math.max(usd, cooks),
        payload: {
          title,
          amount: `${amt} ${sym}`,
        },
        sourceActivityId: act.id,
      });
    }

    // community_convergence — several distinct wallets interacted with the
    // same token within this cycle. Deterministic: count of distinct wallets.
    const byMint = new Map<string, Set<string>>();
    for (const act of cycleActs) {
      const set = byMint.get(act.tokenMint);
      if (set) set.add(act.wallet);
      else byMint.set(act.tokenMint, new Set([act.wallet]));
    }
    for (const [mint, wallets] of byMint) {
      if (!shouldEmitConvergence(wallets.size)) continue;
      const verified = await verifiedWalletCount([...wallets].slice(0, 50));
      events.push({
        archetype: "community_convergence",
        wallet: null,
        tokenMint: mint,
        significance: communitySignificance(wallets.size, verified),
        payload: {
          title: `${await tokenSymbol(mint)} is attracting wallets`,
          metrics: { buyers: wallets.size, verified: verified },
          social: { wallets: wallets.size, buyers: wallets.size, verifiedWallets: verified, followedWallets: 0 },
        },
        sourceActivityId: null,
      });
    };

    return events;
  }

  // ---- Cycles -----------------------------------------------------------------
  async function processSlot(slot: number) {
    const block = await rpc("getBlock", [
      slot,
      { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, transactionDetails: "full" },
    ]);
    if (!block) return [];
    const blockTime = block.blockTime ?? Math.floor(Date.now() / 1000);
    const cycleActs: Activity[] = [];
    for (const entry of block.transactions ?? []) {
      const parsed = parseTransaction(entry, blockTime, slot);
      if (!parsed) continue;
      const act = parsed.act;

      await upsertWallet(parsed.feePayer, blockTime, parsed.tokens);
      await upsertWallet(act.wallet, blockTime, parsed.tokens);
      await upsertWallet(act.counter, blockTime, parsed.tokens);
      await upsertTokenFromAsset(act.tokenMint);

      const inserted = (await sql`
        insert into activities (signature, wallet, token_mint, type, amount, value_usd, timestamp, slot, meta)
        values (${parsed.sig}, ${act.wallet}, ${act.tokenMint}, ${act.type},
                ${act.amount}, ${act.usd}, ${new Date(blockTime * 1000).toISOString()},
                ${slot}, ${JSON.stringify({ counter: act.counter, tokens: [...parsed.tokens], programIds: [...parsed.programIds] })})
        on conflict (signature) do nothing returning id, signature, type, amount, value_usd, wallet, token_mint`) as {
        id: number;
        signature: string;
        type: string;
        amount: string | null;
        value_usd: string | null;
        wallet: string;
        token_mint: string;
      }[];

      for (const row of inserted) {
        cycleActs.push({
          id: row.id,
          sig: row.signature,
          wallet: row.wallet,
          tokenMint: row.token_mint,
          type: row.type,
          amount: row.amount,
          usd: Number(row.value_usd) || 0,
          counter: act.counter,
        });
      }
    }
    return cycleActs;
  }

  async function runCycle() {
    let startSlot = Number((await getState("start_slot", "0")) ?? "0");
    const head = await rpc("getSlot", []);

    if (startSlot <= 0) {
      startSlot = head - 1;
      console.log(`[indexer] starting at slot ${startSlot} (head ${head})`);
    }

    let end = Math.min(head, startSlot + BATCH);
    if (end <= startSlot) return { done: 0, actions: 0, events: 0 };

    const slots = (await rpc("getBlocks", [startSlot + 1, end])) ?? [];

    let queue = [...slots];
    let next = 0;
    const allCycleActs: Activity[] = [];
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (next < queue.length) {
        const s = queue[next++];
        try {
          const acts = await processSlot(s);
          allCycleActs.push(...acts);
        } catch (err) {
          console.warn(`[indexer] slot ${s} failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    });
    await Promise.all(workers);

    const eventsWritten = await writeEvents(allCycleActs);
    await setState("start_slot", String(end));
    await setState("last_run", new Date().toISOString());
    await setState("last_head", String(head));
    return { done: slots.length, actions: allCycleActs.length, events: eventsWritten };
  }

  async function writeEvents(cycleActs: Activity[]) {
    const events: SocialEvent[] = [...(await runSignificance(cycleActs))];

    const touched = [...new Set(cycleActs.map((a) => a.tokenMint))];
    for (const mint of touched.slice(0, 30)) {
      const hour = new Date(Date.now());
      hour.setUTCMinutes(0, 0, 0);
      const sampleAt = hour.toISOString();
      const [t] = (await sql`select holder_count, symbol from tokens where mint = ${mint}`) as {
        holder_count: number | string | null;
        symbol: string | null;
      }[];
      if (!t) continue;
      const holders = Number(t.holder_count ?? 0);
      const buyers = await countDistinct(mint, "transfer");
      const sellers = await countDistinct(mint, "swap");
      await sql`
        insert into token_stats (mint, sampled_at, holder_count, volume_24h, buyers_1h, sellers_1h)
        values (${mint}, ${sampleAt}, ${holders}, null, ${buyers}, ${sellers})
        on conflict (mint, sampled_at) do nothing`;

      const [prev] = (await sql`
        select holder_count from token_stats
        where mint = ${mint} and sampled_at < ${sampleAt}
        order by sampled_at desc limit 1`) as { holder_count: number | string | null }[];
      const prevHolders = prev ? Number(prev.holder_count) : null;
      const sym = t.symbol ?? mint.slice(0, 4);
      if (prevHolders !== null && prevHolders > 0 && holders > prevHolders) {
        const pct = ((holders - prevHolders) / prevHolders) * 100;
        if (pct >= 1) {
          events.push({
            archetype: "token_momentum",
            wallet: null,
            tokenMint: mint,
            significance: pct,
            payload: { title: `${sym} holder growth +${pct.toFixed(0)}% this hour`, metrics: { holdersPct: pct } },
            sourceActivityId: null,
          });
        }
        if (holders >= 2 && holders <= 300) {
          events.push({
            archetype: "early_discovery",
            wallet: null,
            tokenMint: mint,
            significance: 60 + pumpSignificance(holders, pct),
            payload: { title: `${sym} is picking up holders (${holders})` },
            sourceActivityId: null,
          });
        }
      }
    }

    // Network digest — keeps the feed alive on quiet chains.
    if (cycleActs.length >= 5) {
      events.push({
        archetype: "network_activity",
        wallet: null,
        tokenMint: null,
        significance: 10 + cycleActs.length,
        payload: { title: `${cycleActs.length} on-chain actions this cycle` },
        sourceActivityId: null,
      });
    }

    let written = 0;
    events.sort((a, b) => b.significance - a.significance);
    for (const ev of events.slice(0, 12)) {
      await sql`
        insert into social_events (archetype, wallet, token_mint, source_activity_ids, significance, payload)
        values (${ev.archetype}, ${ev.wallet}, ${ev.tokenMint},
                ${ev.sourceActivityId ? [ev.sourceActivityId] : []}, ${ev.significance.toFixed(4)}, ${JSON.stringify(ev.payload)}::jsonb)
        on conflict do nothing`;
      if (ev.sourceActivityId) {
        await sql`update activities set event_created = true where id = ${ev.sourceActivityId}`;
      }
      written++;
    }
    return written;
  }

  async function countDistinct(mint: string, type: string) {
    const [r] = (await sql`
      select count(distinct wallet)::int as n from activities
      where token_mint = ${mint} and type = ${type} and timestamp > now() - interval '1 hour'`) as {
      n: number;
    }[];
    return r?.n ?? 0;
  }

  return { rpc, getState, setState, processSlot, writeEvents, runCycle, runBoundedCycle };
}

/** One catch-up cycle bounded for serverless execution. */
async function runBoundedCycle(this: Engine, { maxSlots = 200, maxMs = 9000 } = {}) {
  const started = Date.now();
  let startSlot = Number((await this.getState("start_slot", "0")) ?? "0");
  const head = await this.rpc("getSlot", []);
  if (startSlot <= 0) startSlot = head - 1;
  const end = Math.min(head, startSlot + Math.min(300, maxSlots));
  if (end <= startSlot) {
    await this.setState("last_head", String(head));
    return { done: 0, actions: 0, events: 0, head, cancelled: false };
  }

  const slots = (await this.rpc("getBlocks", [startSlot + 1, end])) ?? [];
  let queue = [...slots];
  let next = 0;
  let completed = 0;
  let cancelled = false;
  const allCycleActs: Activity[] = [];
  const workers = Array.from({ length: 4 }, async () => {
    while (next < queue.length) {
      if (Date.now() - started > maxMs) {
        cancelled = true;
        next = queue.length;
        break;
      }
      const s = queue[next++];
      try {
        const acts = await this.processSlot(s);
        allCycleActs.push(...acts);
        completed++;
      } catch (err) {
        console.warn(`[indexer] slot ${s} failed: ${err instanceof Error ? err.message : String(err)}`);
        completed++;
      }
    }
  });
  await Promise.all(workers);

  const events = await this.writeEvents(allCycleActs);
  const advancedTo = startSlot + (cancelled ? completed : slots.length);
  await this.setState("start_slot", String(advancedTo));
  await this.setState("last_run", new Date().toISOString());
  await this.setState("last_head", String(head));
  return { done: completed, actions: allCycleActs.length, events, head, cancelled };
}

type Activity = {
  id: number;
  sig: string;
  wallet: string;
  tokenMint: string;
  type: string;
  amount: string | null;
  usd: number;
  counter?: string | null;
};

type SocialEvent = {
  archetype: string;
  wallet: string | null;
  tokenMint: string | null;
  significance: number;
  payload: Record<string, unknown>;
  sourceActivityId: number | null;
};