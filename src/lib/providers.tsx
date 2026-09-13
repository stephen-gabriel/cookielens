"use client";

import type { WalletAccount } from "@wallet-standard/base";
import type { StandardConnectFeature, StandardDisconnectFeature } from "@wallet-standard/features";
import { StandardConnect, StandardDisconnect } from "@wallet-standard/features";
import type { UiWallet } from "@wallet-standard/ui";
import { getWalletFeature } from "@wallet-standard/ui";
import { useWallets } from "@wallet-standard/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { switchNightlyNetwork } from "@/lib/nightly";

const CONNECT_TIMEOUT_MS = 60_000;

function isMobileUA(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent);
}

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
  const [manuallyDisconnected, setManuallyDisconnected] = useState(false);

  const connect = useCallback(
    async (wallet: UiWallet) => {
      if (connecting || connectedWallet) return;
      setConnecting(true);
      try {
        if (wallet.name.toLowerCase().includes("nightly") && !isMobileUA()) {
          try {
            await switchNightlyNetwork();
          } catch {
            // User rejected the network switch prompt.
          }
        }
        const feature = getWalletFeature(wallet, StandardConnect) as StandardConnectFeature[typeof StandardConnect];
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error("No approval received from Nightly. Keep this tab open, confirm the approve dialog, and try again."));
          }, CONNECT_TIMEOUT_MS);
        });
        try {
          const { accounts } = await Promise.race([feature.connect({ silent: false }), timeout]);
          setAccount(accounts[0] ?? null);
          setConnectedWallet(wallet);
          setManuallyDisconnected(false);
        } finally {
          if (timer) clearTimeout(timer);
        }
      } finally {
        setConnecting(false);
      }
    },
    [connecting, connectedWallet],
  );

  // Restore a previously-authorized wallet on page load (extensions re-register
  // with their existing accounts after refresh).
  useEffect(() => {
    if (connectedWallet || connecting || manuallyDisconnected) return;
    const restored = wallets.find((w) => w.accounts && w.accounts.length > 0);
    if (restored) {
      const [restoredAccount] = restored.accounts;
      queueMicrotask(() => {
        if (!connectedWallet) {
          setAccount(restoredAccount);
          setConnectedWallet(restored);
        }
      });
    }
  }, [wallets, connectedWallet, connecting, manuallyDisconnected]);

  const disconnect = useCallback(async () => {
    if (!connectedWallet) return;
    try {
      if (connectedWallet.features.includes(StandardDisconnect)) {
        const feature = getWalletFeature(connectedWallet, StandardDisconnect) as StandardDisconnectFeature[typeof StandardDisconnect];
        await feature.disconnect();
      }
    } finally {
      setAccount(null);
      setConnectedWallet(null);
      setManuallyDisconnected(true);
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