"use client";

import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/components/auth/AuthProvider";
import { useWallet } from "@/lib/providers";
import { signMessageForClaim } from "@/lib/walletSign";
import { truncateAddress } from "@/lib/format";

/**
 * Claim flow (FRD §19): challenge -> sign -> verify -> choose username.
 */
export function WalletClaim({ surface }: { surface?: "page" | "banner" }) {
  const { account, connectedWallet } = useWallet();
  const { me, refresh } = useAuth();
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!connectedWallet || !account) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4 text-sm text-text-secondary">
        Connect your Nightly wallet to claim a profile.
      </div>
    );
  }

  if (me) {
    return (
      <div className={`rounded-lg border border-border bg-surface ${surface === "page" ? "p-6" : "p-4"}`}>
        <div className="flex items-center gap-2">
          <BadgeCheck className="h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold">@{me.username}</p>
            <p className="font-mono text-xs text-text-secondary">{truncateAddress(me.wallet, 6)}</p>
          </div>
        </div>
        <Link
          href="/profile"
          className="mt-3 inline-flex items-center gap-1 text-sm text-primary underline"
        >
          Go to my profile <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  const submit = async () => {
    if (!connectedWallet || !account || submitting) return;
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      toast.error("Username must be 3-24 characters: letters, numbers, underscores.");
      return;
    }
    setSubmitting(true);
    try {
      const challengeRes = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: account.address }),
      });
      const challenge = (await challengeRes.json()) as { ok?: boolean; nonce?: string; message?: string; error?: string };
      if (!challengeRes.ok || !challenge.nonce || !challenge.message) {
        throw new Error(challenge.error ?? "Could not start verification.");
      }

      const signature = await signMessageForClaim(connectedWallet, account, challenge.message);

      const claimRes = await fetch("/api/auth/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: account.address,
          nonce: challenge.nonce,
          signature,
          username: username.trim(),
        }),
      });
      const claim = (await claimRes.json()) as { ok?: boolean; error?: string };
      if (!claimRes.ok) throw new Error(claim.error ?? "Claim failed.");

      await refresh();
      toast.success("Wallet claimed — profile created.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Claim failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`rounded-lg border border-border bg-surface ${surface === "page" ? "p-6" : "p-4"}`}>
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <div>
          <p className="font-semibold">Claim this wallet</p>
          <p className="break-all font-mono text-xs text-text-secondary">{account.address}</p>
        </div>
      </div>
      <p className="mt-2 text-sm text-text-secondary">
        Sign a message with your wallet to prove ownership, then choose a username.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username (3-24 chars)"
          disabled={submitting}
          className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-primary"
        />
        <button
          onClick={submit}
          disabled={submitting}
          className="flex cursor-pointer items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-background transition hover:bg-primary/90 disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Claim & sign"}
        </button>
      </div>
    </div>
  );
}