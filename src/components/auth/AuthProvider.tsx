"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@/lib/providers";

export type Me = {
  wallet: string;
  userId: string;
  username: string;
} | null;

type AuthContextValue = {
  me: Me;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe(): Promise<Me> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    const data = (await res.json()) as { me?: Me };
    return data.me ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { account } = useWallet();
  const [me, setMe] = useState<Me>(null);
  const [loading, setLoading] = useState(true);
  const lastWallet = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMe().then((m) => {
      if (cancelled) return;
      setMe(m);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Restore the session for a previously claimed wallet. The username is
  // permanently bound to the address in `users`, so reconnecting (even after a
  // sign-out) should log the user straight back in without re-claiming a name.
  useEffect(() => {
    if (loading) return;
    const addr = account?.address ?? null;
    if (!addr) {
      lastWallet.current = null;
      return;
    }
    if (lastWallet.current === addr) return;
    lastWallet.current = addr;
    if (me?.wallet === addr) return;

    let cancelled = false;
    fetch("/api/auth/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: addr }),
    })
      .then((res) => (res.ok ? res.json() : { me: null }))
      .then((data) => {
        if (cancelled) return;
        if (data.me) setMe(data.me);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [account?.address, me, loading]);

  const refresh = useCallback(async () => {
    const m = await fetchMe();
    setMe(m);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setMe(null);
    }
  }, []);

  const value = useMemo(() => ({ me, loading, refresh, logout }), [me, loading, refresh, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}