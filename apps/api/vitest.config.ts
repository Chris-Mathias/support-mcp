import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      SESSION_SECRET: 'a'.repeat(32),
      ENCRYPTION_KEY: 'a'.repeat(64),
      APP_PASSWORD: 'test-password',
    },
  },
});
