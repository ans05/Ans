import type { Entity, Relationship, Scene } from "@/domain/types";

/**
 * The single seam between SONAR's UI and any music data source.
 *
 * Implementations: MockProvider (bundled fictional data) today; Spotify,
 * MusicBrainz and Last.fm adapters can implement this same interface later
 * (see ./adapters). All methods are async so network-backed providers work
 * without changing any caller.
 */
export interface MusicDataProvider {
  readonly id: string;
  readonly label: string;
  /** True when every figure comes from simulated data (shows DEMO DATA badge). */
  readonly isDemo: boolean;

  /** Entities to show on first load. */
  getSeeds(): Promise<Entity[]>;
  getEntity(id: string): Promise<Entity | null>;
  /** All relationships touching `id`, plus the entities at the other end. */
  getNeighborhood(id: string): Promise<{ entities: Entity[]; relationships: Relationship[] }>;
  search(query: string, limit?: number): Promise<Entity[]>;
  getScenes(): Promise<Scene[]>;
  /** Every entity tied to a scene, plus relationships among them. */
  getSceneGraph(sceneId: string): Promise<{ entities: Entity[]; relationships: Relationship[] }>;
  /** Total number of entities the provider knows (for "x of y" counters), if known. */
  getTotals(): Promise<{ entities: number }>;
}
