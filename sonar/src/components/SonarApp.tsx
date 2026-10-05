"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import GraphCanvas from "@/graph/GraphCanvas";
import { ENTITY_TYPES, RELATION_LABEL, type EntityType } from "@/domain/types";
import { useSonar } from "@/hooks/useSonar";
import EntityPanel from "./EntityPanel";
import { ScenePulse, TypeFilters } from "./Rail";
import SearchBox from "./SearchBox";
import Tooltip from "./Tooltip";

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(max-width: 767px)");
    const f = () => setM(q.matches);
    f();
    q.addEventListener("change", f);
    return () => q.removeEventListener("change", f);
  }, []);
  return m;
}

export default function SonarApp() {
  const { provider, state, view, actions } = useSonar();
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [box, setBox] = useState({ w: 800, h: 600 });
  const isMobile = useIsMobile();
  const [fitNonce, setFitNonce] = useState(0);
  const refit = () => setFitNonce((n) => n + 1);
  // Re-frame once data first arrives and whenever a scene is entered / left.
  useEffect(() => { if (state.ready) refit(); }, [state.ready, state.sceneId]);
  const stageRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const selected = state.selectedId ? state.store.entities[state.selectedId] ?? null : null;
  const scene = state.scenes.find((s) => s.id === state.sceneId) ?? null;
  const hovered = hover ? state.store.entities[hover.id] : null;

  const counts = useMemo(() => {
    const c = Object.fromEntries(ENTITY_TYPES.map((t) => [t, 0])) as Record<EntityType, number>;
    for (const id of state.visible) {
      const e = state.store.entities[id];
      if (e) c[e.type]++;
    }
    return c;
  }, [state.visible, state.store]);

  const goScene = (city: string) => {
    const s = state.scenes.find((x) => x.city === city);
    if (s && s.id !== state.sceneId) actions.enterScene(s.id);
  };

  return (
    <div className="flex h-dvh flex-col">
      {/* ── Header ── */}
      <header className="z-20 flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3 border-b border-edge bg-ink px-4 py-3 md:px-6">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-5xl leading-none tracking-[0.08em] text-bone">SONAR</h1>
          <span className="hidden font-mono text-[10px] uppercase leading-tight tracking-[0.25em] text-dim lg:block">
            Music industry<br />network intelligence
          </span>
        </div>
        <div className="order-3 w-full md:order-none md:max-w-xl md:flex-1">
          <SearchBox search={actions.search} onPick={actions.focusEntity} />
        </div>
        <div className="ml-auto flex items-center gap-4 font-mono text-[10px] uppercase tracking-widest text-dim">
          <span className="hidden sm:block" aria-live="polite">
            <b className="text-bone">{view.nodes.length}</b>/{state.total} nodes · <b className="text-bone">{view.links.length}</b> links
          </span>
          {provider.isDemo && (
            <span className="border border-signal px-2 py-1 text-signal" title="All names and figures are fictional">Demo data</span>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* ── Left rail ── */}
        <nav aria-label="Filters and scenes" className="hide-scroll z-10 flex shrink-0 gap-6 overflow-x-auto border-b border-edge bg-ink px-4 py-3 md:w-64 md:flex-col md:gap-8 md:overflow-y-auto md:overflow-x-hidden md:border-b-0 md:border-r md:px-6 md:py-6">
          <TypeFilters hidden={state.hiddenTypes} counts={counts} onToggle={actions.toggleType} onShowAll={actions.showAllTypes} />
          <ScenePulse scenes={state.scenes} activeId={state.sceneId} onPick={actions.enterScene} />
        </nav>

        {/* ── Stage ── */}
        <main className="stage grain relative min-h-0 min-w-0 flex-1 overflow-hidden" ref={stageRef}>
          {state.error ? (
            <p className="absolute inset-0 grid place-items-center font-mono text-sm text-signal">Couldn’t load data: {state.error}</p>
          ) : (
            <GraphCanvas
              view={view}
              selectedId={state.selectedId}
              focus={state.focus}
              fitNonce={fitNonce}
              bottomInset={isMobile && !!selected}
              onSelect={actions.selectNode}
              onHover={setHover}
            />
          )}

          {!state.ready && <p className="scan absolute inset-0 grid place-items-center font-mono text-xs uppercase tracking-[0.4em] text-dim">Scanning network…</p>}
          {state.ready && view.nodes.length === 0 && !state.error && (
            <p className="absolute inset-0 grid place-items-center px-6 text-center font-mono text-xs uppercase tracking-widest text-dim">
              Every node type is filtered out — re-enable one on the left.
            </p>
          )}

          {scene && (
            <div className="scene-title pointer-events-none absolute left-5 top-4 max-w-[70%]">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-signal">Scene · +{scene.growth}% <span className="text-dim">(demo)</span></div>
              <div className="font-display text-6xl leading-[0.85] text-bone md:text-8xl">{scene.city}</div>
              <p className="mt-2 hidden max-w-xs text-sm text-dim md:block">{scene.blurb}</p>
              <button onClick={actions.exitScene} className="pointer-events-auto mt-3 border border-edge bg-ink/80 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-bone hover:border-signal hover:text-signal">
                ✕ Exit scene
              </button>
            </div>
          )}

          {state.busy > 0 && state.ready && (
            <div className="scan absolute right-4 top-4 font-mono text-[10px] uppercase tracking-[0.3em] text-signal">● Loading</div>
          )}

          <button
            onClick={refit}
            className="absolute bottom-3 right-4 border border-edge bg-ink/80 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-bone hover:border-signal hover:text-signal"
          >
            ⌖ Fit view
          </button>

          {/* Legend */}
          <div className="pointer-events-none absolute bottom-3 left-4 hidden font-mono text-[10px] uppercase tracking-widest text-dim sm:block">
            <div>Drag nodes · scroll to zoom · click to expand</div>
            <div className="mt-1 flex flex-wrap gap-x-3">
              {(["collaborated_with", "produced_for", "signed_to", "performed_at", "featured_on"] as const).map((r) => (
                <span key={r}>— {RELATION_LABEL[r]}</span>
              ))}
            </div>
          </div>

          {hovered && hover && !isMobile && (
            <Tooltip
              entity={hovered}
              x={hover.x} y={hover.y}
              links={view.links.filter((l) => l.source === hovered.id || l.target === hovered.id).length}
              bounds={box}
            />
          )}
        </main>

        {/* ── Detail panel (side on desktop, bottom sheet on mobile) ── */}
        {selected && (
          <div className="fixed inset-x-0 bottom-0 z-30 h-[52dvh] border-t border-edge md:static md:z-auto md:h-auto md:w-[400px] md:shrink-0 md:border-t-0">
            <EntityPanel
              key={selected.id}
              entity={selected}
              store={state.store}
              depth={state.depth[selected.id] ?? 0}
              loading={state.busy > 0}
              onClose={() => actions.selectNode(null)}
              onExpand={() => actions.expandNetwork(selected.id)}
              onGoto={actions.focusEntity}
              onScene={goScene}
            />
          </div>
        )}
      </div>

    </div>
  );
}
