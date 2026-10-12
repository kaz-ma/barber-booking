import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CACHE_TAGS } from './cache-tags'

/*
 * CR-03: cacheTag() readers and updateTag() invalidations must use the same constants from
 * src/lib/cache-tags.ts — a literal tag in either place is how 'hours' vs 'business-hours'
 * drifted apart. Static scan of src/.
 */

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

const calls = sourceFiles(join(process.cwd(), 'src')).flatMap((file) => {
  const code = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
  return [...code.matchAll(/\b(cacheTag|updateTag|revalidateTag)\(([^)]*)\)/g)].map((m) => ({
    file,
    fn: m[1] as string,
    args: (m[2] as string).split(',').map((a) => a.trim()),
  }))
})

const tagOf = (arg: string) => {
  const m = /^CACHE_TAGS\.(\w+)$/.exec(arg)
  return m ? CACHE_TAGS[m[1] as keyof typeof CACHE_TAGS] : undefined
}

describe('cache tags (CR-03)', () => {
  it('every cacheTag / updateTag argument is a CACHE_TAGS constant', () => {
    expect(calls.length).toBeGreaterThan(0)
    for (const c of calls) for (const a of c.args) expect(tagOf(a), `${c.file}: ${c.fn}(${a})`).toBeDefined()
  })

  it('every invalidated tag is read by some cached function, and every read tag can be invalidated', () => {
    const read = new Set(calls.filter((c) => c.fn === 'cacheTag').flatMap((c) => c.args.map(tagOf)))
    const updated = new Set(calls.filter((c) => c.fn !== 'cacheTag').flatMap((c) => c.args.map(tagOf)))
    expect([...updated].sort()).toEqual([...read].sort())
    expect([...read].sort()).toEqual(Object.values(CACHE_TAGS).sort())
  })
})
