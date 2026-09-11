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
      const res = await fetch(url);
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