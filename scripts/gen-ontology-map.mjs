#!/usr/bin/env node
/**
 * Generate `docs/ONTOLOGY_MAP.md` — every organ-system-to-nomenclature mapping
 * this repository holds, and which of them actually reach the shipped assets.
 *
 * WHY THIS EXISTS
 * ---------------
 * Organ overlays currently declare what they replace **by structure NAME**, and
 * that is fragile in a way the OpenEar ear made concrete: Z-Anatomy names the left
 * and right ossicles identically, so a name test cannot mask one ear without
 * masking the other, and a one-sided overlay therefore cannot hide the structures
 * it stands in for at all. Ontology terms are the stable join — they are per-side
 * where the anatomy is per-side, they survive a rebuild, and they are shared across
 * atlases. This document is the inventory needed to move overlays onto them.
 *
 * GENERATED, LIKE THE OTHER TABLES HERE, AND FOR THE SAME REASON. Every row comes
 * from a crosswalk TSV or from a shipped GLB. A mapping document that has quietly
 * drifted is worse than none, because ontology ids look authoritative.
 *
 *   node scripts/gen-ontology-map.mjs
 */
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { NodeIO } = require('@gltf-transform/core')
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions')
const { MeshoptDecoder } = require('meshoptimizer')

const ROOT = process.cwd()
const OUT = join(ROOT, 'docs/ONTOLOGY_MAP.md')
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })

/** Tab-separated, `#` comments skipped, first non-comment line is the header. */
function readTsv(path) {
  if (!existsSync(path)) return []
  const lines = readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
  const hdr = lines[0].split('\t')
  return lines.slice(1).map((l) => {
    const cells = l.split('\t')
    return Object.fromEntries(hdr.map((h, i) => [h, (cells[i] ?? '').trim()]))
  })
}

/**
 * The crosswalks, normalised to one shape.
 *
 * Two nomenclatures appear because the atlases have two lineages, not because
 * anybody chose to mix them: BodyParts3D and its derivative Z-Anatomy are FMA,
 * and everything segmented from imaging speaks UBERON.
 */
const SOURCES = [
  {
    id: 'bodyparts3d',
    label: 'BodyParts3D',
    vocab: 'FMA',
    file: 'docs/bodyparts3d-system-map.tsv',
    term: 'fma_id',
    name: 'label',
    note: 'one row per source OBJ, from the FMA walk done when the atlas was assembled',
  },
  {
    id: 'z-anatomy',
    label: 'Z-Anatomy',
    vocab: 'FMA',
    file: 'docs/z-anatomy-fma.tsv',
    term: 'fma',
    name: 'name',
    note: 'per structure and per side',
  },
  {
    id: 'ct-atlas-f',
    label: 'CT atlas (MOOSE)',
    vocab: 'UBERON',
    file: 'docs/moose-uberon-crosswalk.tsv',
    term: 'uberon',
    name: 'uberon_label',
    note: 'MOOSE class to UBERON, hand-built and hand-checked',
  },
  {
    id: 'htb-ct-f',
    label: 'CT (female), TCIA',
    vocab: 'UBERON',
    file: 'docs/healthy-total-body-cts-crosswalk.tsv',
    term: 'uberon',
    name: 'uberon_label',
    note: 'grouped labelmap classes to UBERON',
  },
]

/** Terms per system, and the reverse index term -> {label, sources, systems}. */
const bySystem = new Map()
const byTerm = new Map()
const perSource = []

