import type { ReactNode } from 'react';

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}

/** Large, confident heading with quiet metadata beneath it. */
export function PageHeader({ eyebrow, title, meta, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {eyebrow && <p className="text-meta mb-1 font-medium uppercase tracking-[0.08em]">{eyebrow}</p>}
        <h1 className="text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] md:text-[34px]">{title}</h1>
        {meta && <p className="mt-1.5 text-sm text-ink-3">{meta}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
