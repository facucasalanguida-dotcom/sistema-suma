import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      /**
       * `server-only` es un centinela: su módulo por defecto lanza para que
       * el código de servidor no acabe en el navegador. En las pruebas todo
       * corre en Node, así que se apunta a la variante vacía que el propio
       * paquete publica para el entorno de servidor de React.
       */
      'server-only': path.resolve(import.meta.dirname, './node_modules/server-only/empty.js'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
