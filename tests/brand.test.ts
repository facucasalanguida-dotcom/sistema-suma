import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * `issuerIsPlaceholder` se calcula al importar el módulo, porque las variables
 * `NEXT_PUBLIC_*` se resuelven en tiempo de compilación. Para probar los dos
 * estados hay que reimportar el módulo con el entorno cambiado.
 */
async function loadBrand() {
  vi.resetModules();
  return import('@/lib/brand');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('datos fiscales del emisor', () => {
  it('detecta que siguen siendo los de ejemplo cuando no hay nada configurado', async () => {
    const { issuerIsPlaceholder, company } = await loadBrand();
    expect(company.taxId).toBe('B00000000');
    expect(issuerIsPlaceholder).toBe(true);
  });

  it('también lo detecta si la variable existe pero está vacía', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUMA_TAX_ID', '   ');
    const { issuerIsPlaceholder } = await loadBrand();
    expect(issuerIsPlaceholder).toBe(true);
  });

  it('deja de avisar en cuanto se configura un NIF real', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUMA_TAX_ID', 'B29123456');
    const { issuerIsPlaceholder, company } = await loadBrand();
    expect(company.taxId).toBe('B29123456');
    expect(issuerIsPlaceholder).toBe(false);
  });

  it('toma del entorno el resto de datos del emisor', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUMA_LEGAL_NAME', 'Grupo SUMA, S.L.');
    vi.stubEnv('NEXT_PUBLIC_SUMA_ADDRESS', 'Calle Almirante 1, 29016 Málaga');
    const { company } = await loadBrand();
    expect(company.legalName).toBe('Grupo SUMA, S.L.');
    expect(company.address).toBe('Calle Almirante 1, 29016 Málaga');
  });
});

describe('paleta de marca', () => {
  it('la web y el PDF comparten el rojo corporativo como color de acento', async () => {
    const { brandColors, printColors } = await loadBrand();
    expect(brandColors.red).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(printColors.red).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('el cuerpo del PDF va sobre papel blanco, no sobre el negro de la web', async () => {
    const { brandColors, printColors } = await loadBrand();
    expect(printColors.paper).toBe('#FFFFFF');
    expect(printColors.paper).not.toBe(brandColors.canvas);
  });
});
