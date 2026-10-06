import { cn } from '@/lib/cn';

export interface MeterProps {
  value: number;
  max: number;
  label: string;
  className?: string;
}

/** Thin progress bar. The track is a lighter step of the same hue as the fill. */
export function Meter({ value, max, label, className }: MeterProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(max, value)}
      className={cn('h-1 w-full overflow-hidden rounded-full bg-accent-soft', className)}
    >
      <div className="h-full rounded-full bg-accent transition-[width] duration-250 ease-out" style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}
