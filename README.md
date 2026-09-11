# CookieLens

Analytics + portfolio tracker for **Cookie Chain**. See native COOK and every token holding for any wallet — priced in USD, ranked across the chain — plus live network stats and a one-click **Send COOK** transfer.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Solana web3.js](https://img.shields.io/badge/Solana-web3.js-9945FF?logo=solana)](https://solana.com/)
[![Wallet-Standard](https://img.shields.io/badge/Wallet-Standard-512888?logo=wallet)](https://wallet-standard.github.io/)
[![Cookie Chain](https://img.shields.io/badge/Cookie-9600FF?logo=solana)](https://www.cookiechain.wtf/)

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