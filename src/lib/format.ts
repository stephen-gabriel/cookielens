export function truncateAddress(address: string, chars = 4): string {
  if (!address) return "";
  if (address.length <= chars * 2 + 1) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatLamports(lamports: number): string {
  const value = lamports / 1e9;
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}