import type { MusicDataProvider } from "@/data/provider";
import type { Entity, Relationship } from "@/domain/types";

export interface ExpansionResult {
  entities: Entity[];
  relationships: Relationship[];
  /** Every id within `depth` hops of the origin (inclusive). */
  reached: Set<string>;
}

/**
 * Breadth-first expansion: load the neighbourhood of `originId` out to `depth`
 * degrees through the provider. Frontier nodes already in `known` still get
 * expanded, so deepening an existing node works without refetching known hops.
 */
export async function expandFrom(
  provider: MusicDataProvider,
  originId: string,
  depth: number,
): Promise<ExpansionResult> {
  const reached = new Set<string>([originId]);
  const entities = new Map<string, Entity>();
  const relationships = new Map<string, Relationship>();
  let frontier = [originId];

  for (let hop = 0; hop < depth && frontier.length; hop++) {
    const hoods = await Promise.all(frontier.map((id) => provider.getNeighborhood(id)));
    const next: string[] = [];
    for (const hood of hoods) {
      for (const e of hood.entities) entities.set(e.id, e);
      for (const r of hood.relationships) {
        relationships.set(r.id, r);
        for (const id of [r.source, r.target]) {
          if (!reached.has(id)) {
            reached.add(id);
            next.push(id);
          }
        }
      }
    }
    frontier = next;
  }
  return { entities: [...entities.values()], relationships: [...relationships.values()], reached };
}
