"use client";

import { useParams } from "next/navigation";
import { BadgeCheck, ExternalLink, Loader2, UserPlus, UserCheck } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import { WalletClaim } from "@/components/auth/WalletClaim";
import { BackButton } from "@/components/ui/BackButton";
import { useAuth } from "@/components/auth/AuthProvider";
import { useWallet } from "@/lib/providers";
import { truncateAddress } from "@/lib/format";
import { EXPLORER_URL } from "@/lib/constants";

type WalletProfile = {
  wallet: {
    address: string;
    verified: boolean;
    username: string | null;
    claimedAt: string | null;
    firstObservedAt: string | null;
    lastActivityAt: string | null;
    daysActive: number;
    txCount: number;
    tokenInteractions: number;
    followers: number;
    following: number;
  };
  isFollowing: boolean;
  recentActivity: {
    id: number;
    signature: string;
    type: string;
    amount: number | null;
    valueUsd: number | null;
    timestamp: string;
    slot: number | null;
    token: { mint: string; symbol: string | null; name: string | null } | null;
  }[];
};

export default function WalletProfilePage() {
  const params = useParams<{ address: string }>();
  const address = params?.address ?? "";
  const { account } = useWallet();
  const { me } = useAuth();
  const [profile, setProfile] = useState<WalletProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetch(`/api/profile/${encodeURIComponent(address)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { ok?: boolean; wallet?: WalletProfile["wallet"]; isFollowing?: boolean; recentActivity?: WalletProfile["recentActivity"]; error?: string }) => {
        if (!data.ok || !data.wallet) {
          setError(data.error ?? "Wallet not found.");
          return;
        }
        setProfile({
          wallet: data.wallet,
          isFollowing: data.isFollowing ?? false,
          recentActivity: data.recentActivity ?? [],
        });
        setError(null);
      })
      .catch(() => setError("Could not load this wallet."));
  };

  useEffect(load, [address]);

  const isSelf = account?.address === address;
  const signedIn = !!me;

  const toggleFollow = async () => {
    if (!profile || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/follow", {
        method: profile.isFollowing ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followeeWallet: address }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Follow failed.");
      toast.success(profile.isFollowing ? "Unfollowed." : "Following this wallet.");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Follow failed.");
      if (!signedIn) {
        setError("Sign in to follow wallets.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-center">
        <p className="text-sm font-semibold">{error}</p>
        <p className="mt-1 text-sm text-text-secondary">{address}</p>
        <Link href="/wallets" className="mt-3 inline-block text-sm text-primary underline">
          Back to wallets
        </Link>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-3">
        <div className="h-16 animate-pulse rounded-lg bg-surface-hover" />
        <div className="h-32 animate-pulse rounded-lg bg-surface-hover" />
      </div>
    );
  }

  const { wallet } = profile;

  return (
    <div className="space-y-4">
      <BackButton />
      <header className="rounded-lg border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {wallet.username ? (
                <>
                  <h1 className="truncate text-xl font-bold">@{wallet.username}</h1>
                  <BadgeCheck className="h-5 w-5 shrink-0 text-primary" />
                </>
              ) : (
                <h1 className="truncate font-mono text-lg font-semibold">{truncateAddress(wallet.address, 8)}</h1>
              )}
            </div>
            <p className="mt-1 break-all font-mono text-xs text-text-secondary">{wallet.address}</p>
          </div>

          {!isSelf && signedIn && (
            <button
              onClick={toggleFollow}
              disabled={busy}
              className={`flex cursor-pointer items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
                profile.isFollowing
                  ? "border border-border text-text-secondary hover:border-primary/50 hover:text-primary"
                  : "bg-primary text-background hover:bg-primary/90"
              }`}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : profile.isFollowing ? (
                <>
                  <UserCheck className="h-4 w-4" /> Following
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" /> Follow
                </>
              )}
            </button>
          )}

          {!isSelf && !signedIn && (
            <Link href="/profile" className="rounded-md border border-border px-4 py-2 text-sm text-text-secondary transition hover:border-primary/50 hover:text-primary">
              Sign in to follow
            </Link>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Followers" value={wallet.followers} />
          <Stat label="Following" value={wallet.following} />
          <Stat label="Observable tx" value={wallet.txCount} />
          <Stat label="Token touches" value={wallet.tokenInteractions} />
        </div>

        <p className="mt-3 text-xs text-text-secondary">
          {wallet.daysActive > 0 && <>Active ~{wallet.daysActive}{wallet.daysActive === 1 ? " day" : " days"} · </>}
          First observed {wallet.firstObservedAt ? new Date(wallet.firstObservedAt).toLocaleDateString() : "—"} ·{" "}
          {wallet.verified ? "Claimed profile — ownership verified on-chain via signature." : "Not yet claimed."}
        </p>
      </header>

      {isSelf && !me && <WalletClaim surface="banner" />}

      <a
        href={`${EXPLORER_URL}/address/${wallet.address}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-sm text-primary underline"
      >
        Verify on CookieScan <ExternalLink className="h-3.5 w-3.5" />
      </a>

      <section>
        <h2 className="text-sm font-semibold text-text-primary">Recent activity</h2>
        {profile.recentActivity.length === 0 ? (
          <div className="mt-2 rounded-lg border border-border bg-surface p-4 text-sm text-text-secondary">
            Activity for this wallet will appear once the indexer starts reading the chain.
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
            {profile.recentActivity.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-3 text-sm">
                <span className="min-w-0">
                  <span className="block font-semibold uppercase">{a.type}</span>
                  <span className="block truncate text-xs text-text-secondary">
                    {a.token ? `${a.token.symbol ?? "TOKEN"} · ${a.token.name ?? a.token.mint}` : a.signature}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-text-secondary">
                  {new Date(a.timestamp).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
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