# CookiePump — Architecture Document

## 1. System Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                       │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                    Next.js App Router                    │  │
│  │  ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌───────────┐  │  │
│  │  │ Landing  │ │  Bake    │ │ Token   │ │  Explore  │  │  │
│  │  │  Page    │ │  Page    │ │ Detail  │ │   Page    │  │  │
│  │  └──────────┘ └──────────┘ └─────────┘ └───────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                   Shared Components                     │  │
│  │  WalletProvider │ Toast Provider │ Layout │ Charts      │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                    Hooks / Utils                        │  │
│  │  useWallet │ usePool │ useToken │ useTransaction        │  │
│  └────────────────────────────────────────────────────────┘  │
└───────────────────────┬──────────────────────────────────────┘
                        │ RPC + Wallet Signing
                        ▼
┌──────────────────────────────────────────────────────────────┐
│                    COOKIE CHAIN (SVM)                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │  Metaplex    │ │ CookieBox    │ │ CookieBox            │ │
│  │  Token       │ │ DBC          │ │ DAMM                 │ │
│  │  Metadata    │ │ (Bonding     │ │ (Post-migration      │ │
│  │  (Token      │ │  Curve)      │ │  liquidity)          │ │
│  │  Creation)   │ │              │ │                      │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  SPL Token / Token-2022 / Associated Token Account       ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │  Irys/       │ │ Cookiescan   │ │  Jupiter Price API   │ │
│  │  Arweave     │ │ Explorer     │ │  (Token Prices)      │ │
│  │  (Metadata)  │ │ (Tx Links)   │ │                      │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## 2. File/Folder Structure

```
cookiepump/
├── .env.example
├── .gitignore
├── README.md
├── PRD.md
├── FRD.md
├── ARCHITECTURE.md
├── next.config.ts
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.js
├── public/
│   ├── cookie-logo.svg
│   ├── og-image.png
│   └── favicon.ico
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout with providers
│   │   ├── page.tsx                      # Landing page
│   │   ├── globals.css                   # Global styles + Tailwind
│   │   ├── bake/
│   │   │   └── page.tsx                  # Token creation form
│   │   ├── token/
│   │   │   └── [mint]/
│   │   │       └── page.tsx              # Token detail page
│   │   ├── explore/
│   │   │   └── page.tsx                  # Token explorer
│   │   ├── dashboard/
│   │   │   └── page.tsx                  # Creator dashboard
│   │   └── api/
│   │       ├── tokens/
│   │       │   ├── route.ts              # List all tokens
│   │       │   └── [mint]/
│   │       │       ├── route.ts          # Token details + pool state
│   │       │       └── trades/
│   │       │           └── route.ts      # Recent trades for a token
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx                # Nav + wallet connect
│   │   │   ├── Footer.tsx
│   │   │   └── MobileNav.tsx
│   │   ├── wallet/
│   │   │   ├── WalletButton.tsx          # Connect/disconnect
│   │   │   └── WalletBalance.tsx         # COOK balance display
│   │   ├── token/
│   │   │   ├── TokenCard.tsx             # Grid card for explorer
│   │   │   ├── TokenHeader.tsx           # Name, symbol, image
│   │   │   ├── TokenInfo.tsx             # Mint, supply, creator
│   │   │   └── StatusBadge.tsx           # Baking/Baked/Migrated
│   │   ├── bake/
│   │   │   ├── BakeForm.tsx              # Token creation form
│   │   │   ├── ImageUpload.tsx           # Drag-drop image upload
│   │   │   └── BakeConfirm.tsx           # Review before submit
│   │   ├── trading/
│   │   │   ├── BondingCurveChart.tsx     # Price chart
│   │   │   ├── BuyPanel.tsx              # Buy interface
│   │   │   ├── SellPanel.tsx             # Sell interface
│   │   │   └── ProgressToMigration.tsx   # Migration progress
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Card.tsx
│   │       ├── Badge.tsx
│   │       ├── Toast.tsx
│   │       ├── Skeleton.tsx
│   │       └── Modal.tsx
│   ├── hooks/
│   │   ├── useConnection.ts              # Cookie Chain RPC connection
│   │   ├── useWallet.ts                  # Wallet state + helpers
│   │   ├── usePool.ts                    # DBC pool state reader
│   │   ├── useToken.ts                   # Token metadata reader
│   │   ├── useCreateToken.ts             # Metaplex token creation
│   │   ├── useInitializePool.ts          # DBC pool initialization
│   │   ├── useBuyTokens.ts               # DBC buy instruction
│   │   ├── useSellTokens.ts              # DBC sell instruction
│   │   ├── useTransaction.ts             # Tx confirmation helper
│   │   └── useTokenList.ts               # Explorer token list
│   ├── lib/
│   │   ├── constants.ts                  # Program IDs, RPC URLs
│   │   ├── providers.tsx                 # Wallet adapter provider
│   │   ├── dbc.ts                        # CookieBox DBC IDL + helpers
│   │   ├── metaplex.ts                   # Metaplex Umi setup
│   │   ├── pool.ts                       # Pool state derivation
│   │   ├── metadata.ts                   # Metadata upload helpers
│   │   ├── price.ts                      # Price calculation utils
│   │   └── format.ts                     # Number/address formatting
│   ├── idl/
│   │   └── dynamic_bonding_curve.json    # CookieBox DBC IDL
│   └── types/
│       ├── token.ts                      # Token type definitions
│       ├── pool.ts                       # Pool type definitions
│       └── trade.ts                      # Trade type definitions
└── tests/
    ├── hooks/
    │   └── usePool.test.ts
    └── lib/
        └── price.test.ts
```

