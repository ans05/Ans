import type { TimelineBlock } from '@nimbus/core';
import type { CSSProperties } from 'react';
import { AppLink } from '@/components/shell/navigation';
import { cn } from '@/lib/cn';

const MIN_BLOCK_PX = 22;
const TWO_LINE_MIN = 46;
const TASK_LIST_MIN = 96;

const kindClasses: Record<TimelineBlock['kind'], string> = {
  flight: 'bg-night text-night-ink border-transparent',
  airport: 'bg-surface-2 text-ink-2 border-line border-dashed',
  ride: 'bg-surface-2 text-ink-2 border-line',
  meeting: 'bg-surface text-ink border-line border-l-[3px] border-l-accent',
  focus:
    'border-dashed border-line-strong bg-transparent text-ink-2 hover:border-accent hover:bg-accent-soft/60 hover:text-ink focus-visible:border-accent',
};

function blockStyle(block: TimelineBlock, rangeStartMin: number): CSSProperties {
  const top = block.startMin - rangeStartMin;
  const length = block.endMin - block.startMin;
  return {
    top: `calc(${top} * var(--ppm) * 1px)`,
    height: `max(${MIN_BLOCK_PX}px, calc(${length} * var(--ppm) * 1px - 2px))`,
  };
}

function approxPixels(block: TimelineBlock, ppm: number): number {
  return (block.endMin - block.startMin) * ppm;
}

export interface TimelineBlockViewProps {
  block: TimelineBlock;
  rangeStartMin: number;
  /** Rough pixels-per-minute, only used to decide how much text fits. */
  ppm: number;
}

export function TimelineBlockView({ block, rangeStartMin, ppm }: TimelineBlockViewProps) {
  const px = approxPixels(block, ppm);
  const showSubtitle = px >= TWO_LINE_MIN;
  const showTasks = block.kind === 'focus' && px >= TASK_LIST_MIN;
  const continuation = block.continuesAfter ? 'continues overnight' : block.continuesBefore ? 'from overnight' : null;
  const subtitle = continuation ? `${block.subtitle} · ${continuation}` : block.subtitle;

  const content = (
    <>
      <p className="flex items-center gap-1.5 truncate text-[13px] leading-[18px] font-medium">
        {block.flagged && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-warn" />}
        <span className="truncate">{block.title}</span>
        {block.flagged && <span className="sr-only">(flagged by the time zone shield)</span>}
      </p>
      {showSubtitle && (
        <p className={cn('truncate text-[11px] leading-4', block.kind === 'flight' ? 'text-night-ink/70' : 'text-ink-3')}>{subtitle}</p>
      )}
      {showTasks && block.taskTitles && block.taskTitles.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {block.taskTitles.slice(0, 4).map((title) => (
            <li key={title} className="truncate rounded-md bg-accent-soft px-2 py-1 text-[11px] leading-4 font-medium text-accent-text">
              {title}
            </li>
          ))}
          {block.taskTitles.length > 4 && <li className="text-meta px-1">+{block.taskTitles.length - 4} more</li>}
        </ul>
      )}
      {showTasks && block.taskTitles && block.taskTitles.length === 0 && (
        <p className="mt-2 text-[11px] leading-4 font-medium text-accent-text">Plan this time</p>
      )}
    </>
  );

  const className = cn(
    'absolute inset-x-0 overflow-hidden rounded-[10px] border px-2.5 py-1 text-left transition-colors duration-150 ease-out',
    block.continuesBefore && 'rounded-t-none border-t-0',
    block.continuesAfter && 'rounded-b-none border-b-0',
    kindClasses[block.kind],
  );

  if (block.kind === 'focus') {
    return (
      <AppLink
        href={`/focus#${block.refId}`}
        aria-label={`Focus window, ${block.subtitle}. Open to plan tasks.`}
        className={className}
        style={blockStyle(block, rangeStartMin)}
      >
        {content}
      </AppLink>
    );
  }

  return (
    <article className={className} style={blockStyle(block, rangeStartMin)}>
      {content}
    </article>
  );
}
