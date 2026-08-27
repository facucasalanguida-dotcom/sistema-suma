import { describe, expect, it, vi } from 'vitest';
import {
  canonicalUrl,
  checkLinks,
  checkProductUrl,
  classifyResponse,
  verificationCap,
} from '@/lib/search/verify-links';
import { applyLinkVerification } from '@/lib/gemini/suppliers';
import { supplierOfferSchema, type SupplierOffer } from '@/lib/types';

/** Respuesta HTTP simulada con la URL final tras las redirecciones. */
function httpResponse(status: number, finalUrl = ''): Response {
  const response = new Response(null, { status });
  Object.defineProperty(response, 'url', { value: finalUrl });
  return response;
}

function offer(id: string, sourceUrl: string | null): SupplierOffer {
  return supplierOfferSchema.parse({
    id,
    productName: `Producto ${id}`,
    supplier: { name: 'Obramat Málaga', location: 'Málaga' },
    price: 10,
    saleUnit: 'm2',
    coverage: { value: 1, unit: 'm2' },
    confidence: 'alta',
    sourceUrl,
  });
}

const FICHA = 'https://www.obramat.es/productos/cemento-gris-10677982.html';

describe('verificationCap', () => {
  it('con tiempo de sobra concede el tope completo', () => {
    expect(verificationCap(30_000)).toBe(6_500);
  });

  it('con poco tiempo concede lo que queda menos la reserva', () => {
    expect(verificationCap(6_000)).toBe(4_000);
  });

  it('sin hueco digno no se verifica', () => {
    expect(verificationCap(3_000)).toBeNull();
    expect(verificationCap(0)).toBeNull();
  });
});

describe('canonicalUrl', () => {
  it('iguala www, parámetros de seguimiento y barra final', () => {
    expect(canonicalUrl('https://www.obramat.es/productos/cemento-1.html?utm_source=google')).toBe(
      canonicalUrl('https://obramat.es/productos/cemento-1.html'),
    );
    expect(canonicalUrl('https://obramat.es/productos/')).toBe(
      canonicalUrl('https://obramat.es/productos'),
    );
  });

  it('rechaza lo que no es una URL http', () => {
    expect(canonicalUrl('no es una url')).toBeNull();
    expect(canonicalUrl('ftp://obramat.es/fichero')).toBeNull();
  });
});

describe('classifyResponse', () => {
  it('2xx es ficha viva', () => {
    expect(classifyResponse(200, FICHA, FICHA)).toBe('ok');
  });

  it('404 y 410 son ficha muerta', () => {
    expect(classifyResponse(404, FICHA, FICHA)).toBe('gone');
    expect(classifyResponse(410, FICHA, FICHA)).toBe('gone');
  });

  it('la redirección a la portada es una ficha muerta encubierta', () => {
    expect(classifyResponse(200, 'https://www.obramat.es/', FICHA)).toBe('gone');
  });

  it('403, 429 y 5xx no demuestran nada', () => {
    expect(classifyResponse(403, FICHA, FICHA)).toBe('unknown');
    expect(classifyResponse(429, FICHA, FICHA)).toBe('unknown');
    expect(classifyResponse(503, FICHA, FICHA)).toBe('unknown');
  });
});

describe('checkProductUrl', () => {
  it('un HEAD que responde bien basta', async () => {
    const fetchMock = vi.fn().mockResolvedValue(httpResponse(200, FICHA));

    expect(await checkProductUrl(FICHA, 6_000, fetchMock)).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.method).toBe('HEAD');
  });

  it('un 404 en el HEAD ya es concluyente', async () => {
    const fetchMock = vi.fn().mockResolvedValue(httpResponse(404, FICHA));

    expect(await checkProductUrl(FICHA, 6_000, fetchMock)).toBe('gone');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('si el HEAD no es concluyente reintenta con GET', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(httpResponse(405, FICHA))
      .mockResolvedValueOnce(httpResponse(200, FICHA));

    expect(await checkProductUrl(FICHA, 6_000, fetchMock)).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]?.method).toBe('GET');
  });

  it('un fallo de red no condena al enlace', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('ENOTFOUND'));

    expect(await checkProductUrl(FICHA, 6_000, fetchMock)).toBe('unknown');
  });

  it('sin tiempo no llama a la red y responde unknown', async () => {
    const fetchMock = vi.fn();

    expect(await checkProductUrl(FICHA, 100, fetchMock)).toBe('unknown');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('checkLinks', () => {
  it('sin presupuesto devuelve el mapa vacío sin tocar la red', async () => {
    const fetchMock = vi.fn();

    expect((await checkLinks([FICHA], null, fetchMock)).size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('comprueba cada enlace distinto una sola vez', async () => {
    const fetchMock = vi.fn().mockResolvedValue(httpResponse(200, FICHA));
    const otra = 'https://www.leroymerlin.es/productos/saco-18693780.html';

    const statuses = await checkLinks([FICHA, FICHA, null, otra], 6_000, fetchMock);
    expect(statuses.get(FICHA)).toBe('ok');
    expect(statuses.get(otra)).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('applyLinkVerification', () => {
  it('una ficha viva queda marcada como verificada', () => {
    const result = applyLinkVerification(
      [offer('a', FICHA)],
      new Map([[FICHA, 'ok' as const]]),
      new Set(),
    );
    expect(result[0].linkVerified).toBe(true);
    expect(result[0].sourceUrl).toBe(FICHA);
  });

  it('una ficha muerta pierde el enlace y pasa a precio estimado', () => {
    const result = applyLinkVerification(
      [offer('a', FICHA), offer('b', null)],
      new Map([[FICHA, 'gone' as const]]),
      new Set(),
    );
    expect(result).toHaveLength(2);
    const dead = result.find((entry) => entry.id === 'a');
    expect(dead?.sourceUrl).toBeNull();
    expect(dead?.confidence).toBe('estimada');
    expect(dead?.linkVerified).toBe(false);
  });

  it('si quedan al menos dos opciones enlazadas, la de la ficha muerta se descarta', () => {
    const otra = 'https://www.leroymerlin.es/productos/saco-18693780.html';
    const muerta = 'https://www.obramat.es/productos/descatalogado-1.html';

    const result = applyLinkVerification(
      [offer('a', FICHA), offer('b', otra), offer('c', muerta)],
      new Map([[muerta, 'gone' as const]]),
      new Set(),
    );
    expect(result.map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('estar en el índice de la búsqueda programática también verifica', () => {
    const canonical = canonicalUrl(`${FICHA}?utm_source=google`);
    const result = applyLinkVerification(
      [offer('a', FICHA)],
      new Map(),
      new Set(canonical ? [canonical] : []),
    );
    expect(result[0].linkVerified).toBe(true);
  });

  it('sin veredicto el enlace se conserva sin marca', () => {
    const result = applyLinkVerification([offer('a', FICHA)], new Map(), new Set());
    expect(result[0].sourceUrl).toBe(FICHA);
    expect(result[0].linkVerified).toBe(false);
  });
});
