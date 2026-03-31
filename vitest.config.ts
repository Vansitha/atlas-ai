import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/types/**',
        'src/index.ts',
        'src/ai/transport/**', // requires external CLIs / API keys
        'src/storage/paths.ts', // pure constants
        'src/utils/logger.ts', // thin wrapper around console
        'src/daemon/watcher.ts', // long-running process with chokidar + full pipeline
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
})
