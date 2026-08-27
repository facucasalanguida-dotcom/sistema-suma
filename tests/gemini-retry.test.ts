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
