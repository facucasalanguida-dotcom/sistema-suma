import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  allowedShopDomains,
  formatCseEvidence,
  isCseConfigured,
  searchProductPages,
} from '@/lib/search/google-cse';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function item(link: string, title = 'Producto', snippet = 'Precio 9,99 €') {
  return { title, link, snippet, displayLink: new URL(link).hostname };
}

beforeEach(() => {
  vi.stubEnv('GOOGLE_CSE_API_KEY', 'clave-de-prueba');
  vi.stubEnv('GOOGLE_CSE_ID', 'buscador-de-prueba');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('configuración', () => {
  it('sin clave no está configurada y no llama a la red', async () => {
    vi.stubEnv('GOOGLE_CSE_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(isCseConfigured()).toBe(false);
    expect(await searchProductPages(['cemento'])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('el filtro de tiendas incluye el directorio y los almacenes online nacionales', () => {
    const domains = allowedShopDomains();
    expect(domains).toContain('obramat.es');
    expect(domains).toContain('leroymerlin.es');
    expect(domains).toContain('manomano.es');
    expect(domains).toContain('bauhaus.es');
  });
});

describe('búsqueda', () => {
  it('devuelve fichas de tiendas admitidas y descarta el resto', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          items: [
            item('https://www.obramat.es/productos/cemento-gris-32-5n-25-kg-10677982.html'),
            item('https://www.unblogdebricolaje.com/mejores-cementos-2026'),
            item('https://www.leroymerlin.es/productos/saco-cemento-18693780.html'),
          ],
        }),
      ),
    );

    const results = await searchProductPages(['cemento saco 25 kg']);
    expect(results.map((result) => result.domain)).toEqual(['obramat.es', 'leroymerlin.es']);
  });

  it('descarta portadas y URLs sin https', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          items: [
            item('https://www.obramat.es/'),
            item('http://www.obramat.es/productos/cemento-10677982.html'),
            item('https://www.obramat.es/productos/cemento-10677982.html'),
          ],
        }),
      ),
    );

    const results = await searchProductPages(['cemento']);
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('https://www.obramat.es/productos/cemento-10677982.html');
  });

  it('deduplica la misma ficha aunque cambien los parámetros de seguimiento', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          items: [
            item('https://www.obramat.es/productos/cemento-10677982.html?utm_source=google'),
            item('https://www.obramat.es/productos/cemento-10677982.html'),
          ],
        }),
      ),
    );

    expect(await searchProductPages(['cemento'])).toHaveLength(1);
  });

  it('una clave rechazada devuelve vacío sin reintentar', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: {} }, 403));
    vi.stubGlobal('fetch', fetchMock);

    expect(await searchProductPages(['cemento'])).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reintenta los errores transitorios del servicio y acaba respondiendo', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(
        jsonResponse({
          items: [item('https://www.obramat.es/productos/cemento-10677982.html')],
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const results = await searchProductPages(['cemento']);
    expect(results).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('una respuesta malformada cuenta como vacía, nunca lanza', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('esto no es JSON', { status: 200 })),
    );
    expect(await searchProductPages(['cemento'])).toEqual([]);
  });

  it('limita el número de consultas por búsqueda', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await searchProductPages(['a', 'b', 'c', 'd', 'e']);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('evidencia para la estructuración', () => {
  it('vacía cuando no hay resultados', () => {
    expect(formatCseEvidence([])).toBe('');
  });

  it('incluye título, URL y extracto de cada ficha', () => {
    const evidence = formatCseEvidence([
      {
        title: 'Cemento gris 32,5N 25 kg',
        url: 'https://www.obramat.es/productos/cemento-10677982.html',
        snippet: '3,80 € IVA incluido',
        domain: 'obramat.es',
      },
    ]);
    expect(evidence).toContain('BÚSQUEDA PROGRAMÁTICA');
    expect(evidence).toContain('https://www.obramat.es/productos/cemento-10677982.html');
    expect(evidence).toContain('3,80 €');
  });
});
