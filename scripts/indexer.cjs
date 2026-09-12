/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * CookieLens indexer — standalone worker.
 *
 * Walks recent Cookie Chain blocks, normalizes transactions into
 * `activities`, keeps `wallets`/`tokens` fresh, samples `token_stats`,
 * and runs a deterministic significance engine that writes `social_events`
 * (which the feed API serves). Safe to re-run: every write is
 * idempotent (signature PRIMARY KEY / ON CONFLICT DO NOTHING).
 *
 * Usage:
 *   npm run indexer           # live tail — repeats catches up from last slot
 *   npm run indexer -- --once # single catch-up cycle then exit
 *   npm run indexer -- --backfill <hours>  # walk back N hours on first run
 *
 * Env: RPC_URL, DATABASE_URL, INDEXER_CONCURRENCY, INDEXER_BATCH,
 *      INDEXER_BACKFILL_HOURS (optional overrides).
 */

const path = require("path");
require("process").loadEnvFile(path.join(__dirname, "..", ".env.local"));
const { neon } = require("@neondatabase/serverless");

// ---- Config -----------------------------------------------------------------
const RPC_URL = process.env.RPC_URL || "https://rpc.cookiescan.io";
const COOK_MINT = process.env.COOK_MINT || "36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1";
const TOKEN_PROGRAM_ID = process.env.SPL_TOKEN_PROGRAM_ID || "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const SYS_PROGRAM_ID = "11111111111111111111111111111111";
const VOTE_PROGRAM_ID = "Vote111111111111111111111111111111111111111";

// Consensus / infra programs — never surface as activity.
const CONSENSUS_PROGRAMS = new Set([
  VOTE_PROGRAM_ID,
  "ComputeBudget111111111111111111111111111111",
  "AxKTyYasazUhkBHsi9HceQ8YEhTbkeohZ9aUH51QyXiy", // block-mine hash sampler
  "57rnijHYbPEGX75L4pQvNB9Drt4WWtyL4DvQVeB1iV1H",
  "HN7egj4JfDGSjHkumZ2ZugJu7kAShny5A62Tr3tYSS3N",
]);

const CONCURRENCY = Math.max(1, Math.min(8, Number(process.env.INDEXER_CONCURRENCY) || 4));
const BATCH = Math.max(10, Math.min(1000, Number(process.env.INDEXER_BATCH) || 300));
const CYCLE_SLEEP_MS = Math.max(500, Number(process.env.INDEXER_SLEEP_MS) || 4000);
const LARGE_USD = Number(process.env.INDEXER_LARGE_USD) || 100;
const COOK_LARGE_COOKS = Number(process.env.INDEXER_LARGE_COOKS) || 1_000_000;
const COOK_DECIMALS = 9;
const COOK_PRICE_USD = 0.00008877;

const ONCE = process.argv.includes("--once");
const BACKFILL_HOURS = hourArg(process.argv);
function hourArg(argv) {
  const i = argv.indexOf("--backfill");
  if (i === -1) return null;
  const v = Number(argv[i + 1]);
  return Number.isFinite(v) && v > 0 ? v : null;
}

