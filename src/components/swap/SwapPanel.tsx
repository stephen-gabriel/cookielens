"use client";

import { ArrowDown, ArrowUpRight, CheckCircle2, Copy, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useWallet } from "@/lib/providers";
import { getConnection, getNativeBalance, getTokenBalances } from "@/lib/chain";
import { prepareAggregateSwapTransfer, walletSignAndSubmit, waitForCookieConfirmation } from "@/lib/tx";
import { EXPLORER_URL } from "@/lib/constants";
import { fromRawAmount, formatNative } from "@/lib/format";

const AGG_COOK_MINT = "So11111111111111111111111111111111111111112";
const AGG_COOK_DECIMALS = 9;
const SLIPPAGE_OPTIONS_BPS = [50, 100, 250, 500, 1000];

type Direction = "buy" | "sell";
type Stage = "idle" | "quote" | "sign" | "submitting" | "confirming" | "done" | "error";

type Quote = {
  inAmount: string;
  outAmount: string;
  feePct: number;
  feeAmount: string;
  netOutAmount: string;
  minOutAmount: string;
  priceImpactPct: number | null;
  path: string[];
  isSplit: boolean;
  isMultiHop: boolean;
  segments: {
    pool: string;
    venue: string;
    inAmount: string;
    outAmount: string;
    hopIndex: number;
  }[];
};

