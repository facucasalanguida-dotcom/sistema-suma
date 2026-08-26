import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Une clases de Tailwind resolviendo los conflictos a favor de la última. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
