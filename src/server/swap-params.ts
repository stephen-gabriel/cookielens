import { PublicKey } from "@solana/web3.js";

export interface SwapParams {
  inputMint: string;
  outputMint: string;
  amount: string;
  inputDecimals: number;
  outputDecimals: number;
  slippageBps: number;
  owner: string | null;
}

export type ParseResult = SwapParams | { error: string };

function asPositiveInt(value: string | null, name: string, min: number, max: number, fallback: number): number {
  if (value === null || value === "") return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`"${name}" must be between ${min} and ${max}.`);
  return n;
}

function asAddress(value: string | null, name: string): string | null {
  if (value === null || value === "") return null;
  try {
    const pk = new PublicKey(value as string);
    return pk.toBase58();
  } catch {
    throw new Error(`"${name}" is not a valid Cookie Chain address.`);
  }
}

export function parseSwapParams(
  sp: URLSearchParams,
  opts: { requireOwner: boolean },
): ParseResult {
  try {
    const inputMint = asAddress(sp.get("inputMint"), "inputMint");
    const outputMint = asAddress(sp.get("outputMint"), "outputMint");
    const owner = asAddress(sp.get("owner"), "owner");

    if (!inputMint || !outputMint) return { error: "inputMint and outputMint are required." };
    if (inputMint === outputMint) return { error: "inputMint and outputMint must differ." };
    if (opts.requireOwner && !owner) return { error: "A connected wallet (owner) is required." };

    const amount = (sp.get("amount") ?? "").trim();
    if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) {
      return { error: "A valid amount greater than 0 is required." };
    }

    return {
      inputMint,
      outputMint,
      amount,
      inputDecimals: asPositiveInt(sp.get("inputDecimals"), "inputDecimals", 0, 19, 9),
      outputDecimals: asPositiveInt(sp.get("outputDecimals"), "outputDecimals", 0, 19, 9),
      slippageBps: asPositiveInt(sp.get("slippageBps"), "slippageBps", 10, 5000, 300),
      owner,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invalid swap parameters." };
  }
}