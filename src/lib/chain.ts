import { Connection, PublicKey } from "@solana/web3.js";
import { RPC_URL } from "@/lib/constants";

const RPC_TIMEOUT_MS = 15_000;

/** Bounded fetch for the Solana Connection so a stalled RPC can never hang the UI forever. */
function boundedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(RPC_TIMEOUT_MS) });
}

let connection: Connection | null = null;

export function getConnection(): Connection {
  if (!connection) connection = new Connection(RPC_URL, { commitment: "confirmed", fetch: boundedFetch });
  return connection;
}

export type WalletTokenBalance = {
  mint: string;
  /** Token amount (base units, integer). */
  amount: bigint;
  decimals: number;
  isNative: boolean;
};

export async function getNativeBalance(address: string): Promise<bigint> {
  const pubkey = new PublicKey(address);
  const lamports = await getConnection().getBalance(pubkey);
  return BigInt(lamports);
}

export async function getTokenBalances(address: string): Promise<WalletTokenBalance[]> {
  const pubkey = new PublicKey(address);

  const [splAccounts, token2022Accounts] = await Promise.all([
    getConnection()
      .getParsedTokenAccountsByOwner(pubkey, {
        programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      })
      .catch(() => ({ value: [] })),
    getConnection()
      .getParsedTokenAccountsByOwner(pubkey, {
        programId: new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"),
      })
      .catch(() => ({ value: [] })),
  ]);

  const allAccounts = [...splAccounts.value, ...token2022Accounts.value];

  return allAccounts
    .map(({ account }) => {
      const parsedInfo = (account.data as { parsed?: { info?: unknown } })?.parsed?.info as {
        mint?: string;
        tokenAmount?: { amount: string; decimals: number };
        isNative?: boolean;
      } | undefined;

      if (!parsedInfo?.mint || !parsedInfo?.tokenAmount) return null;
      return {
        mint: parsedInfo.mint,
        amount: BigInt(parsedInfo.tokenAmount.amount),
        decimals: parsedInfo.tokenAmount.decimals,
        isNative: parsedInfo.isNative === true,
      };
    })
    .filter((x): x is WalletTokenBalance => x !== null && x.amount > 0n);
}

export async function getRecentSignatures(
  address: string,
  limit = 20,
): Promise<{ signature: string; blockTime: number | null; err: unknown }[]> {
  const pubkey = new PublicKey(address);
  const sigs = await getConnection().getSignaturesForAddress(pubkey, { limit });
  return sigs.map((s) => ({
    signature: s.signature,
    blockTime: s.blockTime ?? null,
    err: s.err,
  }));
}

export function isValidAddress(address: string): boolean {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return false;
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}