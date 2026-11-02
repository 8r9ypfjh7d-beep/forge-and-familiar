// Service worker template. pwa/vite-plugin.ts fills in VERSION, SHELL, CORE and LAZY at build time.
const VERSION = '__VERSION__'
// Unhashed files (index.html, manifest, icons): one cache per build.
const SHELL = __SHELL__
// Hashed files the first screen needs: fetched before the worker installs.
const CORE = __CORE__
// Every other hashed chunk (screens, monsters, spells, Hebrew…): fetched in the background after the app opens.
const LAZY = __LAZY__
const CACHE = `ff-${VERSION}`
// Hashed files never change under the same name, so they share one cache that survives deploys:
// a new version downloads only the chunks that actually changed.
const ASSETS = 'ff-assets'
const scope = self.registration.scope
// Hosts often send Vary: Origin, and module scripts carry an Origin header the precache requests did not.
const MATCH = { ignoreVary: true }
const url = (p) => new URL(p, scope).href

/** Puts each missing file into the asset cache, a few at a time. A failed fetch is skipped; it is retried next time. */
async function fill(paths) {
  const cache = await caches.open(ASSETS)
  const have = new Set((await cache.keys()).map((r) => r.url))
  const todo = paths.map(url).filter((u) => !have.has(u))
  const worker = async () => {
    for (let u = todo.shift(); u; u = todo.shift()) {
      try {
        const res = await fetch(u)
        if (res.ok) await cache.put(u, res)
      } catch {
        // Offline or a flaky connection: the next WARM picks it up.
      }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
}

self.addEventListener('install', (event) => {
  event.waitUntil(Promise.all([
    caches.open(CACHE).then((cache) => cache.addAll(SHELL.map(url))),
    caches.open(ASSETS).then(async (cache) => {
      const have = new Set((await cache.keys()).map((r) => r.url))
      await cache.addAll(CORE.map(url).filter((u) => !have.has(u)))
    }),
  ]))
})

self.addEventListener('activate', (event) => {
  const keep = new Set([...CORE, ...LAZY].map(url))
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ff-') && k !== CACHE && k !== ASSETS).map((k) => caches.delete(k))))
      // Chunks of older builds are no longer referenced by anything.
      .then(() => caches.open(ASSETS))
      .then(async (cache) => Promise.all((await cache.keys()).filter((r) => !keep.has(r.url)).map((r) => cache.delete(r))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  // The page asks the waiting worker to take over when the player taps "Reload".
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
  // The page, once it has rendered, asks for the rest of the app so every screen works with no signal.
  if (event.data === 'WARM') event.waitUntil(fill(LAZY))
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || !req.url.startsWith(scope)) return
  if (req.mode === 'navigate') {
    // Single-page app: every navigation gets the cached shell, so it opens with no signal.
    event.respondWith(caches.match(url('index.html'), MATCH).then((hit) => hit || fetch(req)))
    return
  }
  event.respondWith(caches.match(req, MATCH).then((hit) => hit || fetch(req).then((res) => {
    // A chunk opened before the background fill reached it is kept too.
    if (res.ok && req.url.startsWith(url('assets/'))) {
      const copy = res.clone()
      event.waitUntil(caches.open(ASSETS).then((cache) => cache.put(req.url, copy)))
    }
    return res
  })))
})
