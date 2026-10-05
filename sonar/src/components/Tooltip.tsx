import { TYPE_LABEL, type Entity } from "@/domain/types";
import { TYPE_COLOR } from "@/graph/theme";
import { compact } from "./format";

function line(e: Entity): string {
  switch (e.type) {
    case "artist": return `${e.genre} · ${compact(e.monthlyListeners)} listeners`;
    case "producer": return `${e.genre} · ${e.credits} credits`;
    case "song": return `${compact(e.streams)} streams`;
    case "label": return `${e.genre} · est. ${e.founded}`;
    case "venue": return `${e.capacity.toLocaleString()} cap · ${e.genre}`;
  }
}

export default function Tooltip({ entity, x, y, links, bounds }: { entity: Entity; x: number; y: number; links: number; bounds: { w: number; h: number } }) {
  const flip = x > bounds.w - 240;
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-30 w-52 border border-edge bg-ink/95 px-3 py-2 backdrop-blur"
      style={{ left: flip ? x - 224 : x + 16, top: Math.min(y + 12, bounds.h - 90) }}
    >
      <div className="font-mono text-[9px] uppercase tracking-[0.25em]" style={{ color: TYPE_COLOR[entity.type] }}>
        {TYPE_LABEL[entity.type]} · {entity.city}
      </div>
      <div className="font-display text-2xl leading-none text-bone">{entity.name}</div>
      <div className="mt-1 font-mono text-[10px] text-dim">{line(entity)}</div>
      <div className="font-mono text-[10px] text-dim">{links} visible link{links === 1 ? "" : "s"}</div>
    </div>
  );
}
