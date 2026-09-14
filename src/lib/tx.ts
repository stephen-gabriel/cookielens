"use client";

import { Connection, PublicKey, SystemProgram, Transaction, VersionedTransaction } from "@solana/web3.js";
import type { WalletAccount } from "@wallet-standard/base";
import type { UiWallet } from "@wallet-standard/ui";
import { getWalletFeature } from "@wallet-standard/ui";

const SOLANA_CHAIN = process.env.NEXT_PUBLIC_WALLET_STANDARD_CHAIN ?? "solana:mainnet";

/**
 * Feature names in both the legacy ("solana:*") and wallet-standard v1
 * ("experimental:*") namespaces, tried in preference order. Wallets may expose
 * either, some with v1 semantics (account required, array outputs) even under
 * the legacy name.
 */
const SIGN_TX_NAMES = ["solana:signTransaction", "experimental:signTransaction"] as const;
const SIGN_AND_SEND_TX_NAMES = ["solana:signAndSendTransaction", "experimental:signAndSendTransaction"] as const;

type FeatureName = (typeof SIGN_TX_NAMES)[number] | (typeof SIGN_AND_SEND_TX_NAMES)[number];

type SignInput = {
  account: WalletAccount;
  transaction: Uint8Array;
  chain: string;
};

type SignedBytes = Transaction | Uint8Array;

/** Extract a signed transaction from both v0 (`{ signedTransaction }` /
 * `{ signedTransactions: bytes[] }`) and v1 (array of
 * `{ signedTransaction }`) output shapes. */
function extractSignedTransaction(value: unknown): SignedBytes | undefined {
  if (Array.isArray(value)) {
    if (value.length === 0) return undefined;
    const first = value[0];
    if (first && typeof first === "object" && "signedTransaction" in (first as object)) {
      return extractSignedTransaction((first as { signedTransaction: SignedBytes }).signedTransaction);
    }
    return extractSignedTransaction(first);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.signedTransaction != null) return obj.signedTransaction as SignedBytes;
    if (Array.isArray(obj.signedTransactions)) return extractSignedTransaction(obj.signedTransactions);
  }
  return undefined;
}

/** Extract a signature from both v0 (`{ signature }`) and v1 (array of
 * `{ signature }`) output shapes. */
function extractSignature(value: unknown): Uint8Array | string | undefined {
  if (Array.isArray(value)) {
    if (value.length === 0) return undefined;
    return extractSignature(value[0]);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.signature != null) return obj.signature as Uint8Array | string;
  }
  return undefined;
}

function toBytes(value: SignedBytes): Uint8Array {
  return value instanceof Transaction ? value.serialize() : new Uint8Array(value);
}

function pickFeature(wallet: UiWallet, names: readonly FeatureName[]): FeatureName | null {
  for (const name of names) {
    if (wallet.features.includes(name)) return name;
  }
  return null;
}

/** Sign-only feature: ask the wallet to sign, then broadcast the signed bytes
 * ourselves against the Cookie RPC so we control confirmation and get
 * descriptive errors from our own network instead of the wallet's default one. */
async function signAndSubmit(
  wallet: UiWallet,
  featureName: FeatureName,
  input: SignInput,
  connection: Connection,
): Promise<string> {
  const feature = getWalletFeature(wallet, featureName) as unknown as {
    signTransaction: (input: SignInput) => Promise<unknown>;
  };
  const raw = await feature.signTransaction(input);
  const signed = extractSignedTransaction(raw);
  if (!signed) throw new Error("Wallet returned no signed transaction");
  return connection.sendRawTransaction(toBytes(signed));
}

export type PreparedCookTransfer = {
  txBytes: Uint8Array;
  blockhash: string;
  lastValidBlockHeight: number;
};

export async function prepareCookTransfer(
  connection: Connection,
  from: PublicKey,
  to: PublicKey,
  lamports: number,
): Promise<PreparedCookTransfer> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction();
  tx.feePayer = from;
  tx.recentBlockhash = blockhash;
  tx.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports }));
  return { txBytes: tx.serialize({ verifySignatures: false, requireAllSignatures: false }), blockhash, lastValidBlockHeight };
}

function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Deserialize an unsigned v0 transaction returned by an aggregator, simulate it against the RPC,
 * and prepare it for wallet signing. Throws with an actionable message if the simulation fails
 * (insufficient funds, no route, stale blockhash). */
export async function prepareAggregateSwapTransfer(
  connection: Connection,
  transactionBase64: string,
): Promise<PreparedCookTransfer> {
  const tx = VersionedTransaction.deserialize(base64ToBytes(transactionBase64));

  const sim = await connection.simulateTransaction(tx, {
    replaceRecentBlockhash: true,
    sigVerify: false,
    commitment: "confirmed",
  });
  if (sim.value.err) {
    const logs = (sim.value.logs ?? []).join(" | ");
    const blob = `${JSON.stringify(sim.value.err)} ${logs}`;
    if (/insufficient|0x1\b/i.test(blob)) {
      throw new Error("Swap simulation failed: insufficient balance. Add funds and retry.");
    }
    if (/BlockhashNotFound|blockhash/i.test(blob)) {
      throw new Error("Swap failed to simulate: the route is stale. Re-quote and retry.");
    }
    const tail = logs.slice(-120);
    throw new Error(`Swap failed to simulate${tail ? `: ${tail}` : ""}. Re-quote and retry.`);
  }

  return {
    txBytes: tx.serialize(),
    blockhash: tx.message.recentBlockhash,
    lastValidBlockHeight: 0,
  };
}

/** Ask the wallet to sign, then broadcast ourselves so we control confirmation timing. */
export async function walletSignAndSubmit(
  wallet: UiWallet,
  account: WalletAccount,
  prepared: PreparedCookTransfer,
  connection: Connection,
): Promise<string> {
  const input: SignInput = { account, transaction: prepared.txBytes, chain: SOLANA_CHAIN };

  const signOnly = pickFeature(wallet, SIGN_TX_NAMES);
  if (signOnly) {
    return await signAndSubmit(wallet, signOnly, input, connection);
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[tx] no sign-only feature; wallet features:", wallet.features);
  }

  const signAndSend = pickFeature(wallet, SIGN_AND_SEND_TX_NAMES);
  if (signAndSend) {
    const feature = getWalletFeature(wallet, signAndSend) as unknown as {
      signAndSendTransaction: (input: SignInput) => Promise<unknown>;
    };
    const raw = await feature.signAndSendTransaction(input);
    const signature = extractSignature(raw);
    if (!signature) throw new Error("Wallet returned no signature");
    return new PublicKey(signature).toBase58();
  }

  throw new Error("Your wallet does not support signing transactions");
}

export async function waitForCookieConfirmation(
  connection: Connection,
  signature: string,
  prepared: PreparedCookTransfer,
  timeoutMs = 60_000,
): Promise<void> {
  const startedAt = Date.now();
  for (;;) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Confirmation timed out. Signature: ${signature}`);
    }
    const status = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
    const value = status?.value;
    if (value) {
      if (value.err) {
        const reason = typeof value.err === "string" ? value.err : JSON.stringify(value.err);
        throw new Error(`Transaction failed on-chain: ${reason}`);
      }
      const level = value.confirmationStatus;
      if (level === "confirmed" || level === "finalized") return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}