import { COOK_PRICE_PROVIDER } from "@/lib/constants";

let cachedPrice: number | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;
let inflight: Promise<number | null> | null = null;

export async function getCookUsdPrice(): Promise<number | null> {
  if (cachedPrice !== null && Date.now() - cachedAt < CACHE_TTL_MS) return cachedPrice;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${COOK_PRICE_PROVIDER.coingeckoId}&vs_currencies=usd`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return cachedPrice;
      const data = (await res.json()) as Record<string, { usd?: number }>;
      const price = data[COOK_PRICE_PROVIDER.coingeckoId]?.usd ?? null;
      if (price !== null && price > 0) {
        cachedPrice = price;
        cachedAt = Date.now();
      }
      return price;
    } catch {
      return cachedPrice;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export type CookMarketData = {
  priceUsd: number | null;
  marketCapUsd: number | null;
};

const MAX_SUPPLY = 1_000_000_000;

export async function getCookMarketData(): Promise<CookMarketData> {
  const priceUsd = await getCookUsdPrice();
  const marketCapUsd = priceUsd !== null ? priceUsd * MAX_SUPPLY : null;
  return { priceUsd, marketCapUsd };
}

export type SwapMarket = {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  quote_symbol?: string;
  supply?: number;
  price?: number;
  priceUsd?: number;
  priceNative?: number;
  change24h?: number;
  high24h?: number;
  low24h?: number;
  volume24h?: number;
  trades24h?: number;
  liquidity?: number;
  marketCap?: number;
  fdv?: number;
  holders?: number;
  lastTradeTs?: number;
  lastTradeSide?: string;
  label?: string | null;
};

let cachedMarkets: { at: number; map: Map<string, SwapMarket> } | null = null;
const MARKETS_TTL_MS = 60_000;
let inflightMarkets: Promise<Map<string, SwapMarket>> | null = null;

export async function getSwapMarkets(): Promise<Map<string, SwapMarket>> {
  if (cachedMarkets && Date.now() - cachedMarkets.at < MARKETS_TTL_MS) return cachedMarkets.map;
  if (inflightMarkets) return inflightMarkets;

  inflightMarkets = (async () => {
    try {
      const res = await fetch("https://swap.cookiescan.io/api/markets", { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return cachedMarkets?.map ?? new Map();
      const markets = (await res.json()) as SwapMarket[];
      const map = new Map(markets.map((m) => [m.mint, m]));
      cachedMarkets = { at: Date.now(), map };
      return map;
    } catch {
      return cachedMarkets?.map ?? new Map();
    } finally {
      inflightMarkets = null;
    }
  })();

  return inflightMarkets;
}