'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Sobre fondo oscuro el rojo corporativo es el único color saturado de la
 * interfaz, así que se reserva para la acción principal de cada zona. Todo lo
 * demás se resuelve con superficies y bordes.
 */
type Variant = 'primary' | 'neutral' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-suma-red text-white hover:bg-suma-red-bright focus-visible:outline-suma-red',
  neutral:
    'bg-suma-high text-suma-ink ring-1 ring-inset ring-suma-border hover:bg-suma-border focus-visible:outline-suma-muted',
  ghost: 'text-suma-muted hover:bg-suma-high hover:text-suma-ink focus-visible:outline-suma-muted',
  outline:
    'ring-1 ring-inset ring-suma-border text-suma-muted hover:text-suma-ink hover:ring-suma-muted focus-visible:outline-suma-muted',
  danger: 'text-suma-danger hover:bg-suma-red-tint focus-visible:outline-suma-danger',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-[13px]',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2 px-6 text-[15px]',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg font-semibold transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('size-4 animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
