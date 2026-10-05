/**
 * SPOTIFY ADAPTER — placeholder, intentionally not implemented.
 *
 * Planned mapping (Web API, client-credentials flow, called from a Next.js
 * route handler so the client secret never reaches the browser):
 *   search            → GET /v1/search?type=artist,track
 *   getEntity(artist) → GET /v1/artists/{id}  (followers, genres, images)
 *   top tracks        → GET /v1/artists/{id}/top-tracks
 *   related artists   → no longer available to new apps; derive edges from
 *                       shared track credits instead (see MusicBrainz).
 * Needs SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET (server-side only).
 */
export const SPOTIFY_ADAPTER_STATUS = "not-implemented" as const;
