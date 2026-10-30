// Live-site check, run by .github/workflows/live-check.yml after each push to main.
// Waits until the live site serves the expected commit (dist/version.json), then opens it
// in a real browser and fails on page errors or an empty app.
// Usage: EXPECTED=<sha> node scripts/live/check.mjs   (needs the playwright package)
import { appendFileSync } from 'node:fs'
import { chromium } from 'playwright'

const SITE = process.env.SITE ?? 'https://forge-and-familiar.onrender.com/'
const EXPECTED = process.env.EXPECTED ?? ''
const TIMEOUT_MIN = Number(process.env.TIMEOUT_MIN ?? 20)

function summary(lines) {
  console.log(lines.join('\n'))
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n')
}

async function liveCommit() {
  try {
    const res = await fetch(new URL(`version.json?t=${Date.now()}`, SITE), { cache: 'no-store' })
    if (!res.ok) return `HTTP ${res.status}`
    return (await res.json()).commit ?? 'missing'
  } catch (e) {
    return `error ${e.message}`
  }
}

const deadline = Date.now() + TIMEOUT_MIN * 60_000
let live = await liveCommit()
while (EXPECTED && live !== EXPECTED && Date.now() < deadline) {
  console.log(`live is ${live}, waiting for ${EXPECTED}`)
  await new Promise((r) => setTimeout(r, 20_000))
  live = await liveCommit()
}
if (EXPECTED && live !== EXPECTED) {
  summary([`## Live site check failed`, `Waited ${TIMEOUT_MIN} min, live site still serves \`${live}\`, expected \`${EXPECTED}\`.`, `Check the Render deploy (build failed or never started).`])
  process.exit(1)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource|supabase/i.test(m.text())) errors.push(`console: ${m.text()}`)
})
await page.goto(new URL(`?livecheck=${Date.now()}`, SITE).href, { waitUntil: 'networkidle' })
const rendered = await page
  .waitForFunction(() => (document.getElementById('root')?.innerText.trim().length ?? 0) > 0, null, { timeout: 30_000 })
  .then(() => true, () => false)
const title = await page.title()
const text = (await page.locator('#root').innerText().catch(() => '')).slice(0, 200).replace(/\s+/g, ' ')
await browser.close()

const ok = rendered && errors.length === 0
summary([
  `## Live site check ${ok ? 'passed' : 'failed'}`,
  `- Site: ${SITE}`,
  `- Live commit: \`${live}\``,
  `- Title: ${title}`,
  `- App rendered: ${rendered ? 'yes' : 'no'} (${text})`,
  `- Errors: ${errors.length ? '\n  - ' + errors.join('\n  - ') : 'none'}`,
])
process.exit(ok ? 0 : 1)
