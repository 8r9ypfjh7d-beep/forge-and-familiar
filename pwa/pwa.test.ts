import { describe, expect, it } from 'vitest'
import { buildCommit, renderServiceWorker } from './vite-plugin.ts'

const template = "const VERSION = '__VERSION__'\nconst PRECACHE = __PRECACHE__\n"
const files = [
  { path: 'index.html', content: '<html>' },
  { path: 'assets/index-abc.js', content: 'js' },
  { path: 'assets/index-abc.js.map', content: '{}' },
  { path: 'sw.js', content: 'old' },
  { path: 'version.json', content: '{}' },
]

describe('renderServiceWorker', () => {
  it('precaches built files, minus source maps, version.json and the worker itself', () => {
    const out = renderServiceWorker(template, files)
    expect(out).toContain('const PRECACHE = ["assets/index-abc.js","index.html"]')
  })

  it('changes version when any file changes, and only then', () => {
    const version = (src: string) => /VERSION = "(\w+)"/.exec(src)?.[1]
    const a = version(renderServiceWorker(template, files))
    const b = version(renderServiceWorker(template, [...files].reverse()))
    const c = version(renderServiceWorker(template, [{ path: 'index.html', content: '<html lang>' }, files[1]]))
    expect(a).toMatch(/^[0-9a-f]{12}$/)
    expect(b).toBe(a)
    expect(c).not.toBe(a)
  })
})

describe('buildCommit', () => {
  it('prefers the commit Render or GitHub names', () => {
    expect(buildCommit({ RENDER_GIT_COMMIT: 'abc', GITHUB_SHA: 'def' })).toBe('abc')
    expect(buildCommit({ GITHUB_SHA: 'def' })).toBe('def')
  })

  it('falls back to git', () => {
    expect(buildCommit({})).toMatch(/^([0-9a-f]{40}|unknown)$/)
  })
})
