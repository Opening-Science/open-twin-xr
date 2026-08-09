#!/usr/bin/env node
/**
 * Resolve FMA terms for Z-Anatomy structures that have none, from FMA itself.
 *
 *   node scripts/resolve-fma-terms.mjs --filter senses     # eye + ear (the overlay blockers)
 *   node scripts/resolve-fma-terms.mjs --filter '<regex>'  # any structure name
 *   node scripts/resolve-fma-terms.mjs --filter senses --write   # append to the crosswalk
 *
 * WHY THIS EXISTS. `docs/ONTOLOGY_MAP.md` reports 0 of 18 overlay parts resolving
 * to a term, and names the reason: the crosswalks "cover the skeleton and the
 * vasculature well and the special senses not at all". Every eye and ear
 * structure in Z-Anatomy is termless, so an overlay cannot say what it stands in
 * for and has to fall back on a name test — which is what made the one-sided ear
 * impossible until a `side` filter was added.
 *
 * ⚠️ EXACT LABEL MATCHES ONLY. NEVER FUZZY, AND NEVER `docs[0]`.
 *
 * OLS4's `exact=true` is a ranking hint, not a filter: searching `Right cornea`
 * returns `Right cornea` AND `Dense regular collagenous tissue of right cornea`.
 * Taking the first hit would therefore tag the cornea with a term for its
 * collagen layer — an id that looks authoritative and hides the wrong structure.
 * This accepts a term only when the returned label EQUALS the queried label, and
 * reports everything else as unresolved rather than resolving it badly. Missing
 * is visibly missing; wrong is silently trusted.
 *
 * LATERALITY IS THE WHOLE GAME. FMA gives left and right genuinely different ids
 * — `Right cornea` is FMA:58239 and the generic `Cornea` is a different term
 * again — so structures are queried per side, using the side the ASSET records.
 * The same point sank the first version of the FMA↔UBERON bridge; see
 * `build-fma-uberon-bridge.mjs`.
 *
 * The spelling list below is the "short fixed synonym list" `docs/HANDOVER.md`
 * already describes for `build-crosswalk.mjs`. It is deliberately tiny and
 * orthographic only — British/American spelling and a couple of plurals. It must
 * never grow into a list of anatomical near-synonyms, which is fuzzy matching
 * wearing a different hat.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { NodeIO } = require('@gltf-transform/core')
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions')
const { MeshoptDecoder } = require('meshoptimizer')

const ROOT = process.cwd()
const ASSET = join(ROOT, 'public/models/z-anatomy.ao.glb')
const CROSSWALK = join(ROOT, 'docs/z-anatomy-fma.tsv')
const CACHE = join(ROOT, '.cache/ols4-fma-labels.json')
const SEARCH = 'https://www.ebi.ac.uk/ols4/api/search'

const argv = process.argv.slice(2)
const WRITE = argv.includes('--write')
const filterArg = argv[argv.indexOf('--filter') + 1]
if (!filterArg || filterArg.startsWith('--')) {
  console.error('need --filter <regex|senses>')
  process.exit(1)
}
/** The eye globe and the ear, which is exactly the set the overlays are blocked on. */
const SENSES =
  /^(cornea|lens|retina|sclera|iris|vitreous body|zonular fibres|anterior segment of eyeball|posterior segment of eyeball|anterior chamber of eyeball|suspensory ligament of eyeball|malleus|incus|stapes|cochlea|tympanic membrane|vestibule|auditory tube)$/i
const FILTER = filterArg === 'senses' ? SENSES : new RegExp(filterArg, 'i')

/**
 * Orthographic variants only. British/American spelling is a real difference
 * between Z-Anatomy's labels and FMA's, and it is not a judgement about anatomy.
 */
const SPELLINGS = [
  (s) => s,
  (s) => s.replace(/fibres/gi, 'fibers'),
  (s) => s.replace(/oesophag/gi, 'esophag'),
  (s) => s.replace(/haemo/gi, 'hemo'),
  (s) => s.replace(/\bgrey\b/gi, 'gray'),
]

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {}

