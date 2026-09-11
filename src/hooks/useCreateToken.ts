import { useCallback, useState } from "react";
import { Keypair as Web3Keypair } from "@solana/web3.js";
import { generateSigner, percentAmount } from "@metaplex-foundation/umi";
import { createAndMint, TokenStandard } from "@metaplex-foundation/mpl-token-metadata";
import { toWeb3JsLegacyTransaction } from "@metaplex-foundation/umi-web3js-adapters";
import { getWalletFeature } from "@wallet-standard/ui";
import { SolanaSignTransaction, type SolanaSignTransactionFeature } from "@solana/wallet-standard-features";
import { Connection } from "@solana/web3.js";
import { walletUmi } from "@/lib/umi";
import { RPC_URL } from "@/lib/constants";
import type { WalletContextValue } from "@/lib/providers";

export interface CreateTokenResult {
  signature: string;
  mint: string;
}

export interface CreateTokenInput {
  name: string;
  symbol: string;
  description: string;
  imageFile: File;
}

export function useCreateToken(
  walletAddress: string,
  connectedWallet: WalletContextValue["connectedWallet"],
  account: WalletContextValue["account"],
) {
  const [loading, setLoading] = useState(false);

  const createToken = useCallback(
    async (input: CreateTokenInput): Promise<CreateTokenResult> => {
      if (!connectedWallet || !account) throw new Error("Wallet not connected");
      setLoading(true);
      try {
        const amount = BigInt(1_000_000_000) * BigInt(10) ** BigInt(9);

        const imageBuffer = await input.imageFile.arrayBuffer();
        const imageBase64 = btoa(
          new Uint8Array(imageBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ""),
        );

        const meta = await fetch("/api/metadata", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: input.name,
            symbol: input.symbol,
            description: input.description,
            imageBase64,
            imageContentType: input.imageFile.type,
          }),
        });

        if (!meta.ok) throw new Error("Metadata upload failed");
        const { uri } = (await meta.json()) as { uri: string };

        const umi = walletUmi(walletAddress);

        const mintKp = generateSigner(umi);

        const umiTxBuilt = await createAndMint(umi, {
            mint: mintKp,
            name: input.name,
            symbol: input.symbol,
            uri,
            sellerFeeBasisPoints: percentAmount(0),
            decimals: 9,
            amount,
            tokenStandard: TokenStandard.Fungible,
          }).buildWithLatestBlockhash(umi);

        const web3Tx = toWeb3JsLegacyTransaction(umiTxBuilt);

        const mintWeb3Kp = Web3Keypair.fromSecretKey(mintKp.secretKey);
        web3Tx.partialSign(mintWeb3Kp);

        const serialized = web3Tx.serialize({ requireAllSignatures: false });

        const signFeature = getWalletFeature(
          connectedWallet,
          SolanaSignTransaction,
        ) as SolanaSignTransactionFeature[typeof SolanaSignTransaction];

        const [{ signedTransaction }] = await signFeature.signTransaction({
          account,
          transaction: serialized,
        });

        const connection = new Connection(RPC_URL, "confirmed");
        const sig = await connection.sendRawTransaction(signedTransaction, {
          skipPreflight: true,
          maxRetries: 3,
        });
        await connection.confirmTransaction(sig, "confirmed");

        return { signature: sig, mint: mintKp.publicKey };
      } finally {
        setLoading(false);
      }
    },
    [account, connectedWallet, walletAddress],
  );

  return { createToken, loading };
}
