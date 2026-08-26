import { describe, expect, it } from 'vitest';
import { demoTypicalUnit, searchDemoCatalog } from '@/lib/demo/catalog';
import { computeLinePrice } from '@/lib/pricing';
import { supplierOfferSchema } from '@/lib/types';

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
