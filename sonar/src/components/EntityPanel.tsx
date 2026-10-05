"use client";

import { useEffect, useRef } from "react";
import { RELATION_LABEL, TYPE_LABEL, type Entity, type EntityType } from "@/domain/types";
import { MAX_DEPTH } from "@/hooks/useSonar";
import { connectionsOf, type GraphStore } from "@/network/graph";
import { TYPE_COLOR } from "@/graph/theme";
import Cover from "./Cover";
import { compact, dateLabel, duration } from "./format";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-l border-edge pl-3">
      <div className="truncate font-display text-3xl leading-none text-bone">{value}</div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-dim">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-edge py-4">
      <h3 className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.25em] text-dim">{title}</h3>
      {children}
    </section>
  );
}

function stats(e: Entity): { label: string; value: string }[] {
  switch (e.type) {
    case "artist": return [{ label: "Monthly listeners", value: compact(e.monthlyListeners) }, { label: "Genre", value: e.genre }];
    case "producer": return [{ label: "Credits", value: String(e.credits) }, { label: "Monthly listeners", value: compact(e.monthlyListeners) }];
    case "song": return [{ label: "Streams", value: compact(e.streams) }, { label: "Length", value: duration(e.durationSec) }];
    case "label": return [{ label: "Founded", value: String(e.founded) }, { label: "Genre", value: e.genre }];
    case "venue": return [{ label: "Capacity", value: e.capacity.toLocaleString() }, { label: "Genre", value: e.genre }];
  }
}

export default function EntityPanel({
  entity, store, depth, loading, onClose, onExpand, onGoto, onScene,
}: {
  entity: Entity;
  store: GraphStore;
  depth: number;
  loading: boolean;
  onClose: () => void;
  onExpand: () => void;
  onGoto: (id: string) => void;
  onScene: (city: string) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { ref.current?.scrollTo({ top: 0 }); }, [entity.id]);

  const conns = connectionsOf(store, entity.id);
  const groups = (["artist", "producer", "song", "label", "venue"] as EntityType[])
    .map((t) => ({ type: t, items: conns.filter((c) => c.other.type === t) }))
    .filter((g) => g.items.length);
  const collaborators = conns.filter((c) => c.other.type === "artist" || c.other.type === "producer").slice(0, 5);
  const maxed = depth >= MAX_DEPTH;
  const color = TYPE_COLOR[entity.type];

  return (
    <aside
      ref={ref}
      aria-label={`${entity.name} details`}
      className="panel-in flex h-full flex-col overflow-y-auto border-edge bg-ink/95 backdrop-blur-md md:border-l"
    >
      <div className="relative shrink-0">
        <Cover id={entity.id} type={entity.type} label={entity.name} className="h-32 w-full md:h-auto md:aspect-square" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/70 to-transparent px-5 pb-3 pt-10 md:pb-4 md:pt-16">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color }}>● {TYPE_LABEL[entity.type]}</div>
          <h2 className="font-display text-4xl leading-[0.9] text-bone md:text-5xl">{entity.name}</h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Close details"
          className="absolute right-3 top-3 border border-edge bg-ink/80 px-2.5 py-1 font-mono text-xs text-bone hover:border-signal hover:text-signal"
        >✕</button>
      </div>

      <div className="px-5 pb-8">
        <div className="flex items-center justify-between py-4">
          <button
            onClick={() => onScene(entity.city)}
            className="font-mono text-xs uppercase tracking-widest text-dim hover:text-signal"
            title="Show this scene"
          >
            ◎ {entity.city} →
          </button>
          <span className="font-mono text-[10px] uppercase tracking-widest text-dim">{conns.length} links loaded</span>
        </div>

        <div className="grid grid-cols-2 gap-3 pb-4">
          {stats(entity).map((s) => <Stat key={s.label} {...s} />)}
        </div>

        <button
          onClick={onExpand}
          disabled={maxed || loading}
          className="relative mb-2 w-full border border-signal bg-signal px-4 py-3 text-left font-display text-2xl tracking-widest text-ink transition-all hover:bg-transparent hover:text-signal disabled:cursor-not-allowed disabled:border-edge disabled:bg-transparent disabled:text-dim"
        >
          {loading ? "LOADING…" : maxed ? "MAX DEPTH" : "EXPAND NETWORK"}
          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] tracking-widest opacity-70">
            {depth}° → {Math.min(depth + 1, MAX_DEPTH)}°
          </span>
        </button>

        {entity.type === "artist" && (
          <>
            <Section title="Top songs">
              <ol className="space-y-1.5">
                {entity.topTracks.map((t, i) => (
                  <li key={t.title} className="flex items-baseline gap-3">
                    <span className="w-4 font-mono text-xs text-dim">{i + 1}</span>
                    {t.songId ? (
                      <button onClick={() => onGoto(t.songId!)} className="truncate text-left text-sm text-bone hover:text-signal">{t.title}</button>
                    ) : (
                      <span className="truncate text-sm text-bone">{t.title}</span>
                    )}
                  </li>
                ))}
              </ol>
            </Section>
            <Section title="Recent releases">
              <ul className="space-y-2">
                {entity.recentReleases.map((r) => (
                  <li key={r.title + r.date} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-bone">{r.title}</span>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-dim">{r.kind} · {dateLabel(r.date)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          </>
        )}

        {entity.type === "song" && (
          <Section title="Released">
            <p className="text-sm text-bone">{dateLabel(entity.releaseDate)} · {entity.genre}</p>
          </Section>
        )}

        {collaborators.length > 0 && (
          <Section title={entity.type === "artist" ? "Top collaborators" : "Key connections"}>
            <ul className="space-y-2">
              {collaborators.map(({ rel, other, outgoing }) => (
                <li key={rel.id}>
                  <button onClick={() => onGoto(other.id)} className="group flex w-full items-center gap-3 text-left">
                    <Cover id={other.id} type={other.type} className="h-9 w-9 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-bone group-hover:text-signal">{other.name}</span>
                      <span className="block truncate font-mono text-[10px] uppercase tracking-widest text-dim">
                        {outgoing ? RELATION_LABEL[rel.type] : `← ${RELATION_LABEL[rel.type]}`}
                      </span>
                    </span>
                    <span className="h-1 w-12 shrink-0 bg-edge" role="img" aria-label={`Tie strength ${Math.round(rel.weight * 100)}%`}>
                      <span className="block h-full" style={{ width: `${rel.weight * 100}%`, background: TYPE_COLOR[other.type] }} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {groups.map((g) => (
          <Section key={g.type} title={`${TYPE_LABEL[g.type]}s · ${g.items.length}`}>
            <ul className="flex flex-wrap gap-1.5">
              {g.items.map(({ rel, other }) => (
                <li key={rel.id}>
                  <button
                    onClick={() => onGoto(other.id)}
                    className="border border-edge px-2 py-1 text-xs text-bone transition-colors hover:border-bone"
                  >
                    <span aria-hidden className="mr-1.5" style={{ color: TYPE_COLOR[other.type] }}>●</span>
                    {other.name}
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        ))}
        <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-dim">Demo data · fictional entity</p>
      </div>
    </aside>
  );
}
