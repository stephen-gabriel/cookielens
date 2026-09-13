import { describe, expect, it } from "vitest";

import {
  communitySignificance,
  pumpSignificance,
  shouldEmitConvergence,
} from "@/lib/significance";

describe("pumpSignificance", () => {
  it("keeps hot moves significant with few holders", () => {
    expect(pumpSignificance(20, 95)).toBe(95);
    expect(pumpSignificance(49, 80)).toBe(80);
  });

  it("dampens hype once a token has many holders", () => {
    expect(pumpSignificance(100, 95)).toBe(45);
    expect(pumpSignificance(500, 60)).toBe(10);
  });

  it("never returns negative", () => {
    expect(pumpSignificance(500, 20)).toBe(0);
  });
});

describe("shouldEmitConvergence", () => {
  it("requires at least four distinct wallets", () => {
    expect(shouldEmitConvergence(3)).toBe(false);
    expect(shouldEmitConvergence(4)).toBe(true);
    expect(shouldEmitConvergence(12)).toBe(true);
  });
});

describe("communitySignificance", () => {
  it("scales with distinct wallets and verified wallets", () => {
    expect(communitySignificance(4, 0)).toBe(108);
    expect(communitySignificance(10, 3)).toBe(60 + 120 + 30);
  });
});