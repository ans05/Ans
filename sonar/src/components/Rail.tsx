"use client";

import { ENTITY_TYPES, TYPE_PLURAL, type EntityType, type Scene } from "@/domain/types";
import { TYPE_COLOR, glyphPath } from "@/graph/theme";

function Glyph({ type }: { type: EntityType }) {
  return (
    <svg width="18" height="18" viewBox="-10 -10 20 20" aria-hidden>
      <path d={glyphPath(type, 6)} fill={TYPE_COLOR[type]} />
    </svg>
  );
}

export function TypeFilters({
  hidden, counts, onToggle, onShowAll,
}: {
  hidden: ReadonlySet<EntityType>;
  counts: Record<EntityType, number>;
  onToggle: (t: EntityType) => void;
  onShowAll: () => void;
}) {
  return (
    <section aria-labelledby="filters-h" className="shrink-0">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 id="filters-h" className="font-mono text-[10px] uppercase tracking-[0.25em] text-dim">Filter nodes</h2>
        {hidden.size > 0 && (
          <button onClick={onShowAll} className="font-mono text-[10px] uppercase tracking-widest text-signal hover:underline">Reset</button>
        )}
      </div>
      <ul className="flex gap-2 md:flex-col md:gap-1">
        {ENTITY_TYPES.map((t) => {
          const off = hidden.has(t);
          return (
            <li key={t}>
              <button
                type="button"
                aria-pressed={!off}
                onClick={() => onToggle(t)}
                className={`flex w-full items-center gap-2.5 border px-2.5 py-1.5 text-left transition-all md:border-transparent md:px-0 ${
                  off ? "border-edge text-dim opacity-50" : "border-edge text-bone md:hover:translate-x-1"
                }`}
              >
                <Glyph type={t} />
                <span className="font-mono text-xs uppercase tracking-wider">{TYPE_PLURAL[t]}</span>
                <span className="ml-auto hidden font-mono text-[10px] text-dim md:block">{counts[t]}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ScenePulse({
  scenes, activeId, onPick,
}: {
  scenes: Scene[];
  activeId: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <section aria-labelledby="scene-h" className="min-w-0 md:flex-1">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="scene-h" className="font-mono text-[10px] uppercase tracking-[0.25em] text-dim">Scene pulse</h2>
        <span className="border border-signal/50 px-1.5 font-mono text-[9px] uppercase tracking-widest text-signal">Demo data</span>
      </div>
      <ul className="flex gap-2 md:flex-col md:gap-0">
        {scenes.map((s) => {
          const on = s.id === activeId;
          return (
            <li key={s.id} className="shrink-0 md:border-b md:border-edge">
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onPick(s.id)}
                title={s.blurb}
                className={`group flex w-full items-baseline justify-between gap-4 border px-3 py-2 text-left transition-colors md:border-0 md:px-0 md:py-2.5 ${
                  on ? "border-signal text-signal" : "border-edge text-bone hover:text-signal"
                }`}
              >
                <span className="font-display text-xl leading-none tracking-wide md:text-2xl">{s.city}</span>
                <span className={`font-mono text-xs tabular-nums ${on ? "text-signal" : "text-acid"}`}>+{s.growth}%&nbsp;↑</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
