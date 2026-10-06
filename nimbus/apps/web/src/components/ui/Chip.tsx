import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type ChipTone = 'neutral' | 'accent' | 'warn' | 'night' | 'outline';

const tones: Record<ChipTone, string> = {
  neutral: 'bg-surface-2 text-ink-2',
  accent: 'bg-accent-soft text-accent-text',
  warn: 'bg-warn-soft text-warn-text',
  night: 'bg-night text-night-ink',
  outline: 'border border-line text-ink-2',
};

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone;
}

export function Chip({ tone = 'neutral', className, ...props }: ChipProps) {
  return (
    <span
      className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium whitespace-nowrap', tones[tone], className)}
      {...props}
    />
  );
}
