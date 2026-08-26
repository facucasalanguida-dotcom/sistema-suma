import { describe, expect, it } from 'vitest';
import { pdfText } from '@/pdf/text';

describe('pdfText', () => {
  it('conserva los acentos y la eñe del español', () => {
    expect(pdfText('Cerámica de Málaga, año 2026 · niño')).toBe(
      'Cerámica de Málaga, año 2026 · niño',
    );
  });

  it('conserva el símbolo del euro y los superíndices de unidades', () => {
    expect(pdfText('14,90 €/m² y 92 €/m³')).toBe('14,90 €/m² y 92 €/m³');
  });

  it('traduce los símbolos técnicos que Helvetica no codifica', () => {
    expect(pdfText('λ = 0,034 W/mK')).toBe('lambda = 0,034 W/mK');
    expect(pdfText('Resistencia ≥ 30 MPa')).toBe('Resistencia >= 30 MPa');
    expect(pdfText('Ø12 mm')).toBe('Ø12 mm');
    expect(pdfText('▪ punto')).toBe('• punto');
    expect(pdfText('interior → exterior')).toBe('interior -> exterior');
  });

  it('translitera caracteres desconocidos en lugar de dibujar un glifo erróneo', () => {
    expect(pdfText('Łódź')).toBe('Lódz');
    expect(pdfText('日本')).toBe('');
  });

  it('normaliza el espacio duro', () => {
    expect(pdfText('24 m²')).toBe('24 m²');
  });

  it('tolera valores vacíos', () => {
    expect(pdfText(null)).toBe('');
    expect(pdfText(undefined)).toBe('');
    expect(pdfText('')).toBe('');
  });
});
