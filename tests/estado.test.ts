import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/estado/route';

afterEach(() => vi.unstubAllEnvs());

describe('panel de diagnóstico', () => {
  it('sin claves, lo dice claro en vez de fallar', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('GOOGLE_API_KEY', '');
    vi.stubEnv('GOOGLE_CSE_API_KEY', '');

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.gemini.estado).toBe('sin-configurar');
    expect(body.gemini.detalle).toContain('AIza');
    expect(body.busquedaProgramatica.estado).toBe('sin-configurar');
    expect(body.datosDelEmisor.estado).toBe('pendiente');
  });

  it('no se guarda en caché', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('GOOGLE_API_KEY', '');
    const response = await GET();
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