// ---- RPC --------------------------------------------------------------------
let rpcSeq = 0;
async function rpc(method, params, attempts = 3) {
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
const sql = neon(process.env.DATABASE_URL);

async function getState(key, fallback = null) {
  const rows = await sql`select value from indexer_state where key = ${key}`;
  return rows.length ? rows[0].value : fallback;
}
async function setState(key, value) {
  await sql`
    insert into indexer_state (key, value, updated_at) values (${key}, ${value}, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
}

async function upsertWallet(address, lastActivityAt, tokenMints) {
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

async function upsertTokenFromAsset(mint) {
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
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "das",
        method: "getAsset",
        params: { id: mint },
      }),
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
function tokenAccountMintMap(meta, accountKeys) {
  const map = new Map();
  for (const list of [meta?.preTokenBalances ?? [], meta?.postTokenBalances ?? []]) {
    for (const b of list) {
      const key = accountKeys[b.accountIndex];
      if (key && b.mint) map.set(key, b.mint);
    }
  }
  return map;
}

function parseParsedInstr(instr, accountKeys, meta) {
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
          usd: null, // priced later via token table
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

function tokenMintOfAccount(account, meta, accountKeys) {
  return tokenAccountMintMap(meta, accountKeys).get(account) ?? null;
}

function parseTransaction(entry, blockTime, slot) {
  const meta = entry.meta ?? {};
  const tx = entry.transaction ?? {};
  if (meta.err) return null;
  const sig = tx.signatures?.[0];
  if (!sig) return null;
  const accountKeys = (tx.message?.accountKeys ?? []).map((k) => (typeof k === "string" ? k : k.pubkey));
  const outer = tx.message?.instructions ?? [];
  const inner = (meta.innerInstructions ?? []).flatMap((p) => p.instructions ?? []);
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

  // Swap heuristic: the same tx moved >1 distinct token.
  const tokens = new Set(acts.map((a) => a.tokenMint));
  if (tokens.size > 1) {
    for (const a of acts) a.type = "swap";
  }

  // One dominant action per transaction (activities are signature-unique).
  acts.sort((x, y) => (y.usd ?? 0) - (x.usd ?? 0) || Number(y.amount ?? 0) - Number(x.amount ?? 0));
  const dominant = acts[0];

  const programIds = new Set(allInstr.map((i) => i.programId));
  const feePayer = accountKeys[0] ?? null;
  return { sig, slot, blockTime, feePayer, act: dominant, tokens, programIds };
}

// ---- Significance engine -----------------------------------------------------
function short(wallet) {
  return `${wallet.slice(0, 4)}...`;
}
function fmtAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
async function tokenSymbol(mint) {
  const rows = await sql`select symbol from tokens where mint = ${mint}`;
  return rows[0]?.symbol ?? (mint === COOK_MINT ? "COOK" : mint.slice(0, 4));
}
async function hasPriorActivity(wallet, mint, excludeSignature) {
  const rows = await sql`
    select 1 from activities where wallet = ${wallet}
      and token_mint = ${mint} and signature <> ${excludeSignature} limit 1`;
  return rows.length > 0;
}

async function runSignificance(cycleActs) {
  const events = [];

  // significant_entry — wallet's first interaction with a token
  for (const act of cycleActs) {
    if (act.type !== "transfer") continue;
    const prior = await hasPriorActivity(act.wallet, act.tokenMint, act.sig);
    if (prior) continue;
    events.push({
      archetype: "significant_entry",
      wallet: act.wallet,
      tokenMint: act.tokenMint,
      significance: 100 + (Number(act.usd) || 0) / 10,
      payload: { title: `${short(act.wallet)} entered ${await tokenSymbol(act.tokenMint)}` },
      sourceActivityId: act.id,
    });
  }

  // large_movement — a single movement above the USD floor (or COOK-scale floor)
  for (const act of cycleActs) {
    const usd = Number(act.usd) || 0;
    const cooks =
      act.tokenMint === COOK_MINT ? Number(act.amount ?? 0) / 10 ** COOK_DECIMALS : 0;
    const isLargeCook = cooks >= COOK_LARGE_COOKS;
    if (!isLargeCook && usd < LARGE_USD) continue;
    if (act.type === "swap" && usd < LARGE_USD * 10 && !isLargeCook) continue;
    events.push({
      archetype: "large_movement",
      wallet: act.wallet,
      tokenMint: act.tokenMint,
      significance: Math.max(usd, cooks),
      payload: {
        title: `${short(act.wallet)} moved ${fmtAmount(act.amount)} ${await tokenSymbol(act.tokenMint)}`,
        amount: `${fmtAmount(act.amount)} ${await tokenSymbol(act.tokenMint)}`,
      },
      sourceActivityId: act.id,
    });
  }

  return events;
}

// ---- Cycles -----------------------------------------------------------------
async function processSlot(slot) {
  const block = await rpc("getBlock", [
    slot,
    { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, transactionDetails: "full" },
  ]);
  if (!block) return [];
  const blockTime = block.blockTime ?? Math.floor(Date.now() / 1000);
  const cycleActs = [];
  for (const entry of block.transactions ?? []) {
    const parsed = parseTransaction(entry, blockTime, slot);
    if (!parsed) continue;
    const act = parsed.act;

    await upsertWallet(parsed.feePayer, blockTime, parsed.tokens);
    await upsertWallet(act.wallet, blockTime, parsed.tokens);
    await upsertWallet(act.counter, blockTime, parsed.tokens);
    await upsertTokenFromAsset(act.tokenMint);

    const inserted = await sql`
      insert into activities (signature, wallet, token_mint, type, amount, value_usd, timestamp, slot, meta)
      values (${parsed.sig}, ${act.wallet}, ${act.tokenMint}, ${act.type},
              ${act.amount}, ${act.usd}, ${new Date(blockTime * 1000).toISOString()},
              ${slot}, ${JSON.stringify({ tokens: [...parsed.tokens], programIds: [...parsed.programIds] })})
      on conflict (signature) do nothing returning id, signature, type, amount, value_usd, wallet, token_mint`;

    for (const row of inserted) {
      cycleActs.push({
        id: row.id,
        sig: row.signature,
        wallet: row.wallet,
        tokenMint: row.token_mint,
        type: row.type,
        amount: row.amount,
        usd: Number(row.value_usd) || 0,
      });
    }
  }
  return cycleActs;
}

async function runCycle() {
  let startSlot = Number((await getState("start_slot", "0")) ?? "0");
  const head = await rpc("getSlot", []);

  if (startSlot <= 0) {
    startSlot = BACKFILL_HOURS
      ? Math.max(1, head - Math.round(BACKFILL_HOURS * 3600 * 2.2))
      : head - 1;
    console.log(`[indexer] starting at slot ${startSlot} (head ${head})`);
  }

  let end = Math.min(head, startSlot + BATCH);
  if (end <= startSlot) return { done: 0, actions: 0, events: 0 };

  const slots = (await rpc("getBlocks", [startSlot + 1, end])) ?? [];

  let queue = [...slots];
  let next = 0;
  const allCycleActs = [];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (next < queue.length) {
      const s = queue[next++];
      try {
        const acts = await processSlot(s);
        allCycleActs.push(...acts);
      } catch (err) {
        console.warn(`[indexer] slot ${s} failed: ${err.message}`);
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

async function writeEvents(cycleActs) {
  const events = [...(await runSignificance(cycleActs))];

  // Sample token_stats for this hour and emit momentum / early-discovery.
  const touched = [...new Set(cycleActs.map((a) => a.tokenMint))];
  for (const mint of touched.slice(0, 30)) {
    const hour = new Date(Date.now());
    hour.setUTCMinutes(0, 0, 0);
    const sampleAt = hour.toISOString();
    const [t] = await sql`select holder_count, symbol from tokens where mint = ${mint}`;
    if (!t) continue;
    const holders = Number(t.holder_count ?? 0);
    const buyers = await countDistinct(mint, "transfer");
    const sellers = await countDistinct(mint, "swap");
    await sql`
      insert into token_stats (mint, sampled_at, holder_count, volume_24h, buyers_1h, sellers_1h)
      values (${mint}, ${sampleAt}, ${holders}, null, ${buyers}, ${sellers})
      on conflict (mint, sampled_at) do nothing`;

    const [prev] = await sql`
      select holder_count from token_stats
      where mint = ${mint} and sampled_at < ${sampleAt}
      order by sampled_at desc limit 1`;
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

  events.sort((a, b) => b.significance - a.significance);
  let written = 0;
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

function pumpSignificance(holders, pct) {
  if (holders < 50) return pct;
  return Math.max(0, pct - 50);
}

async function countDistinct(mint, type) {
  const [r] = await sql`
    select count(distinct wallet)::int as n from activities
    where token_mint = ${mint} and type = ${type} and timestamp > now() - interval '1 hour'`;
  return r?.n ?? 0;
}

async function main() {
  console.log(
    `[indexer] rpc=${RPC_URL} concurrency=${CONCURRENCY} batch=${BATCH} large_usd=${LARGE_USD} backfill=${BACKFILL_HOURS ?? "live"}`,
  );
  let cycle = 0;
  for (;;) {
    cycle++;
    const { done, actions, events } = await runCycle();
    if (ONCE) {
      console.log(`[indexer] cycle complete (${done} slots, ${actions} actions, ${events} events). exiting.`);
      return;
    }
    // Quiet by default: log only when something surfaced, plus a heartbeat
    // every ~60 cycles so the operator can see it's alive.
    if (actions > 0 || events > 0) {
      console.log(`[indexer] ${actions} actions -> ${events} social events (slots ${done})`);
    } else if (cycle % 60 === 0) {
      const head = await getState("last_head", "?");
      const at = await getState("start_slot", "?");
      console.log(`[indexer] alive — tracking to slot ${at} (head ${head})`);
    }
    await new Promise((r) => setTimeout(r, CYCLE_SLEEP_MS));
  }
}

main().catch((err) => {
  console.error("[indexer] fatal:", err);
  process.exit(1);
});