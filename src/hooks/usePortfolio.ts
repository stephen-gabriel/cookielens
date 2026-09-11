"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getNativeBalance, getTokenBalances, getRecentSignatures, type WalletTokenBalance } from "@/lib/chain";
import { getAssetsByOwner, getAsset, type DasAsset } from "@/lib/das";
import { getCookUsdPrice } from "@/lib/pricing";
import { COOK_MINT } from "@/lib/constants";

export type Holding = {
  mint: string;
  symbol: string;
  name: string;
  image: string | null;
  amount: number;
  decimals: number;
  isCook: boolean;
  priceUsd: number | null;
  valueUsd: number | null;
};

export type Portfolio = {
  address: string;
  cookBalance: number;
  cookUsdValue: number;
  tokenHoldings: Holding[];
  totalUsd: number;
  lastActivity: number | null;
};

export type PortfolioState = {
  data: Portfolio | null;
  loading: boolean;
  error: string | null;
};

export function usePortfolio(address: string | null) {
  const [state, setState] = useState<PortfolioState>({ data: null, loading: !!address, error: null });
  const [nonce, setNonce] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    if (!address) return;

    const id = ++requestId.current;

    (async () => {
      try {
        const [nativeLamports, tokenBalances, cookPrice, assetInfo, signatures] = await Promise.all([
          getNativeBalance(address),
          getTokenBalances(address),
          getCookUsdPrice(),
          getAssetsByOwner(address, 500),
          getRecentSignatures(address, 5).catch(() => []),
        ]);

        if (requestId.current !== id) return;

        const cookBalance = Number(nativeLamports) / 1e9;

        const assetByMint = new Map<string, DasAsset>();
        for (const a of assetInfo) {
          if (a.interface === "FungibleToken" || a.token_info) assetByMint.set(a.id, a);
        }

        const holdings: Holding[] = [];

        for (const tb of tokenBalances as WalletTokenBalance[]) {
          const isCook = tb.mint === COOK_MINT;
          const asset = assetByMint.get(tb.mint) ?? (await getAsset(tb.mint) ?? undefined);
          const symbol = asset?.content.metadata.symbol ?? tb.mint.slice(0, 4).toUpperCase();
          const name = asset?.content.metadata.name ?? tb.mint;
          const image = asset?.content.links?.image ?? asset?.content.files?.[0]?.uri ?? null;
          const amount = Number(tb.amount) / 10 ** tb.decimals;

          let priceUsd: number | null = null;
          if (isCook) {
            priceUsd = cookPrice;
          } else if (asset?.token_info?.price_info?.price_per_token) {
            priceUsd = asset.token_info.price_info.price_per_token;
          }

          holdings.push({
            mint: tb.mint,
            symbol,
            name,
            image,
            amount,
            decimals: tb.decimals,
            isCook,
            priceUsd,
            valueUsd: priceUsd !== null ? priceUsd * amount : null,
          });
        }

        // Ensure COOK itself shows even with zero SPL token account (it's native).
        const hasCook = holdings.some((h) => h.isCook);
        if (!hasCook) {
          holdings.unshift({
            mint: COOK_MINT,
            symbol: "COOK",
            name: "Cookie",
            image: null,
            amount: cookBalance,
            decimals: 9,
            isCook: true,
            priceUsd: cookPrice,
            valueUsd: cookPrice !== null ? cookPrice * cookBalance : null,
          });
        }

        const totalUsd = holdings.reduce((sum, h) => sum + (h.valueUsd ?? 0), 0);
        const lastActivity =
          signatures.find((s) => s.blockTime)?.blockTime ?? null;

        setState({
          data: {
            address,
            cookBalance,
            cookUsdValue: cookPrice !== null ? cookPrice * cookBalance : 0,
            tokenHoldings: holdings,
            totalUsd,
            lastActivity,
          },
          loading: false,
          error: null,
        });
      } catch (err) {
        if (requestId.current !== id) return;
        setState({ data: null, loading: false, error: err instanceof Error ? err.message : "Failed to load portfolio" });
      }
    })();
  }, [address, nonce]);

  const refresh = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    setNonce((n) => n + 1);
  }, []);

  return { ...state, refresh };
}