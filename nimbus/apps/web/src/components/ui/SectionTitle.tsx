import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn('text-meta font-medium uppercase tracking-[0.08em]', className)}>{children}</h2>;
}
