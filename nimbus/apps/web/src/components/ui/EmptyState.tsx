import type { ReactNode } from 'react';

export function EmptyState({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line-strong px-5 py-8 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {detail && <p className="mt-1 text-sm text-ink-3">{detail}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
