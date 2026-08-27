import { describe, expect, it } from 'vitest';
import { classifyGeminiFailure, retryDelay } from '@/lib/gemini/client';

describe('clasificación de fallos de Gemini', () => {
  it('reconoce el límite de peticiones', () => {
    expect(classifyGeminiFailure(new Error('429 RESOURCE_EXHAUSTED: quota exceeded'))).toBe('rate');
    expect(classifyGeminiFailure(new Error('Rate limit reached'))).toBe('rate');
  });

  it('reconoce los fallos transitorios del servicio', () => {
    expect(classifyGeminiFailure(new Error('503 UNAVAILABLE: model overloaded'))).toBe('transient');
    expect(classifyGeminiFailure(new Error('500 INTERNAL'))).toBe('transient');
  });

  it('trata todo lo demás como definitivo', () => {
    expect(classifyGeminiFailure(new Error('API key not valid'))).toBe('fatal');
    expect(classifyGeminiFailure(new Error('400 INVALID_ARGUMENT'))).toBe('fatal');
  });
});

describe('política de reintento', () => {
  const rate = new Error('429 RESOURCE_EXHAUSTED');
  const transient = new Error('503 UNAVAILABLE');
  const fatal = new Error('API key not valid');

  it('espera al cupo por minuto cuando el presupuesto lo permite', () => {
    expect(retryDelay(rate, 0, 45_000)).toBe(15_000);
  });

  it('reintenta pronto los fallos transitorios', () => {
    expect(retryDelay(transient, 0, 45_000)).toBe(2_500);
  });

  it('no reintenta si no quedaría margen para responder', () => {
    // 15 s de espera + 10 s de margen = 25 s mínimos.
    expect(retryDelay(rate, 0, 20_000)).toBeNull();
    expect(retryDelay(transient, 0, 5_000)).toBeNull();
  });

  it('reintenta una sola vez', () => {
    expect(retryDelay(rate, 1, 60_000)).toBeNull();
  });

  it('nunca reintenta un fallo definitivo', () => {
    expect(retryDelay(fatal, 0, 60_000)).toBeNull();
  });
});

describe('esquemas de respuesta para Gemini', () => {
  it('ningún enum contiene la cadena vacía, que la API rechaza con 400', async () => {
    // Regresión del fallo visto en producción: INVALID_ARGUMENT
    // «response_schema...enum[0]: cannot be empty».
    const schemas = await import('@/lib/gemini/schemas');

    const walk = (node: unknown, path: string): void => {
      if (Array.isArray(node)) {
        node.forEach((item, index) => walk(item, `${path}[${index}]`));
        return;
      }
      if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) {
          if (key === 'enum' && Array.isArray(value)) {
            for (const option of value) {
              expect(String(option).length, `${path}.enum contiene un valor vacío`).toBeGreaterThan(0);
            }
          }
          walk(value, `${path}.${key}`);
        }
      }
    };

    for (const [name, schema] of Object.entries(schemas)) {
      walk(schema, name);
    }
  });
});
