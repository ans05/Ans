"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { getProvider } from "@/data";
import type { Entity, EntityType, Relationship, Scene } from "@/domain/types";
import { buildView, emptyStore, mergeIntoStore, type GraphStore } from "@/network/graph";
import { expandFrom } from "@/network/expand";

export const MAX_DEPTH = 3;

interface State {
  ready: boolean;
  error: string | null;
  store: GraphStore;
  visible: ReadonlySet<string>;
  /** Visible set to restore when leaving a scene. */
  savedVisible: ReadonlySet<string> | null;
  /** How many degrees each node has been expanded. */
  depth: Record<string, number>;
  selectedId: string | null;
  sceneId: string | null;
  hiddenTypes: ReadonlySet<EntityType>;
  scenes: Scene[];
  total: number;
  busy: number;
  focus: { id: string; nonce: number } | null;
}

type Action =
  | { t: "init"; entities: Entity[]; rels: Relationship[]; ids: string[]; depth: Record<string, number>; scenes: Scene[]; total: number }
  | { t: "fail"; message: string }
  | { t: "add"; entities: Entity[]; rels: Relationship[]; ids: string[]; depth?: [string, number]; unhide?: EntityType[] }
  | { t: "select"; id: string | null }
  | { t: "focus"; id: string }
  | { t: "enterScene"; sceneId: string; entities: Entity[]; rels: Relationship[] }
  | { t: "exitScene" }
  | { t: "toggleType"; type: EntityType }
  | { t: "showAllTypes" }
  | { t: "busy"; delta: number };

const initial: State = {
  ready: false,
  error: null,
  store: emptyStore(),
  visible: new Set(),
  savedVisible: null,
  depth: {},
  selectedId: null,
  sceneId: null,
  hiddenTypes: new Set(),
  scenes: [],
  total: 0,
  busy: 0,
  focus: null,
};

function reducer(s: State, a: Action): State {
  switch (a.t) {
    case "init":
      return {
        ...s,
        ready: true,
        store: mergeIntoStore(s.store, a.entities, a.rels),
        visible: new Set(a.ids),
        depth: a.depth,
        scenes: a.scenes,
        total: a.total,
      };
    case "fail":
      return { ...s, ready: true, error: a.message };
    case "add": {
      const visible = new Set(s.visible);
      a.ids.forEach((id) => visible.add(id));
      const hidden = new Set(s.hiddenTypes);
      a.unhide?.forEach((t) => hidden.delete(t));
      return {
        ...s,
        store: mergeIntoStore(s.store, a.entities, a.rels),
        visible,
        hiddenTypes: hidden,
        depth: a.depth ? { ...s.depth, [a.depth[0]]: a.depth[1] } : s.depth,
      };
    }
    case "select":
      return { ...s, selectedId: a.id };
    case "focus":
      return { ...s, focus: { id: a.id, nonce: (s.focus?.nonce ?? 0) + 1 } };
    case "enterScene":
      return {
        ...s,
        store: mergeIntoStore(s.store, a.entities, a.rels),
        savedVisible: s.sceneId ? s.savedVisible : s.visible,
        visible: new Set(a.entities.map((e) => e.id)),
        sceneId: a.sceneId,
        selectedId: null,
        hiddenTypes: new Set(),
      };
    case "exitScene":
      return { ...s, sceneId: null, visible: s.savedVisible ?? s.visible, savedVisible: null, selectedId: null };
    case "toggleType": {
      const hidden = new Set(s.hiddenTypes);
      if (hidden.has(a.type)) hidden.delete(a.type);
      else hidden.add(a.type);
      const sel = s.selectedId ? s.store.entities[s.selectedId] : null;
      return { ...s, hiddenTypes: hidden, selectedId: sel && hidden.has(sel.type) ? null : s.selectedId };
    }
    case "showAllTypes":
      return { ...s, hiddenTypes: new Set() };
    case "busy":
      return { ...s, busy: Math.max(0, s.busy + a.delta) };
  }
}

