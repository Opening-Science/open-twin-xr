#!/usr/bin/env node
/**
 * The due-diligence log generator.
 *
 * Not a gate. **D12b replaced the gate with a record**: the project takes
 * everything each atlas offers, stays open source, credits every source, and
 * keeps an accurate account of what is inside so the licence position can be
 * reviewed properly before publication rather than guessed at.
 *
 *   npm run check:licences            regenerate docs/LICENCE_LOG.md, print a summary
 *   npm run check:licences -- --review  also print the pre-publication action list
 *
 * WHAT MAKES THIS TRUSTWORTHY, and the reason it reads the GLBs rather than just
 * `licences.json`: the per-structure component tags are written INTO the asset by
 * `build-z-anatomy.mjs`, so this reports what the shipped file actually contains
 * rather than what a hand-maintained table claims it contains. Two documents in
 * this repo had already gone stale that way. If a component's name pattern drifts
 * and stops matching, the count drops to zero and the log says so, loudly.
 */
import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'

const ROOT = process.cwd()
const REVIEW = process.argv.includes('--review')
/**
 * ⚠️ `--verify` IS THE ONLY MODE THAT CAN FAIL, AND THAT SPLIT IS THE POINT.
 *
 * D12b replaced a licence GATE with a licence RECORD, deliberately: this project
 * takes what every atlas offers and documents it, rather than dropping
 * components to keep a checker quiet. So the default run regenerates the log,
 * prints the position and exits 0 no matter what it finds.
 *
 * But "not a gate" quietly became "nothing can ever fail", and several documents
 * went on describing this command as though running it protected a release. It
 * cannot: with 15 outstanding actions, an unregistered asset and geometry
 * carrying no licence statement at all, it still exits 0.
 *
 * `--verify` is the release-time question, which is narrower than the action
 * list and is NOT about commerce. It fails only on things that mean the bundle
 * cannot lawfully be distributed or cannot be reasoned about:
 *
 *   - an asset on disk with no entry in the register
 *   - a shipped GLB carrying no embedded `asset.copyright`
 *   - a registered multi-file artefact that is only partly present
 *   - a component with NO LICENCE STATEMENT, which grants nothing
 *
 * ⚠️ The last one is why `--publishable` exists in the Z-Anatomy build. A local
 * research build legitimately contains that geometry, so `--verify` is a
 * RELEASE check to run against the publishable build, not a pre-commit hook.
 * CI cannot run it at all — no assets are committed.
 */
const VERIFY = process.argv.includes('--verify')
const LOG_PATH = join(ROOT, 'docs/LICENCE_LOG.md')
const register = JSON.parse(readFileSync(join(ROOT, 'licences.json'), 'utf8'))

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })

const byFile = new Map()
for (const a of register.assets) if (a.file) byFile.set(a.file, a)

// Intermediates inherit the terms of the asset they become; registering each
// separately would triple the register and add nothing.
//
// `.raw` is the OpenEar bake before texture compression. It resolves to a plain
// `.glb` rather than to `.ao.glb` because that asset has no AO bake at all: its
// colour is photographic and occlusion is kept in a separate channel on purpose,
// so there is no `.ao` stage for it to become.
const INTERMEDIATE = /(\.opt|\.stripped|\.raw)?\.glb$/
const SUFFIXED = /\.(opt|stripped|raw)\.glb$/

const modelDir = join(ROOT, 'public/models')
const onDisk = existsSync(modelDir) ? readdirSync(modelDir).filter((f) => f.endsWith('.glb')) : []

const rows = []
const unregistered = []
const actions = []

for (const f of onDisk.sort()) {
  const rel = `public/models/${f}`
  const direct = byFile.get(rel)
  const entry =
    direct ?? byFile.get(rel.replace(INTERMEDIATE, '.ao.glb')) ?? byFile.get(rel.replace(SUFFIXED, '.glb'))
  if (!entry) {
    unregistered.push(rel)
    continue
  }
  if (!direct) continue // an intermediate; reported via its final asset

  const row = { file: rel, entry, embedded: null, components: [], structures: 0 }
  try {
    const doc = await io.read(join(ROOT, rel))
    row.embedded = doc.getRoot().getAsset().copyright ?? ''
    const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]
    const extras = scene?.getExtras() ?? {}
    const table = Array.isArray(extras.structures) ? extras.structures : []
    row.structures = table.length
    // Component roster declared by the asset, counted against the actual table.
    for (const c of extras.components ?? []) {
      row.components.push({ ...c, count: table.filter((s) => s.component === c.id).length })
    }
    row.own = table.filter((s) => !s.component).length
  } catch (err) {
    row.error = err.message
  }
  rows.push(row)
}

