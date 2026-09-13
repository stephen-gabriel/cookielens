import { randomBytes } from "node:crypto";

import bs58 from "bs58";
import nacl from "tweetnacl";
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

const SIGNER_CHAIN = process.env.NEXT_PUBLIC_WALLET_STANDARD_CHAIN ?? "solana:mainnet";

/**
 * Verify the Ed25519 signature over `data`. Wallets occasionally emit the
 * signature halves in the reverse order (S||R vs the canonical R||S), so both
 * orders are tried.
 */
function ed25519Check(data: Uint8Array, sig: Uint8Array, pub: Uint8Array): boolean {
  if (sig.length !== 64) return false;
  if (nacl.sign.detached.verify(data, sig, pub)) return true;
  const swapped = new Uint8Array([...sig.subarray(32), ...sig.subarray(0, 32)]);
  return swapped.length === 64 && nacl.sign.detached.verify(data, swapped, pub);
}

/**
 * Verify a claim signature. Primary path: reproduce the challenge message and
 * verify (handles straight Ed25519). Nightly & friends may sign a slightly
 * transformed copy; when the wallet reports the exact bytes it signed via
 * `signedMessage`, we verify against those bytes too and require the payload
 * to contain the fresh nonce and the claimed wallet so a replay of an
 * unrelated signature cannot pass.
 */
export function verifySignedMessage(
  message: string,
  publicKey: string,
  signature: string,
  signedMessageBase64?: string,
): boolean {
  let sig: Uint8Array;
  try {
    sig = bs58.decode(signature);
  } catch {
    return false;
  }
  let pub: Uint8Array;
  try {
    pub = new Uint8Array(new PublicKey(publicKey).toBytes());
  } catch {
    return false;
  }
  const plain = new TextEncoder().encode(message);

  const candidates: Array<{ name: string; data: Uint8Array }> = [
    { name: "plain", data: plain },
    { name: "chain+plain", data: new TextEncoder().encode(`${SIGNER_CHAIN}${message}`) },
    { name: "plain+chain", data: new TextEncoder().encode(`${message}${SIGNER_CHAIN}`) },
  ];

  for (const { data } of candidates) {
    if (ed25519Check(data, sig, pub)) {
      logVerified();
      return true;
    }
  }

  if (signedMessageBase64) {
    let signed: Uint8Array | null = null;
    try {
      signed = new Uint8Array(Buffer.from(signedMessageBase64, "base64"));
    } catch {
      signed = null;
    }
    const nonce = message.slice(message.indexOf("Nonce: ") + 7) || "";
    if (signed) {
      const ok = ed25519Check(signed, sig, pub);
      const text = new TextDecoder().decode(signed);
      const bound = nonce && text.includes(nonce) && text.includes(publicKey);
      if (ok && bound) {
        logVerified();
        return true;
      }
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[auth] signedMessage path: ok=${ok} bound=${!!bound} bytes=${signed.length} sample=${JSON.stringify(text.slice(0, 160))}`,
        );
      }
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.warn(`[auth] verify failed: sigLen=${sig.length} tried=${candidates.map((c) => c.name).join(",")}${signedMessageBase64 ? ",signedMessage" : ""}`);
  }
  return false;
}

function logVerified(): void {
  if (process.env.NODE_ENV === "development") {
    console.warn("[auth] signature verified");
  }
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;
const RESERVED_USERNAMES = ["admin", "staff", "support", "cookie", "cook", "token", "mod"];

export function isValidUsername(username: string): boolean {
  if (!USERNAME_RE.test(username)) return false;
  return !RESERVED_USERNAMES.includes(username.toLowerCase());
}