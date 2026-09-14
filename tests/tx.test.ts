import { describe, expect, it } from "vitest";
import { Transaction } from "@solana/web3.js";
import { extractSignedTransaction, extractSignature, toBytes } from "../src/lib/tx";

describe("tx parsing and extraction", () => {
  const dummyBytes = new Uint8Array([1, 2, 3, 4, 5]);

  it("extracts bare Uint8Array signed transaction", () => {
    const res = extractSignedTransaction(dummyBytes);
    expect(res).toBe(dummyBytes);
    expect(toBytes(res!)).toEqual(dummyBytes);
  });

  it("extracts Nightly nested v1 format: [{ signedTransaction: Uint8Array }]", () => {
    const raw = [{ signedTransaction: dummyBytes }];
    const res = extractSignedTransaction(raw);
    expect(res).toBe(dummyBytes);
    expect(toBytes(res!)).toEqual(dummyBytes);
  });

  it("extracts standard array format: [Uint8Array]", () => {
    const raw = [dummyBytes];
    const res = extractSignedTransaction(raw);
    expect(res).toBe(dummyBytes);
    expect(toBytes(res!)).toEqual(dummyBytes);
  });

  it("extracts object format: { signedTransaction: Uint8Array }", () => {
    const raw = { signedTransaction: dummyBytes };
    const res = extractSignedTransaction(raw);
    expect(res).toBe(dummyBytes);
    expect(toBytes(res!)).toEqual(dummyBytes);
  });

  it("extracts v0 array format: { signedTransactions: [Uint8Array] }", () => {
    const raw = { signedTransactions: [dummyBytes] };
    const res = extractSignedTransaction(raw);
    expect(res).toBe(dummyBytes);
    expect(toBytes(res!)).toEqual(dummyBytes);
  });

  it("extracts Transaction instance", () => {
    const tx = new Transaction();
    const res = extractSignedTransaction(tx);
    expect(res).toBe(tx);
  });

  it("returns undefined for invalid inputs", () => {
    expect(extractSignedTransaction(null)).toBeUndefined();
    expect(extractSignedTransaction(undefined)).toBeUndefined();
    expect(extractSignedTransaction({})).toBeUndefined();
    expect(extractSignedTransaction([])).toBeUndefined();
    expect(extractSignedTransaction("invalid")).toBeUndefined();
  });

  it("extracts string signature", () => {
    const sig = "5K...abc";
    expect(extractSignature(sig)).toBe(sig);
    expect(extractSignature([sig])).toBe(sig);
    expect(extractSignature([{ signature: sig }])).toBe(sig);
    expect(extractSignature({ signature: sig })).toBe(sig);
  });

  it("extracts Uint8Array signature", () => {
    const sigBytes = new Uint8Array(64);
    expect(extractSignature(sigBytes)).toBe(sigBytes);
    expect(extractSignature([sigBytes])).toBe(sigBytes);
    expect(extractSignature([{ signature: sigBytes }])).toBe(sigBytes);
  });
});
