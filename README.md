# CookieLens

Analytics + portfolio tracker for **Cookie Chain**. See native COOK and every token holding for any wallet — priced in USD, ranked across the chain — plus live network stats, one-click **Send COOK** transfers, and **swap** between COOK and any token via the Cookiebox aggregator.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)](https://neon.tech/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-0.45-C5F74F?logo=drizzle)](https://orm.drizzle.team/)
[![Solana web3.js](https://img.shields.io/badge/Solana-web3.js-9945FF?logo=solana)](https://solana.com/)
[![Wallet-Standard](https://img.shields.io/badge/Wallet-Standard-512888?logo=wallet)](https://wallet-standard.github.io/)
[![tweetnacl](https://img.shields.io/badge/tweetnacl-Ed25519-2B579A?logo=libreoffice&logoColor=white)](https://github.com/dchest/tweetnacl-js)
[![Vitest](https://img.shields.io/badge/Vitest-5-6BA552?logo=vitest)](https://vitest.dev/)
[![recharts](https://img.shields.io/badge/recharts-3-22B8CF?logo=charts-dot-js)](https://recharts.org/)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-cron-2088FF?logo=github-actions&logoColor=white)](https://github.com/features/actions)
[![Cookie Chain](https://img.shields.io/badge/Cookie-9600FF?logo=solana)](https://www.cookiechain.wtf/)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com/)

## Why

Cookie Chain has explorers, DEXs, a launchpad, and a bridge — but no portfolio-aggregation layer. CookieLens is that layer: connect a wallet (Nightly or any wallet-standard wallet), paste any address to watch it, browse every token on the chain, send COOK, and swap between COOK and any token with live status feedback.

## Features

- **Overview** — live COOK price (CoinGecko), market cap, and current chain height
- **Portfolio** — connected wallet's COOK + token balances with USD valuation
- **Send COOK** — transfer native COOK on-chain with real-time status (sign → broadcast → confirm) and a CookieScan link
- **Swap** — trade COOK ↔ any token through the Cookiebox aggregator (quote → simulate → sign → submit → confirm) with slippage and price-impact controls
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
| Cookiebox aggregator (`agg.cookiebox.app`) | Swap quotes + unsigned swap transactions |

> COOK is native on Cookie Chain (mint `So11111111111111111111111111111111111111112`, 9 decimals), distinct from the bridged SPL variant that appears in DAS metadata. Swaps always route the native mint.

## Documentation

See [PRD.md](./PRD.md), [FRD.md](./FRD.md), and [ARCHITECTURE.md](./ARCHITECTURE.md) for full documentation.