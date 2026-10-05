/**
 * SONAR domain model. Everything the UI knows about the music industry is
 * expressed in these types, independent of where the data comes from
 * (mock data today; Spotify / MusicBrainz / Last.fm adapters later).
 */

export type EntityType = "artist" | "producer" | "song" | "label" | "venue";

export const ENTITY_TYPES: EntityType[] = ["artist", "producer", "song", "label", "venue"];

export type RelationType =
  | "collaborated_with"
  | "produced_for"
  | "signed_to"
  | "performed_at"
  | "featured_on"
  | "produced";

export interface TrackRef {
  title: string;
  /** Present when the track also exists as a Song node in the graph. */
  songId?: string;
}

export interface ReleaseRef {
  title: string;
  kind: "Single" | "EP" | "Album" | "Mixtape";
  /** ISO date (YYYY-MM-DD). */
  date: string;
}

interface EntityBase {
  id: string;
  type: EntityType;
  name: string;
  /** Scene / home city, e.g. "Los Angeles". Matches Scene.city. */
  city: string;
}

export interface Artist extends EntityBase {
  type: "artist";
  genre: string;
  monthlyListeners: number;
  topTracks: TrackRef[];
  recentReleases: ReleaseRef[];
}

export interface Producer extends EntityBase {
  type: "producer";
  genre: string;
  /** Number of credited releases (demo figure). */
  credits: number;
  monthlyListeners: number;
}

export interface Song extends EntityBase {
  type: "song";
  genre: string;
  releaseDate: string;
  streams: number;
  durationSec: number;
}

export interface Label extends EntityBase {
  type: "label";
  genre: string;
  founded: number;
}

export interface Venue extends EntityBase {
  type: "venue";
  capacity: number;
  genre: string;
}

export type Entity = Artist | Producer | Song | Label | Venue;

export interface Relationship {
  id: string;
  source: string;
  target: string;
  type: RelationType;
  /** 0..1 strength of the tie (shared credits, frequency, etc.). */
  weight: number;
  /** Optional year the relationship began. */
  since?: number;
}

export interface Scene {
  id: string;
  city: string;
  /** Week-over-week growth in scene activity, in percent. DEMO figure. */
  growth: number;
  blurb: string;
}

export const RELATION_LABEL: Record<RelationType, string> = {
  collaborated_with: "collaborated with",
  produced_for: "produced for",
  signed_to: "signed to",
  performed_at: "performed at",
  featured_on: "featured on",
  produced: "produced",
};

export const TYPE_LABEL: Record<EntityType, string> = {
  artist: "Artist",
  producer: "Producer",
  song: "Song",
  label: "Label",
  venue: "Venue",
};

export const TYPE_PLURAL: Record<EntityType, string> = {
  artist: "Artists",
  producer: "Producers",
  song: "Songs",
  label: "Labels",
  venue: "Venues",
};
