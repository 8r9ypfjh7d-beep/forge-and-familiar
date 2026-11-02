import { describe, expect, it } from 'vitest'
import { buildCommit, renderServiceWorker, startupFiles } from './vite-plugin.ts'

const template = "const VERSION = '__VERSION__'\nconst SHELL = __SHELL__\nconst CORE = __CORE__\nconst LAZY = __LAZY__\n"
const files = [
  { path: 'index.html', content: '<script type="module" src="./assets/index-abc.js"></script>' },
  { path: 'assets/index-abc.js', content: 'js' },
  { path: 'assets/index-abc.js.map', content: '{}' },
  { path: 'sw.js', content: 'old' },
  { path: 'version.json', content: '{}' },
]

describe('renderServiceWorker', () => {
  it('caches built files, minus source maps, version.json and the worker itself', () => {
    const out = renderServiceWorker(template, files)
    expect(out).toContain('const SHELL = ["index.html"]')
    expect(out).toContain('const CORE = ["assets/index-abc.js"]')
    expect(out).toContain('const LAZY = []')
  })

  it('splits hashed chunks into what the first screen loads and what screens load later', () => {
    const built = [
      { path: 'index.html', content: '<link rel="stylesheet" href="/assets/index-a.css"><script type="module" src="/assets/index-a.js"></script>' },
      { path: 'assets/index-a.css', content: 'body{}' },
      { path: 'assets/index-a.js', content: 'import{a as r}from"./react-b.js";import"./i18n-c.js";const S=()=>import("./Sheet-d.js")' },
      { path: 'assets/react-b.js', content: 'export const a=1' },
      { path: 'assets/i18n-c.js', content: 'import {x} from "./react-b.js"' },
      { path: 'assets/Sheet-d.js', content: 'import"./react-b.js"' },
      { path: 'assets/he-e.js', content: '' },
      { path: 'icons/icon-192.png', content: 'png' },
    ]
    expect([...startupFiles(built)].sort()).toEqual(['assets/i18n-c.js', 'assets/index-a.css', 'assets/index-a.js', 'assets/react-b.js'])
    const out = renderServiceWorker(template, built)
    expect(out).toContain('const SHELL = ["icons/icon-192.png","index.html"]')
    expect(out).toContain('const LAZY = ["assets/he-e.js","assets/Sheet-d.js"]')
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