for (const src of SOURCES) {
  const rows = readTsv(join(ROOT, src.file))
  let withTerm = 0
  const seen = new Set()
  for (const r of rows) {
    const term = (r[src.term] ?? '').trim()
    const system = (r.system ?? '').trim() || '(unassigned)'
    if (!term || term === '-') continue
    withTerm++
    // Normalise `FMA54397` and `FMA:54397` to one form — the two TSVs differ.
    const id = term.replace(/^(FMA|UBERON)[:_]?/i, (m) => m.replace(/[:_]$/, '').toUpperCase() + ':')
    seen.add(id)
    if (!bySystem.has(system)) bySystem.set(system, new Map())
    const sysMap = bySystem.get(system)
    if (!sysMap.has(id)) sysMap.set(id, { label: r[src.name] || '', sources: new Set(), sides: new Set() })
    const e = sysMap.get(id)
    if (!e.label && r[src.name]) e.label = r[src.name]
    e.sources.add(src.label)
    if (r.side) e.sides.add(r.side)
    if (!byTerm.has(id)) byTerm.set(id, { label: e.label, systems: new Set(), sources: new Set() })
    byTerm.get(id).systems.add(system)
    byTerm.get(id).sources.add(src.label)
  }
  perSource.push({ ...src, rows: rows.length, withTerm, distinct: seen.size })
}

/**
 * Does the SHIPPED asset carry a term per structure, or only the crosswalk?
 *
 * This is the finding the document exists to report. A crosswalk in `docs/` is not
 * a join the app can make: unless the term travels into the GLB, the only thing
 * available at runtime is the structure's name.
 */
const ASSETS = [
  { id: 'hra', file: 'public/models/hra.ao.glb' },
  { id: 'hra-m', file: 'public/models/hra-m.ao.glb' },
  { id: 'bodyparts3d', file: 'public/models/bodyparts3d.ao.glb' },
  { id: 'z-anatomy', file: 'public/models/z-anatomy.ao.glb' },
  { id: 'z-anatomy-regions', file: 'public/models/z-anatomy-regions.ao.glb' },
  { id: 'htb-ct-f', file: 'public/models/htb-ct-003.glb' },
  { id: 'ct-atlas-f', file: 'public/models/ct-atlas-f.glb' },
]
const TERM_RE = /(UBERON|FMA)[:_]\d+/i

const assetTerms = []
for (const a of ASSETS) {
  const path = join(ROOT, a.file)
  if (!existsSync(path)) {
    assetTerms.push({ ...a, missing: true })
    continue
  }
  const doc = await io.read(path)
  const root = doc.getRoot()
  const scene = root.getDefaultScene() ?? root.listScenes()[0]
  const table = scene.getExtras()?.structures ?? []
  let nodes = 0
  let nodesWithTerm = 0
  const terms = new Set()
  for (const n of root.listNodes()) {
    if (!n.getMesh()) continue
    nodes++
    const ex = n.getExtras() ?? {}
    const probe = `${n.getName()} ${JSON.stringify(ex)}`
    const m = probe.match(TERM_RE)
    if (m) {
      nodesWithTerm++
      for (const t of probe.match(new RegExp(TERM_RE.source, 'gi')) ?? []) terms.add(t.replace('_', ':'))
    }
  }
  const tableWithTerm = table.filter((s) =>
    Object.values(s).some((v) => typeof v === 'string' && TERM_RE.test(v)),
  ).length
  /**
   * Latin nomenclature (D24), counted here so the number is GENERATED.
   *
   * It belongs in this document because it is identity: for a structure with no
   * ontology term a Terminologia-style Latin name is the only formal identity it
   * carries, and on the regions atlas it is the only identity of any kind. The
   * `termless` count is the one that says what was actually gained.
   */
  const tableWithLatin = table.filter((s) => typeof s.name_lat === 'string' && s.name_lat).length
  const latinTermless = table.filter(
    (s) =>
      typeof s.name_lat === 'string' &&
      s.name_lat &&
      !Object.values(s).some((v) => typeof v === 'string' && TERM_RE.test(v)),
  ).length
  assetTerms.push({
    ...a,
    nodes,
    nodesWithTerm,
    table: table.length,
    tableWithTerm,
    tableWithLatin,
    latinTermless,
    terms,
  })
}

/**
 * What each overlay is made of, read from its own asset.
 *
 * Derived rather than transcribed from `organOverlays.ts` so it cannot drift, and
 * matched against the crosswalks by name to show which terms an overlay could
 * declare instead of a name test. Unmatched names are listed as unmatched — the
 * point of this exercise is defeated by guessing a term.
 */
