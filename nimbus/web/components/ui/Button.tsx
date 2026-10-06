import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  children?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-ink text-canvas hover:bg-ink/90 disabled:bg-ink/40 shadow-xs",
  secondary:
    "bg-surface text-ink border border-line hover:border-line-2 hover:bg-surface-2 disabled:text-ink-3",
  ghost: "text-ink-2 hover:text-ink hover:bg-surface-2 disabled:text-ink-3",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
};

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center font-medium whitespace-nowrap select-none",
        "transition-[background-color,border-color,color,opacity] duration-150",
        "disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {icon ? <Icon name={icon} size={size === "sm" ? 14 : 16} /> : null}
      {children}
    </button>
  );
}
