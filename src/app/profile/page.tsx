"use client";

import Link from "next/link";
import { BadgeCheck, LogOut, Send, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/components/auth/AuthProvider";
import { WalletClaim } from "@/components/auth/WalletClaim";
import { DemoClaim } from "@/components/auth/DemoClaim";
import { useWallet } from "@/lib/providers";
import { truncateAddress } from "@/lib/format";

type MeProfile = {
  wallet: {
    address: string;
    verified: boolean;
    username: string | null;
    claimedAt: string | null;
    firstObservedAt: string | null;
    txCount: number;
    tokenInteractions: number;
    followers: number;
    following: number;
  };
  isFollowing: boolean;
  recentActivity: unknown[];
};

export default function ProfilePage() {
  const { account, connectedWallet } = useWallet();
  const { me, loading, logout } = useAuth();
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const address = account?.address ?? me?.wallet;
    if (!address) return;
    let cancelled = false;
    fetch(`/api/profile/${encodeURIComponent(address)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { ok?: boolean; wallet?: MeProfile["wallet"] }) => {
        if (!cancelled && data.ok && data.wallet) {
          setProfile({ wallet: data.wallet, isFollowing: false, recentActivity: [] });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [account, me]);

  if (loading) {
    return (
      <div className="h-24 animate-pulse rounded-lg bg-surface-hover" />
    );
  }

  if (!connectedWallet || !account) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <UserRound className="mx-auto h-8 w-8 text-text-secondary" />
        <h1 className="mt-3 text-lg font-bold">Profile</h1>
        <div className="mx-auto mt-4 max-w-md text-left">
          <p className="mb-3 text-sm text-text-secondary">
            Connect your Nightly wallet to claim a profile on Cookie Chain — or jump straight in with demo mode.
          </p>
          <DemoClaim />
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold">Claim your wallet</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Your address is <span className="font-mono">{truncateAddress(account.address, 6)}</span>. Sign a message to prove
            ownership and pick a username.
          </p>
        </div>
        <WalletClaim surface="page" />
        {profile && !profile.wallet.verified && (
          <p className="text-xs text-text-secondary">
            Note: this address has no observable on-chain activity yet — profiles can be claimed even before the
            indexer has seen a transaction.
          </p>
        )}
      </div>
    );
  }

  const doLogout = async () => {
    setBusy(true);
    await logout();
    toast.success("Signed out.");
    setBusy(false);
  };

  const p = profile?.wallet;

  return (
    <div className="space-y-4">
      <header className="rounded-lg border border-border bg-surface p-5">
        <div className="flex items-center gap-2">
          <BadgeCheck className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">@{me.username}</h1>
        </div>
        <p className="mt-1 break-all font-mono text-xs text-text-secondary">{me.wallet}</p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Followers" value={p?.followers ?? 0} />
          <Stat label="Following" value={p?.following ?? 0} />
          <Stat label="Observable tx" value={p?.txCount ?? 0} />
          <Stat label="Token touches" value={p?.tokenInteractions ?? 0} />
        </div>
      </header>

      <div className="grid gap-3">
        <Link
          href="/portfolio"
          className="flex items-center justify-between rounded-lg border border-border bg-surface p-4 transition hover:border-primary/40"
        >
          <span className="flex items-center gap-3">
            <Send className="h-5 w-5 text-primary" />
            <span>
              <span className="block text-sm font-semibold">My portfolio &amp; Send COOK</span>
              <span className="block text-xs text-text-secondary">Balances, prices, transfers.</span>
            </span>
          </span>
          <span className="text-text-secondary">→</span>
        </Link>
        <Link
          href={`/wallets/${me.wallet}`}
          className="flex items-center justify-between rounded-lg border border-border bg-surface p-4 transition hover:border-primary/40"
        >
          <span className="flex items-center gap-3">
            <UserRound className="h-5 w-5 text-secondary" />
            <span>
              <span className="block text-sm font-semibold">View my public wallet page</span>
              <span className="block text-xs text-text-secondary">Activity and follows from a wallet view.</span>
            </span>
          </span>
          <span className="text-text-secondary">→</span>
        </Link>
      </div>

      <button
        onClick={doLogout}
        disabled={busy}
        className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-text-secondary transition hover:border-error/50 hover:text-error"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-surface p-2.5">
      <div className="truncate font-mono text-lg font-bold">{value.toLocaleString()}</div>
      <div className="text-[11px] uppercase tracking-wide text-text-secondary">{label}</div>
    </div>
  );
}