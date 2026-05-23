import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      ENCRYPTION_KEY: 'a'.repeat(64),
    },
  },
});
