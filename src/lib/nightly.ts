"use client";

import { RPC_URL } from "@/lib/constants";

export const COOKIE_CHAIN_GENESIS_HASH = process.env.NEXT_PUBLIC_COOKIE_GENESIS_HASH ?? "9wDaBRDgArEUpvhHxGguNkwozsZh4UpGZB9o2EoEcBB2";

interface NightlySolanaInjected {
  genesisHash?: string;
  chainId?: unknown;
  supportedChains?: unknown[];
  changeNetwork?: (network: { genesisHash: string; url?: string }) => Promise<unknown>;
  [key: string]: unknown;
}

interface NightlyInjected {
  solana?: NightlySolanaInjected;
  [key: string]: unknown;
}

declare global {
  interface Window {
    nightly?: NightlyInjected;
  }
}

export function isNightlyOnCookieChain(): boolean {
  return window.nightly?.solana?.genesisHash === COOKIE_CHAIN_GENESIS_HASH;
}

export async function switchNightlyNetwork(): Promise<boolean> {
  const solana = window.nightly?.solana;
  if (!solana) return true;
  if (solana.genesisHash === COOKIE_CHAIN_GENESIS_HASH) return true;
  if (typeof solana.changeNetwork !== "function") return false;
  await solana.changeNetwork({ genesisHash: COOKIE_CHAIN_GENESIS_HASH, url: RPC_URL });
  return true;
}