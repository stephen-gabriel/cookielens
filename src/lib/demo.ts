"use client";

import bs58 from "bs58";
import nacl from "tweetnacl";
import { Keypair } from "@solana/web3.js";

const STORAGE_KEY = "cookielens:demoKey";

const signDetached = nacl.sign.detached as unknown as (msg: Uint8Array, sk: Uint8Array) => Uint8Array;

function loadStoredKey(): Keypair | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/**
 * Demo wallet: a real Ed25519 keypair generated in the browser and persisted
 * to localStorage. Used to sign the claim challenge locally (raw ed25519 via
 * tweetnacl detached) so the full profile / follow / watch flow can be
 * exercised without a wallet app.
 */
export function getDemoKeypair(): Keypair {
  const existing = loadStoredKey();
  if (existing) return existing;
  const kp = Keypair.generate();
  try {
    window.localStorage.setItem(STORAGE_KEY, bs58.encode(kp.secretKey));
  } catch {
    // Storage unavailable — keypair still works for this session.
  }
  return kp;
}

export function demoAddress(): string {
  return getDemoKeypair().publicKey.toBase58();
}

export function clearDemoKeypair(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function signChallengeMessage(message: string): { signature: string; signedMessage: string } {
  const kp = getDemoKeypair();
  const messageBytes = new TextEncoder().encode(message);
  const signatureBytes = signDetached(messageBytes, kp.secretKey);
  return {
    signature: bs58.encode(signatureBytes),
    signedMessage: bytesToBase64(messageBytes),
  };
}