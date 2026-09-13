"use client";

import Link from "next/link";
import { useWallet } from "@/lib/providers";
import { truncateAddress } from "@/lib/format";
import { Loader2, LogOut } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from "@/components/auth/AuthProvider";
import { DemoClaim } from "@/components/auth/DemoClaim";

export function WalletButton() {
  const { wallets, connectedWallet, account, connecting, connect, disconnect } = useWallet();
  const { me, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const handleConnect = async (wallet: (typeof wallets)[number]) => {
    setOpen(false);
    try {
      await connect(wallet);
      toast.success(`Connected ${wallet.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    }
  };

  if (me) {
    return (
      <div className="flex items-center gap-2 sm:gap-3">
        <Link href="/profile" className="max-w-40 truncate text-xs font-semibold text-primary sm:text-sm">
          @{me.username}
        </Link>
        <button
          onClick={async () => {
            try {
              if (connectedWallet) await disconnect();
              await logout();
              toast.success("Signed out.");
            } catch {
              toast.error("Sign out failed.");
            }
          }}
          className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-text-secondary transition hover:border-error/50 hover:text-error sm:px-3 sm:py-2 sm:text-sm"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    );
  }

  if (connectedWallet && account) {
    return (
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="font-mono text-xs text-text-secondary sm:text-sm">{truncateAddress(account.address)}</span>
        <button
          onClick={async () => {
            try {
              await disconnect();
              toast.success("Disconnected");
            } catch {
              toast.error("Disconnect failed.");
            }
          }}
          className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-text-secondary transition hover:border-error/50 hover:text-error sm:px-3 sm:py-2 sm:text-sm"
        >
          <LogOut className="h-4 w-4" />
          Disconnect
        </button>
      </div>
    );
  }

  const uniqueWallets = wallets.filter(
    (w, i) => wallets.findIndex((x) => x.name === w.name) === i,
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={connecting}
        className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-background transition hover:bg-primary/90 disabled:opacity-60 sm:px-4 sm:py-2 sm:text-sm"
      >
        {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect Nightly"}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-20 w-72 rounded-lg border border-border bg-surface p-2 shadow-xl">
            {uniqueWallets.length > 0 &&
              uniqueWallets.map((wallet) => (
                <button
                  key={wallet.name}
                  onClick={() => handleConnect(wallet)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-text-primary transition hover:bg-surface-hover"
                >
                  {wallet.icon && (
                    <img src={wallet.icon} alt={wallet.name} className="h-6 w-6 rounded" />
                  )}
                  <span className="font-medium">{wallet.name}</span>
                </button>
              ))}

            {uniqueWallets.length === 0 && (
              <p className="px-3 pb-2 pt-1 text-xs leading-relaxed text-text-secondary">
                On mobile, open this site inside the{" "}
                <span className="font-semibold text-text-primary">Nightly app browser</span>{" "}
                (Nightly → Browser → cookielens.vercel.app) to connect. Or use the web extension on desktop.
              </p>
            )}

            <div className="my-1 border-t border-border" />
            <div className="p-1">
              <DemoClaim compact />
            </div>
          </div>
        </>
      )}
    </div>
  );
}