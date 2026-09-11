# CookieLens — Architecture Document

## 1. System Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                       │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                    Next.js App Router                    │  │
│  │  ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌───────────┐   │  │
│  │  │ Overview │ │ Portfolio│ │ Watch   │ │  Tokens   │   │  │
│  │  │  (Home)  │ │  Page    │ │  Page   │ │   Page    │   │  │
│  │  └──────────┘ └──────────┘ └─────────┘ └───────────┘   │  │
│  │           ┌───────────┐                                  │  │
│  │           │Token Detail│  (/token/[mint])                 │  │
│  │           └───────────┘                                  │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                   Shared Components                     │  │
│  │  WalletProvider (wallet-standard) │ Header │ Toaster    │  │
│  │  HoldingsTable │ TokenImage                            │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                    Hooks / Utils                        │  │
│  │  useWallet │ usePortfolio │ useCookUsdPrice            │  │
│  │  chain.ts │ das.ts │ pricing.ts │ tx.ts │ format.ts    │  │
│  │  constants.ts                                          │  │
│  └────────────────────────────────────────────────────────┘  │
└───────────────────────┬──────────────────────────────────────┘
      read-only HTTPS (CORS: *)  +  one opt-in signed transaction
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  Cookie Chain RPC (rpc.cookiescan.io)                        │
│  - getBalance       → native COOK (lamports)                  │
│  - getTokenAccountsByOwner → SPL holdings                     │
│  - getSignaturesForAddress → tx history                       │
│  - getSlotHeight    → chain height                            │
│  - getLatestBlockhash / sendRawTransaction / getSignatureStatus → Send COOK
└───────────────────────┬──────────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  CookieScan DAS API (api.cookiescan.io)                      │
│  - getAsset         → token metadata (name/symbol/image)      │
│  - getAssetsByOwner → all assets for a wallet                 │
│  - searchAssets     → discover fungible tokens                │
└───────────────────────┬──────────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  CoinGecko API (api.coingecko.com, id: cookie-2)             │
│  - simple/price     → COOK/USD (60s client cache)             │
└──────────────────────────────────────────────────────────────┘
```

## 2. File / Folder Structure

```
cookielens/
├── .env.example
├── .gitignore
├── README.md
├── PRD.md
├── FRD.md
├── ARCHITECTURE.md
├── next.config.ts
├── package.json
├── tsconfig.json
├── postcss.config.mjs
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout, WalletProvider, Header, Toaster
│   │   ├── page.tsx                   # Overview (home): price widgets + feature cards
│   │   ├── globals.css                # Dark theme tokens (Tailwind @theme)
│   │   ├── portfolio/page.tsx         # Connected wallet holdings
│   │   ├── watch/page.tsx             # Paste any address → holdings
│   │   ├── tokens/page.tsx            # All fungible tokens, ranked by holders
│   │   └── token/[mint]/page.tsx      # Token detail (DAS getAsset)
│   ├── components/
│   │   ├── layout/Header.tsx          # Nav + WalletButton
│   │   ├── wallet/WalletButton.tsx    # wallet-standard connect/disconnect
│   │   ├── wallet/SendCookPanel.tsx   # Send COOK form + tx status machine
│   │   └── portfolio/HoldingsTable.tsx# Shared holdings table + TokenImage
│   ├── hooks/
│   │   └── usePortfolio.ts            # Reads balances + assets + price for an address
│   └── lib/
│       ├── constants.ts               # RPC/DAS/Coingecko URLs, COOK mint, program IDs
│       ├── providers.tsx              # wallet-standard React provider (connect/restore/disconnect)
│       ├── nightly.ts                 # Cookie Chain network switch for Nightly
│       ├── chain.ts                   # RPC client (getBalance, getTokenBalances, sigs)
│       ├── tx.ts                      # Build + sign + broadcast + confirm COOK transfer
│       ├── das.ts                     # DAS client (getAsset, getAssetsByOwner, searchAssets)
│       ├── pricing.ts                 # COOK/USD price + market data (CoinGecko, cached)
│       └── format.ts                  # truncate, formatUsd, formatCompact, timeAgo
```

## 3. Data Flow

### Portfolio (any address)
1. `usePortfolio(address)` fires on address change (parallel Promise.all):
   - `getNativeBalance` → COOK lamports
   - `getTokenBalances` → per-mint SPL amounts + decimals (jsonParsed)
   - `getCookUsdPrice` → cached COOK/USD
   - `getAssetsByOwner` → DAS asset metadata by mint
   - `getRecentSignatures` → last blockTime for activity
2. Holdings built: COOK first (native, always present), then SPL tokens.
3. `valueUsd = priceUsd × amount`; `totalUsd = Σ valueUsd`.
4. Request-race guard via `requestId` refs (stale responses discarded).

### Token explorer
1. `searchAssets({ tokenType: "fungible" })` → up to 100 assets.
2. COOK pinned as row #1; remaining tokens deduplicated and sorted by `holderCount`.
3. Price/change/MC columns render from DAS fields; missing → "—".

### Send COOK
1. `getLatestBlockhash("confirmed")` from Cookie Chain RPC → build a legacy `Transaction` with `SystemProgram.transfer` (fee payer = connected account).
2. Serialize unsigned and request `solana:signTransaction` from the wallet (fallback: `solana:signAndSendTransaction`).
3. CookieLens broadcasts via `sendRawTransaction` and polls `getSignatureStatus` until `confirmed`/`finalized` (60s timeout).
4. Status machine drives inline text + a single React Hot Toast through: sign → broadcast → confirm → confirmed; success links to `cookiescan.io/tx/<sig>` and refreshes the portfolio.
5. Failures (user rejection, insufficient COOK, on-chain error, timeout) surface inline and as an error toast.

## 4. Environment Variables

```env
# .env.example
# Cookie Chain RPC (read-only)
NEXT_PUBLIC_RPC_URL=https://rpc.cookiescan.io
NEXT_PUBLIC_WSS_URL=wss://wss.cookiescan.io

