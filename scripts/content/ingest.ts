// Builds the content library (src/content/data) from the SRD JSON in 5e-bits/5e-database.
//
//   node scripts/content/ingest.ts                       both editions from the upstream main branch
//   node scripts/content/ingest.ts --edition 2024        one edition
//   node scripts/content/ingest.ts --ref <commit-sha>    a pinned upstream version
//   node scripts/content/ingest.ts --from ./5e-database  a local checkout (or folder of 5e-SRD-*.json), no network
//   node scripts/content/ingest.ts --out /tmp/content    somewhere else
//
// Fetch → normalize (src/content/ingest/fiveEBits.ts) → check links → write one JSON file per kind plus manifest.json.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { normalizeAll, type UpstreamFiles } from '../../src/content/ingest/fiveEBits.ts'
import {
  SRD_SOURCES, UPSTREAM_FOR, UPSTREAM_REPO, upstreamFile, upstreamPath, type UpstreamName,
} from '../../src/content/ingest/sources.ts'
import { CONTENT_FORMAT, CONTENT_KINDS, CONTENT_VERSION, type ContentFile, type ContentManifest, type Edition } from '../../src/content/types.ts'
import { checkContent } from '../../src/content/validate.ts'

const { values } = parseArgs({
  options: {
    edition: { type: 'string', default: 'all' },
    ref: { type: 'string', default: 'main' },
    from: { type: 'string' },
    out: { type: 'string', default: resolve(import.meta.dirname, '../../src/content/data') },
    strict: { type: 'boolean', default: false },
  },
})

const editions: Edition[] = values.edition === 'all' ? ['2014', '2024'] : [values.edition as Edition]
for (const e of editions) if (!SRD_SOURCES[e]) throw new Error(`--edition must be 2014, 2024 or all, not ${e}`)

/** Pins a branch or tag to its commit so the manifest says exactly which upstream version was used. Best effort. */
function resolveRef(ref: string): string {
  if (/^[0-9a-f]{40}$/.test(ref)) return ref
  try {
    const out = execFileSync('git', ['ls-remote', `https://github.com/${UPSTREAM_REPO}`, ref], { encoding: 'utf8', timeout: 30_000 })
    return /^([0-9a-f]{40})\s/.exec(out)?.[1] ?? ref
  } catch {
    console.warn(`Could not resolve ${ref} to a commit; recording the name instead.`)
    return ref
  }
}

const ref = values.from ? `local:${values.from}` : resolveRef(values.ref)

async function fetchJson(url: string, tries = 4): Promise<unknown> {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url)
      if (res.status === 404) return undefined
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      if (i >= tries) throw new Error(`${url}: ${(err as Error).message}`)
      await new Promise(r => setTimeout(r, 2 ** i * 500))
    }
  }
}

/** Reads one upstream file from --from (checkout root, edition folder or flat folder) or from GitHub. */
async function readUpstream(edition: Edition, name: UpstreamName): Promise<unknown[] | undefined> {
  const file = upstreamFile(name)
  if (values.from) {
    const dir = resolve(values.from)
    const hit = [join(dir, upstreamPath(edition), file), join(dir, edition, file), join(dir, file)].find(existsSync)
    return hit ? JSON.parse(readFileSync(hit, 'utf8')) : undefined
  }
  const url = `https://raw.githubusercontent.com/${UPSTREAM_REPO}/${ref}/${upstreamPath(edition)}/${file}`
  return (await fetchJson(url)) as unknown[] | undefined
}

/** One entry per line: small diffs when upstream changes one spell, and still compact. */
const serialize = (file: object & { entries: unknown[] }) => {
  const { entries, ...head } = file
  const body = entries.map(e => JSON.stringify(e)).join(',\n')
  return `${JSON.stringify(head).slice(0, -1)},"entries":[\n${body}\n]}\n`
}

let failed = false
for (const edition of editions) {
  const source = SRD_SOURCES[edition]
  const needed = [...new Set(Object.values(UPSTREAM_FOR[edition]).flat())]
  const files: UpstreamFiles = {}
  await Promise.all(needed.map(async name => {
    const data = await readUpstream(edition, name)
    if (Array.isArray(data)) files[name] = data
  }))
  for (const kind of CONTENT_KINDS) {
    const main = UPSTREAM_FOR[edition][kind][0]
    if (!files[main]) throw new Error(`${source.id}: upstream ${upstreamFile(main)} is missing, needed for ${kind}`)
  }

  const content = normalizeAll(files, source)
  const problems = checkContent(content)
  const dir = join(values.out, source.id)
  mkdirSync(dir, { recursive: true })
  const counts: ContentManifest['counts'] = {}
  for (const kind of CONTENT_KINDS) {
    const file: ContentFile = { format: CONTENT_FORMAT, version: CONTENT_VERSION, source, kind, entries: content[kind] }
    writeFileSync(join(dir, `${kind}.json`), serialize(file))
    counts[kind] = content[kind].length
  }
  const manifest: ContentManifest = {
    format: CONTENT_FORMAT,
    version: CONTENT_VERSION,
    source,
    upstream: { repo: UPSTREAM_REPO, ref, path: upstreamPath(edition) },
    generatedAt: new Date().toISOString(),
    counts,
  }
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

  console.log(`${source.id}: ${Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(', ')}`)
  if (problems.length) {
    console.warn(`${source.id}: ${problems.length} link problem(s) (upstream data gaps):`)
    for (const p of problems) console.warn(`  ${p}`)
    if (values.strict) failed = true
  }
}
if (failed) process.exit(1)
