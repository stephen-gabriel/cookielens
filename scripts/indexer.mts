import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
try { loadEnvFile(path.join(here, "..", ".env.local")); } catch {}

const { createIndexer } = await import("../src/server/indexer/engine");
const idx = createIndexer(process.env);

const ONCE = process.argv.includes("--once");
const BACKFILL_HOURS = (() => {
  const i = process.argv.indexOf("--backfill");
  if (i === -1) return null;
  const v = Number(process.argv[i + 1]);
  return Number.isFinite(v) && v > 0 ? v : null;
})();

if (BACKFILL_HOURS) {
  await idx.setState("start_slot", "0");
  console.log(`[indexer] backfill ${BACKFILL_HOURS}h`);
}

console.log(
  `[indexer] rpc=${process.env.RPC_URL || "https://rpc.cookiescan.io"} batch=${process.env.INDEXER_BATCH || 300}`,
);

const SLEEP_MS = Math.max(250, Number(process.env.INDEXER_SLEEP_MS) || 1000);
let cycle = 0;
for (;;) {
  cycle++;
  const { done, actions, events } = await idx.runCycle();
  if (ONCE) {
    console.log(`[indexer] cycle complete (${done} slots, ${actions} actions, ${events} events). exiting.`);
    break;
  }
  const head = Number((await idx.getState("last_head", "0")) ?? "0");
  const at = Number((await idx.getState("start_slot", "0")) ?? "0");
  const behind = head > 0 ? Math.max(0, head - at) : 0;
  if (behind === 0 && (actions > 0 || events > 0)) {
    console.log(`[indexer] ${actions} actions -> ${events} social events (done ${done})`);
  } else if (behind > 0 && cycle % 25 === 0) {
    console.log(`[indexer] catching up — ${at}/${head} (behind ${behind})`);
  } else if (cycle % 600 === 0) {
    console.log(`[indexer] alive — tracking to slot ${at} (head ${head})`);
  }
  if (behind > 0 && cycle % 500 !== 0) continue;
  await new Promise((r) => setTimeout(r, SLEEP_MS));
}