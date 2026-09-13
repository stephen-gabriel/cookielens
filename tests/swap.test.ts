import { describe, expect, it } from "vitest";

import { parseSwapParams } from "@/server/swap-params";

const COOK = "So11111111111111111111111111111111111111112";
const TOKEN = "7Up3XmdDXkMvQneBaDat3gSnM9j7bJZam7jzCJ3mBCBk";
const WALLET = "36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1";

function sp(inputMint: string, outputMint: string, extra?: Record<string, string>): URLSearchParams {
  const p = new URLSearchParams({
    inputMint,
    outputMint,
    amount: "1.5",
    inputDecimals: "9",
    outputDecimals: "9",
    slippageBps: "100",
    owner: WALLET,
  });
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v === "") p.delete(k);
      else p.set(k, v);
    }
  }
  return p;
}

describe("parseSwapParams", () => {
  it("parses a valid buy swap", () => {
    const r = parseSwapParams(sp(COOK, TOKEN), { requireOwner: true });
    expect("error" in r ? r.error : null).toBeNull();
    if ("error" in r) return;
    expect(r.inputMint).toBe(COOK);
    expect(r.outputMint).toBe(TOKEN);
    expect(r.amount).toBe("1.5");
    expect(r.outputDecimals).toBe(9);
    expect(r.owner).toBe(WALLET);
  });

  it("requires an owner for building", () => {
    const r = parseSwapParams(sp(COOK, TOKEN, { owner: "" }), { requireOwner: true });
    if (!("error" in r)) {
      expect.fail("expected an error for a missing owner");
    }
    expect(r.error).toMatch(/connected wallet/);
  });

  it("accepts a missing owner when optional", () => {
    const r = parseSwapParams(sp(COOK, TOKEN, { owner: "" }), { requireOwner: false });
    if ("error" in r) {
      expect.fail("expected success");
    }
    expect(r.owner).toBeNull();
  });

  it("rejects the same mint on both sides", () => {
    const r = parseSwapParams(sp(COOK, COOK), { requireOwner: false });
    if (!("error" in r)) {
      expect.fail("expected an error");
    }
    expect(r.error).toMatch(/must differ/);
  });

  it("rejects invalid addresses", () => {
    const r = parseSwapParams(sp("not-an-address", TOKEN), { requireOwner: false });
    if (!("error" in r)) {
      expect.fail("expected an error");
    }
    expect(r.error).toMatch(/not a valid/);
  });

  it("rejects zero or malformed amounts", () => {
    for (const bad of ["0", "-1", "abc", ""]) {
      const r = parseSwapParams(sp(COOK, TOKEN, { amount: bad }), { requireOwner: false });
      if (!("error" in r)) expect.fail(`expected error for amount "${bad}"`);
    }
  });

  it("clamps slippage to valid bounds", () => {
    const h = parseSwapParams(sp(COOK, TOKEN, { slippageBps: "99999" }), { requireOwner: false });
    if (!("error" in h)) {
      expect.fail("expected an error for oversized slippage");
    }
    expect(h.error).toMatch(/slippageBps/);
  });

  it("defaults decimals to 9", () => {
    const r = parseSwapParams(sp(COOK, TOKEN, { inputDecimals: "" }), { requireOwner: false });
    if ("error" in r) {
      expect.fail("expected success");
    }
    expect(r.inputDecimals).toBe(9);
  });
});