import type { Metadata, Viewport } from 'next';
import './globals.css';
import { company } from '@/lib/brand';

/**
 * No se usa `next/font/google`: descargaría las tipografías en tiempo de
 * compilación y ataría el despliegue a tener salida a Internet. La pila de
 * fuentes del sistema se ve nativa en cada plataforma y carga al instante.
 */

export const metadata: Metadata = {
  title: {
    default: `${company.tradeName} · Presupuestos de construcción`,
    template: `%s · ${company.tradeName}`,
  },
  description:
    'Sistema de presupuestos de SUMA: describe o fotografía el material, compara proveedores de ' +
    'Málaga con inteligencia artificial y genera el presupuesto en PDF.',
  applicationName: `${company.tradeName} Presupuestos`,
  authors: [{ name: company.legalName }],
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0e2a47',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
