"use client";

import bs58 from "bs58";
import type { UiWallet } from "@wallet-standard/ui";
import { getWalletFeature } from "@wallet-standard/ui";

const SIGN_MESSAGE = "solana:signMessage";
const SOLANA_CHAIN = process.env.NEXT_PUBLIC_WALLET_STANDARD_CHAIN ?? "solana:mainnet";

type SignMessageFeature = {
  "solana:signMessage": {
    signMessage: (input: {
      message: Uint8Array;
      chain?: string;
    }) => Promise<{ signatures: readonly Uint8Array[] }>;
  };
};

/**
 * Sign the exact UTF-8 bytes of a message with the wallet's
 * `solana:signMessage` feature and return the base58 signature.
 */
export async function signMessageForClaim(wallet: UiWallet, message: string): Promise<string> {
  if (!wallet.features.includes(SIGN_MESSAGE)) {
    throw new Error("Your wallet does not support message signing.");
  }
  const feature = getWalletFeature(wallet, SIGN_MESSAGE) as unknown as SignMessageFeature["solana:signMessage"];
  const { signatures } = await feature.signMessage({
    message: new TextEncoder().encode(message),
    chain: SOLANA_CHAIN,
  });
  const signature = signatures?.[0];
  if (!signature) throw new Error("Wallet returned no signature.");
  return bs58.encode(signature);
}