/**
 * ⚠️ ASSETS THAT ARE NOT GLB. THE SCAN ABOVE CANNOT SEE THEM AT ALL.
 *
 * `onDisk` filters to `.glb`, which was every shipped asset until the parametric
 * body arrived with a 28 MB `.bin` of vertex deltas, a `.idx` of triangle indices
 * and a `.json` sidecar. None of the three could ever appear here, so an
 * unrecorded binary would ship in silence — the precise failure this register
 * exists to make impossible, just outside the extension it was written for.
 *
 * Two differences from a GLB, both stated rather than papered over. There is no
 * `asset.copyright` to read, because that is a glTF field — some of these formats
 * do carry a credit of their own (a WOFF2 has an OpenType name table,
 * `package.json` has `license`) and some carry none at all, but either way THIS
 * script does not read it, so reporting a missing embedded copyright would assert
 * something it never checked. And there is no structure table, because these are
 * single artefacts rather than sets of named organs.
 */
const GLB_ONLY = /\.glb$/

/**
 * One entry may cover several files — the grid's three are one artefact with one
 * licence position, and splitting them would state the same thing three times.
 *
 * The shorthand is `path/base.ext + .ext2 + .ext3`, where a continuation
 * beginning with a dot swaps the extension on the first path rather than naming
 * a file in the repository root. Expanding it wrongly is not cosmetic: the
 * unregistered-file check below compares against these strings, so a bare
 * `.idx` in the set means the real `public/models/anny-grid.idx` matches
 * nothing and is reported as unrecorded.
 */
function expandFiles(spec) {
  const parts = spec.split('+').map((f) => f.trim()).filter(Boolean)
  const first = parts[0]
  return parts.map((f) => (f.startsWith('.') ? first.replace(/\.[^./]+$/, f) : f))
}

const otherRegistered = register.assets.filter((a) => a.file && !GLB_ONLY.test(a.file))
for (const a of otherRegistered) {
  const files = expandFiles(a.file)
  const missing = files.filter((f) => !existsSync(join(ROOT, f)))
  rows.push({
    file: a.file,
    entry: a,
    embedded: null,
    embeddable: false,
    components: [],
    structures: 0,
    absent: missing,
  })
  if (missing.length && missing.length < files.length) {
    actions.push(
      `**${a.id}** is registered as ${files.length} files but ${missing.join(', ')} ` +
        `${missing.length === 1 ? 'is' : 'are'} absent. A partially present artefact is worse ` +
        `than a missing one: the app loads what is there and fails on the rest.`,
    )
  }
}

/**
 * And the other direction — a non-GLB file on disk that nothing registers.
 *
 * Restricted to the extensions the app actually fetches. `public/models/` doubles
 * as the pipeline's working directory, so it is full of intermediates that are
 * not assets and never ship; `pruneUnshippedModels` drops those from `dist`.
 */
const SHIPPED_DATA = /\.(bin|idx)$/
const registeredFiles = new Set(register.assets.flatMap((a) => (a.file ? expandFiles(a.file) : [])))
if (existsSync(modelDir)) {
  for (const f of readdirSync(modelDir).filter((f) => SHIPPED_DATA.test(f)).sort()) {
    if (!registeredFiles.has(`public/models/${f}`)) unregistered.push(`public/models/${f}`)
  }
}

// --- the action list ---------------------------------------------------------
// What a human has to DO before publishing, as opposed to what is merely true.
for (const r of rows) {
  // `embeddable === false` means this script never looked, because the file is not
  // glTF — which is not the same as a GLB that has the field and left it blank.
  if (r.embeddable !== false && !r.embedded?.trim()) {
    actions.push(`**${r.file}** carries no \`asset.copyright\` — the credit is not travelling with the file.`)
  }
  for (const c of r.components) {
    if (c.count === 0) {
      actions.push(
        `**${r.file}**: component "${c.title}" matched **0 structures**. Either it is genuinely ` +
          `absent, or its name pattern in \`build-z-anatomy.mjs\` has drifted and this log has ` +
          `quietly stopped being accurate. Verify before relying on it.`,
      )
    }
    if (/none stated|unlicensed|unknown/i.test(c.licence)) {
      actions.push(
        `**${r.file}**: ${c.count} structures from "${c.title}" (${c.holder}) have **no licence ` +
          `statement**. Attribution cannot settle this one — it satisfies a licence's conditions, ` +
          `it does not create a grant. Request written permission, or replace the geometry ` +
          `(MOOSE/TotalSegmentator segment white matter from CT under Apache-2.0).`,
      )
    }
  }
}
for (const u of unregistered) {
  actions.push(`**${u}** is on disk with no entry in \`licences.json\`. Add one — an unrecorded asset cannot be reasoned about.`)
}
for (const a of register.assets) {
  if (a.verify) actions.push(`**${a.id}**: ${a.verify}`)
}

// --- write the log -----------------------------------------------------------
const L = []
L.push('# Licence log')
L.push('')
L.push('**Generated — do not edit by hand.** Run `npm run check:licences` to regenerate.')
L.push('')
L.push('This is the pre-publication due-diligence record for every asset on disk. Per **D12b**')
L.push('this project imports everything each atlas offers, remains open source, and renders every')
L.push('attribution its sources require; this file is how the licence position stays knowable')
L.push('rather than assumed. Structure counts are read out of the shipped GLBs, not from a')
L.push('hand-maintained table, so they cannot drift from what actually ships.')
L.push('')
L.push(`Project stance: **${register.stance ?? 'open source, non-commercial, fully attributed'}**.`)
L.push('')

