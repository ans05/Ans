/**
 * MUSICBRAINZ ADAPTER — placeholder, intentionally not implemented.
 *
 * No API key required, but a descriptive User-Agent and ≤1 request/second are
 * mandatory. Best source for relationships:
 *   artist-rels   → /ws/2/artist/{mbid}?inc=artist-rels+label-rels+recording-rels
 *   label signing → label-rels → RelationType "signed_to"
 *   producer      → recording-rels with type "producer" → "produced_for"/"produced"
 *   venues        → /ws/2/event?artist={mbid}  → "performed_at"
 */
export const MUSICBRAINZ_ADAPTER_STATUS = "not-implemented" as const;