export function SwapPanel({
  mint,
  symbol,
  decimals,
}: {
  mint: string;
  symbol: string;
  decimals: number;
}) {
  const { connectedWallet, account } = useWallet();
  const [direction, setDirection] = useState<Direction>("buy");
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(100);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [noRoute, setNoRoute] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [cookBalance, setCookBalance] = useState(0);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [balanceLoaded, setBalanceLoaded] = useState(false);
  const [lastSignature, setLastSignature] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const toastId = useRef<string | null>(null);
  const quoteReq = useRef(0);

  const address = account?.address ?? null;

  // ---- balances --------------------------------------------------------------
  const loadBalances = useCallback(async () => {
    if (!address) return;
    const [native, tokens] = await Promise.all([getNativeBalance(address), getTokenBalances(address)]);
    setCookBalance(Number(native) / 10 ** AGG_COOK_DECIMALS);
    const t = tokens.find((x) => x.mint === mint);
    setTokenBalance(t ? Number(t.amount) / 10 ** t.decimals : 0);
    setBalanceLoaded(true);
  }, [address, mint]);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    Promise.all([getNativeBalance(address), getTokenBalances(address)])
      .then(([native, tokens]) => {
        if (cancelled) return;
        setCookBalance(Number(native) / 10 ** AGG_COOK_DECIMALS);
        const t = tokens.find((x) => x.mint === mint);
        setTokenBalance(t ? Number(t.amount) / 10 ** t.decimals : 0);
        setBalanceLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setBalanceLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [address, mint]);

  const isBuy = direction === "buy";
  const payMint = isBuy ? AGG_COOK_MINT : mint;
  const paySymbol = isBuy ? "COOK" : symbol;
  const payDecimals = isBuy ? AGG_COOK_DECIMALS : decimals;
  const outMint = isBuy ? mint : AGG_COOK_MINT;
  const outDecimals = isBuy ? decimals : AGG_COOK_DECIMALS;
  const payBalance = (isBuy ? cookBalance : tokenBalance) || 0;
  const payBalanceLabel = `${formatNative(Math.round(payBalance * 10 ** payDecimals), payDecimals)} ${paySymbol}`;

  const amountOk = /^\d+(\.\d+)?$/.test(amount) && Number(amount) > 0;
  const canSwap =
    !!connectedWallet && !!account && amountOk && !!quote && stage !== "sign" && stage !== "submitting" && stage !== "confirming";

  // ---- quote -----------------------------------------------------------------
  const refreshQuote = useCallback(async () => {
    if (!amountOk) return;
    const id = ++quoteReq.current;
    setStage("quote");
    setNoRoute(false);
    setQuote(null);
    try {
      const qp = new URLSearchParams({
        inputMint: payMint,
        outputMint: outMint,
        amount,
        inputDecimals: String(payDecimals),
        outputDecimals: String(outDecimals),
        slippageBps: String(slippageBps),
      });
      if (address) qp.set("owner", address);
      const res = await fetch(`/api/swap/quote?${qp.toString()}`, { cache: "no-store" });
      const data = (await res.json()) as { ok: boolean; quote?: Quote | null; error?: string };
      if (id !== quoteReq.current) return;
      if (!data.ok || !data.quote) {
        setQuote(null);
        setNoRoute(true);
        setStage("idle");
        return;
      }
      setQuote(data.quote);
      setStage("idle");
    } catch {
      if (id !== quoteReq.current) return;
      setNoRoute(true);
      setStage("idle");
    }
  }, [amount, amountOk, payMint, outMint, payDecimals, outDecimals, slippageBps, address]);

  // ---- swap ---------------------------------------------------------------
  const update = useCallback((s: Stage, text: string) => {
    setStage(s);
    setMessage(text);
    if (toastId.current) toast.loading(text, { id: toastId.current });
  }, []);

  const submit = async () => {
    if (!connectedWallet || !account || !canSwap || !quote) return;
    setLastSignature(null);
    setStage("idle");
    const txToastId = toast.loading("Preparing swap…");
    toastId.current = txToastId;
    try {
      update("sign", "Confirm the swap in your wallet…");

      const buildRes = await fetch("/api/swap/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputMint: payMint,
          outputMint: outMint,
          amount,
          inputDecimals: payDecimals,
          slippageBps,
          owner: account.address,
        }),
      });
      const built = (await buildRes.json()) as { ok?: boolean; transactionBase64?: string; error?: string };
      if (!buildRes.ok || !built.transactionBase64) {
        throw new Error(built.error ?? "Failed to build swap transaction.");
      }

      const connection = getConnection();
      const prepared = await prepareAggregateSwapTransfer(connection, built.transactionBase64);

      update("submitting", "Broadcasting to Cookie Chain…");
      const signature = await walletSignAndSubmit(connectedWallet, prepared, connection);
      setLastSignature(signature);

      update("confirming", "Transaction submitted — confirming on-chain…");
      await waitForCookieConfirmation(connection, signature, prepared);

      setStage("done");
      setMessage(null);
      toast.success(`${isBuy ? "Bought" : "Sold"} confirmed!`, { id: txToastId });
      toastId.current = null;
      void loadBalances();
      setQuote(null);
      setAmount("");
    } catch (err) {
      setStage("error");
      const reason = err instanceof Error ? err.message : "Swap failed";
      setMessage(reason);
      toast.error(reason, { id: txToastId });
      toastId.current = null;
    }
  };

  const received = useMemo(() => {
    if (!quote) return null;
    return {
      net: fromRawAmount(BigInt(quote.netOutAmount || quote.outAmount), outDecimals),
      min: fromRawAmount(BigInt(quote.minOutAmount || "0"), outDecimals),
      impact: quote.priceImpactPct,
      feePct: quote.feePct,
      venues: [...new Set(quote.segments.map((s) => s.venue))],
    };
  }, [quote, outDecimals]);

  if (!connectedWallet || !account) {
    return (
      <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <ArrowDown className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold sm:text-lg">Trade {symbol}</h2>
        </div>
        <p className="mt-4 text-sm text-text-secondary">
          Connect your wallet to swap {symbol} on Cookie Chain through the Cookiebox aggregator.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <ArrowDown className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold sm:text-lg">Trade {symbol}</h2>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-md border border-border bg-surface p-1">
        {(["buy", "sell"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => {
              setDirection(d);
              setQuote(null);
              setNoRoute(false);
              setStage("idle");
            }}
            disabled={stage === "sign" || stage === "submitting" || stage === "confirming"}
            className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-semibold capitalize transition disabled:opacity-50 ${
              direction === d ? "bg-primary text-primary-foreground" : "text-text-secondary hover:text-primary"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-md border border-border bg-background/60 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="uppercase tracking-wide text-text-secondary">{isBuy ? "You pay" : "You sell"}</span>
          <span className="text-text-secondary">
            Balance:{" "}
            {!balanceLoaded ? (
              <Loader2 className="inline h-3 w-3 animate-spin" />
            ) : (
              <span className="text-text-primary">{payBalanceLabel}</span>
            )}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <input
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setQuote(null);
              setNoRoute(false);
            }}
            placeholder="0.0"
            inputMode="decimal"
            disabled={stage === "sign" || stage === "submitting" || stage === "confirming"}
            className="w-full bg-transparent font-mono text-xl text-primary placeholder:text-text-secondary/50 focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setAmount(payBalance > 0 ? String(payBalance) : "")}
            disabled={payBalance <= 0}
            className="shrink-0 cursor-pointer rounded-md border border-border px-2 py-1 text-xs text-text-secondary transition hover:border-primary/50 hover:text-primary disabled:opacity-50"
          >
            Max
          </button>
          <span className="rounded-md bg-surface px-2 py-1 text-sm font-semibold">{paySymbol}</span>
        </div>
      </div>

      <div className="my-3 flex justify-center">
        <div className="rounded-full border border-border bg-background p-1.5">
          <ArrowDown className="h-4 w-4 text-text-secondary" />
        </div>
      </div>

      <div className="rounded-md border border-border bg-background/60 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="uppercase tracking-wide text-text-secondary">{isBuy ? "You receive" : "You receive"}</span>
          <span className="text-text-secondary">Route via aggregator</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="font-mono text-xl text-primary">
            {received ? Number(received.net).toLocaleString() : "—"}
          </span>
          <span className="rounded-md bg-surface px-2 py-1 text-sm font-semibold">{outDecimals === 9 ? "COOK" : symbol}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-text-secondary">Slippage</span>
        <div className="flex gap-1">
          {SLIPPAGE_OPTIONS_BPS.map((bps) => (
            <button
              key={bps}
              type="button"
              onClick={() => setSlippageBps(bps)}
              disabled={stage === "sign" || stage === "submitting" || stage === "confirming"}
              className={`cursor-pointer rounded border border-border px-2 py-0.5 transition disabled:opacity-50 ${
                slippageBps === bps ? "bg-primary text-primary-foreground" : "text-text-secondary hover:text-primary"
              }`}
            >
              {bps / 100}%
            </button>
          ))}
        </div>
      </div>

      {message && (
        <div
          className={`mt-4 rounded-md border p-3 text-sm ${
            stage === "error" ? "border-error/30 text-error" : "border-border text-text-secondary"
          }`}
        >
          <div className="flex items-start gap-2">
            {stage === "error" ? (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
            )}
            <div>
              {message}
              {message.includes("Signature:") && (
                <div className="mt-1 font-mono text-xs break-all">{message.split("Signature: ")[1]}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {stage === "done" && lastSignature && (
        <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-text-primary">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span className="font-medium">{isBuy ? `Bought ${symbol} and confirmed` : "Sold and confirmed"}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <a
              href={`${EXPLORER_URL}/tx/${lastSignature}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs break-all text-primary underline"
            >
              {lastSignature.slice(0, 24)}… <ArrowUpRight className="h-3 w-3" />
            </a>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(lastSignature)}
              className="inline-flex items-center gap-1 text-xs text-text-secondary transition hover:text-primary"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
          </div>
          <p className="mt-2 text-xs text-text-secondary">
            Your activity will appear in your profile and the CookieLens feed shortly.
          </p>
        </div>
      )}

      {noRoute && stage !== "error" && !message && (
        <p className="mt-4 text-sm text-text-secondary">
          No swap route found for {paySymbol} → {isBuy ? symbol : "COOK"} at this amount. The pair may lack
          pooled liquidity. Try a different amount.
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!canSwap}
        className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {stage === "quote" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Getting quote…
          </>
        ) : stage === "sign" || stage === "submitting" || stage === "confirming" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {stage === "sign" ? "Waiting for signature…" : stage === "submitting" ? "Submitting…" : "Confirming…"}
          </>
        ) : (
          isBuy ? `Buy ${symbol}` : "Sell"
        )}
      </button>

      {received && (
        <div className="mt-4 space-y-1 rounded-md border border-border bg-background/60 p-3 text-xs text-text-secondary">
          <div className="flex justify-between">
            <span>Expected receive</span>
            <span className="font-mono text-text-primary">{Number(received.net).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Minimum after slippage ({slippageBps / 100}%)</span>
            <span className="font-mono text-text-primary">{Number(received.min).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Price impact</span>
            <span className={`font-mono ${received.impact && received.impact > 5 ? "text-error" : "text-text-primary"}`}>
              {received.impact === null || received.impact === undefined ? "—" : `${Math.max(0, received.impact).toFixed(2)}%`}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Aggregator fee</span>
            <span className="font-mono text-text-primary">{received.feePct ? `${(received.feePct * 100).toFixed(1)}%` : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span>Route</span>
            <span className="font-mono text-text-primary">{received.venues.join(", ") || "—"}</span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => void refreshQuote()}
        disabled={!amountOk || stage === "sign" || stage === "submitting" || stage === "confirming"}
        className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-text-secondary transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        <RefreshCw className={`h-4 w-4 ${stage === "quote" ? "animate-spin" : ""}`} />
        {amountOk ? "Get quote" : "Enter an amount"}
      </button>
    </section>
  );
}