const OVERLAYS = [
  { id: 'beating-heart', label: 'Beating heart', file: 'public/models/biv-heart.glb' },
  { id: 'schematic-eye', label: 'Schematic eye', file: 'public/models/eye.glb' },
  { id: 'openear', label: 'Ear (photographic)', file: 'public/models/openear-zeta.glb' },
]
const labelIndex = new Map()
for (const [system, terms] of bySystem)
  for (const [id, e] of terms) {
    const k = (e.label || '').toLowerCase().trim()
    if (!k) continue
    if (!labelIndex.has(k)) labelIndex.set(k, [])
    labelIndex.get(k).push({ id, system, sources: [...e.sources] })
  }

/**
 * Structure names the atlases actually contain, so "no term" and "no structure"
 * can be told apart.
 *
 * They are different problems with different fixes. A structure the atlas HAS but
 * no crosswalk names needs a term added — that is the work. A structure no atlas
 * has at all is an overlay ADDING an organ, and there is nothing to supersede;
 * the schematic eye is the whole reason that distinction matters, because no atlas
 * here models an eyeball.
 */
const atlasNames = new Map()
/** Kept whole, because the eye section below reports measured structure IDS. */
let zAnatomyTable = []
for (const a of assetTerms) {
  if (a.missing) continue
  const path = join(ROOT, a.file)
  const doc = await io.read(path)
  const root = doc.getRoot()
  const scene = root.getDefaultScene() ?? root.listScenes()[0]
  const table = scene.getExtras()?.structures ?? []
  const names = new Set()
  for (const s of table) if (s.name) names.add(String(s.name).toLowerCase().trim())
  for (const n of root.listNodes()) {
    if (!n.getMesh()) continue
    const ex = n.getExtras() ?? {}
    if (typeof ex.label === 'string') names.add(ex.label.toLowerCase().trim())
  }
  atlasNames.set(a.id, names)
  if (a.id === 'z-anatomy') zAnatomyTable = table
}

