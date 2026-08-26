import { describe, expect, it } from 'vitest';
import { demoTypicalUnit, searchDemoCatalog } from '@/lib/demo/catalog';
import { computeLinePrice } from '@/lib/pricing';
import { supplierOfferSchema } from '@/lib/types';
import { SUPPLIER_DIRECTORY } from '@/lib/demo/suppliers';
import { normalizeOffersResponse, preferLinkedOffers } from '@/lib/gemini/suppliers';

describe('catálogo de demostración', () => {
  it('encuentra porcelánico aunque la consulta lleve tildes y palabras sueltas', () => {
    const offers = searchDemoCatalog('quiero porcelánico gris para el salón');
    expect(offers.length).toBeGreaterThan(1);
    expect(offers.every((offer) => offer.price > 0)).toBe(true);
  });

  it('ignora las tildes al normalizar', () => {
    expect(searchDemoCatalog('ceramica').length).toBe(searchDemoCatalog('cerámica').length);
    expect(searchDemoCatalog('ceramica').length).toBeGreaterThan(0);
  });

  it('devuelve varias opciones de distintos proveedores', () => {
    const offers = searchDemoCatalog('porcelanico');
    const suppliers = new Set(offers.map((offer) => offer.supplier.name));
    expect(suppliers.size).toBeGreaterThan(1);
  });

  it('no inventa resultados para consultas sin relación', () => {
    expect(searchDemoCatalog('billete de avión a Tokio')).toEqual([]);
    expect(searchDemoCatalog('')).toEqual([]);
  });

  it('respeta el límite solicitado', () => {
    expect(searchDemoCatalog('cemento', 2).length).toBeLessThanOrEqual(2);
  });

  it('sugiere la unidad de medida habitual del material', () => {
    expect(demoTypicalUnit('azulejo')).toBe('m2');
    expect(demoTypicalUnit('cemento')).toBe('kg');
    expect(demoTypicalUnit('tubo pvc')).toBe('m');
    expect(demoTypicalUnit('nada de esto')).toBeNull();
  });

  it('todas las ofertas del catálogo cumplen el esquema del dominio', () => {
    const queries = [
      'porcelanico', 'cemento', 'cemento cola', 'pladur', 'aislamiento', 'ladrillo',
      'bloque', 'hormigon', 'arena', 'acero', 'pintura', 'tubo pvc', 'cable',
      'madera', 'teja', 'impermeabilizacion',
    ];
    for (const query of queries) {
      const offers = searchDemoCatalog(query, 20);
      expect(offers.length, `sin resultados para «${query}»`).toBeGreaterThan(0);
      for (const offer of offers) {
        expect(() => supplierOfferSchema.parse(offer), offer.productName).not.toThrow();
      }
    }
  });

  it('cada oferta se puede convertir a un importe sin lanzar', () => {
    const offers = searchDemoCatalog('porcelanico', 20);
    for (const offer of offers) {
      const breakdown = computeLinePrice(offer, { value: 20, unit: 'm2' });
      expect(breakdown.lineTotal).toBeGreaterThan(0);
      expect(breakdown.saleUnits).toBeGreaterThan(0);
    }
  });
});

describe('familias de producto', () => {
  it('etiqueta cada oferta con su familia para poder compararlas', () => {
    const offers = searchDemoCatalog('porcelanico', 20);
    expect(offers.every((offer) => offer.group === 'porcelanico')).toBe(true);
  });

  it('no confunde «terraza» con impermeabilización al pedir pavimento', () => {
    const offers = searchDemoCatalog('porcelánico antideslizante para la terraza', 20);
    expect(offers.some((offer) => offer.group === 'impermeabilizacion')).toBe(false);
    expect(offers.some((offer) => offer.group === 'porcelanico')).toBe(true);
  });

  it('sigue encontrando la impermeabilización cuando se pide por su nombre', () => {
    expect(searchDemoCatalog('lámina asfáltica').length).toBeGreaterThan(0);
    expect(searchDemoCatalog('impermeabilización de cubierta').length).toBeGreaterThan(0);
  });
});

describe('coherencia con el directorio de proveedores', () => {
  it('cada oferta del catálogo apunta a un proveedor del directorio', () => {
    const known = new Set(SUPPLIER_DIRECTORY.map((supplier) => supplier.name));
    const queries = [
      'porcelanico', 'cemento', 'cemento cola', 'pladur', 'aislamiento', 'ladrillo',
      'bloque', 'hormigon', 'arena', 'acero', 'pintura', 'tubo pvc', 'cable',
      'madera', 'teja', 'lamina asfaltica',
    ];

    for (const query of queries) {
      for (const offer of searchDemoCatalog(query, 20)) {
        // Un nombre que no está en el directorio pierde el municipio y la web,
        // y la oferta acaba mostrando «Provincia de Málaga» a secas.
        expect(known, `${offer.productName} → ${offer.supplier.name}`).toContain(
          offer.supplier.name,
        );
        expect(offer.supplier.location).not.toBe('Provincia de Málaga');
      }
    }
  });
});

describe('preferencia por ofertas con enlace de compra', () => {
  function offer(id: string, sourceUrl: string | null) {
    const base = searchDemoCatalog('cemento', 1)[0];
    return { ...base, id, sourceUrl };
  }

  it('descarta las ofertas sin ficha cuando hay al menos dos con enlace', () => {
    const result = preferLinkedOffers([
      offer('a', 'https://obramat.es/p/1'),
      offer('b', null),
      offer('c', 'https://leroymerlin.es/p/2'),
    ]);
    expect(result.map((o) => o.id)).toEqual(['a', 'c']);
  });

  it('conserva todas si casi ninguna tiene enlace, con las enlazadas primero', () => {
    const result = preferLinkedOffers([
      offer('a', null),
      offer('b', 'https://obramat.es/p/1'),
      offer('c', null),
    ]);
    expect(result.map((o) => o.id)).toEqual(['b', 'a', 'c']);
  });

  it('no se queda sin resultados cuando ninguna lleva enlace', () => {
    const result = preferLinkedOffers([offer('a', null), offer('b', null)]);
    expect(result).toHaveLength(2);
  });
});

describe('saneado de URLs de ficha', () => {
  it('acepta una ficha de producto y rechaza una portada', () => {
    const parse = (sourceUrl: string) =>
      normalizeOffersResponse({
        summary: 's',
        offers: [
          {
            productName: 'Cemento cola C2TE saco 25 kg',
            supplierName: 'Obramat',
            supplierLocation: 'Málaga',
            price: 9.5,
            saleUnit: 'saco',
            coverageValue: 5,
            coverageUnit: 'm2',
            recommendedWastePct: 0,
            confidence: 'alta',
            sourceUrl,
          },
        ],
      }).offers[0]?.sourceUrl ?? null;

    expect(parse('https://www.obramat.es/productos/cemento-cola-10741444.html')).toContain(
      'cemento-cola',
    );
    // Una portada no lleva a ningún producto: no puede pasar por ficha.
    expect(parse('https://www.obramat.es/')).toBeNull();
    expect(parse('obramat.es')).toBeNull();
    expect(parse('no es una url')).toBeNull();
  });
});
