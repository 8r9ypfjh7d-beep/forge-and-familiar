// Service worker template. pwa/vite-plugin.ts fills in VERSION and PRECACHE at build time.
const VERSION = '__VERSION__'
const PRECACHE = __PRECACHE__
const CACHE = `ff-${VERSION}`
const scope = self.registration.scope
// Hosts often send Vary: Origin, and module scripts carry an Origin header the precache requests did not.
const MATCH = { ignoreVary: true }

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((p) => new URL(p, scope).href))))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ff-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// The page asks the waiting worker to take over when the player taps "Reload".
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || !req.url.startsWith(scope)) return
  if (req.mode === 'navigate') {
    // Single-page app: every navigation gets the cached shell, so it opens with no signal.
    event.respondWith(caches.match(new URL('index.html', scope).href, MATCH).then((hit) => hit || fetch(req)))
    return
  }
  event.respondWith(caches.match(req, MATCH).then((hit) => hit || fetch(req)))
})
