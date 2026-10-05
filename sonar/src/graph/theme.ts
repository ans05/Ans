import type { EntityType, RelationType } from "@/domain/types";

/** Node colours — also mirrored in tailwind.config.ts (signal/acid/bone/violet/cyan). */
export const TYPE_COLOR: Record<EntityType, string> = {
  artist: "#ff5a36",
  producer: "#c6ff3d",
  song: "#ece9e1",
  label: "#b18cff",
  venue: "#3dd6ff",
};

/** Base radius per type; degree adds a little on top. */
export const TYPE_RADIUS: Record<EntityType, number> = {
  artist: 15,
  producer: 11,
  song: 6,
  label: 12,
  venue: 11,
};

/** Preferred link length per relationship — keeps clusters readable. */
export const LINK_DISTANCE: Record<RelationType, number> = {
  collaborated_with: 120,
  produced_for: 105,
  signed_to: 130,
  performed_at: 125,
  featured_on: 70,
  produced: 75,
};

export function nodeRadius(type: EntityType, degree: number): number {
  return TYPE_RADIUS[type] + Math.min(10, Math.sqrt(degree) * 1.6);
}

/** SVG path for each type's glyph, centred on 0,0 for radius r. */
export function glyphPath(type: EntityType, r: number): string {
  switch (type) {
    case "producer": // diamond
      return `M0,${-r * 1.2} L${r * 1.2},0 L0,${r * 1.2} L${-r * 1.2},0 Z`;
    case "label": // rounded-ish square
      return `M${-r},${-r} H${r} V${r} H${-r} Z`;
    case "venue": { // hexagon
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        return `${(Math.cos(a) * r * 1.1).toFixed(2)},${(Math.sin(a) * r * 1.1).toFixed(2)}`;
      });
      return `M${pts.join(" L")} Z`;
    }
    default: // circle (artist, song)
      return `M${-r},0 a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0`;
  }
}
