import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { existsSync } from 'node:fs'

// Same as scripts/load-env.ts (inlined: the native config loader wants explicit extensions).
for (const file of ['.env.local', '.env']) if (existsSync(file)) process.loadEnvFile(file)

// DB tests run against TEST_DATABASE_URL (scripts/test.sh starts the local cluster and
// exports it; CI points it at the Postgres service). The app's db module reads DATABASE_URL.
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? ''

const serverOnlyStub = fileURLToPath(new URL('./test/server-only-stub.ts', import.meta.url))
const shared = {
  plugins: [react()],
  resolve: { tsconfigPaths: true, alias: { 'server-only': serverOnlyStub } },
}

export default defineConfig({
  test: {
    projects: [
      {
        ...shared,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.db.test.ts'],
        },
      },
      {
        ...shared,
        test: {
          name: 'dom',
          environment: 'happy-dom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./test/dom-setup.ts'],
        },
      },
      {
        ...shared,
        test: {
          name: 'db',
          environment: 'node',
          include: ['src/**/*.db.test.ts'],
          globalSetup: ['./test/db-global-setup.ts'],
          setupFiles: ['./test/db-setup.ts'],
          // One shared database: run files sequentially.
          fileParallelism: false,
          testTimeout: 20_000,
          env: {
            NODE_ENV: 'test',
            DATABASE_URL: testDatabaseUrl,
            SITE_URL: 'http://localhost:3000',
            TURNSTILE_SECRET_KEY: '',
          },
        },
      },
    ],
  },
})
