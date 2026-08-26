import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * `@react-pdf/renderer` arrastra dependencias nativas de Node (fuentes,
   * streams) que no deben pasar por el bundler del servidor.
   */
  serverExternalPackages: ['@react-pdf/renderer'],

  /**
   * Las métricas de las tipografías estándar del PDF (Helvetica, Times) viven
   * en `pdfkit` y se cargan por un especificador interno `#standard-fonts/*`.
   * El rastreador de dependencias no siempre sigue ese tipo de importación, y
   * si se queda fuera del paquete desplegado el PDF falla sólo en producción,
   * que es el peor sitio para enterarse. Incluirlas explícitamente cuesta unos
   * pocos kilobytes.
   */
  outputFileTracingIncludes: {
    '/api/pdf': ['./node_modules/pdfkit/js/standard-fonts/**'],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          // La herramienta es interna y no debe aparecer en buscadores.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;
