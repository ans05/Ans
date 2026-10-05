import type { EntityType } from "@/domain/types";
import { TYPE_COLOR } from "@/graph/theme";

/** Deterministic PRNG so each entity always gets the same generated artwork. */
function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const INKS = ["#ff5a36", "#c6ff3d", "#3dd6ff", "#b18cff", "#ffb020", "#ece9e1"];

/**
 * Generated placeholder artwork (no copyrighted images). Four poster-style
 * layouts, picked and coloured from the entity id.
 */
export default function Cover({ id, type, label, className = "" }: { id: string; type: EntityType; label?: string; className?: string }) {
  const rnd = seeded(id);
  const a = INKS[Math.floor(rnd() * INKS.length)];
  let b = INKS[Math.floor(rnd() * INKS.length)];
  if (b === a) b = TYPE_COLOR[type];
  const variant = Math.floor(rnd() * 4);
  const bg = "#121214";
  const uid = `c-${id}`;

  let art: React.ReactNode;
  if (variant === 0) {
    // concentric rings, off-centre
    const cx = 30 + rnd() * 40, cy = 30 + rnd() * 40;
    art = Array.from({ length: 9 }, (_, i) => (
      <circle key={i} cx={cx} cy={cy} r={6 + i * 9} fill="none" stroke={i % 2 ? a : b} strokeWidth={i % 3 === 0 ? 3 : 1.2} />
    ));
  } else if (variant === 1) {
    // vertical bars — a frozen equaliser
    art = Array.from({ length: 14 }, (_, i) => {
      const h = 14 + rnd() * 76;
      return <rect key={i} x={5 + i * 6.6} y={100 - h} width={4.2} height={h} fill={i % 4 === 0 ? b : a} />;
    });
  } else if (variant === 2) {
    // diagonal slashes
    art = Array.from({ length: 8 }, (_, i) => (
      <path key={i} d={`M${-20 + i * 18},110 L${20 + i * 18},-10`} stroke={i % 2 ? a : b} strokeWidth={4 + rnd() * 7} />
    ));
  } else {
    // halftone grid
    art = Array.from({ length: 49 }, (_, i) => {
      const x = (i % 7) * 14 + 9, y = Math.floor(i / 7) * 14 + 9;
      const d = Math.hypot(x - 50, y - 50) / 70;
      return <circle key={i} cx={x} cy={y} r={Math.max(1, 6.2 * (1 - d) * (0.6 + rnd() * 0.6))} fill={d > 0.5 ? b : a} />;
    });
  }

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label={label ? `Generated artwork for ${label}` : "Generated artwork"}>
      <defs>
        <clipPath id={uid}><rect width="100" height="100" /></clipPath>
      </defs>
      <rect width="100" height="100" fill={bg} />
      <g clipPath={`url(#${uid})`}>{art}</g>
      <rect width="100" height="100" fill="none" stroke="#ffffff14" />
    </svg>
  );
}
