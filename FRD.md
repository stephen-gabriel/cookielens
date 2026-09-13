# CookieLens — Functional Requirements Document

## FR-1: Wallet Connection
- **What:** Users can connect their Nightly (or any wallet-standard wallet) to view their portfolio and sign transactions.
- **Priority:** P0
- **Acceptance Criteria:**
  - "Connect" button visible in header on all pages
  - Clicking opens the wallet connect flow; Nightly auto-switches to Cookie Chain
  - On success, wallet address displayed (truncated); "Disconnect" available
  - Connection persists across page refreshes (auto-restore) unless manually disconnected
  - Connect request times out after 60s with a clear error (no hang)
  - On mobile, chain-switch popup is skipped and a guidance banner is shown instead
- **Edge Cases:**
  - User rejects connection → error toast, no crash
  - No wallet installed → "Install Nightly" link shown
  - Network mismatch → auto-switch to Cookie Chain via `window.nightly.solana.changeNetwork`
  - Wallet-extension quirks (host permission, auto-refresh) → inline guidance

## FR-2: Portfolio View
- **What:** Show the connected wallet's complete Cookie Chain holdings with USD valuation.
- **Priority:** P0
- **Acceptance Criteria:**
  - Native COOK balance shown (from `getBalance`)
  - COOK USD price shown (CoinGecko, cached 60s)
  - All SPL token accounts shown with name, symbol, image, decimals-correct amount
  - Per-token USD value + portfolio total
  - Loading spinner while reading; refresh button re-reads
- **Edge Cases:**
  - Wallet has zero token accounts → show COOK balance only, empty-state row
  - Price API down → show amounts with "—" for USD, no crash
  - Connection error → inline error banner, refresh retries

