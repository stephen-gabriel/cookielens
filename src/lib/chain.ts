import { Connection, PublicKey } from "@solana/web3.js";
import { RPC_URL } from "@/lib/constants";

let connection: Connection | null = null;

export function getConnection(): Connection {
  if (!connection) connection = new Connection(RPC_URL, "confirmed");
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
  const { value } = await getConnection().getTokenAccountsByOwner(pubkey, {
    programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
  });

  return value
    .map(({ account }) => {
      const info =
        typeof account.data === "string"
          ? (JSON.parse(account.data).parsed?.info ?? null)
          : (account.data as { parsed?: { info?: unknown } }).parsed?.info ?? null;
      const anyInfo = info as { mint?: string; tokenAmount?: { amount: string; decimals: number }; isNative?: boolean } | null;
      if (!anyInfo?.mint || !anyInfo?.tokenAmount) return null;
      return {
        mint: anyInfo.mint,
        amount: BigInt(anyInfo.tokenAmount.amount),
        decimals: anyInfo.tokenAmount.decimals,
        isNative: anyInfo.isNative === true,
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