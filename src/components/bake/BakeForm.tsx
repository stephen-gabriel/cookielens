"use client";

import { useState } from "react";
import { Cookie } from "lucide-react";
import { useWallet } from "@/lib/providers";
import { ImageUpload } from "@/components/bake/ImageUpload";
import { useCreateToken } from "@/hooks/useCreateToken";
import { toast } from "react-hot-toast";
import Link from "next/link";

const MAX_NAME = 32;
const MAX_SYMBOL = 6;
const MAX_DESCRIPTION = 500;

export function BakeForm() {
  const { account, connectedWallet } = useWallet();
  const walletAddress = account?.address ?? "";
  const { createToken, loading: tokenLoading } = useCreateToken(walletAddress, connectedWallet, account);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [mintedMint, setMintedMint] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const formValid = name.trim().length > 0 && symbol.trim().length > 0 && image !== null;

  const handleSubmit = async () => {
    if (!account) {
      toast.error("Connect your wallet to bake a token");
      return;
    }
    if (!image) {
      toast.error("Please upload an image for your token");
      return;
    }
    setSubmitting(true);
    try {
      const { mint } = await createToken({
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        description: description.trim(),
        imageFile: image,
      });
      setMintedMint(mint);
      toast.success(`Token baked! Mint: ${mint.slice(0, 6)}...${mint.slice(-4)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Deploy failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      {!connectedWallet && (
        <div className="mb-6 rounded-lg border border-border bg-surface p-4 text-sm text-text-secondary">
          You don&apos;t have a wallet connected. Click the Connect Wallet button in the top-right to start baking.
        </div>
      )}

      <div className="space-y-6 rounded-lg border border-border bg-surface p-6">
        <h2 className="text-xl font-semibold">Bake a new token</h2>

        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm text-text-secondary">
            Token name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            maxLength={MAX_NAME}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cookie Monster"
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-text-primary outline-none transition focus:border-primary"
          />
          <p className="mt-1 text-right text-xs text-text-secondary">{name.length}/{MAX_NAME}</p>
        </div>

        <div>
          <label htmlFor="symbol" className="mb-1.5 block text-sm text-text-secondary">
            Ticker symbol
          </label>
          <input
            id="symbol"
            type="text"
            value={symbol}
            maxLength={MAX_SYMBOL}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="e.g. CMR"
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 font-mono uppercase text-text-primary outline-none transition focus:border-primary"
          />
          <p className="mt-1 text-right text-xs text-text-secondary">{symbol.length}/{MAX_SYMBOL}</p>
        </div>

        <div>
          <label htmlFor="description" className="mb-1.5 block text-sm text-text-secondary">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            maxLength={MAX_DESCRIPTION}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Give your cookie a story..."
            rows={4}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2.5 text-text-primary outline-none transition focus:border-primary"
          />
          <p className="mt-1 text-right text-xs text-text-secondary">{description.length}/{MAX_DESCRIPTION}</p>
        </div>

        <div>
          <span className="mb-1.5 block text-sm text-text-secondary">Token image</span>
          <ImageUpload value={image} onChange={setImage} />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!formValid || submitting || tokenLoading}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-base font-semibold text-background transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Cookie className="h-5 w-5" />
          {submitting || tokenLoading ? "Baking..." : "Bake the Cookie"}
        </button>
      </div>

      {mintedMint && (
        <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
          <p className="font-semibold text-emerald-400">Cookie baked successfully!</p>
          <p className="mt-1 break-all font-mono text-xs text-text-secondary">{mintedMint}</p>
          <p className="mt-1 text-text-secondary">
            View it on{" "}
            <Link
              href={`https://cookiescan.io/address/${mintedMint}`}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              CookieScan
            </Link>
            . Bonding curve pool coming in a later phase.
          </p>
        </div>
      )}
    </div>
  );
}