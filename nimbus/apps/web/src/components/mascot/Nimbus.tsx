import { cn } from '@/lib/cn';

export type NimbusMood = 'calm' | 'alert';

export interface NimbusProps {
  mood?: NimbusMood;
  size?: number;
  className?: string;
}

const SHAPES = (
  <>
    <circle cx="18" cy="29" r="10" />
    <circle cx="33" cy="21" r="14" />
    <circle cx="48" cy="29" r="10" />
    <rect x="18" y="27" width="30" height="12" />
  </>
);

/**
 * Nimbus, the cloud. White and still when calm; a little greyer with a gentle
 * bob when something needs attention. Only one is ever on screen.
 */
export function Nimbus({ mood = 'calm', size = 44, className }: NimbusProps) {
  const body = mood === 'alert' ? 'var(--mascot-body-warn)' : 'var(--mascot-body)';
  const line = mood === 'alert' ? 'var(--mascot-line-warn)' : 'var(--mascot-line)';
  return (
    <span className={cn('inline-block', mood === 'alert' && 'motion-safe:animate-bob', className)} style={{ width: size, height: (size * 44) / 64 }}>
      <svg viewBox="0 0 64 44" width="100%" height="100%" aria-hidden focusable="false">
        <g fill={line} stroke={line} strokeWidth="3" strokeLinejoin="round">
          {SHAPES}
        </g>
        <g fill={body}>{SHAPES}</g>
        <g fill="#1a1a1f">
          <circle cx="27" cy="24" r="1.8" />
          <circle cx="39" cy="24" r="1.8" />
        </g>
        {mood === 'alert' ? (
          <path d="M31 30.5h4" stroke="#1a1a1f" strokeWidth="1.4" strokeLinecap="round" />
        ) : (
          <path d="M30.5 29.5q2.5 2.2 5 0" fill="none" stroke="#1a1a1f" strokeWidth="1.4" strokeLinecap="round" />
        )}
      </svg>
    </span>
  );
}