# DAS API (Metaplex Digital Asset Standard)
NEXT_PUBLIC_DAS_URL=https://api.cookiescan.io

# Native COOK token
NEXT_PUBLIC_COOK_MINT=36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1

# CoinGecko COOK price provider
NEXT_PUBLIC_COOK_COINGECKO_ID=cookie-2

# wallet-standard chain identifier for signing on Cookie Chain
NEXT_PUBLIC_WALLET_STANDARD_CHAIN=solana:mainnet

# Network
NEXT_PUBLIC_CHAIN_NAME=cookie-chain
NEXT_PUBLIC_EXPLORER_URL=https://cookiescan.io
```

## 5. Key Decisions

- **Read-heavy, single opt-in write:** the entire browsing surface uses free RPC/DAS/CoinGecko reads (no COOK, no funding, private keys never leave the wallet). One signing flow — **Send COOK** — satisfies the hackathon's required on-chain interaction (transaction execution + confirmation handling), using the wallet-standard `solana:signTransaction` feature with `solana:signAndSendTransaction` as fallback.
- **wallet-standard (not legacy wallet-adapter):** Nightly supports the standard connect/sign features; `@wallet-standard/react` + `@wallet-standard/ui` are the canonical APIs.
- **Self-contained data layer:** `chain.ts`, `das.ts`, `pricing.ts` are pure functions returning typed data, so screens stay UI-only.
- **Pricing fallbacks:** COOK price is cached 60s in the module (not per-component); if CoinGecko fails, all USD columns degrade to "—" without crashing.
- **No backend state:** CookieLens keeps no server-side database — all data is derived live from chain + APIs, which makes deployment trivial (static-ish Next.js on Vercel).

## 6. Third-Party Services

| Service | Purpose | Why Used |
|---------|---------|----------|
| Cookie Chain RPC (rpc.cookiescan.io) | Native COOK balance, token accounts, tx history | Official public RPC, CORS open |
| CookieScan DAS API (api.cookiescan.io) | Token metadata, asset discovery | Standard Metaplex DAS interface |
| CoinGecko API | COOK/USD price + market cap | Free, no key required, CORS open |
| CookieScan explorer (cookiescan.io) | Transaction/mint links | User verification path |
| Vercel | Deployment | Free tier, Git integration |