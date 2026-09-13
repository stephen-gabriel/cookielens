# CookieLens — Architecture Document

## 1. System Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                       CLIENT (Browser, Next.js 16)                  │
│  Pages: / , /tokens, /token/[mint], /portfolio, /watch,            │
│         /wallets, /wallets/[address], /discover, /profile           │
│  Shared: Header + LeftNav + RightRail + BottomNav (responsive)      │
│  Auth:   AuthProvider (session) · WalletClaim · DemoClaim           │
│  Wallet: WalletButton (wallet-standard) · SendCookPanel ·           │
│          SwapPanel (Cookiebox)                                      │
│  Lib:    chain.ts · das.ts · pricing.ts · tx.ts · format.ts ·       │
│          demo.ts · events.ts · significance.ts · providers.tsx      │
│  Hooks:  usePortfolio · useWallet · useAuth                         │
└──────────────┬────────────────────────┬──────────────────────────────┘
               │ public API (JSON)      │ signed transactions (direct)
               ▼                        ▼
┌─────────────────────────────┐  ┌──────────────────────────────┐
│  Next.js API routes         │  │  Cookie Chain RPC            │
│  (runtime: nodejs)          │  │  rpc.cookiescan.io           │
│  /api/auth/* (challenge,    │  │  - sign + send + confirm      │
│     claim, me, logout)      │  │    (Send COOK, Swap)          │
│  /api/follow, /api/watch    │  │  - simulate (pre-swap check)  │
│  /api/feed, /api/profile/*  │  └──────────────────────────────┘
│  /api/explore/*             │
│  /api/swap/* (quote, build) │
│  /api/indexer/* (run,status)│
│  /api/token/[mint]          │
│  /api/wallets/active        │
└──────────────┬──────────────┘
               │ @neondatabase/serverless (pooled)
               ▼
┌─────────────────────────────┐  ┌──────────────────────────────┐
│  Neon Postgres              │  │  External data                │
│  wallets · users · follows  │  │  CookieScan DAS (api.cookies- │
│  watches · tokens ·         │  │    can.io) — metadata/assets  │
│  token_stats · activities   │  │  CoinGecko — COOK/USD         │
│  social_events ·            │  │  Cookiebox agg (agg.cookiebox │
│  claim_challenges ·         │  │    .app) — swap quotes/tx     │
│  indexer_state              │  └──────────────────────────────┘
└─────────────┬───────────────┘
              │ GitHub Actions (cron) → POST /api/indexer/run (CRON_SECRET)
              ▼
        Indexer worker (bundled TS engine, bounded cycles)
```

**Key rule:** the browser only reads/writes through the API (or signs txs it constructs). The indexer is the **only** service that writes the on-chain-derived tables (`wallets`, `tokens`, `token_stats`, `activities`, `social_events`); `users/follows/watches/claim_challenges` come from the auth/social API.

## 2. File / Folder Structure

```
src/
├── app/
│   ├── layout.tsx                 # Root: providers, Header/LeftNav/RightRail/BottomNav, Toaster
│   ├── page.tsx                   # Home: stats widgets, Following/Discover feed, emerging tokens
│   ├── discover/page.tsx          # Explore sections (archetype-based breakdown)
│   ├── portfolio/page.tsx         # Connected wallet holdings + Send COOK
│   ├── watch/page.tsx             # Paste any address → holdings
│   ├── tokens/page.tsx            # Fungible token explorer (COOK pinned), search
│   ├── token/[mint]/page.tsx      # Detail: metadata, stats, community, Watch, SwapPanel
│   ├── wallets/page.tsx           # Wallet directory
│   ├── wallets/[address]/page.tsx # Wallet profile: holdings, stats, events, Follow
│   ├── profile/page.tsx           # Own profile
│   └── api/                       # See §1 (all nodejs runtime; jsonError helper)
│       ├── auth/{challenge,claim,logout,me}
│       ├── explore/{sections,emerging}
│       ├── feed, follow, watch, profile/[wallet], wallets/active
│       ├── swap/{quote,build}, token/[mint], indexer/{run,status}
├── components/
│   ├── layout/{Header,LeftNav,RightRail,BottomNav}
│   ├── auth/{AuthProvider,WalletClaim,DemoClaim}
│   ├── wallet/{WalletButton,SendCookPanel}
│   ├── swap/SwapPanel.tsx         # buy/sell, slippage, quote review, status machine
│   ├── feed/EventCard.tsx         # deterministic archetype rendering
│   ├── portfolio/HoldingsTable.tsx# shared holdings + TokenImage
│   └── ui/BackButton.tsx
├── hooks/usePortfolio.ts          # parallel portfolio reads for any address
├── lib/                           # client + shared pure helpers
│   ├── constants.ts               # URLs, COOK mints (native + bridged), program IDs
│   ├── chain.ts                   # RPC client + balance/account/token reads
│   ├── das.ts                     # DAS client (getAsset, getAssetsByOwner, searchAssets)
│   ├── pricing.ts                 # COOK/USD (CoinGecko, cached)
│   ├── tx.ts                      # build/sign/submit/confirm; prepareAggregateSwapTransfer
│   ├── demo.ts                    # localStorage Ed25519 demo keypair
│   ├── events.ts                  # FeedEvent types + archetype labels
│   ├── significance.ts            # scoring rules (unit-tested, shared with engine logic)
│   ├── format.ts                  # USD/compact/pct + toRawAmount/fromRawAmount (BigInt-safe)
│   ├── indexer-format.ts          # fmtAmount/short used by feed rendering
│   ├── nightly.ts                 # Cookie Chain network switch
│   └── providers.tsx              # wallet-standard React provider
├── server/
│   ├── http.ts                    # jsonError/readJson helpers
│   ├── auth/{message,session}.ts  # challenge construction + Ed25519 verify + session cookies
│   ├── db/{index,schema}.ts       # Drizzle client + schema (§4 envs)
│   ├── indexer/engine.ts          # createIndexer: processSlot/runCycle/runBoundedCycle
│   ├── swap.ts                    # Cookiebox client: quoteCookiebox, buildCookieboxSwapTx
│   └── swap-params.ts             # swap request validation (unit-tested)
├── scripts/indexer.mts            # standalone worker (tsx); --once / --backfill
└── types/tweetnacl.d.ts
tests/                             # Vitest: format, significance, events, swap
```

## 3. Data Flows

### Portfolio (any address)
1. `usePortfolio(address)` fires on address change (parallel `Promise.all`):
   - `getNativeBalance` → COOK lamports
   - `getTokenBalances` → per-mint SPL amounts + decimals (jsonParsed)
   - `getCookUsdPrice` → cached COOK/USD
   - `getAssetsByOwner` → DAS asset metadata by mint
   - `getRecentSignatures` → last blockTime for activity
2. Holdings built: COOK first (native, always present), then SPL tokens.
3. `valueUsd = priceUsd × amount`; `totalUsd = Σ valueUsd`.
4. Request-race guard via `requestId` refs (stale responses discarded).

### Send COOK
1. `getLatestBlockhash("confirmed")` → build legacy `Transaction` (`SystemProgram.transfer`, fee payer = connected account).
2. `solana:signTransaction` (fallback `solana:signAndSendTransaction`).
3. Broadcast via `sendRawTransaction`; poll `getSignatureStatus` until `confirmed`/`finalized` (60s timeout).
4. Status machine drives inline text + a single toast: sign → broadcast → confirm → done; success links to `cookiescan.io/tx/<sig>` and refreshes the portfolio.

### Swap (Cookiebox aggregate)
1. UI requests a quote via `GET /api/swap/quote` → server validates params (`parseSwapParams`), calls Cookiebox `/quote` (404 → "no route").
2. UI requests `POST /api/swap/build` → Cookiebox `/swap-tx` returns an **unsigned v0 transaction** (base64) + blockhash + lastValidBlockHeight.
3. `prepareAggregateSwapTransfer` deserializes the `VersionedTransaction` and **simulates** it on our RPC before signing (maps errors to actionable messages).
4. Wallet signs the versioned tx; CookieLens submits and confirms (same machine as Send COOK).
5. COOK leg always uses native mint `So111...12` (9 decimals) — the bridged SPL mint is never swapped.

### Auth claim (server-verified)
1. `/api/auth/challenge` issues a nonce stored in `claim_challenges` (expiry).
2. Client signs the challenge message:
   - Wallet path: wallet-standard `solana:signMessage` (connected wallet).
   - Demo path: tweetnacl `sign.detached` with a localStorage keypair.
3. `/api/auth/claim` reconstructs the expected message, verifies the Ed25519 signature **against the claimed wallet address**, consumes the challenge, upserts the profile, and sets an httpOnly signed session cookie.

### Indexer cycle
1. GitHub Actions cron (or manual) calls `/api/indexer/run` (guarded by `CRON_SECRET`).
2. `runBoundedCycle` (≤ ~200 slots / ≤ 9s) advances from `indexer_state`: `getSlots` / signatures → parse → upsert `wallets`/`tokens` + insert `activities` (unique by signature) → sample `token_stats` → significance engine writes `social_events`.
3. Frontend surfaces status via `/api/indexer/status`; feed via `/api/feed`.

## 4. Environment Variables

```env
# Public (client + server reads)
NEXT_PUBLIC_RPC_URL=https://rpc.cookiescan.io
NEXT_PUBLIC_WSS_URL=wss.cookiescan.io
NEXT_PUBLIC_DAS_URL=https://api.cookiescan.io
NEXT_PUBLIC_CHAIN_NAME=cookie-chain
NEXT_PUBLIC_COOK_MINT=36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1   # bridged SPL (labeling)
NEXT_PUBLIC_COOK_COINGECKO_ID=cookie-2
NEXT_PUBLIC_WALLET_STANDARD_CHAIN=solana:mainnet
NEXT_PUBLIC_SPL_TOKEN_PROGRAM_ID=TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
NEXT_PUBLIC_ATA_PROGRAM_ID=ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL
NEXT_PUBLIC_EXPLORER_URL=https://cookiescan.io
NEXT_PUBLIC_BRIDGE_URL=https://hyperlane.cookiescan.io
# Server-only
DATABASE_URL=postgresql://...pooler.neon.tech/cookielens?sslmode=require
SESSION_SECRET=random-48-bytes-base64
CRON_SECRET=random-shared-with-github-actions
COOKIEBOX_AGG_API_URL=https://agg.cookiebox.app   # optional override
```

Native COOK is **not** in env: the app hard-references mint `So11111111111111111111111111111111111111112` for balances and swaps (`AGG_COOK_MINT`).

## 5. Key Decisions

- **Read-heavy, two opt-in writes:** the browsing surface is free RPC/DAS/CoinGecko reads. Two signing flows satisfy the on-chain interaction requirement — **Send COOK** and **Swap** — both using wallet-standard signing with our-owned submit + confirm (60s).
- **Postgres (Neon) + indexer instead of pure static:** classification (convergence, verified wallets, holder deltas) needs history and cross-wallet state, so a cron-driven indexer writes `social_events`/`activities` deterministically. The API routes stay serverless-friendly (bounded cycles, idempotent upserts).
- **Deterministic event payloads:** `social_events.payload` is template-built JSONB (no LLM), so the feed is cheap, testable, and presentable.
- **Server-verified claims (always):** Demo Mode replaces the *signing transport* with a local keypair, never the *verification* — claim signatures are always validated against the wallet address by the API (Ed25519 via tweetnacl).
- **Swap uses the aggregator's v0 tx untouched, simulated first:** we never build routing ourselves; we deserialize + simulate the aggregator's transaction pre-sign, catching insufficient funds / stale blockhash / bad routes before the user signs.
- **wallet-standard (not legacy wallet-adapter):** Nightly supports the standard connect/sign features; `@wallet-standard/react` + `@wallet-standard/ui` are the canonical APIs.
- **Pricing fallbacks:** COOK price cached 60s module-wide; all USD columns degrade to "—" on failure.

## 6. Third-Party Services

| Service | Purpose | Why Used |
|---------|---------|----------|
| Cookie Chain RPC (rpc.cookiescan.io) | Native COOK balance, token accounts, tx history, simulate | Official public RPC, CORS open |
| CookieScan DAS API (api.cookiescan.io) | Token metadata, asset discovery | Standard Metaplex DAS interface |
| Cookiebox aggregator (agg.cookiebox.app) | Swap quotes + unsigned swap txs | Route aggregation + wrap/unwrap of native COOK |
| CoinGecko API | COOK/USD price + market cap | Free, no key required |
| Neon Postgres | Wallets/tokens/activities/events/identity | Serverless Postgres for Vercel |
| GitHub Actions | Cron indexer schedule | Free scheduled compute, calls `/api/indexer/run` |
| CookieScan explorer (cookiescan.io) | Transaction/mint links | User verification path |
| Vercel | Deployment | Free tier, Git integration |

## 7. Testing & Verification (commands)

| Command | Purpose |
|---------|---------|
| `npm run typecheck` | TypeScript strict check |
| `npm run lint` | ESLint |
| `npm test` | Vitest (format, significance, events, swap params) |
| `npm run build` | Next.js production build (also typechecks) |
| `npm run db:push` | Push Drizzle schema to Neon |
| `npx tsx scripts/indexer.mts --once` | Manual single indexer cycle |

Sandbox note: no dev-server runtime is available here; verification is tsc/build/test/lint only. Real wallet flows (Send COOK, Swap) require a funded wallet — a separate Nightly wallet funded with ~5–10 COOK is used for final on-chain verification before submission.