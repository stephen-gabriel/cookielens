/**
 * Shared shape for Social Events (FRD §13-15). The indexer writes these
 * payloads; the UI renders them deterministically — no LLM prose.
 */
export type Archetype =
  | "significant_entry"
  | "community_convergence"
  | "early_discovery"
  | "large_movement"
  | "token_momentum"
  | "network_activity";

export type SocialEventPayload = {
  /** Primary line, e.g. "0x82A… entered $MOCHI". Built from templates in the indexer. */
  title: string;
  amount?: string;
  metrics?: {
    volumePct?: number;
    holdersPct?: number;
    newHolders?: number;
    buyers?: number;
    sellers?: number;
  };
  social?: {
    followedWallets?: number;
    verifiedWallets?: number;
  };
};

export type FeedEvent = {
  id: number;
  archetype: Archetype;
  wallet: string | null;
  username?: string | null;
  token: { mint: string; symbol: string; name: string } | null;
  payload: SocialEventPayload;
  significance: number;
  createdAt: string;
};

export const ARCHETYPE_LABEL: Record<Archetype, string> = {
  significant_entry: "Entered",
  community_convergence: "Converging",
  early_discovery: "Early discovery",
  large_movement: "Large movement",
  token_momentum: "Momentum",
  network_activity: "Network",
};

export const ARCHETYPE_EMOJI: Record<Archetype, string> = {
  significant_entry: "🟢",
  community_convergence: "🔥",
  early_discovery: "👀",
  large_movement: "🐋",
  token_momentum: "📈",
  network_activity: "👥",
};