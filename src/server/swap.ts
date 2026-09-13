import { toRawAmount } from "@/lib/format";

const COOKIEBOX_AGG_API_URL =
  process.env.COOKIEBOX_AGG_API_URL?.trim().replace(/\/$/, "") || "https://agg.cookiebox.app";

const HTTP_TIMEOUT_MS = 12_000;
const SWAP_TX_TIMEOUT_MS = 60_000;

export const AGG_COOK_MINT = "So11111111111111111111111111111111111111112";
export const AGG_COOK_DECIMALS = 9;

export interface AggSegment {
  pool: string;
  venue: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  percentage?: number;
  hopIndex: number;
}

export interface AggQuote {
  inAmount: string;
  outAmount: string;
  feePct: number;
  feeAmount: string;
  netOutAmount: string;
  minOutAmount: string;
  priceImpactPct: number | null;
  path: string[];
  isSplit: boolean;
  isMultiHop: boolean;
  segments: AggSegment[];
}

export interface AggSwapTx {
  transactionBase64: string;
  blockhash: string;
  lastValidBlockHeight: number;
  route: AggQuote;
}

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = HTTP_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (res.status === 404) {
      const err = new Error("no route") as Error & { status: number };
      err.status = 404;
      throw err;
    }
    if (!res.ok) {
      const err = new Error(`aggregator ${res.status}: ${(await res.text()).slice(0, 200)}`) as Error & {
        status: number;
      };
      err.status = res.status;
      throw err;
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function isNoRouteError(err: unknown): boolean {
  return err instanceof Error && (err as { status?: number }).status === 404;
}

/** Quote via the Cookiebox aggregator. Returns null when no route exists. `amount` must be a UI
 * amount of the input token (converted to raw units with `inputDecimals` here). */
export async function quoteCookiebox(args: {
  inputMint: string;
  outputMint: string;
  amount: string | number;
  inputDecimals: number;
  slippageBps: number;
  owner?: string | null;
}): Promise<AggQuote | null> {
  const amountRaw = toRawAmount(args.amount, args.inputDecimals);
  const q = new URLSearchParams({
    inputMint: args.inputMint,
    outputMint: args.outputMint,
    amount: amountRaw.toString(),
    slippageBps: String(args.slippageBps),
  });
  if (args.owner) q.set("owner", args.owner);
  try {
    const body = await fetchJson<{ route: AggQuote }>(`${COOKIEBOX_AGG_API_URL}/quote?${q.toString()}`);
    return body.route;
  } catch (err) {
    if (isNoRouteError(err)) return null;
    throw err;
  }
}

/** Build an unsigned v0 swap transaction via the Cookiebox aggregator. `amount` is a UI amount of the
 * input token (converted to raw units with `inputDecimals`). The returned transaction still needs to
 * be signed by `owner`. */
export async function buildCookieboxSwapTx(args: {
  inputMint: string;
  outputMint: string;
  amount: string | number;
  inputDecimals: number;
  slippageBps: number;
  owner: string;
}): Promise<AggSwapTx> {
  const amountRaw = toRawAmount(args.amount, args.inputDecimals).toString();
  const built = await fetchJson<AggSwapTx>(
    `${COOKIEBOX_AGG_API_URL}/swap-tx`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inputMint: args.inputMint,
        outputMint: args.outputMint,
        amount: amountRaw,
        slippageBps: args.slippageBps,
        owner: args.owner,
      }),
    },
    SWAP_TX_TIMEOUT_MS,
  );
  return built;
}