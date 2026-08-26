import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'brand' | 'success' | 'warning';

const TONES: Record<Tone, string> = {
  neutral: 'bg-suma-high text-suma-muted ring-suma-border',
  brand: 'bg-suma-red-tint text-suma-red-bright ring-suma-red/40',
  success: 'bg-suma-success/12 text-suma-success ring-suma-success/30',
  warning: 'bg-suma-warning/12 text-suma-warning ring-suma-warning/30',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
  icon,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
