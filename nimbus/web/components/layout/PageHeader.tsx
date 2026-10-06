import type { ReactNode } from "react";

interface PageHeaderProps {
  /** Small, quiet line above the title. */
  eyebrow?: string;
  title: string;
  /** Small, quiet line under the title. */
  meta?: ReactNode;
  /** Something that sits to the right of the title on wide screens. */
  aside?: ReactNode;
}

export function PageHeader({ eyebrow, title, meta, aside }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[13px] font-medium text-ink-3">{eyebrow}</p>
        ) : null}
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-ink sm:text-[34px]">
          {title}
        </h1>
        {meta ? <p className="mt-1.5 text-sm text-ink-2">{meta}</p> : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </header>
  );
}