const overlayRows = []
for (const o of OVERLAYS) {
  const path = join(ROOT, o.file)
  if (!existsSync(path)) continue
  const doc = await io.read(path)
  const parts = doc
    .getRoot()
    .listMeshes()
    .map((m) => m.getName())
  overlayRows.push({
    ...o,
    parts: parts.map((p) => {
      /**
       * `cardiovascular/epicardium` -> `epicardium`.
       *
       * The heart's meshes are system-prefixed and the other two overlays' are not.
       * Leaving the prefix on reported every heart part as unmatched, which read as
       * a finding about the crosswalks when it was a finding about this line.
       */
      const key = p
        .toLowerCase()
        .replace(/^[a-z-]+\//, '')
        .replace(/\s+colour$/, '')
        .trim()
      const inAtlases = [...atlasNames.entries()]
        .filter(([, names]) => names.has(key))
        .map(([id]) => id)
      return { name: p, key, matches: labelIndex.get(key) ?? [], inAtlases }
    }),
  })
}

// --------------------------------------------------------------------------- //
// Emit
// --------------------------------------------------------------------------- //
const L = []
const totalTerms = byTerm.size
const systemsSorted = [...bySystem.entries()].sort((a, b) => b[1].size - a[1].size)

L.push('# Organ systems and ontology terms')
L.push('')
L.push('**Generated — do not edit by hand.** Run `node scripts/gen-ontology-map.mjs`.')
L.push('')
L.push(
  'Every mapping from a body system to a nomenclature term that this repository holds, ' +
    `and — more importantly — which of them actually reach the shipped assets. ` +
    `${totalTerms.toLocaleString()} distinct terms across ${bySystem.size} systems.`,
)
L.push('')
L.push('## Why this exists')
L.push('')
L.push(
  'Organ overlays declare what they replace **by structure name**, and that is fragile. ' +
    'Z-Anatomy names the left and right ossicles identically, so a name test cannot mask one ' +
    'ear without masking the other — which is why the OpenEar overlay supersedes nothing at all ' +
    'today and renders alongside the atlas’s own ear. Ontology terms are the join that fixes ' +
    'it: per-side where the anatomy is per-side, stable across a rebuild, and shared between ' +
    'atlases. This is the inventory for that move.',
)
L.push('')
L.push(
  '**Two nomenclatures appear because the atlases have two lineages, not because anybody chose ' +
    'to mix them.** BodyParts3D and its derivative Z-Anatomy are addressed in **FMA**; everything ' +
    'segmented from imaging — the CT atlases and HRA — speaks **UBERON**. Any cross-atlas overlay ' +
    'therefore needs both, or an FMA↔UBERON bridge — which now exists; see below.',
)
L.push('')

L.push('## ⚠️ The gap: crosswalks exist, the assets mostly do not carry them')
L.push('')
L.push(
  'A crosswalk in `docs/` is not a join the app can make. Unless the term travels into the GLB, ' +
    'the only thing available at runtime is the structure’s name — which is exactly the ' +
    'situation the overlays are stuck in.',
)
L.push('')
L.push('| asset | structures | carry a term | carry a Latin name | where the term is |')
L.push('|---|---|---|---|---|')
for (const a of assetTerms) {
  if (a.missing) {
    L.push(`| \`${a.id}\` | — | — | — | not built |`)
    continue
  }
  const unit = a.table ? `${a.table.toLocaleString()} in the structure table` : `${a.nodes} mesh nodes`
  const carry = a.table ? a.tableWithTerm : a.nodesWithTerm
  const pct = a.table ? (100 * a.tableWithTerm) / (a.table || 1) : (100 * a.nodesWithTerm) / (a.nodes || 1)
  const where = a.table
    ? a.tableWithTerm
      ? 'structure table'
      : '**nowhere — name only**'
    : a.nodesWithTerm
      ? 'node `extras.ontologyid`'
      : '**nowhere — name only**'
  const lat = a.tableWithLatin
    ? `${a.tableWithLatin.toLocaleString()} (${((100 * a.tableWithLatin) / (a.table || 1)).toFixed(0)} %)` +
      (a.latinTermless ? `, ${a.latinTermless.toLocaleString()} with no term` : '')
    : '—'
  L.push(
    `| \`${a.id}\` | ${unit} | ${carry.toLocaleString()} (${pct.toFixed(0)} %) | ${lat} | ${where} |`,
  )
}
L.push('')
// Counts pulled from the data rather than written into the prose — the first
// draft said "635" where the table said 618, because the term normalisation
// dedupes and the sentence had been written before it.
const zaSrc = perSource.find((s) => s.id === 'z-anatomy')
const bpSrc = perSource.find((s) => s.id === 'bodyparts3d')
const zaAsset = assetTerms.find((a) => a.id === 'z-anatomy')
const bpAsset = assetTerms.find((a) => a.id === 'bodyparts3d')
// ⚠️ THIS PARAGRAPH IS DERIVED, AND IT HAS TO BE.
//
// It used to assert that Z-Anatomy "carries none", as a fixed string beside a
// table computed from the asset. When `apply-crosswalk.mjs` wrote 1,048 FMA
// terms into the build, the table updated and the sentence did not, so this
// generated document spent a while contradicting itself one line apart — and
// `docs/HANDOVER.md` and `CLAUDE.md` both went on repeating the sentence rather
// than the table. A generated document that states a conclusion the same run
// disproved is worse than a hand-maintained one, because it carries the
// authority of having been measured.
//
// So the claim is now computed. If a future build writes terms into
// BodyParts3D, this paragraph changes on its own.
const zaCarry = zaAsset?.tableWithTerm ?? 0
const zaTotal = zaAsset?.table ?? 0
const withoutTerms = assetTerms.filter(
  (a) => !a.missing && !(a.table ? a.tableWithTerm : a.nodesWithTerm),
)
L.push(
  (withoutTerms.length
    ? `**${withoutTerms.length} of the ${assetTerms.filter((a) => !a.missing).length} built assets ` +
      `carry no term at all: ${withoutTerms.map((a) => `\`${a.id}\``).join(', ')}.** `
    : '**Every built asset now carries at least some terms.** ') +
    (zaCarry
      ? `Z-Anatomy ships ${zaTotal.toLocaleString()} named structures and now carries ` +
        `${zaCarry.toLocaleString()} of them (${((100 * zaCarry) / (zaTotal || 1)).toFixed(0)} %), ` +
        `written into the structure table from \`${zaSrc?.file}\`, which maps ` +
        `${(zaSrc?.distinct ?? 0).toLocaleString()} distinct terms across ` +
        `${(zaSrc?.rows ?? 0).toLocaleString()} rows. The remainder is unmapped crosswalk, not a ` +
        'pipeline failure. '
      : `Z-Anatomy ships ${zaTotal.toLocaleString()} named structures and carries none, though ` +
        `\`${zaSrc?.file}\` maps ${(zaSrc?.distinct ?? 0).toLocaleString()} distinct terms across ` +
        `${(zaSrc?.rows ?? 0).toLocaleString()} rows. `) +
    // ⚠️ DERIVED FOR THE SAME REASON AS THE SENTENCE ABOVE. This half described
    // BodyParts3D as having lost its FMA ids to the merge and needing a rebuild.
    // It was rebuilt on 8 August 2026 and now carries all 1,838, at which point
    // a fixed string would have gone stale within one run of this script — the
    // exact failure the previous paragraph had just been fixed for. Twice in one
    // paragraph is enough to make the rule general: if a sentence states a
    // measurement, it computes the measurement.
    (bpAsset?.tableWithTerm
      ? `BodyParts3D carries ${bpAsset.tableWithTerm.toLocaleString()} of ` +
        `${(bpAsset.table ?? 0).toLocaleString()} ` +
        `(${((100 * bpAsset.tableWithTerm) / (bpAsset.table || 1)).toFixed(0)} %), from ` +
        `\`${bpSrc?.file}\`. It is still merged to eleven draw calls — the ids travel in the ` +
        'structure table and the `_STRUCTURE` attribute, not in the node graph, so the draw-call ' +
        'budget is unaffected.'
      : 'BodyParts3D is merged to eleven draw calls and ' +
        `loses the FMA id that \`${bpSrc?.file}\` holds for all ` +
        `${(bpSrc?.rows ?? 0).toLocaleString()} of its source meshes — note that ` +
        '`build-bodyparts3d.mjs` already WRITES a structure table with those ids, so the shipped ' +
        'asset is simply older than the pipeline and needs only a rebuild, not a code change.'),
)
L.push('')

