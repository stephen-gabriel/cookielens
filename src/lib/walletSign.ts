"use client";

import bs58 from "bs58";
import type { UiWallet } from "@wallet-standard/ui";
import { getWalletFeature } from "@wallet-standard/ui";

const SIGN_MESSAGE = "solana:signMessage";
const SOLANA_CHAIN = process.env.NEXT_PUBLIC_WALLET_STANDARD_CHAIN ?? "solana:mainnet";

type ReadonlyBytes = Omit<Uint8Array<ArrayBufferLike>, "copyWithin" | "fill" | "reverse" | "set" | "sort">;

type SignMessageInput = {
  message: Uint8Array;
  /** Wallet-standard v1 requires the signing account (reads `input.account.address`). */
  account?: { address: string; publicKey: Uint8Array<ArrayBufferLike> | ReadonlyBytes };
  chain?: string;
};

type SignMessageOutput = {
  signatures?: readonly Uint8Array[];
  signature?: Uint8Array | string;
  signedMessage?: Uint8Array;
};

type SignMessageFeature = {
  "solana:signMessage": {
    signMessage: (input: SignMessageInput) => Promise<SignMessageOutput>;
  };
};

/**
 * Walk any result shape wallets actually return and find the first usable
 * signature: bare `Uint8Array`, `{ signature }`, `{ signatures: [...] }`, or
 * arrays/objects nesting these. Returns the base58 string when found.
 */
function extractSignature(raw: unknown, depth = 0): string | null {
  if (depth > 4) return null;
  if (raw instanceof Uint8Array) return raw.length > 0 ? bs58.encode(raw) : null;
  if (typeof raw === "string") return raw.length > 0 ? raw : null;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const sig = extractSignature(item, depth + 1);
      if (sig) return sig;
    }
    return null;
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["signatures", "signature", "sig", "signatureBytes"]) {
      const sig = extractSignature(obj[key], depth + 1);
      if (sig) return sig;
    }
    return null;
  }
  return null;
}

/**
 * Sign the exact UTF-8 bytes of a message with the wallet's
 * `solana:signMessage` feature and return the base58 signature.
 * Wallets vary in the result shape; Nightly returns a bare `Uint8Array`.
 */
export async function signMessageForClaim(
  wallet: UiWallet,
  account: { address: string; publicKey: Uint8Array<ArrayBufferLike> | ReadonlyBytes },
  message: string,
): Promise<string> {
  if (!wallet.features.includes(SIGN_MESSAGE)) {
    throw new Error("Your wallet does not support message signing.");
  }
  const feature = getWalletFeature(wallet, SIGN_MESSAGE) as unknown as SignMessageFeature["solana:signMessage"];
  const result = await feature.signMessage({
    message: new TextEncoder().encode(message),
    account: { address: account.address, publicKey: account.publicKey },
    chain: SOLANA_CHAIN,
  });
  if (process.env.NODE_ENV === "development") {
    const bytes = result instanceof Uint8Array ? result : null;
    const arr = Array.isArray(result) ? result : null;
    const first = arr?.[0];
    console.warn(
      "[signMessageForClaim] result=" +
        JSON.stringify({
          isArray: !!arr,
          isBytes: !!bytes,
          bytesLength: bytes ? bytes.length : null,
          arrayLength: arr?.length,
          firstType: typeof first,
          firstIsBytes: first instanceof Uint8Array,
          firstLen: first instanceof Uint8Array ? first.length : null,
        }),
    );
  }
  const signature = extractSignature(result);
  if (!signature) {
    throw new Error("Wallet returned no usable signature bytes (result was not bytes / signature(s) / string).");
  }
  return signature;
}