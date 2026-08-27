import { describe, expect, it } from 'vitest';
import {
  productSearchTerms,
  productSearchUrl,
  siteDomain,
} from '@/lib/search/fallback-link';
import {
  attachRecoveredLinks,
  linkRecoveryTargets,
  recoveryCap,
} from '@/lib/gemini/suppliers';
import { supplierOfferSchema, type SupplierOffer } from '@/lib/types';

function offer(
  id: string,
  sourceUrl: string | null,
  overrides: { website?: string | null; brand?: string | null } = {},
): SupplierOffer {
  return supplierOfferSchema.parse({
    id,
    productName: `Producto ${id}`,
    brand: overrides.brand ?? null,
    supplier: {
      name: 'Optimus',
      location: 'Marbella',
      website: overrides.website !== undefined ? overrides.website : 'optimusferreteria.com',
    },
    price: 10,
    saleUnit: 'ud',
    coverage: { value: 1, unit: 'ud' },
    confidence: 'estimada',
    sourceUrl,
  });
}

describe('siteDomain', () => {
  it('limpia protocolo, www y rutas', () => {
    expect(siteDomain('https://www.optimusferreteria.com/tienda')).toBe('optimusferreteria.com');
    expect(siteDomain('optimusferreteria.com')).toBe('optimusferreteria.com');
    expect(siteDomain('www.Obramat.es')).toBe('obramat.es');
  });

  it('rechaza lo que no parece un dominio', () => {
    expect(siteDomain(null)).toBeNull();
    expect(siteDomain('pendiente')).toBeNull();
    expect(siteDomain('')).toBeNull();
  });
});

describe('productSearchUrl', () => {
  it('acota la búsqueda a la tienda cuando el proveedor tiene web', () => {
    const url = productSearchUrl(
      offer('a', null, { brand: 'EDM', website: 'optimusferreteria.com' }),
    );
    expect(url).toContain('google.com/search');
    expect(decodeURIComponent(url)).toContain('site:optimusferreteria.com');
    expect(decodeURIComponent(url)).toContain('EDM Producto a');
  });

  it('sin web busca el producto junto al nombre del proveedor', () => {
    const url = productSearchUrl(offer('a', null, { website: null }));
    expect(decodeURIComponent(url)).not.toContain('site:');
    expect(decodeURIComponent(url)).toContain('Optimus');
  });

  it('nunca es la portada del proveedor', () => {
    const url = productSearchUrl(offer('a', null));
    expect(new URL(url).hostname).toBe('www.google.com');
    expect(new URL(url).search.length).toBeGreaterThan(0);
  });
});

describe('productSearchTerms', () => {
  it('antepone la marca cuando existe', () => {
    expect(productSearchTerms({ productName: 'Ventilador 107cm', brand: 'EDM' })).toBe(
      'EDM Ventilador 107cm',
    );
    expect(productSearchTerms({ productName: 'Ventilador 107cm', brand: null })).toBe(
      'Ventilador 107cm',
    );
  });
});

describe('recoveryCap', () => {
  it('con tiempo de sobra concede el tope completo', () => {
    expect(recoveryCap(30_000)).toBe(7_000);
  });

  it('con lo justo concede lo que queda menos la reserva', () => {
    expect(recoveryCap(13_000)).toBe(3_000);
  });

  it('sin hueco digno no se rescata', () => {
    expect(recoveryCap(11_000)).toBeNull();
  });
});

describe('linkRecoveryTargets', () => {
  it('elige las ofertas sin enlace cuyo proveedor tiene web', () => {
    const targets = linkRecoveryTargets([
      offer('con-enlace', 'https://www.obramat.es/productos/cemento-1.html'),
      offer('sin-enlace', null, { brand: 'EDM' }),
      offer('sin-web', null, { website: null }),
    ]);

    expect(targets).toEqual([
      { id: 'sin-enlace', query: 'EDM Producto sin-enlace', domain: 'optimusferreteria.com' },
    ]);
  });

  it('limita cuántas ofertas se rescatan por búsqueda', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => offer(id, null));
    expect(linkRecoveryTargets(many).length).toBeLessThanOrEqual(4);
  });
});

describe('attachRecoveredLinks', () => {
  it('engancha la ficha rescatada a su oferta y no toca las demás', () => {
    const offers = [offer('a', null), offer('b', null)];
    const result = attachRecoveredLinks(
      offers,
      new Map([['a', 'https://optimusferreteria.com/ventilador-edm-107']]),
    );

    expect(result.find((entry) => entry.id === 'a')?.sourceUrl).toBe(
      'https://optimusferreteria.com/ventilador-edm-107',
    );
    expect(result.find((entry) => entry.id === 'b')?.sourceUrl).toBeNull();
  });

  it('sin rescates devuelve la lista tal cual', () => {
    const offers = [offer('a', null)];
    expect(attachRecoveredLinks(offers, new Map())).toBe(offers);
  });
});