L.push('## Assets')
L.push('')
for (const r of rows) {
  L.push(`### \`${r.file}\``)
  L.push('')
  L.push(`- **Licence:** ${r.entry.licence}`)
  L.push(`- **Source:** ${r.entry.source ?? '—'}`)
  L.push(`- **Loaded by the app:** ${r.entry.loaded ? 'yes' : 'no'}`)
  if (r.structures) L.push(`- **Structures:** ${r.structures.toLocaleString()}`)
  L.push(`- **Required credit:** ${r.entry.attribution ?? '—'}`)
  L.push(
    r.embeddable === false
      ? '- **Embedded credit:** not checked — `asset.copyright` is a glTF field and this is not a ' +
          'glTF file. The required credit above is rendered in-app and recorded here; whether ' +
          'this format carries one internally is not read by this script.'
      : `- **Embedded \`asset.copyright\`:** ${r.embedded?.trim() ? '✅ present' : '❌ MISSING'}`,
  )
  if (r.entry.why) L.push(`- **Why:** ${r.entry.why}`)
  if (r.error) L.push(`- ⚠️ **Could not read:** ${r.error}`)
  L.push('')
  if (r.components.length) {
    L.push('Third-party components inside this asset:')
    L.push('')
    L.push('| structures | licence | component | rights holder |')
    L.push('|---:|---|---|---|')
    for (const c of r.components) {
      L.push(`| ${c.count} | ${c.licence} | ${c.title} | ${c.holder} |`)
    }
    L.push(`| ${r.own} | CC BY-SA 4.0 | Z-Anatomy's own geometry | Z-Anatomy authors |`)
    L.push('')
    for (const c of r.components) {
      if (c.note) L.push(`- **${c.title}:** ${c.note}`)
    }
    L.push('')
  }
}

L.push('## Not usable at any point')
L.push('')
L.push('Recorded so nobody re-investigates them. These are closed by **contract or price**, which')
L.push('no decision of ours can relax — unlike a licence choice, which is ours to make.')
L.push('')
L.push('| source | instrument | why |')
L.push('|---|---|---|')
for (const c of register.closed ?? []) L.push(`| ${c.id} | ${c.licence} | ${c.why} |`)
L.push('')

L.push('## Action list before publishing')
L.push('')
if (actions.length) {
  for (const a of actions) L.push(`- [ ] ${a}`)
} else {
  L.push('Nothing outstanding.')
}
L.push('')

writeFileSync(LOG_PATH, L.join('\n'))

// --- console summary ---------------------------------------------------------
console.log(`Licence log -> docs/LICENCE_LOG.md`)
console.log(`Stance: ${register.stance ?? 'open source, non-commercial, fully attributed'}\n`)
for (const r of rows) {
  const extra = r.components.length
    ? '  ' + r.components.map((c) => `${c.count}x ${c.licence}`).join(', ')
    : ''
  console.log(
    `  ${r.file.replace('public/models/', '').padEnd(24)}${r.entry.licence.padEnd(34)}` +
      `${r.embeddable === false ? '— not glTF' : r.embedded?.trim() ? '✓ credited' : '✗ NO CREDIT'}${extra}`,
  )
}
if (unregistered.length) {
  console.log(`\n  ⚠️  ${unregistered.length} unregistered file(s): ${unregistered.join(', ')}`)
}
console.log(`\n${actions.length} item(s) on the pre-publication action list.`)
if (REVIEW) {
  console.log('')
  for (const a of actions) console.log(`  - ${a.replace(/\*\*/g, '')}\n`)
}

if (VERIFY) {
  const blockers = []
  for (const u of unregistered) {
    blockers.push(`${u} is on disk with no entry in licences.json — an unrecorded asset cannot be reasoned about.`)
  }
  for (const r of rows) {
    if (r.embeddable !== false && !r.embedded?.trim()) {
      blockers.push(`${r.file} carries no embedded asset.copyright — the credit does not travel with the file.`)
    }
    if (r.absent?.length) {
      blockers.push(`${r.entry.id}: ${r.absent.join(', ')} missing from a multi-file artefact — the app loads part of it and fails on the rest.`)
    }
    for (const c of r.components) {
      if (/none stated|unlicensed|unknown/i.test(c.licence)) {
        blockers.push(
          `${r.file}: ${c.count} structures from "${c.title}" (${c.holder}) have NO LICENCE STATEMENT. ` +
            `Silence is not permission — attribution satisfies a licence's conditions, it cannot create a grant. ` +
            `Build with --publishable, or obtain written permission.`,
        )
      }
    }
  }
  console.log('')
  if (blockers.length) {
    console.error(`✗ NOT RELEASABLE — ${blockers.length} blocker(s):`)
    for (const b of blockers) console.error(`   ${b}`)
    console.error(
      '\n  These are distribution questions, not commercial ones. Non-commercial and\n' +
        '  share-alike terms are fine here (D12b); a MISSING GRANT is not.',
    )
    process.exit(1)
  }
  console.log('✓ releasable: every asset registered, credited, complete, and carrying a grant')
}