/**
 * The bridge, reported from its own generated TSV rather than described.
 *
 * Kept out of the crosswalk table above on purpose: every row there maps a
 * STRUCTURE to a term, and this maps a term to a term. Filing them together would
 * imply the bridge tags geometry, which it does not — it is what lets a structure
 * tagged in one vocabulary be recognised by the other.
 */
// Counted, not quoted — the same union the bridge script derives its work list
// from: every UBERON id in a crosswalk or in a shipped asset.
const uberonIds = new Set()
for (const id of byTerm.keys()) if (id.startsWith('UBERON:')) uberonIds.add(id)
for (const a of assetTerms) for (const t of a.terms ?? []) if (t.startsWith('UBERON:')) uberonIds.add(t)
const uberonIdCount = uberonIds.size

const BRIDGE = join(ROOT, 'docs/fma-uberon-bridge.tsv')
if (existsSync(BRIDGE)) {
  const bRows = readFileSync(BRIDGE, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('uberon\t'))
    .map((l) => l.split('\t'))
  const joined = bRows.filter((r) => (r[5] ?? '').trim())
  const direct = joined.filter((r) => r[4] === 'direct').length
  const viaChild = joined.filter((r) => r[4] === 'fma-child').length
  const bridgedFma = new Set(joined.flatMap((r) => r[5].split('|').filter(Boolean)))

  L.push('## The FMA ↔ UBERON bridge')
  L.push('')
  L.push(
    'Generated by `npm run build:bridge` into `docs/fma-uberon-bridge.tsv`, from **UBERON\'s own ' +
      'published cross-references** via the EBI OLS4 API — the route the MOOSE and TCIA crosswalks ' +
      'were built by. Nothing in it is hand-authored: asserting an equivalence between two ' +
      'vocabularies this project does not maintain would be inventing a fact.',
  )
  L.push('')
  L.push('| | |')
  L.push('|---|---|')
  L.push(`| UBERON ids held here | ${uberonIdCount} |`)
  L.push(`| …carrying an FMA xref | ${bRows.length} |`)
  L.push(`| **…reaching FMA-addressed geometry here** | **${joined.length}** |`)
  L.push(`| via UBERON's own xref id | ${direct} |`)
  L.push(`| via FMA's sided children | ${viaChild} |`)
  L.push(`| distinct FMA ids bridged | ${bridgedFma.size} |`)
  L.push('')
  L.push(
    '⚠️ **The two `via` values are the finding, not bookkeeping.** A first build joined only ' +
      `${direct} rows, because UBERON cross-references the UNSIDED FMA class — \`tibia\` is ` +
      'FMA:24476 — while both FMA-addressed atlases here use the SIDED terms, FMA:24477 right and ' +
      'FMA:24478 left. The bridge was landing exactly one level too coarse, so every laterally ' +
      'paired structure missed. Descending FMA\'s own `is_a` hierarchy recovers them, and it is ' +
      'the only correct way to: **the offset is not arithmetic** — `clavicle` FMA:13321 has ' +
      'children at 13322 and 13323, but `femur` FMA:9611 has a left child at FMA:24475, nearly ' +
      '15,000 away. Unpaired midline organs (stomach, oesophagus, inferior vena cava) join ' +
      'directly; paired ones do not.',
  )
  L.push('')
  L.push(
    'The remaining gap is not a defect in the bridge. The UBERON side of this repository is ' +
      'coarse — whole organs from imaging segmentation — while the FMA side is fine-grained, so ' +
      'most FMA ids here describe structures no UBERON-addressed atlas models at all. Widening it ' +
      'means more UBERON-tagged geometry, not more bridge.',
  )
  L.push('')
}

