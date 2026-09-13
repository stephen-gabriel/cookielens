import { describe, expect, it } from "vitest";

import { formatCompact, formatPct, formatUsd, truncateAddress } from "@/lib/format";
import { fmtAmount, short } from "@/lib/indexer-format";

describe("truncateAddress", () => {
  it("truncates long addresses", () => {
    expect(truncateAddress("36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1", 4)).toBe(
      "36Zr...m9e1",
    );
  });

  it("leaves short addresses untouched", () => {
    expect(truncateAddress("abc")).toBe("abc");
  });

  it("uses the requested width", () => {
    expect(truncateAddress("36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1", 8)).toBe(
      "36ZrtQoa...cuVfm9e1",
    );
  });
});

describe("formatUsd", () => {
  it("renders dashes for missing values", () => {
    expect(formatUsd(null)).toBe("—");
    expect(formatUsd(undefined)).toBe("—");
    expect(formatUsd(Number.NaN)).toBe("—");
  });

  it("renders small values with precision", () => {
    expect(formatUsd(0.00123)).toBe("$0.00123");
  });
});

describe("formatCompact", () => {
  it("compacts large numbers", () => {
    expect(formatCompact(1_450_000)).toBe("1.45M");
    expect(formatCompact(2_100_000_000)).toBe("2.10B");
  });

  it("passes through small numbers", () => {
    expect(formatCompact(248)).toBe("248");
  });
});

describe("formatPct", () => {
  it("adds a sign", () => {
    expect(formatPct(12.5)).toBe("+12.50%");
    expect(formatPct(-3.1)).toBe("-3.10%");
  });

  it("renders dashes for missing values", () => {
    expect(formatPct(null)).toBe("—");
  });
});

describe("indexer format helpers", () => {
  it("shorts a wallet like the indexer does", () => {
    expect(short("36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1")).toBe("36Zr...");
  });

  it("formats amounts without crashing on bad input", () => {
    expect(fmtAmount(1_000_000)).toBe("1,000,000");
    expect(fmtAmount(null)).toBe("0");
    expect(fmtAmount("not-a-number")).toBe("not-a-number");
  });
});