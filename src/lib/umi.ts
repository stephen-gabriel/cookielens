import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createNoopSigner, publicKey } from "@metaplex-foundation/umi";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { mplToolbox } from "@metaplex-foundation/mpl-toolbox";
import { RPC_URL } from "@/lib/constants";

export function createCookieUmi(rpcUrl: string = RPC_URL) {
  return createUmi(rpcUrl).use(mplTokenMetadata()).use(mplToolbox());
}

export function walletUmi(walletAddress: string, rpcUrl: string = RPC_URL) {
  const signer = createNoopSigner(publicKey(walletAddress));
  const umi = createCookieUmi(rpcUrl);
  umi.identity = signer;
  umi.payer = signer;
  return umi;
}