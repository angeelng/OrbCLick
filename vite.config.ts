import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * El dashboard de desarrollo vive en `dashboard/` y lo sirve el servidor de dev
 * en /dashboard/. Queda fuera del build de producción a propósito: `input` solo
 * declara el juego.
 */
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: {
      input: { game: resolve(__dirname, 'index.html') },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json'],
      reportsDirectory: 'coverage',
      include: ['src/core/**/*.ts', 'src/persistence/**/*.ts'],
    },
  },
});
