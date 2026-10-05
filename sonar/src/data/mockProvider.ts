import type { Entity, Relationship } from "@/domain/types";
import { rankMatches } from "@/network/search";
import type { MusicDataProvider } from "./provider";
import { artists, labels, producers, songs, venues } from "./mock/entities";
import { relationships } from "./mock/relationships";
import { scenes } from "./mock/scenes";

const LATENCY_MS = 140; // small delay so loading states are exercised like a real API

const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), LATENCY_MS));

export class MockProvider implements MusicDataProvider {
  readonly id = "mock";
  readonly label = "Demo dataset (fictional)";
  readonly isDemo = true;

  private readonly all: Entity[] = [...artists, ...producers, ...songs, ...labels, ...venues];
  private readonly byId = new Map(this.all.map((e) => [e.id, e]));

  async getSeeds() {
    // The two biggest artists by monthly listeners anchor the opening graph.
    const top = [...artists].sort((a, b) => b.monthlyListeners - a.monthlyListeners).slice(0, 2);
    return wait(top);
  }

  async getEntity(id: string) {
    return wait(this.byId.get(id) ?? null);
  }

  async getNeighborhood(id: string) {
    const rels = relationships.filter((r) => r.source === id || r.target === id);
    return wait({ entities: this.resolve(rels, id), relationships: rels });
  }

  async search(query: string, limit = 8) {
    return wait(rankMatches(this.all, query, limit));
  }

  async getScenes() {
    return wait(scenes);
  }

  async getSceneGraph(sceneId: string) {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) return wait({ entities: [], relationships: [] });
    // Songs belong to a scene through their credited artists' city.
    const members = this.all.filter((e) => e.city === scene.city);
    const ids = new Set(members.map((e) => e.id));
    const rels = relationships.filter((r) => ids.has(r.source) && ids.has(r.target));
    return wait({ entities: members, relationships: rels });
  }

  async getTotals() {
    return wait({ entities: this.all.length });
  }

  private resolve(rels: Relationship[], selfId: string): Entity[] {
    const out = new Map<string, Entity>();
    const self = this.byId.get(selfId);
    if (self) out.set(self.id, self);
    for (const r of rels) {
      for (const id of [r.source, r.target]) {
        const e = this.byId.get(id);
        if (e) out.set(id, e);
      }
    }
    return [...out.values()];
  }
}
