#!/usr/bin/env node
/**
 * Every asset a selectable mode needs must survive `npm run build`.
 *
 *   npm run check:dist        after a build
 *
 * ⚠️ THIS CLASS OF BUG HAS SHIPPED THREE TIMES, AND IT IS INVISIBLE IN DEV.
 *
 * `pruneUnshippedModels` decides what reaches `dist` by regex-scanning the
 * registry sources for `/models/<name>`. `npm run dev` serves `public/` directly
 * and never runs it, so nothing about the failure appears until someone loads a
 * production build:
 *
 *   1. `bodyEnvelopes.ts` was not in the plugin's registry list, so all five ANNY
 *      envelopes were pruned and the feature shipped as five "not installed" pills.
 *   2. Their urls were TEMPLATE LITERALS, which the regex cannot see — the same
 *      bug from the other direction.
 *   3. The shape grid's `.bin`/`.idx`/`.json` were pruned because the regex
 *      matched `.glb` literally, and the whole parametric mode would have shipped
 *      as an empty canvas.
 *
 * Each was found by hand, after the fact. This asserts it instead: read the urls
 * the app can actually request, and check the built directory for each one.
 *
 * ⚠️ It is a POST-BUILD check, not a unit test, because the thing being tested is
 * the output of a Vite plugin. `dist/` must exist; run it after `npm run build`.
 *
 * An asset absent from `public/` is NOT a failure — the repository must run with
 * zero binary assets, and a contributor with no atlases installed still needs a
 * green build. What fails is an asset that IS in `public/models/` and did not
 * reach `dist/models/`, because that is the prune eating something real.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const DIST = join(ROOT, 'dist', 'models')
const PUBLIC = join(ROOT, 'public', 'models')

if (!existsSync(DIST)) {
  console.error('✗ dist/models does not exist — run `npm run build` first')
  process.exit(1)
}

/**
 * The urls the app can request, read from the registries themselves.
 *
 * Deliberately the same scan the prune plugin does, so this checks the plugin's
 * OUTPUT rather than re-deriving the intent from a hand-kept list that could
 * drift the same way the registry list did.
 */
const REGISTRIES = ['anatomySources.ts', 'organOverlays.ts', 'bodyEnvelopes.ts', 'annyGrid.ts']
let sources = ''
for (const f of REGISTRIES) {
  const p = join(ROOT, 'src', 'scene', f)
  if (existsSync(p)) sources += readFileSync(p, 'utf8')
}
const wanted = [
  ...new Set([...sources.matchAll(/\/models\/([A-Za-z0-9._-]+\.[A-Za-z0-9]+)/g)].map((m) => m[1])),
].sort()

if (!wanted.length) {
  console.error('✗ found no model urls in the registries — the scan itself is broken')
  process.exit(1)
}

const onDisk = new Set(existsSync(PUBLIC) ? readdirSync(PUBLIC) : [])
const inDist = new Set(readdirSync(DIST))

/**
 * ⚠️ RIGHTS WITHHOLDING — the same rule `pruneUnshippedModels` applies, read
 * from the same place, checked from the other side.
 *
 * `licences.json` entries whose `ownLicence` says "unresolved" or that carry a
 * `gate` field must NOT be in `dist`, however much the registries reference
 * them — `dist` is what gets deployed, and since D21 the site is public.
 * Withheld-and-absent is the pass condition here; withheld-but-present means
 * the plugin's rule and this one have drifted apart, which is a failure.
 */
const register = JSON.parse(readFileSync(join(ROOT, 'licences.json'), 'utf8'))
const withheld = new Set()
for (const a of register.assets ?? []) {
  const m = /^public\/models\/([A-Za-z0-9._-]+\.[A-Za-z0-9]+)$/.exec(a.file ?? '')
  if (!m) continue
  if (/unresolved/i.test(a.ownLicence ?? '') || a.gate) withheld.add(m[1])
}

const missing = []
const skipped = []
const leaked = []
for (const f of wanted) {
  if (withheld.has(f)) {
    if (inDist.has(f)) leaked.push(f)
    continue
  }
  if (!onDisk.has(f)) {
    skipped.push(f)
    continue
  }
  if (!inDist.has(f)) missing.push(f)
}

console.log(`registries reference ${wanted.length} asset(s)`)
console.log(`  present in public/ : ${wanted.length - skipped.length}`)
console.log(`  not installed      : ${skipped.length} (fine — the app runs with zero assets)`)
if (withheld.size) {
  console.log(
    `  rights-withheld    : ${withheld.size} (${[...withheld].join(', ')}) — unresolved per licences.json, must be absent from dist`,
  )
}

if (leaked.length) {
  console.error(`\n✗ ${leaked.length} rights-withheld asset(s) reached dist anyway:`)
  for (const m of leaked) console.error(`    ${m}`)
  console.error(
    '\n  licences.json says their rights are unresolved, and dist is what deploys.\n' +
      '  The withhold rule in `pruneUnshippedModels` (vite.config.ts) and this one\n' +
      '  must agree — one of them has drifted.',
  )
  process.exit(1)
}

if (missing.length) {
  console.error(`\n✗ ${missing.length} asset(s) are in public/models but were PRUNED from dist:`)
  for (const m of missing) console.error(`    ${m}`)
  console.error(
    '\n  The mode that needs them will load nothing in production while working in dev.\n' +
      '  Check `pruneUnshippedModels` in vite.config.ts: the registry must be in its\n' +
      '  file list, and the url must be a LITERAL string it can see.',
  )
  process.exit(1)
}

console.log('\n✓ every installed asset a mode can request survived the build, and nothing rights-withheld leaked')
