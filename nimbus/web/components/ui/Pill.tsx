import type { HTMLAttributes } from "react";

import { cn } from "./cn";
import { Icon, type IconName } from "./Icon";

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "accent" | "warn";
  icon?: IconName;
}

const tones = {
  neutral: "bg-surface-2 text-ink-2",
  accent: "bg-accent-soft text-accent-ink",
  warn: "bg-warn-soft text-warn-ink",
};

/** Small, quiet metadata label. */
export function Pill({ tone = "neutral", icon, className, children, ...rest }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium leading-5",
        tones[tone],
        className,
      )}
      {...rest}
    >
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  );
}
