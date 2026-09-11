# CookiePump — Product Requirements Document

## 1. Overview

**Project:** CookiePump
**Pitch:** Launch your memecoin on Cookie Chain in 60 seconds — fair bonding curve, instant trading, zero gatekeeping.
**Target Users:** Crypto degens, content creators, community builders, and anyone wanting to launch a token on Cookie Chain.
**Problem:** Cookie Chain has no token launchpad. The infrastructure (CookieBox DBC, DAMM, Metaplex) exists at genesis, but there's no user-friendly way to create and trade tokens. Users must manually interact with programs or use generic Solana tools.

## 2. Feature List

| ID | Feature | Priority | Description |
|----|---------|----------|-------------|
| F1 | Wallet Connection | P0 | Connect Nightly wallet, display address, COOK balance |
| F2 | Token Creation ("Bake") | P0 | Form to create token with name, symbol, image, description |
| F3 | Metadata Upload | P0 | Upload token image and metadata to Arweave/IPFS |
| F4 | Metaplex Token Deploy | P0 | Create fungible token via Metaplex Token Metadata program |
| F5 | DBC Pool Initialization | P0 | Initialize bonding curve pool via CookieBox DBC |
| F6 | Bonding Curve Visualization | P0 | Live chart showing price vs supply on bonding curve |
| F7 | Buy on Bonding Curve | P0 | Purchase tokens with COOK through DBC program |
| F8 | Sell on Bonding Curve | P0 | Sell tokens for COOK through DBC program |
| F9 | Transaction Feedback | P0 | Real-time tx status, confirmation, error handling |
| F10 | Token Explorer | P1 | Browse all launched tokens, filter by status |
| F11 | Token Detail Page | P1 | Full token info, chart, trading interface, creator info |
| F12 | Creator Dashboard | P1 | View your tokens, amounts raised, trading volume |
| F13 | Migration Indicator | P1 | Show when bonding curve fills and liquidity migrates to DAMM |
| F14 | Featured Tokens | P1 | Homepage section for trending/newest tokens |
| F15 | Share Cards | P2 | Generate social media share cards for tokens |
| F16 | Token Analytics | P2 | Volume, holders, price history charts |
| F17 | Anti-Rug Info | P2 | Display liquidity lock status and creator token allocation |

## 3. User Flows

### Flow 1: Launch a Token (Primary)
1. User lands on CookiePump homepage
2. Clicks "Bake a Cookie" / "Launch Token"
3. Connects Nightly wallet (if not connected)
4. Fills form: token name, symbol, image upload, description
5. Reviews token details on confirmation screen
6. Signs transaction → token created via Metaplex
7. Signs transaction → DBC pool initialized with bonding curve
8. Sees "Cookie Fresh Out of the Oven!" success toast
9. Redirected to token detail page with live bonding curve chart

### Flow 2: Trade on Bonding Curve
1. User discovers token on explore page or via link
2. Views bonding curve chart and current price
3. Enters amount of COOK to spend (or tokens to sell)
4. Clicks "Buy" / "Sell"
5. Signs transaction → DBC buy/sell executed
6. Sees confirmation toast with tx link
7. Chart updates in real-time

### Flow 3: Browse Tokens
1. User clicks "Explore" in navigation
2. Sees grid of launched tokens with status badges (Baking / Baked / Migrated)
3. Can filter by: status, newest, most traded
4. Clicks token → navigates to detail page

## 4. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 14+ (App Router) |
| Language | TypeScript | 5.x (strict mode) |
| Styling | Tailwind CSS | 4.x |
| Charts | Recharts | 2.x |
| Wallet | @solana/wallet-adapter | Latest |
| Wallet Plugin | @nightly-app/solana-wallet-adapter | Latest |
| On-chain | @solana/web3.js | 2.x |
| Anchor | @coral-xyz/anchor | Latest |
| Metaplex | @metaplex-foundation/mpl-token-metadata | Latest |
| Umi | @metaplex-foundation/umi | Latest |
| CookieBox DBC | Custom IDL (from fibanachos/dynamic-bonding-curve) | 0.1.0 |
| RPC | Cookie Chain RPC | https://rpc.cookiescan.io |
| WebSocket | Cookie Chain WSS | https://wss.cookiescan.io |
| Metadata Storage | Irys (via Metaplex Umi uploader) | N/A |
| Deployment | Vercel | N/A |

## 5. Data Model

### Token (Off-chain index / local state)
```
Token {
  mintAddress: string (public key)
  name: string
  symbol: string
  description: string
  imageUri: string
  metadataUri: string
  creator: string (wallet address)
  createdAt: timestamp
  decimals: number (9)
  totalSupply: bigint
  status: "baking" | "baked" | "migrated"
  poolAddress: string (DBC pool)
  poolAuthority: string (PDA)
  baseMint: string (token mint)
  quoteMint: string (COOK mint)
}
```

### Bonding Curve State (On-chain, read from DBC pool account)
```
PoolState {
  virtualBaseReserve: bigint
  virtualQuoteReserve: bigint
  realBaseReserve: bigint
  realQuoteReserve: bigint
  migrationQuoteThreshold: bigint
  totalQuoteAmount: bigint
  // Derived:
  currentPrice: bigint (quoteReserve / baseReserve)
  percentComplete: number (totalQuote / threshold)
}
```

### Trade (On-chain, derived from transactions)
```
Trade {
  signature: string
  type: "buy" | "sell"
  tokenMint: string
  trader: string
  baseAmount: bigint
  quoteAmount: bigint
  timestamp: number
}
```

## 6. Deployment Plan

| Step | Action |
|------|--------|
| 1 | Build and test locally with `npm run dev` |
| 2 | Deploy to Vercel (auto-deploy from GitHub main branch) |
| 3 | Set environment variables in Vercel dashboard |
| 4 | Verify wallet connection works on Cookie Chain |
| 5 | Test full flow: create token → initialize pool → buy → sell |
| 6 | Submit Vercel URL + GitHub repo to hackathon |

## 7. Success Metrics

| Metric | Target |
|--------|--------|
| Token creation success rate | > 95% |
| Average time to launch token | < 2 minutes |
| Transaction confirmation time | < 3 seconds (sub-second finality) |
| Zero unhandled errors in UI | Yes |
| All P0 features working | Yes |
| README completeness | 100% |