## FR-3: Wallet Tracker ("Watch")
- **What:** Paste any Cookie Chain address and view its holdings + behavior.
- **Priority:** P0
- **Acceptance Criteria:**
  - Address input + Track button (disabled when input isn't a valid base58 pubkey)
  - Reuses the same portfolio read path (FR-2) for an arbitrary address
  - No wallet connection required
  - Shows COOK balance, USD total, and holdings table
  - Enter key submits; invalid input shows validation hint
- **Edge Cases:**
  - Empty/garbage input → disabled button + error hint
  - Unknown/empty address → empty holdings, zero balance (valid response)
  - Very large accounts → capped reads

## FR-4: Token Explorer + Search
- **What:** List every fungible token discovered on Cookie Chain.
- **Priority:** P0
- **Acceptance Criteria:**
  - COOK pinned as row #1 with live price + market cap
  - Other tokens from DAS `searchAssets` (fungible), deduped, ranked by holder count
  - Columns: rank, token (image+name+symbol), price, 24h change, market cap, holders
  - Row click → token detail page
- **Edge Cases:**
  - No tokens discovered → empty state row
  - Missing price data → "—" (data not indexed yet)
  - DAS slow/fails → error banner with retry on next mount

## FR-5: Token Detail Page
- **What:** Full metadata + community + trading view of a single token mint.
- **Priority:** P0
- **Acceptance Criteria:**
  - Header: image, name, symbol, mint (link to CookieScan)
  - Stats: price, market cap, total supply, holders (with 24h holder delta)
  - Community context: buyers/sellers 1h, verified wallets, 24h volume, recent activity rows
  - **Watch toggle** — persist a follow of this mint for the connected (or demo) wallet
  - **Swap panel** — buy/sell COOK ↔ this token via the Cookiebox aggregator (see FR-10)
  - Description shown when present
- **Edge Cases:**
  - Mint not in DAS → "Token not found" with back link
  - DAS error → retry once, then error state
  - Token backed by native COOK (mint `So111...12`) → swap routes native, not bridged

## FR-6: Live Network Stats (homepage)
- **What:** Homepage widgets showing live Cookie Chain + COOK market data.
- **Priority:** P1
- **Acceptance Criteria:**
  - COOK price (USD) from CoinGecko `cookie-2`
  - COOK market cap (price × max supply)
  - Current chain height via RPC `getSlot`
  - Indexer position + lag line (`/api/indexer/status`)
- **Edge Cases:**
  - CoinGecko down → "—" placeholders, loading state clears to dashes
  - Indexer not yet running → status line omitted, no crash

## FR-7: Transaction History
- **What:** Show recent transaction signatures for a wallet.
- **Priority:** P1
- **Acceptance Criteria:**
  - Reads `getSignaturesForAddress` for the active portfolio address
  - Most recent block time surfaced (feeds `lastActivity`)
- **Edge Cases:**
  - No signatures → null activity, no crash

## FR-8: Token Search (P2 — reserved)
- Search explorer by name/symbol via DAS `searchAssets(searchString)`.

## FR-9: Send COOK (on-chain transaction)
- **What:** Send native COOK from the connected wallet to any Cookie Chain address.
- **Priority:** P0 (required hackathon feature)
- **Acceptance Criteria:**
  - Available on the Portfolio page when a wallet is connected
  - Inputs: recipient address + amount (COOK), with validation (valid base58 pubkey, amount > 0, amount ≤ balance)
  - "Max" fills the spendable balance
  - Wallet signs via `solana:signTransaction` (falls back to `solana:signAndSendTransaction`)
  - CookieLens broadcasts and confirms the transaction against Cookie Chain RPC
  - **Real-time status updates:** "Confirm the transfer in your wallet…" → "Broadcasting to Cookie Chain…" → "Confirming on-chain…" → "COOK sent and confirmed"
  - Success shows the transaction signature with a CookieScan link + copy button, and refreshes the portfolio
  - Errors (rejection, insufficient COOK, on-chain failure, timeout) shown inline and as a toast
- **Edge Cases:**
  - User rejects in wallet → "Transfer cancelled" error, form remains usable
  - Insufficient COOK for amount + fee → "Insufficient COOK balance" hint / RPC error surfaced
  - Confirmation timeout → error with the signature so the user can verify on CookieScan
  - Wallet lacks signing features → clear "wallet does not support signing" message

## FR-10: Swap COOK ↔ Token (on-chain transaction)
- **What:** Trade any token against native COOK through the Cookiebox aggregator.
- **Priority:** P0 (primary remaining on-chain feature)
- **Acceptance Criteria:**
  - Available on Token detail pages (and usable for COOK itself)
  - Buy/Sell toggle (COOK as quote only — the input for buys, output for sells)
  - Amount input with validated decimals; "Max" fills the pay-side balance
  - Slippage selector (0.5% / 1% / 2.5% / 5% / 10%)
  - Quote via `GET /api/swap/quote` → shows expected receive, minimum after slippage, price impact, aggregator fee, and route venues
  - "No route found" state when the aggregator has no liquidity for the pair/amount
  - Build via `POST /api/swap/build` → unsigned **v0 transaction** from the aggregator
  - CookieLens **simulates** the transaction on our RPC before signing (surfaces insufficient balance / stale-blockhash / route errors with actionable messages)
  - Wallet signs the versioned transaction; CookieLens submits and confirms
  - Real-time status: sign → submitting → confirming → done; explorer link + signature copy
  - Balances refresh after a successful swap
- **Edge Cases:**
  - Aggregator 404 (no route) vs 5xx (service down) handled distinctly
  - Thin liquidity → high price-impact warning color
  - Simulation failure → human-readable reason + "re-quote and retry"
  - COOK leg always uses the **native** mint `So11111111111111111111111111111111111111112` (9 decimals), never the bridged SPL mint

## FR-11: Social Feed (Discover + Following)
- **What:** Homepage feed of classified on-chain events (archetypes) from the significance engine, and a personal feed of followed wallets.
- **Priority:** P0
- **Acceptance Criteria:**
  - Discover tab shows recent `social_events` across the chain
  - Following tab shows events where the actor is a wallet the user follows (requires a claimed profile)
  - Event cards render deterministically from JSONB payloads (no LLM) with archetype label/emoji
  - Tabs: Following / Discover; 401 on Following (no session) → prompt to claim
- **Archetypes:** `significant_entry`, `community_convergence`, `early_discovery`, `large_movement`, `token_momentum`, `network_activity`
- **Edge Cases:**
  - Indexer not live → graceful empty states / "Indexer warming up" messaging
  - No followed wallets → empty state + link to the wallet directory

## FR-12: Wallet Directory
- **What:** Browse wallets and claimed profiles on Cookie Chain.
- **Priority:** P1
- **Acceptance Criteria:**
  - `/wallets` lists wallets ranked by activity (verified/claimed profiles surfaced)
  - `/wallets/[address]` is a profile page with holdings, stats, events, and a Follow button
  - Active-wallets endpoint is indexer-derived and capped
- **Edge Cases:**
  - Unclaimed wallet → generic wallet view, no username
  - Sparse data before the indexer runs → empty states

## FR-13: Identity & Following
- **What:** Claim a wallet (username), follow wallets, and get a personalized Following feed.
- **Priority:** P1
- **Acceptance Criteria:**
  - Claim: server issues a nonce challenge; client signs it (wallet-standard for connected wallets, local Ed25519 for Demo Mode); API verifies Ed25519 against the wallet address, then creates/updates the profile + session
  - Session persisted in an httpOnly cookie (signed with `SESSION_SECRET`)
  - Username unique; profile links wallet ↔ display name
  - Follow/unfollow server-backed per wallet; duplicates prevented
- **Edge Cases:**
  - Stale/expired challenge → re-issue
  - Bad signature → 401 with clear reason
  - Demo keypair survives across sessions so a demo user keeps their identity; explicit "reset identity" clears it

## FR-14: Demo Mode (P2)
- **What:** Explore the full social surface without a wallet.
- **Priority:** P2
- **Acceptance Criteria:**
  - "Demo" entry generates a browser-local Ed25519 keypair (tweetnacl) persisted in localStorage
  - Claim flow signs the challenge locally; identity behaves like a real wallet address
  - Demo user can follow, watch tokens, and see a Following feed
  - Explicit "reset demo identity" action
- **Edge Cases:**
  - Storage unavailable → keypair still valid for the session
  - Never implies on-chain control (no funds); demo identity is clearly a product-exploration path, claims remain server-verified Ed25519 either way

## FR-15: Indexer & Significance Engine
- **What:** A server-side worker keeps Postgres fresh and classifies meaningful on-chain activity.
- **Priority:** P0
- **Acceptance Criteria:**
  - `createIndexer(env)` exposes `processSlot`, `runCycle`, `runBoundedCycle` (production cap: ~200 slots / 9s per run)
  - Polls Cookie Chain RPC for new slots + signatures; parses token interactions (buy/sell/swap/liquidity/transfer/create/bridge/stake)
  - Deduplicates by transaction signature (re-runnable)
  - Maintains `wallets`, `tokens`, `token_stats`, and `activities`
  - Significance engine emits `social_events` deterministically (archetype, significance score, source activity ids) — no LLM prose
  - Progress persisted in `indexer_state`; `/api/indexer/status` surfaces head/lag
  - Scheduled by GitHub Actions cron → `/api/indexer/run` (guarded by `CRON_SECRET`); a manual `/api/indexer/run?once=1` is also available
- **Edge Cases:**
  - Cron miss / double-fire → idempotent upserts + unique activity signatures
  - Serverless 60s max → bounded cycles; runbook documents the cap
  - RPC flakiness → stateful resume from last processed slot

## Error Handling Matrix

| Error | UI Response | Recovery |
|-------|-------------|----------|
| Wallet not installed | "Install Nightly" link | User installs wallet |
| Connection rejected | Toast error | Retry connection |
| Connect timeout (60s) | Timeout error + guidance | Retry |
| RPC unreachable | Error banner on page | Refresh button |
| DAS unreachable | Error banner; pricing shows "—" | Retry on next mount |
| CoinGecko unreachable | "—" for price/market cap | Auto-retry on next page load |
| Invalid watched address | Disabled button + hint | User fixes input |
| User rejects signature | "Transfer cancelled" toast + inline | Retry (Send/Swap) |
| Insufficient COOK | Inline "Insufficient COOK balance" / RPC error | Receive/bridge COOK |
| Swap: no route | "No swap route found" empty state | Change amount/pair |
| Swap: simulate fail | Actionable reason (insufficient / stale blockhash / route) | Re-quote and retry |
| Aggregator down | 502 with detail | Retry later |
| On-chain tx failure | Error toast with reason | Retry or check CookieScan |
| Auth: bad/stale challenge | Re-issue challenge with clear message | User re-signs |

## Testing Checklist (current)

- [x] Wallet connects on Cookie Chain (not Solana mainnet)
- [x] Connect timeout + mobile guidance
- [x] Portfolio shows real COOK balance for a funded wallet
- [x] Portfolio shows correct USD math (COOK × price)
- [x] Watch page works with a pasted address
- [x] Token explorer populates COOK + discovered tokens
- [x] Token detail page loads for a known mint (community stats, per-token activity)
- [x] Homepage shows COOK price, market cap, chain height, indexer status
- [x] Send COOK validates address + amount + balance
- [x] Send COOK signs, broadcasts, confirms, shows status progression + explorer link
- [x] Demo mode: claim, follow, watch, Following feed without a wallet
- [x] Feed renders Discover events; Following requires a profile
- [x] Vitest suite (format, significance, events, swap params) passes
- [x] Mobile responsive on all pages
- [x] No TypeScript errors
- [x] No ESLint errors
- [x] Build succeeds
- [ ] Swap: end-to-end on-chain buy & sell with a funded wallet (pending live gas test)
- [ ] Handoff fund management (100 COOK budget to submission)

## Out Of Scope (submission-bounded)

- Candle/OHLCV charts (tables + time-series stats only; recharts reserved for future sparklines)
- On-chain governance/claim tooling for real assets
- Multi-chain aggregator beyond Cookie Chain
- LLM-generated event prose (payloads are deterministic templates by design)