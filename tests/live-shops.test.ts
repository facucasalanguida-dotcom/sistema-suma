import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatLiveEvidence, scrapeShops, scrapeTargets } from '@/lib/search/live-shops';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function htmlResponse(body: string): Response {
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } });
}

beforeEach(() => {
  vi.stubEnv('GOOGLE_CSE_API_KEY', 'clave-de-prueba');
  vi.stubEnv('GOOGLE_CSE_ID', 'buscador-de-prueba');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('scrapeTargets', () => {
  it('incluye las tiendas principales', () => {
    const targets = scrapeTargets();
    expect(targets).toContain('obramat.es');
    expect(targets).toContain('leroymerlin.es');
    expect(targets).toContain('manomano.es');
  });

  it('suma las tiendas extra del entorno y descarta la morralla', () => {
    vi.stubEnv('SUMA_EXTRA_SHOPS', ' isolana.es , www.MiTienda.com, sinpunto, ');
    const targets = scrapeTargets();
    expect(targets).toContain('isolana.es');
    expect(targets).toContain('mitienda.com');
    expect(targets).not.toContain('sinpunto');
  });
});

describe('scrapeShops', () => {
  it('sin Custom Search configurado no hace nada', async () => {
    vi.stubEnv('GOOGLE_CSE_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await scrapeShops('ventilador de techo', fetchMock)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('busca en cada tienda, descarga las fichas y reparte por turnos', async () => {
    // Buscador por tienda: cada dominio devuelve dos fichas.
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = new URL(String(input));
        const domain = url.searchParams.get('siteSearch') ?? 'desconocida';
        return Promise.resolve(
          jsonResponse({
            items: [1, 2].map((n) => ({
              title: `Ventilador ${n} de ${domain}`,
              link: `https://www.${domain}/ventilador-${n}`,
              snippet: 'Ventilador de techo',
              displayLink: domain,
            })),
          }),
        );
      }),
    );

    // Descarga de páginas: todas responden con una ficha mínima.
    const pageFetch = vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(
        htmlResponse(
          `<html><head><title>Ficha ${String(input)}</title></head><body>62,00 €</body></html>`,
        ),
      ),
    );

    const pages = await scrapeShops('ventilador de techo', pageFetch as typeof fetch);

    expect(pages.length).toBeGreaterThan(0);
    expect(pages.length).toBeLessThanOrEqual(8);
    // Reparto por turnos: las primeras fichas son de tiendas distintas.
    const firstDomains = pages.slice(0, 3).map((page) => page.domain);
    expect(new Set(firstDomains).size).toBe(firstDomains.length);
    // La evidencia se destila de la página descargada.
    expect(pages[0].evidence).toContain('62,00 €');
  });

  it('una tienda que no responde no arrastra a las demás', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = new URL(String(input));
        const domain = url.searchParams.get('siteSearch') ?? 'desconocida';
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                title: `Producto de ${domain}`,
                link: `https://www.${domain}/producto`,
                snippet: '',
                displayLink: domain,
              },
            ],
          }),
        );
      }),
    );

    const pageFetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('obramat')) return Promise.reject(new Error('bloqueada'));
      return Promise.resolve(htmlResponse('<html><body>Precio 9 €</body></html>'));
    });

    const pages = await scrapeShops('cemento', pageFetch as typeof fetch);
    expect(pages.length).toBeGreaterThan(0);
    expect(pages.every((page) => !page.url.includes('obramat'))).toBe(true);
  });
});

describe('formatLiveEvidence', () => {
  it('vacío sin fichas', () => {
    expect(formatLiveEvidence([])).toBe('');
  });

  it('numera cada ficha con su tienda y su URL literal', () => {
    const evidence = formatLiveEvidence([
      { url: 'https://www.obramat.es/ventilador-1', domain: 'obramat.es', evidence: 'Precio 62 €' },
    ]);
    expect(evidence).toContain('FICHAS DESCARGADAS EN VIVO');
    expect(evidence).toContain('FICHA EN VIVO 1 · obramat.es');
    expect(evidence).toContain('https://www.obramat.es/ventilador-1');
  });
});
