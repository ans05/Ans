import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface CheckboxProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
}

/** Native checkbox under a drawn box so keyboard and screen readers get the real thing. */
export function Checkbox({ id, checked, onChange, label, description }: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className="group flex cursor-pointer items-start gap-3 rounded-control px-2 py-2.5 -mx-2 transition-colors duration-150 ease-out hover:bg-surface-2"
    >
      <span className="relative mt-0.5 inline-flex size-5 shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer absolute inset-0 size-5 cursor-pointer appearance-none rounded-[6px] border border-line-strong bg-surface transition-colors duration-150 ease-out checked:border-accent checked:bg-accent"
        />
        <Check
          aria-hidden
          className="pointer-events-none absolute inset-0 m-auto size-3.5 text-[#1a1a1f] opacity-0 transition-opacity duration-150 ease-out peer-checked:opacity-100"
          strokeWidth={3}
        />
      </span>
      <span className="min-w-0">
        <span className={cn('block text-sm leading-5 transition-colors duration-150', checked ? 'text-ink-3 line-through' : 'text-ink')}>
          {label}
        </span>
        {description && <span className="text-meta block">{description}</span>}
      </span>
    </label>
  );
}
