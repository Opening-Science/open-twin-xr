#!/usr/bin/env node
/**
 * Generate the component/licence table from `licences.json` and the shipped
 * assets, and splice it into `docs/HANDOVER.md`.
 *
 * ⚠️ GENERATED, NOT TYPED, AND THAT IS THE WHOLE POINT. Two hand-maintained
 * tables in this repo went stale without anyone noticing — `docs/RESOURCES.md`
 * spent a while asserting Z-Anatomy was "not yet pulled in" while it supplied
 * the entire musculoskeletal system. A licence table that drifts is worse than
 * no table, because it is quoted with confidence.
 *
 * Structure counts come from the ASSET, read out of the per-structure
 * `component` tags `build-z-anatomy.mjs` writes, so the number is what actually
 * ships rather than what someone believed shipped.
 *
 *   node scripts/gen-component-table.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'

const ROOT = process.cwd()
const DOC = join(ROOT, 'docs/HANDOVER.md')
const START = '<!-- BEGIN GENERATED COMPONENT TABLE -->'
const END = '<!-- END GENERATED COMPONENT TABLE -->'

const register = JSON.parse(readFileSync(join(ROOT, 'licences.json'), 'utf8'))
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })

/**
 * Rights position in one word.
 *
 * `gate` comes from the register and WINS over the licence string, because the
 * two answer different questions. The beating heart is Apache-2.0 and the
 * licence string is not in doubt; what is in doubt is whether the licensor held
 * the rights to the subject's scan, and no licence text can say so. Pattern
 * matching prose cannot see that, and a table that reported it as publishable
 * would be a false green on the one asset the register says to hold back.
 *
 * `unresolved` gets its own verdict for the same reason it needed one: an
 * unrecorded source scan is not "no grant" (something may well be granted) and
 * it is certainly not "yes". Before this it read as **yes**, because the pattern
 * list matched "none stated" but not "unresolved" — the same
 * deriving-rights-from-prose trap the comment above warns about, one step
 * further along.
 */
function publishable(licence, gate) {
  if (gate) return `**no — ${gate}**`
  if (/unresolved/i.test(licence)) return '**no — unresolved**'
  if (/none stated|unlicensed|unknown/i.test(licence)) return '**no — no grant**'
  if (/nc|non-?commercial/i.test(licence)) return 'non-commercial only'
  return 'yes'
}

/**
 * Organ overlays belong in this table too.
 *
 * They were skipped while `atlas` and `derived-atlas` were the only kinds, and
 * the effect was that a shipped, rendered, publication-BLOCKED asset — the
 * beating heart — appeared nowhere in the handover's licence table. An omission
 * reads as "nothing to say about it", which is the opposite of true.
 */
const LISTED_KINDS = new Set(['atlas', 'derived-atlas', 'organ-overlay'])

const rows = []
for (const asset of register.assets) {
  if (!LISTED_KINDS.has(asset.kind)) continue
  const path = asset.file ? join(ROOT, asset.file) : null
  let table = []
  let components = []
  if (path && existsSync(path)) {
    try {
      const doc = await io.read(path)
      const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]
      const ex = scene?.getExtras() ?? {}
      table = Array.isArray(ex.structures) ? ex.structures : []
      components = ex.components ?? []
    } catch {
      /* unreadable assets are reported as absent rather than crashing the doc */
    }
  }
  /**
   * The atlas's own geometry is whatever carries no third-party tag.
   *
   * ⚠️ Uses `ownLicence`, NOT `licence`. The latter describes the whole FILE —
   * for Z-Anatomy that string mentions its CC BY-NC components, and testing it
   * for "NC" reported the authors' own CC BY-SA geometry as non-commercial.
   * Deriving a rights position by pattern-matching prose was the bug; the
   * register states it instead.
   */
  const own = table.filter((s) => !s.component).length
  const onDisk = !!(path && existsSync(path))
  const ownLicence = asset.ownLicence ?? asset.licence
  rows.push({
    component: `${asset.id} — own geometry`,
    holder: asset.holder ?? asset.id,
    licence: ownLicence,
    // Three distinct states, kept distinct: a count, "on disk but carrying no
    // structure table" (an atlas predating per-structure ids), and "not built".
    // Collapsing them to one dash invites reading it as zero.
    count: table.length ? own : onDisk ? 'no table' : '—',
    pub: publishable(ownLicence, asset.gate),
    onDisk,
  })
  for (const c of components) {
    rows.push({
      component: c.title,
      holder: c.holder,
      licence: c.licence,
      count: table.filter((s) => s.component === c.id).length,
      pub: publishable(c.licence),
      onDisk: true,
    })
  }
}

const missing = rows.filter((r) => !r.onDisk).length
const lines = [
  START,
  '',
  `<!-- generated by scripts/gen-component-table.mjs — do not edit by hand -->`,
  '',
  '| component | rights holder | licence | structures | publishable |',
  '|---|---|---|---|---|',
  ...rows.map(
    (r) =>
      `| ${r.component} | ${r.holder} | ${r.licence} | ${typeof r.count === 'number' ? r.count.toLocaleString() : r.count} | ${r.pub} |`,
  ),
  '',
]
if (missing) {
  lines.push(
    `⚠️ ${missing} asset(s) are not built, so their counts read \`—\`. A dash means`,
    'unknown, not zero. `no table` means the asset is built but predates',
    'per-structure ids. Build, then re-run this script.',
    '',
  )
}
lines.push(
  'Counts are read from the shipped GLB, not from the register — they are what',
  'actually ships. Regenerate with `node scripts/gen-component-table.mjs`.',
  '',
  END,
)

const block = lines.join('\n')
if (!existsSync(DOC)) {
  console.error(`${DOC} does not exist — create it with the markers first:\n${START}\n${END}`)
  process.exit(1)
}
const doc = readFileSync(DOC, 'utf8')
if (!doc.includes(START) || !doc.includes(END)) {
  console.error(`${DOC} is missing the generated-block markers:\n${START}\n${END}`)
  process.exit(1)
}
writeFileSync(DOC, doc.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block))
console.log(`component table: ${rows.length} rows -> docs/HANDOVER.md`)
for (const r of rows) console.log(`  ${String(r.count).padStart(6)}  ${r.licence.padEnd(34)} ${r.component}`)
