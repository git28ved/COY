import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
      reporter: ['text', 'html'],
      // Phase 2 bar: the business logic and the privacy serializer.
      thresholds: {
        'src/services/**': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/serializers.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
      },
    },
  },
});
