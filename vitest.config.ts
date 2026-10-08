import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

const alias = {
  '@shared': `${root}src/shared`,
  '@client': `${root}src/client`,
  '@server': `${root}src/server`,
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'shared',
          environment: 'node',
          include: ['tests/shared/**/*.test.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'client',
          environment: 'jsdom',
          include: ['tests/client/**/*.test.ts', 'tests/client/**/*.test.tsx'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'api',
          environment: 'node',
          include: ['tests/api/**/*.test.ts'],
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
          testTimeout: 30000,
          hookTimeout: 60000,
        },
      },
    ],
  },
});
