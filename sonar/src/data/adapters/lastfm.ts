/**
 * LAST.FM ADAPTER — placeholder, intentionally not implemented.
 *
 * Needs LASTFM_API_KEY (server-side). Useful for popularity and similarity:
 *   artist.getInfo     → listeners / playcount (monthlyListeners analogue)
 *   artist.getSimilar  → weighted "collaborated_with"-style soft edges
 *   geo.getTopArtists  → per-country scene activity for Scene.growth
 */
export const LASTFM_ADAPTER_STATUS = "not-implemented" as const;
