"use client";

import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import type { UiWallet } from "@wallet-standard/ui";
import { getWalletFeature } from "@wallet-standard/ui";

const SOLANA_CHAIN = process.env.NEXT_PUBLIC_WALLET_STANDARD_CHAIN ?? "solana:mainnet";

const SIGN_TX = "solana:signTransaction";
const SIGN_AND_SEND_TX = "solana:signAndSendTransaction";

type SignTransactionFeature = {
  "solana:signTransaction": {
    signTransaction: (input: {
      transaction: Uint8Array;
      chain: string;
    }) => Promise<{ signedTransactions: readonly (Transaction | Uint8Array)[] }>;
  };
};

type SignAndSendTransactionFeature = {
  "solana:signAndSendTransaction": {
    signAndSendTransaction: (input: {
      transaction: Uint8Array;
      chain: string;
    }) => Promise<{ signature: Uint8Array }>;
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

/** Ask the wallet to sign, then broadcast ourselves so we control confirmation timing. */
export async function walletSignAndSubmit(
  wallet: UiWallet,
  prepared: PreparedCookTransfer,
  connection: Connection,
): Promise<string> {
  let lastError: unknown = null;

  if (wallet.features.includes(SIGN_TX)) {
    try {
      const feature = getWalletFeature(wallet, SIGN_TX) as unknown as SignTransactionFeature["solana:signTransaction"];
      const { signedTransactions } = await feature.signTransaction({ transaction: prepared.txBytes, chain: SOLANA_CHAIN });
      const signed = signedTransactions?.[0];
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
      const { signature } = await feature.signAndSendTransaction({ transaction: prepared.txBytes, chain: SOLANA_CHAIN });
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