async function lookup(label, attempt = 0) {
  if (cache[label] !== undefined) return cache[label]
  const url = `${SEARCH}?q=${encodeURIComponent(label)}&ontology=fma&exact=true&rows=8`
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const j = await r.json()
    const docs = j?.response?.docs ?? []
    // THE GUARD. Equality against the queried label, not rank.
    const hit = docs.find(
      (d) => String(d.label ?? '').toLowerCase().trim() === label.toLowerCase().trim(),
    )
    const out = hit ? `FMA:${String(hit.obo_id ?? hit.short_form).replace(/^fma/i, '')}` : null
    cache[label] = out
    return out
  } catch (e) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
      return lookup(label, attempt + 1)
    }
    cache[label] = null
    return null
  }
}

/**
 * `Cornea` + `right` -> the labels FMA might use, most specific first.
 *
 * ⚠️ FMA LATERALISES TWO DIFFERENT WAYS, and missing the second cost 8 of the 14
 * structures this script first failed to resolve.
 *
 *   simple noun      `Cornea`                      -> `Right cornea`
 *   "X of Y" phrase  `Anterior chamber of eyeball` -> `Anterior chamber of right eyeball`
 *
 * The second inserts the side before the INNER noun, not at the front — FMA:58081
 * is `Anterior chamber of right eyeball`, and no term called "Right anterior
 * chamber of eyeball" exists. Every eye structure Z-Anatomy names as a phrase
 * (both segments, the anterior chamber, the suspensory ligament) needs this form.
 *
 * Both are still EXACT label matches. This widens what is asked, never what is
 * accepted — the equality guard in `lookup` is unchanged.
 */
function candidates(name, side) {
  const base = String(name).trim()
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
  const forms = []
  if (side) {
    forms.push(`${cap(side)} ${base.toLowerCase()}`, `${cap(side)} ${base}`)
    const m = base.match(/^(.*?) of (.+)$/i)
    if (m) forms.push(`${cap(m[1])} of ${side.toLowerCase()} ${m[2].toLowerCase()}`)
  } else {
    forms.push(cap(base), base)
  }
  const out = []
  for (const f of forms) for (const sp of SPELLINGS) out.push(sp(f))
  return [...new Set(out)]
}

const doc = await io.read(ASSET)
const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]
const table = scene.getExtras()?.structures ?? []

const targets = table
  .map((s, id) => ({ id, ...s }))
  .filter((s) => !s.ontologyid && FILTER.test(String(s.name ?? '').trim()))

console.log(`${targets.length} untermed structures match the filter\n`)

const resolved = []
const unresolved = []
for (const t of targets) {
  let got = null
  let via = null
  for (const c of candidates(t.name, t.side)) {
    got = await lookup(c)
    if (got) {
      via = c
      break
    }
  }
  if (got) {
    resolved.push({ ...t, fma: got, via })
    console.log(`  ✓ ${String(t.name).padEnd(32)} ${String(t.side ?? '-').padEnd(6)} ${got}   (${via})`)
  } else {
    unresolved.push(t)
    console.log(`  ✗ ${String(t.name).padEnd(32)} ${String(t.side ?? '-').padEnd(6)} no exact FMA label`)
  }
}

mkdirSync(dirname(CACHE), { recursive: true })
writeFileSync(CACHE, JSON.stringify(cache, null, 2))

console.log(`\nresolved ${resolved.length} / ${targets.length}`)
if (unresolved.length) {
  console.log(`unresolved ${unresolved.length} — left termless ON PURPOSE rather than approximated:`)
  for (const u of [...new Set(unresolved.map((u) => u.name))]) console.log(`  ${u}`)
}

if (!WRITE) {
  console.log('\n(dry run — pass --write to append to docs/z-anatomy-fma.tsv)')
  process.exit(0)
}

// Append, never rewrite: the file is hand-reviewed and other rows are not ours.
const existing = readFileSync(CROSSWALK, 'utf8')
const have = new Set(
  existing
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const c = l.split('\t')
      return `${(c[0] ?? '').toLowerCase()}|${(c[1] ?? '').toLowerCase()}`
    }),
)
const add = []
for (const r of resolved) {
  const key = `${String(r.name).toLowerCase()}|${String(r.side ?? '').toLowerCase()}`
  if (have.has(key)) continue
  have.add(key)
  add.push(`${r.name}\t${r.side ?? ''}\t${r.fma}\t${r.system ?? ''}\t${r.layer ?? ''}`)
}
if (!add.length) {
  console.log('\nnothing new to add')
  process.exit(0)
}
writeFileSync(CROSSWALK, existing.replace(/\n*$/, '\n') + add.join('\n') + '\n')
console.log(`\nappended ${add.length} rows to ${CROSSWALK}`)
