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
 * arrays/objects nesting these (Nightly returns `[{ ... }]`). Prefers known
 * signature keys, then falls back to the first 64-byte blob (an ed25519 sig),
 * while avoiding pubkeys/messages.
 */
function signatureBytesOf(raw: unknown, depth = 0, visited = new Set<unknown>()): Uint8Array | null {
  if (depth > 4 || raw === null || raw === undefined || visited.has(raw)) return null;
  if (typeof raw !== "object") return null;
  visited.add(raw);
  if (raw instanceof Uint8Array) return raw.length > 0 ? raw : null;
  if (raw instanceof ArrayBuffer) return raw.byteLength > 0 ? new Uint8Array(raw) : null;

  const entries = raw instanceof Uint8Array ? [] : Object.entries(raw as Record<string, unknown>);
  const known = ["signatures", "signature", "sig", "signatureBytes", "ed25519Signature"];
  for (const key of known) {
    const hit = raw instanceof Uint8Array ? null : raw[key as keyof typeof raw];
    if (hit !== undefined) {
      const sig = signatureBytesOf(hit, depth + 1, visited);
      if (sig) return sig;
    }
  }
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const sig = signatureBytesOf(item, depth + 1, visited);
      if (sig) return sig;
    }
    return null;
  }
  for (const [key, value] of entries) {
    if (/publickey|account|address|message|signedmessage/i.test(key)) continue;
    if (typeof value === "string") return new TextEncoder().encode(value);
    if (value instanceof Uint8Array && value.length === 64) return value;
  }
  return null;
}

/**
 * Find the `signedMessage` bytes the wallet reports — the exact bytes its
 * signature covers. Some wallets (e.g. Nightly) sign the message with a small
 * transform, so we verify against what they say they signed.
 */
function signedMessageBytesOf(raw: unknown, depth = 0): Uint8Array | null {
  if (!raw || typeof raw !== "object" || depth > 4) return null;
  if (raw instanceof Uint8Array) return raw.length > 0 ? raw : null;
  for (const key of Object.keys(raw as Record<string, unknown>)) {
    const value = (raw as Record<string, unknown>)[key];
    if (key.toLowerCase().includes("signedmessage") && value instanceof Uint8Array && value.length > 0) return value;
    if (value && typeof value === "object") {
      const hit = signedMessageBytesOf(value, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * Sign the exact UTF-8 bytes of a message with the wallet's
 * `solana:signMessage` feature. Returns the base58 signature plus the base64
 * `signedMessage` the wallet reports (verify server-side against those bytes).
 */
export async function signMessageForClaim(
  wallet: UiWallet,
  account: { address: string; publicKey: Uint8Array<ArrayBufferLike> | ReadonlyBytes },
  message: string,
): Promise<{ signature: string; signedMessage?: string }> {
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
    const firstSummary =
      first && typeof first === "object"
        ? Object.entries(first as Record<string, unknown>).reduce<Record<string, string>>((acc, [k, v]) => {
            acc[k] = v instanceof Uint8Array ? `bytes(${v.length})` : Array.isArray(v) ? `array(${v.length})` : typeof v;
            return acc;
          }, {})
        : null;
    console.warn("[signMessageForClaim] result=" + JSON.stringify({ isArray: !!arr, isBytes: !!bytes, bytesLength: bytes?.length ?? null, arrayLength: arr?.length ?? null, first: firstSummary }));
  }
  const signature = signatureBytesOf(result);
  if (!signature) {
    throw new Error("Wallet returned no usable signature bytes (result was not bytes / signature(s) / string).");
  }
  const signedMessageBytes = signedMessageBytesOf(result);
  return {
    signature: bs58.encode(signature),
    signedMessage: signedMessageBytes ? bytesToBase64(signedMessageBytes) : undefined,
  };
}