# CookieLens — Functional Requirements Document

## FR-1: Wallet Connection
- **What:** Users can connect their Nightly (or any wallet-standard wallet) to view their portfolio.
- **Priority:** P0
- **Acceptance Criteria:**
  - "Connect" button visible in header on all pages
  - Clicking opens the wallet connect flow (nightly auto-switches to Cookie Chain)
  - On success, wallet address displayed (truncated)
  - "Disconnect" option available
  - Connection persists across page refreshes (auto-restore), unless the user manually disconnected
- **Edge Cases:**
  - User rejects connection → error toast, no crash
  - No wallet installed → "Install Nightly" link shown
  - Network mismatch → auto-switch to Cookie Chain via `window.nightly.solana.changeNetwork`

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
- **What:** Paste any Cookie Chain address and view its holdings.
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
  - Very large accounts → capped reads (limit 500 assets)

## FR-4: Token Explorer
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
- **What:** Full metadata view of a single token mint.
- **Priority:** P1
- **Acceptance Criteria:**
  - Header: image, name, symbol, mint (link to CookieScan)
  - Stats: price, market cap, total supply, decimals
  - Description shown when present
- **Edge Cases:**
  - Mint not in DAS → "Token not found" with back link
  - DAS error → retry once, then error state

## FR-6: Live Network Stats (homepage)
- **What:** Homepage widgets showing live Cookie Chain + COOK market data.
- **Priority:** P1
- **Acceptance Criteria:**
  - COOK price (USD) from CoinGecko `cookie-2`
  - COOK market cap (price × 1B max supply)
  - Current chain height via RPC `getSlotHeight`
- **Edge Cases:**
  - CoinGecko down → "—" placeholders, loading state clears to dashes

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

## Error Handling Matrix

| Error | UI Response | Recovery |
|-------|-------------|----------|
| Wallet not installed | "Install Nightly" link | User installs wallet |
| Connection rejected | Toast error | Retry connection |
| RPC unreachable | Error banner on page | Refresh button |
| DAS unreachable | Error banner; pricing shows "—" | Retry on next mount |
| CoinGecko unreachable | "—" for price/market cap | Auto-retry on next page load |
| Invalid watched address | Disabled button + hint | User fixes input |
| User rejects signature | "Transfer cancelled" toast + inline | Retry |
| Insufficient COOK | Inline "Insufficient COOK balance" / RPC error | Receive/bridge COOK |
| On-chain tx failure | Error toast with reason | Retry or check CookieScan |

## Testing Checklist

- [ ] Wallet connects on Cookie Chain (not Solana mainnet)
- [ ] Portfolio shows real COOK balance for a funded wallet
- [ ] Portfolio shows correct USD math (COOK × price)
- [ ] Watch page works with a pasted address (e.g., reserve vault shows 379M+ COOK)
- [ ] Token explorer populates COOK + discovered tokens
- [ ] Token detail page loads for a known mint
- [ ] Homepage shows COOK price, market cap, and chain height
- [ ] Send COOK validates address + amount + balance
- [ ] Send COOK signs, broadcasts, confirms, and shows the status progression
- [ ] Send COOK success shows a working CookieScan tx link and refreshes the portfolio
- [ ] Send COOK rejection/failure shows a clear error
- [ ] Mobile responsive on all pages
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Build succeeds