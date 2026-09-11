"use client";

import { useState } from "react";
import { Cookie } from "lucide-react";
import { useWallet } from "@/lib/providers";
import { ImageUpload } from "@/components/bake/ImageUpload";
import { toast } from "react-hot-toast";

const MAX_NAME = 32;
const MAX_SYMBOL = 6;
const MAX_DESCRIPTION = 500;

export function BakeForm() {
  const { account, connectedWallet } = useWallet();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const formValid = name.trim().length > 0 && symbol.trim().length > 0 && image !== null;

  const handleSubmit = async () => {
    if (!account) {
      toast.error("Connect your wallet to bake a token");
      return;
    }
    setSubmitting(true);
    try {
      // Phase 3 (F4-F5): deploy token via Metaplex, then initialize DBC pool.
      // Placeholder until implemented.
      await new Promise((r) => setTimeout(r, 800));
      toast.success("Cookie is ready to bake! On-chain deploy coming next.");
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
          disabled={!formValid || submitting}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-base font-semibold text-background transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Cookie className="h-5 w-5" />
          {submitting ? "Baking..." : "Bake the Cookie"}
        </button>
      </div>
    </div>
  );
}