L.push('## Crosswalks in this repository')
L.push('')
L.push('| source | vocabulary | rows | with a term | distinct terms | what it is |')
L.push('|---|---|---|---|---|---|')
for (const s of perSource)
  L.push(
    `| ${s.label} | ${s.vocab} | ${s.rows.toLocaleString()} | ${s.withTerm.toLocaleString()} | ` +
      `${s.distinct.toLocaleString()} | ${s.note} |`,
  )
L.push('')
L.push(
  'These TSVs are the machine-readable form and stay the authority; the tables below are the ' +
    'same data organised by system.',
)
L.push('')

L.push('## Terms by organ system')
L.push('')
L.push('| system | distinct terms |')
L.push('|---|---|')
for (const [system, terms] of systemsSorted) L.push(`| ${system} | ${terms.size.toLocaleString()} |`)
L.push('')
L.push(
  '⚠️ `SystemId` has nine values and is the **health-data contract**, owned upstream (D8). ' +
    'Systems outside it — `lymphoid`, `sensory` — are deliberately not added to it for a geometric ' +
    'reason; those structures render unresolved rather than score-coloured. A term mapping does not ' +
    'change that.',
)
L.push('')

for (const [system, terms] of systemsSorted) {
  const rows = [...terms.entries()].sort((a, b) => (a[1].label || '').localeCompare(b[1].label || ''))
  L.push(`<details>`)
  L.push(
    `<summary><strong>${system}</strong> — ${rows.length.toLocaleString()} term${rows.length === 1 ? '' : 's'}</summary>`,
  )
  L.push('')
  L.push('| term | label | sides | in |')
  L.push('|---|---|---|---|')
  for (const [id, e] of rows)
    L.push(
      `| \`${id}\` | ${e.label || '—'} | ${[...e.sides].sort().join(', ') || '—'} | ${[...e.sources].sort().join(', ')} |`,
    )
  L.push('')
  L.push('</details>')
  L.push('')
}

