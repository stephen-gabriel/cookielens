# CookiePump — Functional Requirements Document

## FR-1: Wallet Connection
- **What:** Users can connect their Nightly wallet to the application
- **Priority:** P0
- **Acceptance Criteria:**
  - "Connect Wallet" button visible on all pages
  - Clicking opens Nightly wallet popup
  - On success, wallet address displayed (truncated: `abc1...wxyz`)
  - COOK balance displayed next to address
  - "Disconnect" option available
  - Connection persists across page refreshes (localStorage)
- **Edge Cases:**
  - User rejects connection → show "Connection rejected" toast
  - No Nightly installed → show "Install Nightly" link
  - Network mismatch → auto-switch to Cookie Chain or show warning

## FR-2: Token Creation Form ("Bake")
- **What:** Users fill a form to define their token parameters
- **Priority:** P0
- **Acceptance Criteria:**
  - Fields: Name (max 32 chars), Symbol (max 6 chars), Description (max 500 chars), Image upload
  - Image upload: drag-and-drop or click, accepts PNG/JPG/GIF, max 5MB, preview shown
  - Form validation: all fields required, name/symbol length limits enforced
  - "Bake" submit button disabled until form valid
  - Button shows loading spinner during submission
- **Edge Cases:**
  - Image too large → "Image must be under 5MB" error
  - Invalid file type → "Please upload an image file" error
  - Network error during upload → retry option

## FR-3: Metadata Upload
- **What:** Token image and metadata JSON uploaded to Irys/Arweave via Metaplex Umi
- **Priority:** P0
- **Acceptance Criteria:**
  - Image uploaded first, receives Arweave URI
  - Metadata JSON constructed: `{ name, symbol, description, image: arweaveUri }`
  - Metadata JSON uploaded, receives metadata URI
  - Metadata URI stored for on-chain registration
- **Edge Cases:**
  - Upload fails → retry with exponential backoff (max 3 retries)
  - Partial upload (image ok, metadata fails) → clean up, retry metadata only

## FR-4: Metaplex Token Deployment
- **What:** Create fungible token on-chain using Metaplex Token Metadata program
- **Priority:** P0
- **Acceptance Criteria:**
  - `createFungible` called with: mint (new keypair), name, symbol, uri (metadata URI), decimals: 9
  - Initial supply minted to creator's wallet (e.g., 1 billion tokens)
  - Transaction confirmed on Cookie Chain
  - Mint address captured and stored
  - Success toast: "Cookie minted!"
- **Edge Cases:**
  - Transaction fails → show error with tx signature, suggest retry
  - Insufficient COOK for fees → show "Insufficient COOK for gas" warning
  - Duplicate submission prevention (disable button after first click)

## FR-5: DBC Pool Initialization
- **What:** Initialize a bonding curve pool via CookieBox DBC program
- **Priority:** P0
- **Acceptance Criteria:**
  - Pool created with: baseMint (new token), quoteMint (COOK), configurable curve parameters
  - Migration threshold set (e.g., 85 SOL equivalent in COOK)
  - Pool authority PDA derived and stored
  - Transaction confirmed
  - Success toast: "Cookie is now baking!"
- **Edge Cases:**
  - Pool init fails → token exists but no pool, show error state
  - Curve parameters invalid → validate before submission

## FR-6: Bonding Curve Visualization
- **What:** Live chart showing token price progression on the bonding curve
- **Priority:** P0
- **Acceptance Criteria:**
  - X-axis: tokens sold (supply on curve)
  - Y-axis: price in COOK
  - Current position marked with dot/line
  - Migration threshold shown as dashed line
  - Percent complete to migration shown as progress bar
  - Chart updates every 5 seconds via RPC polling
  - Responsive design (works on mobile)
- **Edge Cases:**
  - RPC fails → show last known state with "stale data" indicator
  - Pool not found → show "Pool not initialized" state

## FR-7: Buy on Bonding Curve
- **What:** Purchase tokens with COOK through the DBC program
- **Priority:** P0
- **Acceptance Criteria:**
  - Input: amount of COOK to spend
  - Output: estimated tokens received (calculated from curve math)
  - "Buy" button triggers wallet signature request
  - Transaction confirmed → tokens appear in user's wallet
  - Chart updates to reflect new position
  - Success toast with tx link to cookiescan.io
- **Edge Cases:**
  - Slippage tolerance exceeded → show warning, allow retry
  - Curve fully migrated → disable buy, show "Curve completed" state
  - Insufficient COOK → disable button, show balance needed

## FR-8: Sell on Bonding Curve
- **What:** Sell tokens back for COOK through the DBC program
- **Priority:** P0
- **Acceptance Criteria:**
  - Input: amount of tokens to sell
  - Output: estimated COOK received
  - "Sell" button triggers wallet signature request
  - Transaction confirmed → COOK appears in user's wallet
  - Chart updates
  - Success toast with tx link
- **Edge Cases:**
  - No tokens held → disable sell, show "You don't own this token"
  - Curve fully migrated → redirect to DAMM trading (if applicable)

## FR-9: Transaction Feedback
- **What:** Real-time transaction status updates for all on-chain interactions
- **Priority:** P0
- **Acceptance Criteria:**
  - States: "Sending transaction..." → "Confirming..." → "Confirmed!"
  - Transaction signature always shown (clickable link to cookiescan.io)
  - Error states: "Transaction failed" with reason when possible
  - Toast notifications for success/error
  - No orphaned loading states (always resolve)
- **Edge Cases:**
  - Timeout after 30s → show "Transaction may have failed, check explorer"
  - User closes wallet popup → cancel gracefully

