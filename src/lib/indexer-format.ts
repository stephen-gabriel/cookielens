export function short(wallet: string): string {
  return `${wallet.slice(0, 4)}...`;
}

export function fmtAmount(amount: unknown): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}