L.push('## What an overlay would declare')
L.push('')
L.push(
  'Each overlay’s own parts, read from its asset, matched against the crosswalks by name. ' +
    'This is the shortlist an overlay would supersede by term instead of by name test. Names that ' +
    'do not match are shown as unmatched rather than resolved to a plausible term — a wrong ' +
    'ontology id would hide the wrong structure, which is worse than hiding nothing.',
)
L.push('')
for (const o of overlayRows) {
  const hit = o.parts.filter((p) => p.matches.length).length
  const needTerm = o.parts.filter((p) => !p.matches.length && p.inAtlases.length)
  const adds = o.parts.filter((p) => !p.matches.length && !p.inAtlases.length)
  L.push(`### ${o.label}`)
  L.push('')
  L.push(
    `${hit}/${o.parts.length} parts have a term. ${needTerm.length} exist in an atlas but have no ` +
      `term in any crosswalk. ${adds.length} are in no atlas here at all.`,
  )
  L.push('')
  L.push('| part | term | status | in which atlas |')
  L.push('|---|---|---|---|')
  for (const p of o.parts) {
    if (p.matches.length) {
      for (const m of p.matches)
        L.push(
          `| ${p.name} | \`${m.id}\` | mapped (${m.system}) | ${p.inAtlases.join(', ') || '—'} |`,
        )
    } else if (p.inAtlases.length) {
      L.push(`| ${p.name} | — | **needs a term** | ${p.inAtlases.join(', ')} |`)
    } else {
      L.push(`| ${p.name} | — | adds an organ, nothing to supersede | none |`)
    }
  }
  L.push('')
}
L.push(
  '**Read the middle column, not the count.** "Needs a term" is the actionable row: the atlas ' +
    'holds that structure, so an overlay could supersede it precisely — the term is simply missing ' +
    'from the crosswalks, which cover the skeleton and the vasculature well and the special senses ' +
    'not at all.',
)
L.push('')
L.push(
  '⚠️ **"Adds an organ" is matched by NAME, so read it as "no structure with this name".** It is ' +
    'not proof the anatomy is absent. Z-Anatomy has no `Scala Tympani`, but it does have a ' +
    '`Cochlea` — one structure where OpenEar has two — and a name test cannot see a many-to-one ' +
    'correspondence. Terms would: the scalae are parts of the cochlea in both FMA and UBERON, which ' +
    'is precisely the kind of relation a name string cannot express and an ontology can.',
)
L.push('')
/**
 * ⚠️ THE EYE IDS ARE MEASURED HERE, AND THEY USED TO BE TYPED INTO THE PROSE.
 *
 * This section previously stated the globe as "20 structures at ids 2631–2650"
 * with cornea, lens and retina at "2631, 2635, 2641, 2644, 2648, 2649". Both were
 * wrong against the shipped asset — the real span is 2626–2647 and the three
 * refracting surfaces are at 2628, 2632, 2638, 2641, 2645, 2646 — because a
 * rebuild renumbered the table (the zero-vertex guard and the narrowed inner-ear
 * pattern moved 3,617 structures to 3,614) and hand-written numbers in a
 * GENERATED document cannot follow.
 *
 * That is not a cosmetic drift. Ids are what the mask consumes, so 2648 and 2649
 * are not "slightly off" — they are `Long posterior ciliary arteries` and other
 * non-eye structures, and anyone implementing the narrowed mask from the old
 * prose would have hidden the wrong anatomy while believing the document.
 *
 * An explicit NAME LIST rather than a regex: `nervous` also holds `Choroid
 * plexus`, and the musculoskeletal system is full of `retinaculum`, both of which
 * a loose /retina|choroid/ matches. The list is what the asset actually calls
 * these parts, so an upstream rename shows up as a dropped count here.
 */
