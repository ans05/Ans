import type { ReactNode } from "react";

import { Icon, type IconName } from "./Icon";

interface EmptyStateProps {
  icon: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-2 px-6 py-14 text-center">
      <span className="mb-4 grid size-10 place-items-center rounded-full bg-surface-2 text-ink-3">
        <Icon name={icon} size={18} />
      </span>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {description ? <p className="mt-1 max-w-sm text-sm text-ink-2">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
