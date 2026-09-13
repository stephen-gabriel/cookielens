"use client";

import { Loader2, LogOut, Sparkles } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/components/auth/AuthProvider";
import { demoAddress, signChallengeMessage } from "@/lib/demo";

export function DemoClaim({ compact }: { compact?: boolean }) {
  const { me, refresh, logout } = useAuth();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  if (me) {
    return (
      <div className={`rounded-lg border border-dashed border-primary/40 bg-surface ${compact ? "p-3" : "p-4"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate font-semibold">@{me.username}</span>
            <span className="shrink-0 text-xs text-text-secondary">demo mode</span>
          </div>
          <button
            onClick={async () => {
              await logout();
              toast.success("Signed out.");
            }}
            className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-text-secondary transition hover:border-error/50 hover:text-error"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>
    );
  }

  const submit = async () => {
    if (busy) return;
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      toast.error("Username must be 3–24 characters: letters, numbers, underscores.");
      return;
    }
    setBusy(true);
    try {
      const wallet = demoAddress();
      const challengeRes = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet }),
      });
      const challengeJson: { ok?: boolean; nonce?: string; message?: string; error?: string } = await challengeRes
        .json()
        .catch(() => ({}));
      if (!challengeRes.ok || !challengeJson.nonce || !challengeJson.message) {
        throw new Error(challengeJson.error ?? `Could not start verification (HTTP ${challengeRes.status}).`);
      }
      const { signature, signedMessage } = signChallengeMessage(challengeJson.message);
      const claimRes = await fetch("/api/auth/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          nonce: challengeJson.nonce,
          signature,
          signedMessage,
          username: username.trim(),
        }),
      });
      const claimJson: { ok?: boolean; error?: string } = await claimRes.json().catch(() => ({}));
      if (!claimRes.ok) throw new Error(claimJson.error ?? `Claim failed (HTTP ${claimRes.status}).`);

      await refresh();
      toast.success(`Demo profile ready — @${username.trim()}. Personalized feed unlocked.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Demo claim failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`rounded-lg border border-dashed border-primary/40 bg-surface ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-primary" /> Explore in demo mode
      </div>
      <p className="mt-1 text-xs leading-relaxed text-text-secondary">
        No wallet needed. A demo wallet signs your profile locally so you can try following, watching, and the feed.
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username (3–24 chars)"
          disabled={busy}
          className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-primary"
        />
        <button
          onClick={submit}
          disabled={busy || !username.trim()}
          className="flex cursor-pointer items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-background transition hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start demo"}
        </button>
      </div>
    </div>
  );
}