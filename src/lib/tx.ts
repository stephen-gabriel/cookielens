"use client";

import { Connection, PublicKey, SystemProgram, Transaction, VersionedTransaction } from "@solana/web3.js";
import type { WalletAccount } from "@wallet-standard/base";
import type { UiWallet } from "@wallet-standard/ui";
import { getWalletFeature } from "@wallet-standard/ui";

const SOLANA_CHAIN = process.env.NEXT_PUBLIC_WALLET_STANDARD_CHAIN ?? "solana:mainnet";

const SIGN_TX = "solana:signTransaction";
const SIGN_AND_SEND_TX = "solana:signAndSendTransaction";

type SignTransactionInput = {
  account: WalletAccount;
  transaction: Uint8Array;
  chain: string;
};

type SignTransactionFeature = {
  "solana:signTransaction": {
    signTransaction: (input: SignTransactionInput) => Promise<
      | { signedTransaction?: Transaction | Uint8Array }
      | { signedTransactions?: readonly (Transaction | Uint8Array)[] }
    >;
  };
};

type SignAndSendTransactionFeature = {
  "solana:signAndSendTransaction": {
    signAndSendTransaction: (input: SignTransactionInput) => Promise<{ signature: Uint8Array }>;
  };
};

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
  let lastError: unknown = null;

  if (wallet.features.includes(SIGN_TX)) {
    try {
      const feature = getWalletFeature(wallet, SIGN_TX) as unknown as SignTransactionFeature["solana:signTransaction"];
      const result = await feature.signTransaction({
        account,
        transaction: prepared.txBytes,
        chain: SOLANA_CHAIN,
      });
      const signed =
        "signedTransaction" in result
          ? result.signedTransaction
          : "signedTransactions" in result
            ? result.signedTransactions?.[0]
            : undefined;
      if (signed) {
        const bytes = signed instanceof Transaction ? signed.serialize() : new Uint8Array(signed);
        return await connection.sendRawTransaction(bytes);
      }
      lastError = new Error("Wallet returned no signed transaction");
    } catch (err) {
      lastError = err;
    }
  }

  if (wallet.features.includes(SIGN_AND_SEND_TX)) {
    try {
      const feature = getWalletFeature(
        wallet,
        SIGN_AND_SEND_TX,
      ) as unknown as SignAndSendTransactionFeature["solana:signAndSendTransaction"];
      const { signature } = await feature.signAndSendTransaction({
        account,
        transaction: prepared.txBytes,
        chain: SOLANA_CHAIN,
      });
      return new PublicKey(signature).toBase58();
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError) throw lastError instanceof Error ? lastError : new Error("Transaction signing failed");
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