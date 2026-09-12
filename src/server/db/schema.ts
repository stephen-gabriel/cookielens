import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Activity types (FRD §10). Stored lowercase; presented uppercased in UI.
 */
export const activityTypeEnum = pgEnum("activity_type", [
  "buy",
  "sell",
  "liquidity_add",
  "liquidity_remove",
  "token_create",
  "pool_create",
  "transfer",
  "swap",
  "bridge",
  "stake",
]);

/**
 * Social-event archetypes (FRD §13).
 */
export const archetypeEnum = pgEnum("archetype", [
  "significant_entry",
  "community_convergence",
  "early_discovery",
  "large_movement",
  "token_momentum",
  "network_activity",
]);

/**
 * Every wallet CookieLens has observed (FRD §25). A wallet is NOT
 * automatically a human identity — behavioral facts live here and are
 * updated by the indexer, never by the browser.
 */
export const wallets = pgTable(
  "wallets",
  {
    address: text("address").primaryKey(),
    firstObservedAt: timestamp("first_observed_at", { withTimezone: true }).notNull().defaultNow(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
    txCount: bigint("tx_count", { mode: "number" }).notNull().default(0),
    tokenInteractions: bigint("token_interactions", { mode: "number" }).notNull().default(0),
  },
  (t) => [index("wallets_last_activity_idx").on(t.lastActivityAt)],
);

/**
 * Claimed profiles (FRD §19). Claiming requires signing a network-
 * specific message that the API verifies server-side.
 */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  walletAddress: text("wallet_address")
    .notNull()
    .unique()
    .references(() => wallets.address, { onDelete: "cascade" }),
  username: text("username").notNull().unique(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Follow relationships: wallet/profile -> wallet/profile (FRD §20).
 */
export const follows = pgTable(
  "follows",
  {
    followerWallet: text("follower_wallet")
      .notNull()
      .references(() => wallets.address, { onDelete: "cascade" }),
    followeeWallet: text("followee_wallet")
      .notNull()
      .references(() => wallets.address, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.followerWallet, t.followeeWallet] }),
    index("follows_followee_idx").on(t.followeeWallet),
  ],
);

/**
 * Watch relationships: wallet -> asset (token/pool/etc). Follows people,
 * watches assets (FRD §21).
 */
export const watches = pgTable(
  "watches",
  {
    walletAddress: text("wallet_address")
      .notNull()
      .references(() => wallets.address, { onDelete: "cascade" }),
    tokenMint: text("token_mint").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.walletAddress, t.tokenMint] }),
    index("watches_token_idx").on(t.tokenMint),
  ],
);

/**
 * Token registry. Latest known state, refreshed by the indexer from DAS.
 */
export const tokens = pgTable("tokens", {
  mint: text("mint").primaryKey(),
  symbol: text("symbol"),
  name: text("name"),
  decimals: integer("decimals").notNull().default(0),
  priceUsd: numeric("price_usd"),
  marketCap: numeric("market_cap"),
  holderCount: bigint("holder_count", { mode: "number" }).notNull().default(0),
  volume24h: numeric("volume_24h"),
  firstObservedAt: timestamp("first_observed_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Time-series snapshots of token metrics so growth deltas can be
 * computed deterministically (FRD §36).
 */
export const tokenStats = pgTable(
  "token_stats",
  {
    mint: text("mint")
      .notNull()
      .references(() => tokens.mint, { onDelete: "cascade" }),
    sampledAt: timestamp("sampled_at", { withTimezone: true }).notNull(),
    holderCount: bigint("holder_count", { mode: "number" }).notNull().default(0),
    volume24h: numeric("volume_24h"),
    buyers1h: integer("buyers_1h").notNull().default(0),
    sellers1h: integer("sellers_1h").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.mint, t.sampledAt] }),
    index("token_stats_mint_idx").on(t.mint),
  ],
);

/**
 * Parsed, normalized on-chain activity (FRD §11). One row per
 * transaction/action; `signature` is unique so the indexer can re-run
 * safely.
 */
export const activities = pgTable(
  "activities",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    signature: text("signature").notNull().unique(),
    wallet: text("wallet").notNull().references(() => wallets.address, { onDelete: "cascade" }),
    tokenMint: text("token_mint").references(() => tokens.mint, { onDelete: "set null" }),
    type: activityTypeEnum("type").notNull(),
    amount: numeric("amount"),
    valueUsd: numeric("value_usd"),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    slot: bigint("slot", { mode: "number" }),
    meta: jsonb("meta"),
    eventCreated: boolean("event_created").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("activities_wallet_idx").on(t.wallet),
    index("activities_token_idx").on(t.tokenMint),
    index("activities_timestamp_idx").on(t.timestamp),
  ],
);

/**
 * Social Events: activities the significance engine decided were worth
 * surfacing (FRD §11-13). Deterministic payload; no LLM prose.
 */
export const socialEvents = pgTable(
  "social_events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    archetype: archetypeEnum("archetype").notNull(),
    wallet: text("wallet").references(() => wallets.address, { onDelete: "set null" }),
    tokenMint: text("token_mint").references(() => tokens.mint, { onDelete: "set null" }),
    sourceActivityIds: bigint("source_activity_ids", { mode: "number" }).array().notNull().default([]),
    significance: numeric("significance").notNull().default("0"),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("social_events_created_idx").on(t.createdAt),
    index("social_events_wallet_idx").on(t.wallet),
    index("social_events_token_idx").on(t.tokenMint),
  ],
);

/**
 * Verification challenges for the wallet-claim flow (FRD §19).
 */
export const claimChallenges = pgTable(
  "claim_challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    wallet: text("wallet").notNull(),
    nonce: text("nonce").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumed: boolean("consumed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("claim_challenges_wallet_idx").on(t.wallet)],
);

export type ActivityType = (typeof activityTypeEnum.enumValues)[number];
export type Archetype = (typeof archetypeEnum.enumValues)[number];