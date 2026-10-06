import { Minus, Plus } from 'lucide-react';
import { useId } from 'react';
import { IconButton } from './Button';

export interface StepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
}

export function Stepper({ label, value, onChange, min, max, step = 5, format = String }: StepperProps) {
  const id = useId();
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return (
    <div className="flex items-center justify-between gap-4">
      <span id={id} className="text-sm text-ink-2">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={id}
        className="inline-flex items-center rounded-control border border-line bg-surface"
      >
        <IconButton label={`Decrease ${label.toLowerCase()}`} onClick={() => onChange(clamp(value - step))} disabled={value <= min} className="size-8 rounded-r-none">
          <Minus className="size-4" />
        </IconButton>
        <output aria-live="polite" className="min-w-14 px-1 text-center text-sm font-medium tabular-nums">
          {format(value)}
        </output>
        <IconButton label={`Increase ${label.toLowerCase()}`} onClick={() => onChange(clamp(value + step))} disabled={value >= max} className="size-8 rounded-l-none">
          <Plus className="size-4" />
        </IconButton>
      </div>
    </div>
  );
}
