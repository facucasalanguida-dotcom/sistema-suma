import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test.describe('proceso completo de presupuesto', () => {
  // Playwright abre un contexto nuevo por prueba, así que el almacenamiento
  // local ya llega vacío: no hace falta limpiarlo (y limpiarlo en cada carga
  // rompería precisamente la prueba de persistencia).
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('del chat al PDF, pasando por cantidad e importe', async ({ page }) => {
    // Paso 1: se pide un material por escrito.
    await expect(page.getByText('Modo demostración').first()).toBeVisible();

    const composer = page.getByPlaceholder(/Describe el material/);
    await composer.fill('porcelánico 60x60 para el salón');
    await composer.press('Enter');

    // Pasos 2 y 3: la respuesta trae varias opciones de proveedores.
    const offers = page.locator('article', { hasText: 'Rendimiento:' });
    await expect(offers.first()).toBeVisible({ timeout: 30_000 });
    const offerCount = await offers.count();
    expect(offerCount).toBeGreaterThan(1);

    // Cada opción muestra proveedor, precio y unidad de venta.
    const first = offers.first();
    await expect(first).toContainText('€');
    await expect(first.getByRole('button', { name: /Agregar al presupuesto/ })).toBeEnabled();

    // Paso 4 y 5: al agregar, el asistente pregunta la cantidad.
    await first.getByRole('button', { name: /Agregar al presupuesto/ }).click();
    await expect(page.getByText('¿Cuánta cantidad vas a utilizar?')).toBeVisible();

    // Paso 6: se indica la cantidad y el importe se calcula solo.
    await page.locator('#suma-cantidad').fill('24');
    await expect(page.getByText(/sin IVA/).first()).toBeVisible();
    await page.getByRole('button', { name: /Calcular y añadir/ }).click();

    await expect(page.getByText(/Añadido al presupuesto/)).toBeVisible({ timeout: 30_000 });

    // La partida aparece en el panel del presupuesto con su total.
    const budget = page.getByRole('complementary', { name: 'Presupuesto en curso' });
    await expect(budget.getByText('1 partida')).toBeVisible();
    await expect(budget.getByText('DEBO COBRAR')).toBeVisible();

    // Se añade un segundo material para comprobar que el presupuesto acumula.
    await composer.fill('cemento cola');
    await composer.press('Enter');
    await expect(offers.nth(offerCount)).toBeVisible({ timeout: 30_000 });

    await offers.nth(offerCount).getByRole('button', { name: /Agregar al presupuesto/ }).click();
    await page.locator('#suma-cantidad').fill('24');
    await page.getByRole('button', { name: /Calcular y añadir/ }).click();
    await expect(budget.getByText('2 partidas')).toBeVisible({ timeout: 30_000 });

    // Paso 7: antes de finalizar se pregunta el margen de ganancia.
    await budget.getByRole('button', { name: /Finalizar presupuesto/ }).click();
    const marginDialog = page.getByRole('dialog');
    await expect(
      marginDialog.getByRole('heading', { name: /Qué margen quieres ganar/ }),
    ).toBeVisible();

    // Con un 25 % de margen, lo que hay que cobrar sube sobre el coste.
    await marginDialog.getByRole('button', { name: '25 %' }).click();
    await expect(marginDialog.getByText(/un 25 % son/)).toBeVisible();
    await marginDialog.getByRole('button', { name: /^Continuar$/ }).click();

    // Paso 8: datos del cliente y descarga del PDF.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Margen de ganancia/)).toBeVisible();

    await dialog.getByLabel('Razón social o nombre').fill('Promociones Costa del Sol, S.L.');
    await dialog.getByLabel('CIF / NIF').fill('B29123456');
    await dialog.getByLabel('Obra o proyecto').fill('Reforma de vivienda unifamiliar');
    await dialog.getByLabel('Descuento comercial').fill('5');

    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await dialog.getByRole('button', { name: /Generar PDF/ }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^Presupuesto-SUMA-PRE-\d{4}-\d{4}\.pdf$/);
    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    expect(existsSync(filePath!)).toBe(true);
  });

  test('el presupuesto sobrevive a recargar la página', async ({ page }) => {
    const composer = page.getByPlaceholder(/Describe el material/);
    await composer.fill('cemento');
    await composer.press('Enter');

    const offers = page.locator('article', { hasText: 'Rendimiento:' });
    await expect(offers.first()).toBeVisible({ timeout: 30_000 });

    await offers.first().getByRole('button', { name: /Agregar al presupuesto/ }).click();
    await page.locator('#suma-cantidad').fill('300');
    await page.getByRole('button', { name: /Calcular y añadir/ }).click();

    const budget = page.getByRole('complementary', { name: 'Presupuesto en curso' });
    await expect(budget.getByText('1 partida')).toBeVisible({ timeout: 30_000 });

    await page.reload();
    await expect(budget.getByText('1 partida')).toBeVisible({ timeout: 30_000 });
  });

  test('avisa cuando no encuentra el material en el catálogo local', async ({ page }) => {
    const composer = page.getByPlaceholder(/Describe el material/);
    await composer.fill('un billete de avión a Tokio');
    await composer.press('Enter');

    await expect(page.getByText(/No he encontrado nada para esa descripción/)).toBeVisible({
      timeout: 30_000,
    });
  });
});
