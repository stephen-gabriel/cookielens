# CookieLens

Analytics + portfolio tracker for **Cookie Chain**. See native COOK and every token holding for any wallet — priced in USD, ranked across the chain — plus live network stats and a one-click **Send COOK** transfer.

## Why

Cookie Chain has explorers, DEXs, a launchpad, and a bridge — but no portfolio-aggregation layer. CookieLens is that layer: connect a wallet (Nightly or any wallet-standard wallet), paste any address to watch it, browse every token on the chain, and send COOK with live status feedback.

## Features

- **Overview** — live COOK price (CoinGecko), market cap, and current chain height
- **Portfolio** — connected wallet's COOK + token balances with USD valuation
- **Send COOK** — transfer native COOK on-chain with real-time status (sign → broadcast → confirm) and a CookieScan link
- **Watch** — track any Cookie Chain address (no connection required)
- **Tokens** — every fungible token on the chain, ranked by holders, COOK pinned
- **Token detail** — per-token metadata, price, market cap, and supply

## Getting Started

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` (all variables are public; `public/` values are prefixed `NEXT_PUBLIC_`)
3. Run the dev server: `npm run dev`
4. Open [http://localhost:3000](http://localhost:3000)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |

## Data Sources

| Source | Used For |
|--------|----------|
| Cookie Chain RPC (`rpc.cookiescan.io`) | Native balances, token accounts, tx history |
| CookieScan DAS API (`api.cookiescan.io`) | Token metadata + asset discovery |
| CoinGecko (`cookie-2`) | COOK/USD price and market cap |

## Documentation

See [PRD.md](./PRD.md), [FRD.md](./FRD.md), and [ARCHITECTURE.md](./ARCHITECTURE.md) for full documentation.