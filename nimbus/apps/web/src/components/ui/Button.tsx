import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { AppLink } from '@/components/shell/navigation';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md';

const base =
  'inline-flex items-center justify-center gap-1.5 rounded-control font-medium whitespace-nowrap select-none ' +
  'transition-[background-color,color,border-color,transform] duration-150 ease-out ' +
  'disabled:opacity-50 disabled:pointer-events-none active:scale-[0.99]';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-[#1a1a1f] hover:brightness-[1.04] dark:text-[#0e1220]',
  secondary: 'border border-line bg-surface text-ink hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
};

export function buttonClasses(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', className?: string): string {
  return cn(base, variants[variant], sizes[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = 'secondary', size = 'md', className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

export interface LinkButtonProps {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}

export function LinkButton({ href, variant = 'secondary', size = 'md', className, children }: LinkButtonProps) {
  return (
    <AppLink href={href} className={buttonClasses(variant, size, className)}>
      {children}
    </AppLink>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

/** Square ghost button for a single icon. `label` becomes the accessible name. */
export function IconButton({ label, className, type = 'button', children, ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-control text-ink-2 transition-colors duration-150 ease-out hover:bg-surface-2 hover:text-ink',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
