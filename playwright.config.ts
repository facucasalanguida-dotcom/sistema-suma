import { defineConfig, devices } from '@playwright/test';

/**
 * Prueba de extremo a extremo del proceso completo: chat -> proveedores ->
 * cantidad -> presupuesto -> PDF.
 *
 * Se ejecuta contra la compilación de producción y en modo demostración (sin
 * clave de Gemini), de modo que no depende de la red ni de un servicio externo.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'list' : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3210',
    trace: 'retain-on-failure',
    locale: 'es-ES',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        /**
         * En entornos con un Chromium ya instalado (contenedores de CI, cajas
         * de desarrollo compartidas) se puede apuntar a ese binario en lugar de
         * descargar uno con `npx playwright install`.
         */
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? {
              executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
              chromiumSandbox: false,
            }
          : {},
      },
    },
  ],
  webServer: {
    command: 'npm run start -- --port 3210 --hostname 127.0.0.1',
    url: 'http://127.0.0.1:3210',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { GEMINI_API_KEY: '', GOOGLE_API_KEY: '' },
  },
});
