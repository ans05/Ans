import type { Entity, EntityType, Relationship } from "@/domain/types";

/** What the app has loaded so far. Visibility is tracked separately. */
export interface GraphStore {
  entities: Record<string, Entity>;
  relationships: Record<string, Relationship>;
}

export const emptyStore = (): GraphStore => ({ entities: {}, relationships: {} });

export function mergeIntoStore(
  store: GraphStore,
  entities: Entity[],
  relationships: Relationship[],
): GraphStore {
  const e = { ...store.entities };
  const r = { ...store.relationships };
  for (const x of entities) e[x.id] = x;
  for (const x of relationships) r[x.id] = x;
  return { entities: e, relationships: r };
}

export interface ViewNode {
  id: string;
  type: EntityType;
  name: string;
  city: string;
  /** Number of visible links — drives node size. */
  degree: number;
}

export interface ViewLink {
  id: string;
  source: string;
  target: string;
  type: Relationship["type"];
  weight: number;
}

export interface GraphView {
  nodes: ViewNode[];
  links: ViewLink[];
}

/** Project the store through visibility + type filters into renderable nodes/links. */
export function buildView(
  store: GraphStore,
  visible: ReadonlySet<string>,
  hiddenTypes: ReadonlySet<EntityType>,
): GraphView {
  const ids = new Set<string>();
  for (const id of visible) {
    const e = store.entities[id];
    if (e && !hiddenTypes.has(e.type)) ids.add(id);
  }
  const links: ViewLink[] = [];
  const degree = new Map<string, number>();
  for (const r of Object.values(store.relationships)) {
    if (ids.has(r.source) && ids.has(r.target)) {
      links.push({ id: r.id, source: r.source, target: r.target, type: r.type, weight: r.weight });
      degree.set(r.source, (degree.get(r.source) ?? 0) + 1);
      degree.set(r.target, (degree.get(r.target) ?? 0) + 1);
    }
  }
  const nodes: ViewNode[] = [...ids].map((id) => {
    const e = store.entities[id];
    return { id, type: e.type, name: e.name, city: e.city, degree: degree.get(id) ?? 0 };
  });
  return { nodes, links };
}

/** Relationships touching a node, strongest first, with the entity at the other end. */
export function connectionsOf(store: GraphStore, id: string) {
  const out: { rel: Relationship; other: Entity; outgoing: boolean }[] = [];
  for (const rel of Object.values(store.relationships)) {
    if (rel.source !== id && rel.target !== id) continue;
    const outgoing = rel.source === id;
    const other = store.entities[outgoing ? rel.target : rel.source];
    if (other) out.push({ rel, other, outgoing });
  }
  return out.sort((a, b) => b.rel.weight - a.rel.weight);
}

/** Ids directly linked to `id` among the given links (for hover highlighting). */
export function neighborIds(links: ViewLink[], id: string): Set<string> {
  const s = new Set<string>([id]);
  for (const l of links) {
    if (l.source === id) s.add(l.target);
    else if (l.target === id) s.add(l.source);
  }
  return s;
}
