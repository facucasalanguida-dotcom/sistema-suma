import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning';

const TONES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-suma-muted ring-slate-200',
  primary: 'bg-suma-primary-tint text-suma-primary-soft ring-suma-primary-tint',
  accent: 'bg-suma-accent-tint text-suma-warning ring-suma-accent-soft/50',
  success: 'bg-emerald-50 text-suma-success ring-emerald-200',
  warning: 'bg-amber-50 text-suma-warning ring-amber-200',
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
