import { readdirSync } from 'node:fs'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import { defineConfig, globalIgnores } from 'eslint/config'

/*
 * Minimal ESLint next to Biome (DES-00 §5.1, research 06 §4): Biome formats and does the
 * general lint; ESLint keeps what Biome cannot do — Next.js / React hooks / jsx-a11y rules
 * and the module-boundary rules below.
 */
const features = readdirSync('./src/features', { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)

const boundaryZones = [
  // features/A must not import features/B (shared logic goes to src/domain or src/lib)
  ...features.map((name) => ({
    target: `./src/features/${name}`,
    from: './src/features',
    except: [`./${name}`],
    message: 'features/* must not import each other; move shared code to src/domain or src/lib.',
  })),
  // domain is pure: no app, features, lib, components or config
  {
    target: './src/domain',
    from: ['./src/app', './src/features', './src/lib', './src/components', './src/config'],
    message: 'src/domain must stay pure (no I/O, no framework imports).',
  },
  // lib is a lower layer than features / app
  {
    target: './src/lib',
    from: ['./src/app', './src/features'],
    message: 'src/lib must not depend on features or app.',
  },
]

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      'import/no-restricted-paths': ['error', { zones: boundaryZones }],
    },
  },
  globalIgnores(['.next/**', 'node_modules/**', 'docs/**', '.local/**', 'drizzle/**', 'next-env.d.ts', 'coverage/**']),
])
