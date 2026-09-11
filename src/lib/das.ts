import { DAS_URL } from "@/lib/constants";

type DasRequest = { jsonrpc: string; id: number; method: string; params: Record<string, unknown> };

export type DasAsset = {
  id: string;
  interface: string;
  burnt: boolean;
  content: {
    metadata: { name?: string; symbol?: string; description?: string; token_standard?: string };
    links?: { image?: string };
    files?: { uri: string; mime?: string }[];
  };
  token_info?: {
    supply?: number;
    symbol?: string;
    balance?: number;
    decimals?: number;
    price_info?: { price_per_token?: number; total_price?: number; currency?: string };
  };
  holder_count?: number;
  market_cap?: number;
  volume_24h?: number;
  price_change_24h?: number;
};

async function dasCall<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const res = await fetch(DAS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params } satisfies DasRequest),
  });
  if (!res.ok) throw new Error(`DAS ${method} failed: ${res.status}`);
  const json = (await res.json()) as { result?: T; error?: { message?: string } };
  if (json.error) throw new Error(json.error.message ?? `DAS ${method} error`);
  return json.result as T;
}

export async function getAsset(id: string): Promise<DasAsset | null> {
  try {
    return await dasCall<DasAsset>("getAsset", { id });
  } catch {
    return null;
  }
}

export async function getAssetsByOwner(
  ownerAddress: string,
  limit = 200,
): Promise<DasAsset[]> {
  try {
    const result = await dasCall<{ total: number; items: DasAsset[] }>("getAssetsByOwner", {
      ownerAddress,
      page: 1,
      limit,
    });
    return result.items ?? [];
  } catch {
    return [];
  }
}

export async function searchFungibleAssets(searchString?: string, limit = 100): Promise<DasAsset[]> {
  try {
    const result = await dasCall<{ total: number; items: DasAsset[] }>("searchAssets", {
      page: 1,
      limit,
      tokenType: "fungible",
      ...(searchString ? { searchString } : {}),
    });
    return result.items ?? [];
  } catch {
    return [];
  }
}