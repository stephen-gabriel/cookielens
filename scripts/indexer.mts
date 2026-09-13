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

const SLEEP_MS = Math.max(500, Number(process.env.INDEXER_SLEEP_MS) || 4000);
let cycle = 0;
for (;;) {
  cycle++;
  const { done, actions, events } = await idx.runCycle();
  if (ONCE) {
    console.log(`[indexer] cycle complete (${done} slots, ${actions} actions, ${events} events). exiting.`);
    break;
  }
  if (actions > 0 || events > 0) {
    console.log(`[indexer] ${actions} actions -> ${events} social events (slots ${done})`);
  } else if (cycle % 60 === 0) {
    const head = await idx.getState("last_head", "?");
    const at = await idx.getState("start_slot", "?");
    console.log(`[indexer] alive — tracking to slot ${at} (head ${head})`);
  }
  await new Promise((r) => setTimeout(r, SLEEP_MS));
}