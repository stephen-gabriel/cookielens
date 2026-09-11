"use client";

import { ArrowUpRight, CheckCircle2, Copy, Loader2, Send, XCircle } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import toast from "react-hot-toast";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@/lib/providers";
import { getConnection } from "@/lib/chain";
import { prepareCookTransfer, waitForCookieConfirmation, walletSignAndSubmit } from "@/lib/tx";
import { isValidAddress } from "@/lib/chain";
import { EXPLORER_URL } from "@/lib/constants";
import { formatNative } from "@/lib/format";

type Stage = "idle" | "sign" | "submitting" | "confirming" | "done" | "error";

export function SendCookPanel({
  cookBalance,
  onSent,
}: {
  cookBalance: number;
  onSent: () => void;
}) {
  const { connectedWallet, account } = useWallet();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [lastSignature, setLastSignature] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const toastId = useRef<string | null>(null);

  const done = stage === "done" || stage === "error";

  const update = useCallback((s: Stage, text: string) => {
    setStage(s);
    setMessage(s === "idle" || s === "done" ? null : text);
    if (toastId.current) {
      toast.loading(text, { id: toastId.current });
    }
  }, []);

  const amountLamports = Math.floor(parseFloat(amount) * 1e9);
  const validAmount = Number.isFinite(amountLamports) && amountLamports > 0;
  const balanceLamports = Math.floor(cookBalance * 1e9);
  const validRecipient = isValidAddress(recipient.trim());
  const canSend = !!connectedWallet && !!account && validRecipient && validAmount && amountLamports <= balanceLamports && !done;

  const submit = async () => {
    if (!connectedWallet || !account || !canSend) return;
    setLastSignature(null);
    setStage("idle");
    const txToastId = toast.loading("Preparing transfer…");
    toastId.current = txToastId;
    try {
      update("sign", "Confirm the transfer in your wallet…");

      const connection = getConnection();
      const from = new PublicKey(account.address);
      const to = new PublicKey(recipient.trim());
      const prepared = await prepareCookTransfer(connection, from, to, amountLamports);

      update("submitting", "Broadcasting to Cookie Chain…");
      const signature = await walletSignAndSubmit(connectedWallet, prepared, connection);
      setLastSignature(signature);

      update("confirming", "Transaction submitted — confirming on-chain…");
      await waitForCookieConfirmation(connection, signature, prepared);

      setStage("done");
      setMessage(null);
      toast.success("COOK sent and confirmed!", { id: txToastId });
      toastId.current = null;
      onSent();
    } catch (err) {
      setStage("error");
      const reason = err instanceof Error ? err.message : "Transfer failed";
      setMessage(reason);
      toast.error(reason, { id: txToastId });
      toastId.current = null;
    }
  };

  const maxBalance = Math.max(0, cookBalance - 0.00001);

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <Send className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Send COOK</h2>
      </div>

      {!connectedWallet || !account ? (
        <p className="mt-4 text-sm text-text-secondary">
          Connect your wallet to send COOK to any Cookie Chain address.
        </p>
      ) : (
        <>
          <label className="mt-4 block text-xs uppercase tracking-wide text-text-secondary">Recipient address</label>
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Cookie Chain address"
            spellCheck={false}
            disabled={done}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm text-primary placeholder:text-text-secondary/50 focus:border-primary/60 focus:outline-none disabled:opacity-50"
          />

          <label className="mt-4 block text-xs uppercase tracking-wide text-text-secondary">Amount (COOK)</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              inputMode="decimal"
              disabled={done}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm text-primary placeholder:text-text-secondary/50 focus:border-primary/60 focus:outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setAmount(maxBalance > 0 ? maxBalance.toFixed(9) : "0")}
              disabled={done}
              className="shrink-0 rounded-md border border-border px-2 py-2 text-xs text-text-secondary transition hover:border-primary/50 hover:text-primary disabled:opacity-50"
            >
              Max
            </button>
          </div>
          <div className="mt-1 text-xs text-text-secondary">
            Balance: {formatNative(balanceLamports)} COOK
          </div>

          {message && (
            <div
              className={`mt-4 rounded-md border p-3 text-sm ${stage === "error" ? "border-error/30 text-error" : "border-border text-text-secondary"}`}
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
                <span className="font-medium">COOK sent and confirmed</span>
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
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {stage === "sign" || stage === "submitting" || stage === "confirming" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {stage === "sign" ? "Waiting for signature…" : stage === "submitting" ? "Submitting…" : "Confirming…"}
              </>
            ) : (
              "Send"
            )}
          </button>

          {!canSend && !done && (
            <p className="mt-2 text-xs text-text-secondary">
              {!validRecipient
                ? "Enter a valid Cookie Chain address."
                : !validAmount
                  ? "Enter an amount greater than 0."
                  : amountLamports > balanceLamports
                    ? "Insufficient COOK balance."
                    : "Sign in to send."}
            </p>
          )}
        </>
      )}
    </section>
  );
}