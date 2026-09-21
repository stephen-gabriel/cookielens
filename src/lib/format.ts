export function toRawAmount(amount: string | number | bigint, decimals: number): bigint {
  const s = typeof amount === "bigint" ? amount.toString() : String(amount).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`Invalid amount "${s}"`);
  const [intPart = "0", fracPart = ""] = s.split(".");
  const frac = (fracPart || "").slice(0, decimals).padEnd(decimals, "0");
  return BigInt(intPart) * BigInt(10 ** decimals) + BigInt(frac || "0");
}

export function fromRawAmount(raw: bigint, decimals: number): string {
  const neg = raw < 0n;
  const abs = neg ? -raw : raw;
  const s = abs.toString().padStart(decimals + 1, "0");
  const intPart = s.length > decimals ? s.slice(0, s.length - decimals) : "0";
  const fracPart = s.length > decimals ? s.slice(s.length - decimals) : s.padStart(decimals, "0");
  const out = `${intPart}.${fracPart}`;
  return neg ? `-${out}` : out;
}

export function truncateAddress(address: string, chars = 4): string {
  if (!address) return "";
  if (address.length <= chars * 2 + 1) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatNative(lamports: number | bigint, decimals = 9): string {
  const value = Number(lamports) / 10 ** decimals;
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (value === 0) return "$0.00";
  if (Math.abs(value) >= 100) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (Math.abs(value) >= 1) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (Math.abs(value) >= 0.01) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;

  const s = value.toFixed(20);
  const decimalPart = s.split(".")[1] || "";
  const zerosMatch = decimalPart.match(/^(0+)/);
  const zeroCount = zerosMatch ? zerosMatch[1].length : 0;

  if (zeroCount >= 3) {
    const rawSig = decimalPart.slice(zeroCount, zeroCount + 5);
    const sigDigits = rawSig.replace(/0+$/, "").slice(0, 3) || rawSig.slice(0, 3);
    const subscriptZeros = zeroCount
      .toString()
      .split("")
      .map((d) => ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"][Number(d)] ?? d)
      .join("");
    return `$0.0₍${subscriptZeros}₎${sigDigits}`;
  }

  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
}

export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function timeAgo(ts: number): string {
  if (!ts) return "—";
  const diff = Math.max(0, Date.now() / 1000 - ts);
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}