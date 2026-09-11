"use client";

import type { WalletAccount } from "@wallet-standard/base";
import type { StandardConnectFeature, StandardDisconnectFeature } from "@wallet-standard/features";
import { StandardConnect, StandardDisconnect } from "@wallet-standard/features";
import type { UiWallet } from "@wallet-standard/ui";
import { getWalletFeature } from "@wallet-standard/ui";
import { useWallets } from "@wallet-standard/react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

export interface WalletContextValue {
  wallets: readonly UiWallet[];
  connectedWallet: UiWallet | null;
  account: WalletAccount | null;
  connecting: boolean;
  connect: (wallet: UiWallet) => Promise<void>;
  disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const wallets = useWallets();
  const [connectedWallet, setConnectedWallet] = useState<UiWallet | null>(null);
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(
    async (wallet: UiWallet) => {
      if (connecting || connectedWallet) return;
      setConnecting(true);
      try {
        const feature = getWalletFeature(wallet, StandardConnect) as StandardConnectFeature[typeof StandardConnect];
        const { accounts } = await feature.connect({ silent: false });
        setAccount(accounts[0] ?? null);
        setConnectedWallet(wallet);
      } finally {
        setConnecting(false);
      }
    },
    [connecting, connectedWallet],
  );

  const disconnect = useCallback(async () => {
    if (!connectedWallet) return;
    const feature = getWalletFeature(connectedWallet, StandardDisconnect) as StandardDisconnectFeature[typeof StandardDisconnect];
    try {
      await feature.disconnect();
    } finally {
      setAccount(null);
      setConnectedWallet(null);
    }
  }, [connectedWallet]);

  const value = useMemo<WalletContextValue>(
    () => ({ wallets, connectedWallet, account, connecting, connect, disconnect }),
    [wallets, connectedWallet, account, connecting, connect, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}