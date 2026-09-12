import { randomBytes, verify } from "node:crypto";

import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";

/**
 * Canonical, deterministic message a user signs to claim a wallet
 * (FRD §19). The wallet signs exactly these UTF-8 bytes via
 * `solana:signMessage`; the API reproduces the string and verifies the
 * Ed25519 signature server-side.
 */
export function challengeMessage(wallet: string, nonce: string): string {
  return [
    "CookieLens",
    "Sign to claim this wallet on Cookie Chain.",
    "",
    `Wallet: ${wallet}`,
    `Nonce: ${nonce}`,
  ].join("\n");
}

export function deriveNonce(): string {
  return randomBytes(32).toString("hex");
}

export function verifySignedMessage(
  message: string,
  publicKey: string,
  signature: string,
): boolean {
  try {
    const pub = Buffer.from(new PublicKey(publicKey).toBytes());
    const sig = bs58.decode(signature);
    return verify(null, Buffer.from(message, "utf8"), pub, sig);
  } catch {
    return false;
  }
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;
const RESERVED_USERNAMES = ["admin", "staff", "support", "cookie", "cook", "token", "mod"];

export function isValidUsername(username: string): boolean {
  if (!USERNAME_RE.test(username)) return false;
  return !RESERVED_USERNAMES.includes(username.toLowerCase());
}