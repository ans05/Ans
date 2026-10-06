import type { HTMLAttributes } from "react";

import { cn } from "./cn";

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "section" | "article" | "li";
  tone?: "default" | "accent" | "warn";
  padded?: boolean;
}

const tones = {
  default: "bg-surface border-line",
  accent: "bg-accent-soft border-accent/30",
  warn: "bg-warn-soft border-warn/40",
};

export function Card({
  as: Tag = "div",
  tone = "default",
  padded = true,
  className,
  ...rest
}: CardProps) {
  return (
    <Tag
      className={cn(
        "rounded-2xl border shadow-xs",
        tones[tone],
        padded && "p-4 sm:p-5",
        className,
      )}
      {...rest}
    />
  );
}
