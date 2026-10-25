import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import type { Plugin } from 'vite'

const SKIP = [/\.map$/, /^sw\.js$/, /^docs\//]

/** Fills the service worker template with the files to precache and a version that changes with their contents. */
export function renderServiceWorker(template: string, files: { path: string; content: Buffer | string }[]): string {
  const kept = files.filter((f) => !SKIP.some((re) => re.test(f.path))).sort((a, b) => a.path.localeCompare(b.path))
  const hash = createHash('sha256')
  for (const f of kept) hash.update(f.path).update(f.content)
  return template
    .replace("'__VERSION__'", JSON.stringify(hash.digest('hex').slice(0, 12)))
    .replace('__PRECACHE__', JSON.stringify(kept.map((f) => f.path)))
}

function listFiles(dir: string, root = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(join(dir, e.name), root) : [relative(root, join(dir, e.name)).split(sep).join('/')],
  )
}

/** Writes dist/sw.js after a production build. Dev mode has no service worker. */
export function serviceWorker(): Plugin {
  let outDir = 'dist'
  return {
    name: 'forge-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const template = readFileSync(new URL('./sw.js', import.meta.url), 'utf8')
      const files = listFiles(outDir).map((path) => ({ path, content: readFileSync(join(outDir, path)) }))
      writeFileSync(join(outDir, 'sw.js'), renderServiceWorker(template, files))
    },
  }
}