## FR-10: Token Explorer
- **What:** Browse all tokens launched on CookiePump
- **Priority:** P1
- **Acceptance Criteria:**
  - Grid layout showing token cards: image, name, symbol, status badge
  - Status badges: "Baking" (curve active), "Baked" (curve complete), "Migrated" (on DAMM)
  - Sort: newest, most volume, most holders
  - Filter by status
  - Pagination or infinite scroll
  - Click card → navigate to token detail page
- **Edge Cases:**
  - No tokens yet → show empty state "No cookies baked yet — be the first!"
  - Slow loading → skeleton placeholders

## FR-11: Token Detail Page
- **What:** Full view of a single token with trading interface
- **Priority:** P1
- **Acceptance Criteria:**
  - Token header: image, name, symbol, mint address (copyable)
  - Bonding curve chart (from FR-6)
  - Trading panel: buy/sell interface (from FR-7, FR-8)
  - Token info: creator address, creation date, total supply, decimals
  - Pool info: quote raised, migration threshold, percent complete
  - Transaction history (recent trades)
  - Share button (from FR-15)
- **Edge Cases:**
  - Token not found → 404 page with a playful message
  - Pool migrated → show DAMM trading link instead of curve

## FR-12: Creator Dashboard
- **What:** View all tokens you've created and their performance
- **Priority:** P1
- **Acceptance Criteria:**
  - List of tokens created by connected wallet
  - For each: name, symbol, status, amount raised, trading volume
  - Click → navigate to token detail
  - Total raised across all tokens displayed
- **Edge Cases:**
  - No tokens created → show "You haven't baked any cookies yet" with CTA

## FR-13: Migration Indicator
- **What:** Visual indicator showing bonding curve completion and DAMM migration status
- **Priority:** P1
- **Acceptance Criteria:**
  - Progress bar showing % toward migration threshold
  - When threshold reached → animation "Cookie is fully baked!"
  - Migration transaction tracked and confirmed
  - Post-migration: link to trade on DAMM
- **Edge Cases:**
  - Migration takes time → show "Migrating to DAMM..." state
  - Migration fails → show error, pool remains on DBC

## FR-14: Featured Tokens
- **What:** Homepage section showcasing notable tokens
- **Priority:** P1
- **Acceptance Criteria:**
  - "Trending" section: tokens with most volume in last 24h
  - "Newest" section: last 5 launched tokens
  - "Almost Baked" section: tokens close to migration threshold
  - Each section limited to 5 tokens
- **Edge Cases:**
  - No data yet → hide sections or show placeholder

## FR-15: Share Cards
- **What:** Generate shareable social media cards for tokens
- **Priority:** P2
- **Acceptance Criteria:**
  - "Share" button on token detail page
  - Generates image with: token name, symbol, price, bonding curve preview
  - Copy to clipboard or download
  - Pre-filled tweet text with token link
- **Edge Cases:**
  - Generation fails → fallback to text-only share

## FR-16: Token Analytics
- **What:** Detailed analytics for each token
- **Priority:** P2
- **Acceptance Criteria:**
  - Volume chart (24h, 7d, all time)
  - Holder count (derived from token accounts)
  - Price history
  - Top holders (anonymized)
- **Edge Cases:**
  - Insufficient data → show "Not enough data yet"

## FR-17: Anti-Rug Information
- **What:** Transparency about token distribution and liquidity
- **Priority:** P2
- **Acceptance Criteria:**
  - Show creator's token allocation (% of supply)
  - Show liquidity lock status (if applicable)
  - Explain that the bonding curve is trustless by design
- **Edge Cases:**
  - No lock → show warning "Creator tokens are not locked"

---

# Data Dictionary

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| mintAddress | string | Valid Solana public key | Token mint address |
| name | string | 1-32 chars | Token display name |
| symbol | string | 1-6 chars | Token ticker symbol |
| description | string | 0-500 chars | Token description |
| imageUri | string | Valid URL | Arweave/IPFS image URL |
| metadataUri | string | Valid URL | Arweave metadata JSON URL |
| creator | string | Valid Solana public key | Creator wallet address |
| decimals | number | 0-9 | Token decimal places |
| totalSupply | bigint | > 0 | Total tokens minted |
| status | enum | baking, baked, migrated | Current pool status |
| poolAddress | string | Valid Solana public key | DBC pool address |
| poolAuthority | string | Valid Solana public key | Pool authority PDA |
| quoteAmount | bigint | >= 0 | COOK raised in pool |
| migrationThreshold | bigint | > 0 | COOK needed to migrate |

# Error Handling Matrix

| Error | UI Response | Recovery |
|-------|-------------|----------|
| Wallet not installed | "Install Nightly" link | User installs wallet |
| Connection rejected | Toast error | Retry connection |
| Insufficient COOK | Disable action button, show balance | User bridges COOK |
| Metadata upload fails | "Upload failed, retry?" prompt | Retry with backoff |
| Token creation fails | Error toast with tx sig | Retry or check explorer |
| Pool init fails | Error state on token page | Retry pool init |
| Buy/sell fails | Error toast with reason | Adjust amount or retry |
| RPC timeout | "Connection slow" indicator | Auto-retry |
| Stale data | "Data may be outdated" banner | Refresh button |

# Testing Checklist

- [ ] Wallet connects on Cookie Chain (not Solana mainnet)
- [ ] Token creation flow works end-to-end
- [ ] Metadata displays correctly on cookiescan.io
- [ ] DBC pool initializes with correct parameters
- [ ] Bonding curve chart shows correct price data
- [ ] Buy transaction completes and tokens appear in wallet
- [ ] Sell transaction completes and COOK appears in wallet
- [ ] Transaction confirmations show within 3 seconds
- [ ] Error states display for all failure modes
- [ ] Explorer page loads and filters work
- [ ] Token detail page shows all information
- [ ] Mobile responsive on all pages
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Build succeeds