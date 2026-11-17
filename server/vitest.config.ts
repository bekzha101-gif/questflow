import { defineConfig } from 'vitest/config';

// Тесты сервера: Telegram, Supabase и время подменяются, сеть не нужна
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
