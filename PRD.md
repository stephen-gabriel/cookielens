# CookieLens — Product Requirements Document

## 1. Overview

**Project:** CookieLens
**Pitch:** The portfolio tracker, social layer, and market explorer for Cookie Chain — see any wallet's COOK and token balances, every token on the chain, live network stats, classified on-chain activity, and a full wallet directory in one place. Read the chain freely, send COOK, and swap COOK ↔ any token with real-time confirmation.

**Target Users:** COOK holders, degens, validators, creators, community analysts, and anyone doing research on Cookie Chain.

**Problem:** Cookie Chain has an explorer (CookieScan), DEXs (CookieSwap, Cookiebox), a launchpad (MomoSwap), and a bridge — but **no portfolio-aggregation layer and no social layer**. There is no product that shows a wallet's complete holdings on Cookie Chain (native COOK + all SPL tokens with prices and USD value), lets you watch arbitrary addresses, lists every token ranked by holders, surfaces meaningful on-chain events (entries, convergence, large moves), or shows whose activity is significant. DefiLlama only tracks protocol TVL, not individual wallets or behavior.

## 2. Feature List

| ID | Feature | Priority | Description |
|----|---------|----------|-------------|
| N1 | Wallet Connection | P0 | Connect Nightly (or any wallet-standard wallet): connect, disconnect, auto-restore, network switch, 60s timeout, mobile guidance |
| N2 | Portfolio View | P0 | Connected wallet's COOK balance + token holdings, priced in USD, total value |
| N3 | Wallet Tracker | P0 | Paste any Cookie Chain address → view its holdings, COOK balance, activity — no connection needed |
| N4 | Token Explorer | P0 | Table of every fungible token on Cookie Chain, ranked by holders, with price/MC where available |
| N5 | Token Detail | P1 | Per-token page: metadata, price, market cap, supply, holders, community context (buyers/sellers, verified wallets, volume), Watch toggle, Swap |
| N6 | Live Network Stats | P1 | Homepage widgets: COOK price (CoinGecko), market cap, chain height, indexer position |
| N7 | Transaction History | P1 | Recent transaction signatures per wallet, linked to CookieScan |
| N8 | Token Search | P2 | Search token explorer by name/symbol via DAS search API |
| N9 | Price Data | P1 | COOK/USD from CoinGecko; other tokens via DAS price info when indexed |
| N10 | Activity Feed | P0 | Discover feed of classified on-chain events (archetypes) + a personal Following feed |
| N11 | Send COOK | P0 | Sign + broadcast a native COOK transfer with real-time confirmation status |
| N12 | Swap | P0 | Buy/sell COOK ↔ any token through the Cookiebox aggregator: quote → simulate → sign → submit → confirm, with slippage + price-impact controls |
| N13 | Wallet Directory | P1 | Browse active/verified wallets and profiles on Cookie Chain, ranked by activity |
| N14 | Identity & Following | P1 | Claim a wallet → username; follow wallets; Following feed aggregates significant activity |
| N15 | Watch Tokens | P1 | Follow a token mint; see watch state + community context on its detail page |
| N16 | Demo Mode | P2 | No-wallet exploration: a browser-generated Ed25519 keypair signs claims locally so profiles, follow, and watch can be tested fully |
| N17 | Indexer | P0 | Background scheduler (GitHub Actions on cron) that polls Cookie Chain + DAS, classifies activity via a significance engine, and writes to Neon Postgres |

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

### Flow 3: Browse tokens + swap
1. User clicks "Tokens" in navigation; table loads every fungible token, COOK pinned first
2. Click a token → detail page with community stats, Watch toggle, and a Swap panel
3. In the Swap panel: pick buy/sell, enter amount, choose slippage, review the quote (receive, min-out, price impact, fee, venues), then swap
4. The aggregator builds an unsigned v0 transaction; CookieLens simulates it, the wallet signs it, CookieLens submits and confirms on-chain

