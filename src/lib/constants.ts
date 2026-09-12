function urlOr(
  fallback: string,
  envValue?: string,
  allowedSchemes = ["http:", "https:"],
): string {
  const raw = envValue?.trim();
  if (!raw) return fallback;
  let protocol = "";
  try {
    protocol = new URL(raw).protocol;
  } catch {
    return fallback;
  }
  return allowedSchemes.includes(protocol) ? raw : fallback;
}

function valueOr(fallback: string, envValue?: string): string {
  const raw = envValue?.trim();
  return raw ? raw : fallback;
}

export const RPC_URL = urlOr("https://rpc.cookiescan.io", process.env.NEXT_PUBLIC_RPC_URL);
export const WSS_URL = urlOr(
  "wss://wss.cookiescan.io",
  process.env.NEXT_PUBLIC_WSS_URL,
  ["wss:", "ws:"],
);
export const DAS_URL = urlOr("https://api.cookiescan.io", process.env.NEXT_PUBLIC_DAS_URL);
export const CHAIN_NAME = valueOr("cookie-chain", process.env.NEXT_PUBLIC_CHAIN_NAME);
export const EXPLORER_URL = urlOr("https://cookiescan.io", process.env.NEXT_PUBLIC_EXPLORER_URL);

export const COOK_MINT = valueOr(
  "36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1",
  process.env.NEXT_PUBLIC_COOK_MINT,
);
export const COOK_MAX_SUPPLY = 1_000_000_000;

export const TOKEN_PROGRAM_ID = valueOr(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  process.env.NEXT_PUBLIC_SPL_TOKEN_PROGRAM_ID,
);
export const ATA_PROGRAM_ID = valueOr(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  process.env.NEXT_PUBLIC_ATA_PROGRAM_ID,
);

export const COOK_PRICE_PROVIDER = {
  coingeckoId: valueOr("cookie-2", process.env.NEXT_PUBLIC_COOK_COINGECKO_ID),
};

export const COOKIE_CHAIN_MATCHER = {
  name: "Cookie Chain",
  rpcUrl: RPC_URL,
  wsUrl: WSS_URL,
};

export const supportedSolanaChains = ["solana:mainnet", "solana:testnet", "solana:devnet"];