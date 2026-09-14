# CookieLens

CookieLens is the portfolio aggregation, social discovery, and market exploration platform for **Cookie Chain**. It transforms raw on-chain activity into structured, actionable social signals — enabling users to track wallet portfolios, follow active traders, discover emerging tokens, send native COOK, and swap COOK ↔ any token with real-time on-chain confirmation.

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

---

## 🌟 Key Features

- **Portfolio Tracker**: Connected wallet view for native COOK + all SPL token holdings with USD valuation.
- **Send COOK**: Direct native COOK token transfers on Cookie Chain with real-time status feedback (Sign → Broadcast → Confirm) and direct CookieScan explorer links.
- **Swap Aggregator**: Integrated Cookiebox swap engine (COOK ↔ any token) with simulation guard, slippage controls, and price impact estimation.
- **Social Discover & Following Feed**: Classified on-chain events (Significant Entries, Community Convergence, Early Token Activity, Large Movements, Token Momentum, and Network Activity).
- **Wallet Directory & Profiles**: Claim username with Ed25519 wallet challenge signatures (or test via Demo Mode), follow wallets, and watch tokens.
- **Token Explorer & Detail Pages**: Per-token price, market cap, supply, holder metrics, community context, and activity history.
- **Address Tracker**: Track any Cookie Chain address without connecting a wallet.
- **Automated Indexer**: Cron-driven background worker (GitHub Actions + Next.js API) that indexes slots, parses activities, and writes classified social events to Neon Postgres.

---

## 🏗️ Architecture Overview

```
                      COOKIE CHAIN RPC & DAS
                           │           │
                           ▼           ▼
                     CookieLens Background Indexer
                     (GitHub Actions cron worker)
                                  │
                                  ▼
                            Neon Postgres
                       (Drizzle ORM Schema)
                                  │
                                  ▼
                         CookieLens Next.js API
                                  │
                                  ▼
                         React / Tailwind UI
              (Wallet-Standard + Ed25519 Verification)
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Ensure the following variables are configured:
* `NEXT_PUBLIC_RPC_URL`: `https://rpc.cookiescan.io`
* `NEXT_PUBLIC_DAS_URL`: `https://api.cookiescan.io`
* `DATABASE_URL`: Your Neon PostgreSQL connection string
* `CRON_SECRET`: Secret token for indexer cron authorization

### 3. Run Database Migrations
```bash
npm run db:push
```

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view CookieLens in your browser.

---

## 🧪 Testing & Verification

| Command | Purpose |
|---------|---------|
| `npm test` | Run Vitest unit test suite (tx parsing, formatters, swap params, significance engine, feed events) |
| `npm run typecheck` | Execute TypeScript strict typecheck (`tsc --noEmit`) |
| `npm run lint` | Run ESLint check |
| `npm run build` | Perform Next.js production build |

---

## 📖 Documentation

* [Product Requirements Document (PRD)](./PRD.md)
* [Functional Requirements Document (FRD)](./FRD.md)
* [Architecture Document](./ARCHITECTURE.md)
* [Design System Guide](./docs/COOKIE_LENS_DESIGN_SYSTEM.md)
* [Project Specification Guide](./docs/COOKIE_LENS_STEVEN_GUIDE.md)

---

## 📜 License

MIT License. Built for Cookie Chain ecosystem.