### Flow 4: Discover what matters
1. Homepage Discover tab shows classified "social events" (significant entries, community convergence, large movements, momentum) produced by the indexer's significance engine
2. Claim a wallet (sign a challenge) → follow interesting wallets from their profile
3. Homepage Following tab shows events from followed wallets only

## 4. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router, Turbopack) | 16.x |
| Language | TypeScript | 5.x (strict) |
| Styling | Tailwind CSS | 4.x |
| Wallet | @wallet-standard/react + @wallet-standard/ui | 1.x |
| On-chain reads | @solana/web3.js (Connection + VersionedTransaction) | 1.99.x |
| Auth signatures | tweetnacl (Ed25519 verify) + bs58 | 1.x / 6.x |
| Database | PostgreSQL on Neon (`@neondatabase/serverless`) | N/A |
| ORM | Drizzle ORM | 0.45.x |
| Metadata | CookieScan DAS API (Metaplex DAS standard) | N/A |
| Swap | Cookiebox aggregator (`agg.cookiebox.app`) | N/A |
| COOK price | CoinGecko API (`cookie-2`) | N/A |
| RPC | Cookie Chain RPC | https://rpc.cookiescan.io |
| Charts | recharts | 3.x |
| Icons | lucide-react | 0.525.x |
| Toasts | react-hot-toast | 2.x |
| Tests | Vitest | 5.x |
| Scheduler | GitHub Actions (cron) → `/api/indexer/run` | N/A |
| Deployment | Vercel | N/A |

## 5. Data Model

Postgres (Neon) tables — see `src/server/db/schema.ts`:

```
wallets        address PK, firstObservedAt, lastActivityAt, txCount, tokenInteractions
users          id PK, walletAddress UNIQUE → wallets, username UNIQUE, claimedAt
follows        (followerWallet, followeeWallet) PK → wallets × wallets
watches        (walletAddress, tokenMint) PK → wallets × tokens
tokens         mint PK, symbol/name/decimals, priceUsd, marketCap, holderCount, volume24h
token_stats    (mint, sampledAt) PK → tokens; holderCount, volume24h, buyers1h, sellers1h
activities     signature UNIQUE, wallet, tokenMint, type (buy/sell/liquidity/transfer/swap/…), amount, valueUsd, timestamp, slot
social_events  archetype, wallet, tokenMint, sourceActivityIds[], significance, payload (JSONB)
claim_challenges  wallet, nonce, expiresAt, consumed
indexer_state key/value progress bookkeeping
```

The client still derives live portfolio/holdings data from the RPC + DAS (no caching); Postgres is written only by the indexer and the auth/claim/follow/watch flows.

## 6. Deployment Plan

| Step | Action |
|------|--------|
| 1 | Build and test locally (`npm run dev`, `npm run build`, `npm test`, `npm run lint`) |
| 2 | Deploy to Vercel (auto-deploy from GitHub main branch) |
| 3 | Set env vars (see `.env.example`): `NEXT_PUBLIC_*`, `DATABASE_URL` (Neon pooled), `SESSION_SECRET`, `CRON_SECRET` |
| 4 | Push the Neon schema: `npm run db:push` (or `db:migrate`) |
| 5 | Create GitHub Actions secret `CRON_SECRET` matching Vercel; the action drives the indexer on a schedule |
| 6 | Verify wallet connection, Send COOK, and Swap on Cookie Chain |
| 7 | **Make the repo public** and submit Vercel URL + GitHub repo to the hackathon |

## 7. Success Metrics

| Metric | Target |
|--------|--------|
| Portfolio load time | < 5 seconds |
| Correct COOK balance shown | Yes |
| Token explorer populated | Shows COOK + all discovered tokens |
| Watches any valid address | Yes |
| Zero unhandled errors | Yes |
| Send COOK executes + confirms with status feedback | Yes |
| Swap quotes, builds, signs, submits, and confirms on-chain | Yes |
| Feed surfaces classified events once the indexer is live | Yes |
| Zero TypeScript/ESLint errors; build succeeds | Yes |
| README completeness | 100% |