#!/usr/bin/env node
/**
 * Latin nomenclature for Z-Anatomy's structures, joined from Anatomed's
 * catalogue (D24).
 *
 *   node scripts/build-latin-crosswalk.mjs --src ~/Downloads/parts-catalog.json
 *   node scripts/build-latin-crosswalk.mjs --src FILE --measure   # writes nothing
 *
 * WHY. For a structure with no FMA term, a Terminologia-style Latin name is the
 * only formal identity it has — and `z-anatomy-regions` carries no terms at all,
 * so this gives those structures their first identity of any kind. The atlas
 * this repository ships and the catalogue this reads are the SAME Z-Anatomy, so
 * the Latin strings are almost certainly Z-Anatomy's own labels that Anatomed's
 * pipeline extracted rather than authored; both are credited (D24, Phase 0).
 *
 * ⚠️ THE CATALOGUE IS AN INPUT, NEVER A VENDORED FILE — the same treatment
 * `build-z-anatomy.mjs` gives the FBX source. It is CC BY-SA 4.0 and belongs to
 * someone else; the TSV this produces is ours to commit and review. Fetch it
 * from `pitfa19/anatomed-mcp` at `assets/parts-catalog.json` and pass the path.
 *
 * ⚠️ EXACT MATCHING ONLY, AT ANY CONFIDENCE. Their ids are `Name.l` / `Name.r`;
 * ours are `name` + `side`. The only normalisation is ORDINAL — they write
 * "1st metacarpal bone" where we write "First metacarpal bone" — and it is a
 * spelling of the same word, not a similarity judgement. No fuzzy matching:
 * see D18, and the standing rule at the top of `src/scene/structureSearch.ts`.
 * A wrong Latin name is a wrong identity, and it would be believed.
 *
 * ⚠️ ATTACHMENT ROWS ARE EXCLUDED, matching what `apply-crosswalk.mjs` skips.
 * An attachment site is named for the muscle that attaches there and inherits
 * that muscle's identity; giving the footprint its own Latin name would assert
 * that the site IS the muscle, which is false.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { NodeIO } = require('@gltf-transform/core')
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions')
const { MeshoptDecoder } = require('meshoptimizer')

const args = process.argv.slice(2)
const MEASURE = args.includes('--measure')
const SRC = args[args.indexOf('--src') + 1]
const OUT = 'docs/z-anatomy-latin.tsv'
const ASSETS = ['public/models/z-anatomy.ao.glb', 'public/models/z-anatomy-regions.ao.glb']

if (!SRC || SRC.startsWith('--') || !existsSync(SRC)) {
  console.error(
    'usage: node scripts/build-latin-crosswalk.mjs --src <parts-catalog.json> [--measure]\n\n' +
      'The catalogue is an input, not a vendored file. Get it from:\n' +
      '  https://raw.githubusercontent.com/pitfa19/anatomed-mcp/b34375d/assets/parts-catalog.json',
  )
  process.exit(1)
}

/**
 * "1st" -> "First". Their spelling to ours.
 *
 * A closed list rather than a number-to-word library, because the only ordinals
 * that appear are these, and a library would happily convert something that is
 * not an ordinal at all.
 */
const ORDINALS = [
  ['1st', 'First'], ['2nd', 'Second'], ['3rd', 'Third'], ['4th', 'Fourth'],
  ['5th', 'Fifth'], ['6th', 'Sixth'], ['7th', 'Seventh'], ['8th', 'Eighth'],
  ['9th', 'Ninth'], ['10th', 'Tenth'], ['11th', 'Eleventh'], ['12th', 'Twelfth'],
]
const normalise = (s) => {
  let out = String(s ?? '').trim()
  for (const [from, to] of ORDINALS) {
    out = out.replace(new RegExp(`^${from}\\b`, 'i'), to)
  }
  return out.toLowerCase()
}
const SIDE = { l: 'left', r: 'right' }

/* --- their catalogue ------------------------------------------------------ */
const raw = JSON.parse(readFileSync(SRC, 'utf8'))
const parts = Array.isArray(raw) ? raw : (raw.parts ?? [])
const latin = new Map() // `name|side` (normalised) -> Latin
const conflicts = []
for (const p of parts) {
  const lat = String(p.name_lat ?? '').trim()
  if (!lat) continue
  const key = `${normalise(p.name_en)}|${SIDE[p.side] ?? ''}`
  const seen = latin.get(key)
  if (seen && seen !== lat) conflicts.push({ key, seen, got: lat })
  else latin.set(key, lat)
}
console.log(`catalogue: ${parts.length.toLocaleString()} parts, ${latin.size.toLocaleString()} with a Latin name`)

/**
 * ⚠️ HARD FAIL ON CONFLICT. Zero today. The gate exists so a future revision of
 * the catalogue cannot introduce an ambiguity silently — picking a winner would
 * be exactly the judgement this script refuses to make.
 */
if (conflicts.length) {
  console.error(`✗ ${conflicts.length} structure(s) draw two different Latin names:`)
  for (const c of conflicts.slice(0, 10)) console.error(`    ${c.key}: "${c.seen}" vs "${c.got}"`)
  process.exit(1)
}

/* --- our structures ------------------------------------------------------- */
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })

const rows = []
const seen = new Set()
let attachmentsSkipped = 0
let termless = 0
for (const file of ASSETS) {
  if (!existsSync(file)) {
    console.log(`  ${file}: not installed, skipped`)
    continue
  }
  const doc = await io.read(file)
  const table = doc.getRoot().listScenes()[0]?.getExtras()?.structures ?? []
  let hit = 0
  for (const s of table) {
    if (s.attachment) {
      if (latin.has(`${normalise(s.name)}|${s.side ?? ''}`)) attachmentsSkipped++
      continue
    }
    const lat = latin.get(`${normalise(s.name)}|${s.side ?? ''}`)
    if (!lat) continue
    hit++
    if (!s.ontologyid) termless++
    const key = `${s.name}|${s.side ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push([s.name, s.side ?? '', lat])
  }
  console.log(
    `  ${file.padEnd(42)} ${String(hit).padStart(5)} of ${String(table.length).padEnd(5)} gain a Latin name`,
  )
}
console.log(
  `\n${rows.length.toLocaleString()} unique (name, side) rows` +
    `  ·  ${termless.toLocaleString()} of the matches have no FMA term today` +
    `  ·  ${attachmentsSkipped.toLocaleString()} attachment rows matched and were excluded`,
)

if (MEASURE) {
  console.log('\n--measure: nothing written.')
  process.exit(0)
}

rows.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]))
writeFileSync(
  OUT,
  '# Z-Anatomy structure -> Latin name — GENERATED, do not edit by hand.\n' +
    '#\n' +
    `# Rebuild:  node scripts/build-latin-crosswalk.mjs --src <parts-catalog.json>\n` +
    '# Apply:    node scripts/apply-crosswalk.mjs public/models/z-anatomy.ao.glb \\\n' +
    '#             public/models/z-anatomy-regions.ao.glb --tsv docs/z-anatomy-latin.tsv --field name_lat\n' +
    '#\n' +
    '# Joined from Anatomed (pitfa19/anatomed-mcp, CC BY-SA 4.0) by exact match on\n' +
    '# (name, side) after ordinal normalisation. The nomenclature is Z-Anatomy\'s;\n' +
    '# Anatomed extracted it. Both are credited — see licences.json and D24.\n' +
    'name\tside\tname_lat\n' +
    rows.map((r) => r.join('\t')).join('\n') +
    '\n',
)
console.log(`✓ ${OUT}`)
