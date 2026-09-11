# CookieLens — Product Requirements Document

## 1. Overview

**Project:** CookieLens
**Pitch:** The portfolio tracker and market explorer for Cookie Chain — see any wallet's COOK and token balances, every token on the chain, and live network stats in one place. Read the chain freely, and send COOK with real-time confirmation.

**Target Users:** COOK holders, degens, validators, creators, community analysts, and anyone doing research on Cookie Chain.

**Problem:** Cookie Chain has an explorer (CookieScan), DEXs (CookieSwap, Cookiebox), a launchpad (MomoSwap), and a bridge — but **no portfolio-aggregation layer**. There is no product that shows a wallet's complete holdings on Cookie Chain (native COOK + all SPL tokens with prices and USD value), lets you watch arbitrary addresses, or lists every token on the chain ranked by holders. DefiLlama only tracks protocol TVL, not individual wallets.

## 2. Feature List

| ID | Feature | Priority | Description |
|----|---------|----------|-------------|
| N1 | Wallet Connection | P0 | Connect Nightly (or any wallet-standard wallet) to view your portfolio |
| N2 | Portfolio View | P0 | Connected wallet's COOK balance + token holdings, priced in USD, total value |
| N3 | Wallet Tracker | P0 | Paste any Cookie Chain address → view its holdings and COOK balance, no connection needed |
| N4 | Token Explorer | P0 | Table of every fungible token on Cookie Chain, ranked by holders, with price/MC where available |
| N5 | Token Detail | P1 | Metadata page per token (name, symbol, image, supply, decimals, price, market cap) |
| N6 | Live Network Stats | P1 | Homepage widgets: COOK price (CoinGecko), market cap, current slot |
| N7 | Transaction History | P1 | Recent transaction signatures per wallet, linked to CookieScan |
| N8 | Token Search | P2 | Search token explorer by name/symbol via DAS search API |
| N9 | Price Data | P1 | COOK/USD from CoinGecko; other tokens via DAS price info when indexed |
| N10 | Activity Feed | P2 | Recent on-chain activity across the ecosystem |
| N11 | Send COOK | P0 | Sign + broadcast a native COOK transfer with real-time confirmation status |

## 3. User Flows

### Flow 1: View your portfolio (primary)
1. User lands on CookieLens homepage
2. Clicks "Track my portfolio" (or connects Nightly in the header)
3. CookieLens reads the connected wallet address via wallet-standard
4. Portfolio page shows: native COOK balance, USD value, all SPL token holdings with prices
5. "Refresh" re-reads current balances

### Flow 2: Watch any wallet
1. User clicks "Watch" in navigation
2. Pastes any Cookie Chain address (or clicks a suggested example)
3. CookieLens shows that address's COOK balance, token holdings, and USD total
4. No signing, no connection, no fees

### Flow 3: Browse all tokens
1. User clicks "Tokens" in navigation
2. Table loads every fungible token on Cookie Chain from the DAS API, COOK pinned first
3. Rows show name/symbol/image, price, 24h change, market cap, holders
4. Click a token → its detail page (N5)

## 4. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.x |
| Language | TypeScript | 5.x (strict) |
| Styling | Tailwind CSS | 4.x |
| Wallet | @wallet-standard/react + @wallet-standard/ui | 1.x |
| On-chain reads | @solana/web3.js (Connection) | 1.99.x |
| Metadata | CookieScan DAS API (Metaplex DAS standard) | N/A |
| COOK price | CoinGecko API (`cookie-2`) | N/A |
| RPC | Cookie Chain RPC | https://rpc.cookiescan.io |
| Icons | lucide-react | 0.525.x |
| Toasts | react-hot-toast | 2.x |
| Deployment | Vercel | N/A |

## 5. Data Model

### Portfolio (derived from chain reads)
```
Portfolio {
  address: string
  cookBalance: number        // native lamports / 1e9
  cookUsdValue: number       // cookBalance * COOK_USD
  tokenHoldings: Holding[]
  totalUsd: number
  lastActivity: timestamp | null
}

Holding {
  mint: string
  symbol: string
  name: string
  image: string | null
  amount: number             // human units (amount_raw / 10^decimals)
  decimals: number
  isCook: boolean
  priceUsd: number | null
  valueUsd: number | null
}
```

### Token (DAS asset, read-only)
```
Token {
  mint: string
  name: string
  symbol: string
  image: string | null
  decimals: number
  supply: number
  holderCount: number
  priceUsd: number | null     // DAS price_info when indexed
  marketCapUsd: number | null
  volume24h: number | null
  change24h: number | null
}
```

## 6. Deployment Plan

| Step | Action |
|------|--------|
| 1 | Build and test locally with `npm run dev` |
| 2 | Deploy to Vercel (auto-deploy from GitHub main branch) |
| 3 | Set environment variables (`NEXT_PUBLIC_*`) in Vercel dashboard |
| 4 | Verify wallet connection on Cookie Chain |
| 5 | Verify portfolio shows real balances; verify token explorer populates |
| 6 | Submit Vercel URL + GitHub repo to hackathon |

## 7. Success Metrics

| Metric | Target |
|--------|--------|
| Portfolio load time | < 5 seconds |
| Correct COOK balance shown | Yes |
| Token explorer populated | Shows COOK + all discovered token |
| Watches any valid address | Yes |
| Zero unhandled errors | Yes |
| Send COOK executes + confirms with status feedback | Yes |
| README completeness | 100% |