export function useSonar() {
  const provider = useMemo(() => getProvider(), []);
  const [state, dispatch] = useReducer(reducer, initial);
  const stateRef = useRef(state);
  stateRef.current = state;

  const track = useCallback(async <T,>(p: Promise<T>) => {
    dispatch({ t: "busy", delta: 1 });
    try {
      return await p;
    } finally {
      dispatch({ t: "busy", delta: -1 });
    }
  }, []);

  // Initial load: seeds, one degree out, scenes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [seeds, scenes, totals] = await Promise.all([
          provider.getSeeds(),
          provider.getScenes(),
          provider.getTotals(),
        ]);
        const results = await Promise.all(seeds.map((s) => expandFrom(provider, s.id, 1)));
        if (cancelled) return;
        const entities = results.flatMap((r) => r.entities);
        const rels = results.flatMap((r) => r.relationships);
        const ids = new Set(results.flatMap((r) => [...r.reached]));
        dispatch({
          t: "init",
          entities, rels, ids: [...ids], scenes, total: totals.entities,
          depth: Object.fromEntries(seeds.map((s) => [s.id, 1])),
        });
      } catch (e) {
        if (!cancelled) dispatch({ t: "fail", message: e instanceof Error ? e.message : "Failed to load" });
      }
    })();
    return () => { cancelled = true; };
  }, [provider]);

  /** Load `depth` degrees around a node and reveal them. */
  const reveal = useCallback(
    async (id: string, depth: number, extra?: { unhide?: EntityType[] }) => {
      const res = await track(expandFrom(provider, id, depth));
      dispatch({
        t: "add", entities: res.entities, rels: res.relationships, ids: [...res.reached],
        depth: [id, depth], unhide: extra?.unhide,
      });
    },
    [provider, track],
  );

  const selectNode = useCallback(
    async (id: string | null) => {
      dispatch({ t: "select", id });
      if (!id) return;
      // Clicking reveals the first degree of connections without a reload.
      if ((stateRef.current.depth[id] ?? 0) < 1) await reveal(id, 1);
    },
    [reveal],
  );

  const expandNetwork = useCallback(
    async (id: string) => {
      const next = Math.min((stateRef.current.depth[id] ?? 0) + 1, MAX_DEPTH);
      if (next === (stateRef.current.depth[id] ?? 0)) return;
      await reveal(id, next);
    },
    [reveal],
  );

  /** Search result / deep link: ensure the node is on the graph, select it, fly the camera to it. */
  const focusEntity = useCallback(
    async (id: string) => {
      const known = stateRef.current.store.entities[id] ?? (await track(provider.getEntity(id)));
      if (!known) return;
      const needsLoad = !stateRef.current.visible.has(id) || (stateRef.current.depth[id] ?? 0) < 1;
      if (needsLoad) await reveal(id, 1, { unhide: [known.type] });
      else if (stateRef.current.hiddenTypes.has(known.type)) {
        dispatch({ t: "add", entities: [], rels: [], ids: [], unhide: [known.type] });
      }
      dispatch({ t: "select", id });
      dispatch({ t: "focus", id });
    },
    [provider, reveal, track],
  );

  const enterScene = useCallback(
    async (sceneId: string) => {
      if (stateRef.current.sceneId === sceneId) return dispatch({ t: "exitScene" });
      const g = await track(provider.getSceneGraph(sceneId));
      dispatch({ t: "enterScene", sceneId, entities: g.entities, rels: g.relationships });
    },
    [provider, track],
  );

  const exitScene = useCallback(() => dispatch({ t: "exitScene" }), []);
  const toggleType = useCallback((type: EntityType) => dispatch({ t: "toggleType", type }), []);
  const showAllTypes = useCallback(() => dispatch({ t: "showAllTypes" }), []);
  const search = useCallback((q: string) => provider.search(q, 8), [provider]);

  const view = useMemo(
    () => buildView(state.store, state.visible, state.hiddenTypes),
    [state.store, state.visible, state.hiddenTypes],
  );

  return {
    provider, state, view,
    actions: { selectNode, expandNetwork, focusEntity, enterScene, exitScene, toggleType, showAllTypes, search },
  };
}
