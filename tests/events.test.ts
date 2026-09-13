import { describe, expect, it } from "vitest";

import { ARCHETYPE_EMOJI, ARCHETYPE_LABEL, type Archetype } from "@/lib/events";

const ARCHETYPES: Archetype[] = [
  "significant_entry",
  "community_convergence",
  "early_discovery",
  "large_movement",
  "token_momentum",
  "network_activity",
];

describe("archetype presentation", () => {
  it("labels and emojis cover every produced archetype", () => {
    for (const archetype of ARCHETYPES) {
      expect(ARCHETYPE_LABEL[archetype], `label for ${archetype}`).toBeTruthy();
      expect(ARCHETYPE_EMOJI[archetype], `emoji for ${archetype}`).toBeTruthy();
    }
  });

  it("has labels for all keys the engine may emit", () => {
    expect(Object.keys(ARCHETYPE_LABEL).sort()).toEqual([...ARCHETYPES].sort());
  });
});