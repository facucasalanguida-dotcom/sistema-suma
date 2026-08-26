'use client';

import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';
import { cn } from '@/lib/cn';

const CONTROL =
  'w-full rounded-lg border border-suma-border bg-white px-3 py-2 text-sm text-suma-ink ' +
  'placeholder:text-suma-muted/60 focus:border-suma-primary-soft focus:outline-none ' +
  'focus:ring-2 focus:ring-suma-primary-tint disabled:bg-slate-50';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export function Field({ label, hint, className, id, ...props }: FieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={inputId} className="text-xs font-semibold text-suma-muted">
        {label}
      </label>
      <input id={inputId} {...props} className={CONTROL} />
      {hint ? <p className="text-[11px] text-suma-muted">{hint}</p> : null}
    </div>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
}

export function TextAreaField({ label, hint, className, id, ...props }: TextAreaFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={inputId} className="text-xs font-semibold text-suma-muted">
        {label}
      </label>
      <textarea id={inputId} {...props} className={cn(CONTROL, 'resize-y')} />
      {hint ? <p className="text-[11px] text-suma-muted">{hint}</p> : null}
    </div>
  );
}

export { CONTROL as fieldControlClass };
