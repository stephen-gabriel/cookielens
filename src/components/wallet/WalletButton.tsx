"use client";

import { useWallet } from "@/lib/providers";
import { truncateAddress } from "@/lib/format";
import { Loader2, LogOut } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";

export function WalletButton() {
  const { wallets, connectedWallet, account, connecting, connect, disconnect } = useWallet();
  const [open, setOpen] = useState(false);

  const nightlyWallets = wallets.filter((w) => w.name.toLowerCase().includes("nightly"));
  const connectTarget = nightlyWallets.find((w) => "standard:connect" in w.features) ?? nightlyWallets[0];

  if (connectedWallet && account) {
    return (
<div className="flex items-center gap-2 sm:gap-3">
      <span className="font-mono text-xs text-text-secondary sm:text-sm">{truncateAddress(account.address)}</span>
      <button
        onClick={async () => {
          await disconnect();
          toast.success("Disconnected");
        }}
        className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-text-secondary transition hover:border-error/50 hover:text-error sm:px-3 sm:py-2 sm:text-sm"
      >
        <LogOut className="h-4 w-4" />
        Disconnect
      </button>
    </div>
    );
  }

  const handleConnect = async (wallet: (typeof wallets)[number]) => {
    setOpen(false);
    try {
      await connect(wallet);
      toast.success(`Connected ${wallet.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    }
  };

  const uniqueWallets = wallets.filter(
    (w, i) => wallets.findIndex((x) => x.name === w.name) === i,
  );

  return (
    <div className="relative">
      <button
        onClick={() => {
          if (connectTarget) {
            handleConnect(connectTarget);
          } else {
            setOpen(!open);
          }
        }}
        disabled={connecting}
        className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-background transition hover:bg-primary/90 disabled:opacity-60 sm:px-4 sm:py-2 sm:text-sm"
      >
        {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect Nightly"}
      </button>

      {open && uniqueWallets.length > 0 && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-20 w-64 rounded-lg border border-border bg-surface p-2 shadow-xl">
            {uniqueWallets.map((wallet) => (
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
          </div>
        </>
      )}

      {open && uniqueWallets.length === 0 && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-20 w-72 rounded-lg border border-border bg-surface p-4 shadow-xl">
            <p className="text-sm text-text-primary">
              No wallet found. Install{" "}
              <a
                href="https://nightly.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Nightly
              </a>{" "}
              to track your on-chain portfolio on Cookie Chain.
            </p>
          </div>
        </>
      )}
    </div>
  );
}