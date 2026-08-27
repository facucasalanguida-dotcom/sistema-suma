import type { Metadata } from 'next';
import { SumaLogo } from '@/components/brand/SumaLogo';
import { company } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Acceso',
  robots: { index: false, follow: false },
};

/**
 * Marco de las pantallas de acceso: una tarjeta centrada sobre el fondo
 * oscuro de la marca, con el logotipo arriba y el aviso de uso interno abajo.
 */
export default function AccessLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* Halo rojo muy tenue: da profundidad sin robar protagonismo. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(225,37,44,0.18),transparent_70%)]"
        aria-hidden
      />

      <div className="relative flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-3">
          <SumaLogo size={30} />
          <p className="text-center text-[11px] font-semibold tracking-[0.18em] text-suma-muted uppercase">
            {company.tagline}
          </p>
        </div>

        <div className="w-full rounded-2xl border border-suma-border bg-suma-raised p-6 shadow-2xl">
          {children}
        </div>

        <p className="text-center text-[11px] leading-relaxed text-suma-faint">
          Herramienta interna de {company.legalName}. El acceso queda registrado.
        </p>
      </div>
    </main>
  );
}
