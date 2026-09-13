export function pumpSignificance(holders: number, pct: number): number {
  if (holders < 50) return pct;
  return Math.max(0, pct - 50);
}

export function shouldEmitConvergence(distinctWallets: number): boolean {
  return distinctWallets >= 4;
}

export function communitySignificance(distinctWallets: number, verifiedWallets: number): number {
  return 60 + distinctWallets * 12 + verifiedWallets * 10;
}