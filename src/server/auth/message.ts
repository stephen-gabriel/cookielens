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

/**
 * Verify the Ed25519 signature. Some wallets (e.g. Nightly) sign a slightly
 * transformed copy of the message; when they report the exact bytes they
 * signed via `signedMessage`, we verify against those bytes and additionally
 * require the payload to contain the fresh nonce and claimed wallet so a
 * replay of an unrelated signature cannot pass.
 */
export function verifySignedMessage(
  message: string,
  publicKey: string,
  signature: string,
  signedMessageBase64?: string,
): boolean {
  const pub = Buffer.from(new PublicKey(publicKey).toBytes());
  let sig: Uint8Array;
  try {
    sig = bs58.decode(signature);
  } catch {
    return false;
  }
  const plain = Buffer.from(message, "utf8");
  if (tryVerify(pub, sig, plain)) return true;
  if (!signedMessageBase64) return false;

  let signed: Buffer;
  try {
    signed = Buffer.from(signedMessageBase64, "base64");
  } catch {
    return false;
  }
  if (!tryVerify(pub, sig, signed)) return false;

  const nonce = message.slice(message.indexOf("Nonce: ") + 7) || "";
  const text = signed.toString("utf8");
  if (!nonce || !text.includes(nonce) || !text.includes(publicKey)) return false;
  return true;
}

function tryVerify(pub: Uint8Array, sig: Uint8Array, data: Uint8Array): boolean {
  try {
    return verify(null, data, Buffer.from(pub), sig) === true;
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[auth] verify errored: ${(err as Error).message}`);
    }
    return false;
  }
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;
const RESERVED_USERNAMES = ["admin", "staff", "support", "cookie", "cook", "token", "mod"];

export function isValidUsername(username: string): boolean {
  if (!USERNAME_RE.test(username)) return false;
  return !RESERVED_USERNAMES.includes(username.toLowerCase());
}