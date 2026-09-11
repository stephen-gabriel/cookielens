export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://rpc.cookiescan.io";
export const WSS_URL = process.env.NEXT_PUBLIC_WSS_URL ?? "wss.cookiescan.io";
export const CHAIN_NAME = process.env.NEXT_PUBLIC_CHAIN_NAME ?? "cookie-chain";
export const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://cookiescan.io";

export const COOK_MINT = process.env.NEXT_PUBLIC_COOK_MINT ?? "36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1";

export const TOKEN_PROGRAM_ID = process.env.NEXT_PUBLIC_SPL_TOKEN_PROGRAM_ID ?? "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const ATA_PROGRAM_ID = process.env.NEXT_PUBLIC_ATA_PROGRAM_ID ?? "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

export const COOKIE_CHAIN_MATCHER = {
  name: "Cookie Chain",
  rpcUrl: RPC_URL,
  wsUrl: WSS_URL,
};

export const supportedSolanaChains = ["solana:mainnet", "solana:testnet", "solana:devnet"];