const EYE_PART_NAMES = new Set(
  [
    'cornea',
    'lens',
    'retina',
    'sclera',
    'iris',
    'vitreous body',
    'zonular fibres',
    'anterior segment of eyeball',
    'posterior segment of eyeball',
    'anterior chamber of eyeball',
    'suspensory ligament of eyeball',
  ].map((s) => s.toLowerCase()),
)
const eyeParts = zAnatomyTable
  .map((s, id) => ({ id, ...s }))
  .filter(
    (s) => (s.system ?? '') === 'nervous' && EYE_PART_NAMES.has(String(s.name ?? '').toLowerCase()),
  )
const eyeIds = eyeParts.map((s) => s.id)
const eyeLo = Math.min(...eyeIds)
const eyeHi = Math.max(...eyeIds)
const eyeContiguous = eyeIds.length > 0 && eyeHi - eyeLo + 1 === eyeIds.length
const REFRACTING = new Set(['cornea', 'lens', 'retina'])
const refracting = eyeParts.filter((s) => REFRACTING.has(String(s.name).toLowerCase()))
const refractingIds = refracting.map((s) => s.id).sort((a, b) => a - b)
const eyeNames = [...new Set(eyeParts.map((s) => String(s.name)))].sort()

L.push('### ⚠️ The conflict this table found: the schematic eye')
L.push('')
L.push(
  'The eye overlay was built and documented on the basis that **no atlas here contained an ' +
    'eyeball**. That was true of the three-file Z-Anatomy build and stopped being true when ' +
    '`NervousSystem100.fbx` was imported; nothing re-checked it until this table was generated. ' +
    `Z-Anatomy carries a complete bilateral globe under \`nervous\` — ${eyeNames.length} distinct ` +
    `parts (${eyeNames.map((n) => n.toLowerCase()).join(', ')}) — **${eyeParts.length} structures ` +
    `at ids ${eyeLo}–${eyeHi}**${eyeContiguous ? ', contiguous' : ', NOT contiguous'}. There is no ` +
    'left/right obstacle either, because the eye overlay already places two instances.',
)
L.push('')
L.push(
  'It is **not** wired up, deliberately, and the decision is recorded rather than taken: the ' +
    'schematic models three refracting surfaces, while Z-Anatomy models the sclera and iris it ' +
    'does not have. Superseding would render LESS anatomy in exchange for correct optics, which ' +
    'contradicts the overlay’s own note that it is "not a substitute for an anatomical eye". Until ' +
    'that is settled, switching the eye on over Z-Anatomy draws two overlapping globes.',
)
L.push('')
L.push(
  '⚠️ **The reason previously given for not narrowing the mask no longer holds, and it was the ' +
    'only one.** This section used to say that masking just cornea, lens and retina was ' +
    'unavailable because those ids "are not contiguous, and the masking mechanism takes a range". ' +
    'The mechanism stopped taking a range when `src/scene/structureMask.ts` replaced `{lo, hi}` ' +
    'with a per-structure texture indexed by id — done for the ear, whose two sides interleave — ' +
    `so an arbitrary set is exactly what it now consumes. Those three sit at ids ` +
    `**${refractingIds.join(', ')}** and could be masked today. What remains is the ANATOMICAL ` +
    'question above, which is a judgement about rendering less anatomy for better optics, not a ' +
    'capability gap. Settle that on its merits.',
)
L.push('')

L.push('---')
L.push('')
L.push(
  'Per-asset licence and component provenance is in `docs/LICENCE_LOG.md`; the viewer shows the ' +
    'same provenance under **All models and sources**.',
)
L.push('')

writeFileSync(OUT, L.join('\n'))
console.log(`ontology map -> docs/ONTOLOGY_MAP.md`)
console.log(`  ${totalTerms} distinct terms, ${bySystem.size} systems, ${perSource.length} crosswalks`)
for (const a of assetTerms) {
  if (a.missing) continue
  const carry = a.table ? a.tableWithTerm : a.nodesWithTerm
  const of = a.table || a.nodes
  console.log(`  ${a.id.padEnd(20)} ${String(carry).padStart(5)}/${String(of).padEnd(6)} carry a term`)
}
for (const o of overlayRows)
  console.log(`  overlay ${o.label.padEnd(20)} ${o.parts.filter((p) => p.matches.length).length}/${o.parts.length} parts matched`)
