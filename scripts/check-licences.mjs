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

// --- the action list ---------------------------------------------------------
// What a human has to DO before publishing, as opposed to what is merely true.
for (const r of rows) {
  if (!r.embedded?.trim()) {
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
  L.push(`- **Embedded \`asset.copyright\`:** ${r.embedded?.trim() ? '✅ present' : '❌ MISSING'}`)
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
      `${r.embedded?.trim() ? '✓ credited' : '✗ NO CREDIT'}${extra}`,
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
