import { formatDuration, type Task } from '@nimbus/core';
import type { ReactNode } from 'react';

export function TaskRow({ task, action, hint }: { task: Task; action: ReactNode; hint?: string }) {
  const meta = [formatDuration(task.estimatedMinutes), task.mode === 'deep' ? 'deep work' : 'quick', task.needsConnectivity ? 'needs Wi-Fi' : 'works offline']
    .concat(hint ? [hint] : [])
    .join(' · ');
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm text-ink">{task.title}</p>
        <p className="text-meta truncate">{meta}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </li>
  );
}