## 3. Tech Stack Table

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | Next.js | 14+ | App Router, SSR, API routes |
| Language | TypeScript | 5.x | Type safety |
| Styling | Tailwind CSS | 4.x | Utility-first CSS |
| Charts | Recharts | 2.x | Bonding curve visualization |
| Wallet | @solana/wallet-adapter | Latest | Wallet connection |
| Wallet Plugin | @nightly-app/wallet-adapter | Latest | Nightly support |
| On-chain | @solana/web3.js | 2.x | Solana RPC interaction |
| Anchor | @coral-xyz/anchor | Latest | IDL-based program interaction |
| Metaplex Umi | @metaplex-foundation/umi | Latest | Token creation framework |
| Metaplex Token | @metaplex-foundation/mpl-token-metadata | Latest | Fungible token creation |
| Metaplex Upload | @metaplex-foundation/umi-uploader-irys | Latest | Metadata upload |
| CookieBox DBC | Anchor IDL (custom) | 0.1.0 | Bonding curve program |
| Notifications | react-hot-toast | Latest | Toast notifications |
| Icons | lucide-react | Latest | UI icons |
| Deployment | Vercel | N/A | Hosting |

## 4. Environment Variables

```env
# .env.example

# Cookie Chain RPC
NEXT_PUBLIC_RPC_URL=https://rpc.cookiescan.io
NEXT_PUBLIC_WSS_URL=wss.cookiescan.io

# Cookie Chain Network
NEXT_PUBLIC_CHAIN_NAME=cookie-chain
NEXT_PUBLIC_CHAIN_ID=cookie-mainnet

# Program IDs (public, not secrets)
NEXT_PUBLIC_DBC_PROGRAM_ID=DBCg4ugDEztk6MbqHEJvx5a5YGJTj45Jb5NvtQ48Rvsf
NEXT_PUBLIC_DAMM_PROGRAM_ID=DAMMjDCEFTDkt7ywazZS8GoaLtjb3HaJo3pLbf64xrPY
NEXT_PUBLIC_CLMM_PROGRAM_ID=CLMMmWqTtyNSomqXP3kETJy2SGKPdr31USsm4GfbLyKs
NEXT_PUBLIC_METAPLEX_PROGRAM_ID=metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s
NEXT_PUBLIC_SPL_TOKEN_PROGRAM_ID=TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
NEXT_PUBLIC_ATA_PROGRAM_ID=ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL

# COOK Token (native token)
NEXT_PUBLIC_COOK_MINT=36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1

# Pool Authority PDA
NEXT_PUBLIC_POOL_AUTHORITY=FhVo3mqL8PW5pH5U2CN4XE33DokiyZnUwuGpH2hmHLuM

# Metadata Upload (Irys)
IRYS_PRIVATE_KEY=                    # Server-side only, never exposed

# Explorer
NEXT_PUBLIC_EXPLORER_URL=https://cookiescan.io
NEXT_PUBLIC_BRIDGE_URL=https://hyperlane.cookiescan.io
```

## 5. API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/tokens` | None | List all launched tokens (paginated) |
| GET | `/api/tokens/[mint]` | None | Get token details + pool state |
| POST | `/api/tokens` | Wallet signature | Register new token in index |
| GET | `/api/tokens/[mint]/trades` | None | Get recent trades for a token |

## 6. Key Dependencies (package.json)

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@solana/web3.js": "^2.0.0",
    "@solana/wallet-adapter-base": "^0.9.0",
    "@solana/wallet-adapter-react": "^0.15.0",
    "@solana/wallet-adapter-react-ui": "^0.9.0",
    "@solana/wallet-adapter-wallets": "^0.19.0",
    "@coral-xyz/anchor": "^0.30.0",
    "@metaplex-foundation/umi": "^1.0.0",
    "@metaplex-foundation/umi-bundle-defaults": "^1.0.0",
    "@metaplex-foundation/mpl-token-metadata": "^4.0.0",
    "@metaplex-foundation/mpl-toolbox": "^1.0.0",
    "@metaplex-foundation/umi-uploader-irys": "^1.0.0",
    "recharts": "^2.12.0",
    "react-hot-toast": "^2.4.0",
    "bs58": "^6.0.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/react": "^18.3.0",
    "@types/node": "^20.0.0",
    "tailwindcss": "^4.0.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^8.0.0",
    "eslint-config-next": "^14.2.0"
  }
}
```

## 7. Third-Party Services

| Service | Purpose | Why Used |
|---------|---------|----------|
| Cookie Chain RPC | Blockchain reads/writes | Primary chain interaction |
| Irys (via Metaplex) | Metadata + image upload | Decentralized storage for token metadata |
| Cookiescan.io | Transaction links | Explorer for tx verification |
| Jupiter Price API | Token price data | Real-time price feeds |
| Vercel | Deployment | Fast, free tier, Git integration |