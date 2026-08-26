import { describe, expect, it } from 'vitest';
import { parseQuantity, parseSpanishNumber } from '@/lib/quantity-parser';

describe('parseSpanishNumber', () => {
  it('lee la coma como separador decimal', () => {
    expect(parseSpanishNumber('12,5')).toBe(12.5);
  });

  it('lee el punto como separador de millares', () => {
    expect(parseSpanishNumber('1.234,56')).toBe(1234.56);
    expect(parseSpanishNumber('1.234')).toBe(1234);
  });

  it('acepta también el formato anglosajón sin ambigüedad', () => {
    expect(parseSpanishNumber('1234.56')).toBe(1234.56);
  });

  it('descarta texto no numérico', () => {
    expect(parseSpanishNumber('abc')).toBeNull();
  });
});

describe('parseQuantity', () => {
  const cases: Array<[string, number, string]> = [
    ['24 m2', 24, 'm2'],
    ['24m²', 24, 'm2'],
    ['24 metros cuadrados', 24, 'm2'],
    ['350 cm', 350, 'cm'],
    ['350 centímetros', 350, 'cm'],
    ['12 metros lineales', 12, 'm'],
    ['12 ml', 12, 'm'],
    ['2,5 m3', 2.5, 'm3'],
    ['500 kg', 500, 'kg'],
    ['1,5 t', 1.5, 't'],
    ['18 unidades', 18, 'ud'],
    ['15 litros', 15, 'l'],
    ['8 piezas', 8, 'ud'],
    ['necesito unos 24,5 m2 aprox', 24.5, 'm2'],
    ['quiero 6 m de tubo', 6, 'm'],
    ['0,75 m3 de hormigón', 0.75, 'm3'],
    ['1.234,56 m2', 1234.56, 'm2'],
  ];

  it.each(cases)('interpreta «%s»', (phrase, value, unit) => {
    const parsed = parseQuantity(phrase);
    expect(parsed).not.toBeNull();
    expect(parsed!.value).toBeCloseTo(value, 3);
    expect(parsed!.unit).toBe(unit);
  });

  it('prefiere superficie sobre longitud en «metros cuadrados»', () => {
    expect(parseQuantity('30 metros cuadrados')!.unit).toBe('m2');
  });

  it('multiplica dimensiones cruzadas', () => {
    const parsed = parseQuantity('3x4 metros');
    expect(parsed).toMatchObject({ value: 12, unit: 'm2', source: 'dimensiones' });
  });

  it('multiplica dimensiones en centímetros manteniendo la unidad', () => {
    const parsed = parseQuantity('300 x 400 cm');
    expect(parsed).toMatchObject({ value: 120000, unit: 'cm2' });
  });

  it('usa la unidad habitual cuando sólo hay un número', () => {
    const parsed = parseQuantity('40', 'm2');
    expect(parsed).toMatchObject({ value: 40, unit: 'm2', source: 'sin-unidad' });
  });

  it('no inventa cantidad si no hay número ni unidad por defecto', () => {
    expect(parseQuantity('no lo sé todavía')).toBeNull();
    expect(parseQuantity('bastante')).toBeNull();
  });
});
