import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Тесты: чистые правила shared/ и хранилище src/store (без браузера, Supabase подменяется)
export default defineConfig({
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  test: {
    include: ['shared/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
});
