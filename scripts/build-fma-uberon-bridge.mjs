#!/usr/bin/env node
/**
 * The FMA ↔ UBERON bridge, ingested from UBERON's own cross-references.
 *
 *   node scripts/build-fma-uberon-bridge.mjs            # build docs/fma-uberon-bridge.tsv
 *   node scripts/build-fma-uberon-bridge.mjs --measure  # report yield, write nothing
 *
 * WHY THIS EXISTS. This repository holds two nomenclatures because its atlases
 * have two lineages, not because anybody chose to mix them: BodyParts3D and its
 * derivative Z-Anatomy are addressed in **FMA**, while everything segmented from
 * imaging — HRA and both CT atlases — speaks **UBERON**. So an overlay declared
 * against one cannot mask geometry addressed in the other, and no cross-atlas
 * join can be made at all. `docs/ONTOLOGY_MAP.md` has named this gap for a while.
 *
 * ⚠️ INGESTED, NEVER HAND-AUTHORED. UBERON curates `xref:` links to FMA as part
 * of its own release, so the correspondence is published upstream by the people
 * who maintain the vocabulary. Typing a mapping table by hand would be inventing
 * an equivalence this project has no standing to assert — and a wrong ontology id
 * hides the wrong structure, which is worse than hiding nothing. Everything here
 * is fetched, cached and re-derivable.
 *
 * ⚠️ AN XREF IS NOT PROOF OF EXACT EQUIVALENCE, and the output says so per row.
 * UBERON's FMA xrefs are curated but not uniformly `oboInOwl:hasDbXref` with
 * exact semantics — some are broader or narrower matches, and a few UBERON terms
 * carry SEVERAL FMA xrefs, which is a one-to-many correspondence rather than an
 * identity. Rows with more than one FMA id are marked `ambiguous`, because
 * silently picking the first would manufacture precision that is not there.
 *
 * DIRECTION IS DELIBERATE: UBERON → FMA. The repository holds 153 distinct UBERON
 * ids against 1,318 FMA ids, so asking UBERON about each of its own terms is
 * ~153 queries, while the reverse would mean pulling the whole ontology to find
 * which of 1,318 FMA ids anybody mentions. Same bridge, an order of magnitude
 * less traffic against a free public service.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { NodeIO } = require('@gltf-transform/core')
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions')
const { MeshoptDecoder } = require('meshoptimizer')

const ROOT = process.cwd()
const MEASURE_ONLY = process.argv.includes('--measure')
const OUT = join(ROOT, 'docs/fma-uberon-bridge.tsv')
const CACHE = join(ROOT, '.cache/ols4-uberon.json')
const OLS4 = 'https://www.ebi.ac.uk/ols4/api/ontologies/uberon/terms'
const OLS4_FMA = 'https://www.ebi.ac.uk/ols4/api/ontologies/fma/terms'
const CHILD_CACHE = join(ROOT, '.cache/ols4-fma-children.json')

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })

const normalise = (s) =>
  String(s)
    .trim()
    .replace(/^FMA[:_]?/i, 'FMA:')
    .replace(/^UBERON[:_]?/i, 'UBERON:')

/**
 * Which ids this repository actually holds — DERIVED, not listed.
 *
 * Reads the crosswalk TSVs and every shipped GLB, so adding an atlas or extending
 * a crosswalk widens the bridge automatically. A hand-kept list here would be the
 * same weak point `DEPLOY.md` documents for its asset roster, which had already
 * gone wrong once.
 */
async function inventory() {
  const fma = new Set()
  const uberon = new Set()
  const add = (t) => {
    if (!t) return
    const n = normalise(t)
    if (/^FMA:\d+$/.test(n)) fma.add(n)
    else if (/^UBERON:\d+$/.test(n)) uberon.add(n)
  }

  for (const f of [
    'docs/z-anatomy-fma.tsv',
    'docs/bodyparts3d-system-map.tsv',
    'docs/moose-uberon-crosswalk.tsv',
    'docs/healthy-total-body-cts-crosswalk.tsv',
  ]) {
    const p = join(ROOT, f)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      if (!line || line.startsWith('#')) continue
      for (const cell of line.split('\t')) {
        const c = cell.trim()
        if (/^(FMA|UBERON)[:_]?\d+$/i.test(c)) add(c)
      }
    }
  }

  for (const f of [
    'z-anatomy.ao.glb',
    'bodyparts3d.ao.glb',
    'hra.ao.glb',
    'hra-m.ao.glb',
    'htb-ct-003.glb',
    'ct-atlas-f.glb',
  ]) {
    const p = join(ROOT, 'public/models', f)
    if (!existsSync(p)) continue
    const doc = await io.read(p)
    const root = doc.getRoot()
    const scene = root.getDefaultScene() ?? root.listScenes()[0]
    for (const s of scene?.getExtras()?.structures ?? []) add(s.ontologyid)
    for (const n of root.listNodes()) add(n.getExtras()?.ontologyid)
  }
  return { fma, uberon }
}

/** Disk cache, so a re-run costs one request per NEW id and none for the rest. */
function loadCache() {
  if (!existsSync(CACHE)) return {}
  try {
    return JSON.parse(readFileSync(CACHE, 'utf8'))
  } catch {
    return {}
  }
}

async function fetchTerm(id, attempt = 0) {
  const url = `${OLS4}?obo_id=${encodeURIComponent(id)}&size=1`
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const j = await r.json()
    const t = j?._embedded?.terms?.[0]
    if (!t) return { id, label: null, fma: [], missing: true }
    const fma = (t.obo_xref ?? [])
      .filter((x) => String(x.database ?? '').toUpperCase() === 'FMA')
      .map((x) => `FMA:${String(x.id).replace(/^FMA[:_]?/i, '')}`)
    return { id, label: t.label ?? null, fma: [...new Set(fma)] }
  } catch (e) {
    // One free public service, so back off rather than hammer it. Three tries,
    // then record the failure as a failure instead of as "no xref" — those are
    // different facts and conflating them would understate the bridge.
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
      return fetchTerm(id, attempt + 1)
    }
    return { id, label: null, fma: [], error: String(e.message ?? e) }
  }
}

/**
 * FMA's own children of a term, via OLS4.
 *
 * ⚠️ THIS IS THE PASS THAT MAKES THE BRIDGE USEFUL, AND THE FIRST BUILD WITHOUT IT
 * JOINED ALMOST NOTHING — 49 of 1,318 FMA ids, 3.7 %.
 *
 * The cause was not a bad bridge. UBERON cross-references the UNSIDED FMA class
 * (`tibia`, FMA:24476) while both FMA-addressed atlases here use the SIDED ones
 * (FMA:24477 right, FMA:24478 left), because FMA gives left and right genuinely
 * different ids. So the bridge was landing exactly one level too coarse, and
 * every laterally-paired bone — most of the skeleton — missed.
 *
 * ⚠️ THE OFFSET IS NOT ARITHMETIC. Do not be tempted: `clavicle` is 13321 with
 * children 13322/13323, one and two above, but `femur` is FMA:9611 with a left
 * child at FMA:24475 — nearly 15,000 apart. Deriving sided ids by adding 1 and 2
 * would silently produce wrong ids for most of the body, and a wrong ontology id
 * hides the wrong structure.
 *
 * Descending FMA's own `is_a` hierarchy is the authoritative answer to "which
 * sided terms belong to this concept", and it is one query per unmatched term
 * rather than a lookup of all 1,318.
 */
async function fetchFmaChildren(fmaId, attempt = 0) {
  const num = String(fmaId).replace(/^FMA[:_]?/i, '')
  const iri = `http://purl.org/sig/ont/fma/fma${num}`
  // OLS4 wants the IRI DOUBLE url-encoded in the path. Single encoding returns a
  // bare 400 with no explanation, which is a slow thing to diagnose.
  const enc = encodeURIComponent(encodeURIComponent(iri))
  try {
    const r = await fetch(`${OLS4_FMA}/${enc}/children?size=60`, {
      headers: { Accept: 'application/json' },
    })
    // 404 is a normal answer here: a leaf term has no children resource.
    if (r.status === 404) return []
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const j = await r.json()
    return (j?._embedded?.terms ?? []).map((t) => ({
      fma: `FMA:${String(t.obo_id ?? t.short_form ?? '').replace(/^fma/i, '')}`,
      label: t.label ?? '',
    }))
  } catch (e) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
      return fetchFmaChildren(fmaId, attempt + 1)
    }
    return []
  }
}

async function main() {
  const { fma: repoFma, uberon: repoUberon } = await inventory()
  console.log(`repository holds ${repoFma.size} FMA ids and ${repoUberon.size} UBERON ids`)

  const cache = loadCache()
  const ids = [...repoUberon].sort()
  const todo = ids.filter((i) => !cache[i])
  console.log(`${ids.length} UBERON terms to resolve — ${cache ? ids.length - todo.length : 0} cached, ${todo.length} to fetch`)

  const CONCURRENCY = 4
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const batch = todo.slice(i, i + CONCURRENCY)
    const got = await Promise.all(batch.map((id) => fetchTerm(id)))
    for (const g of got) cache[g.id] = g
    process.stdout.write(`\r  fetched ${Math.min(i + CONCURRENCY, todo.length)}/${todo.length}`)
  }
  if (todo.length) process.stdout.write('\n')

  if (todo.length) {
    mkdirSync(dirname(CACHE), { recursive: true })
    writeFileSync(CACHE, JSON.stringify(cache, null, 2))
  }

  const rows = []
  let withXref = 0
  let ambiguous = 0
  let errors = 0
  const joinable = new Set()
  const pending = []
  for (const id of ids) {
    const e = cache[id]
    if (!e) continue
    if (e.error) {
      errors++
      continue
    }
    if (!e.fma.length) continue
    withXref++
    if (e.fma.length > 1) ambiguous++
    const present = e.fma.filter((f) => repoFma.has(f))
    for (const f of present) joinable.add(f)
    const row = {
      uberon: id,
      label: e.label ?? '',
      fma: e.fma.join('|'),
      confidence: e.fma.length > 1 ? 'ambiguous' : 'single',
      via: present.length ? 'direct' : '',
      inRepo: present.length ? present.join('|') : '',
    }
    rows.push(row)
    if (!present.length) pending.push(row)
  }

  // ---- second pass: descend FMA's own hierarchy for the unsided misses -------
  const childCache = existsSync(CHILD_CACHE)
    ? JSON.parse(readFileSync(CHILD_CACHE, 'utf8'))
    : {}
  const directJoins = rows.filter((r) => r.via === 'direct').length
  console.log(`\ndirect joins: ${directJoins}; descending FMA children for ${pending.length} unsided misses`)
  let fetched = 0
  for (let i = 0; i < pending.length; i += 4) {
    const batch = pending.slice(i, i + 4)
    await Promise.all(
      batch.map(async (row) => {
        for (const f of row.fma.split('|')) {
          if (!childCache[f]) {
            childCache[f] = await fetchFmaChildren(f)
            fetched++
          }
        }
      }),
    )
    process.stdout.write(`\r  ${Math.min(i + 4, pending.length)}/${pending.length}`)
  }
  if (pending.length) process.stdout.write('\n')
  if (fetched) {
    mkdirSync(dirname(CHILD_CACHE), { recursive: true })
    writeFileSync(CHILD_CACHE, JSON.stringify(childCache, null, 2))
  }
  let viaChild = 0
  for (const row of pending) {
    const hits = []
    for (const f of row.fma.split('|'))
      for (const c of childCache[f] ?? []) if (repoFma.has(c.fma)) hits.push(c.fma)
    if (!hits.length) continue
    const uniq = [...new Set(hits)]
    row.via = 'fma-child'
    row.inRepo = uniq.join('|')
    for (const f of uniq) joinable.add(f)
    viaChild++
  }

  const joinRows = rows.filter((r) => r.inRepo)
  console.log('')
  console.log(`UBERON terms resolved       : ${ids.length - errors} / ${ids.length}${errors ? ` (${errors} failed)` : ''}`)
  console.log(`  with at least one FMA xref: ${withXref}`)
  console.log(`  ambiguous (>1 FMA xref)   : ${ambiguous}`)
  console.log(`ROWS THAT JOIN              : ${joinRows.length}`)
  console.log(`  direct (UBERON xref id)   : ${directJoins}`)
  console.log(`  via FMA sided children    : ${viaChild}`)
  console.log(`  distinct FMA ids bridged  : ${joinable.size} of ${repoFma.size} (${((joinable.size / repoFma.size) * 100).toFixed(1)}%)`)

  if (MEASURE_ONLY) return 0

  const L = []
  L.push('# FMA ↔ UBERON bridge — GENERATED, do not edit by hand.')
  L.push('#')
  L.push('# Rebuild:  node scripts/build-fma-uberon-bridge.mjs')
  L.push('#')
  L.push('# Every row comes from UBERON\'s OWN published cross-references, read from the')
  L.push('# EBI OLS4 API — the same route the MOOSE and TCIA crosswalks in this directory')
  L.push('# were built by. Nothing here is hand-authored: this project has no standing to')
  L.push('# assert an equivalence between two vocabularies it does not maintain.')
  L.push('#')
  L.push('# ⚠️ AN XREF IS NOT PROOF OF EXACT EQUIVALENCE. `confidence` is `ambiguous` where')
  L.push('# UBERON lists MORE THAN ONE FMA term for the same concept, which is a one-to-many')
  L.push('# correspondence rather than an identity. Do not collapse those to the first id —')
  L.push('# a wrong ontology id hides the wrong structure, which is worse than hiding none.')
  L.push('#')
  L.push('# `in_repo` is the subset of `fma` that some asset or crosswalk here actually uses.')
  L.push('# An empty `in_repo` is a valid bridge to anatomy this repository does not hold.')
  L.push('#')
  L.push(`# ${ids.length} UBERON ids queried, ${withXref} carry an FMA xref, ${joinRows.length} join to geometry here.`)
  L.push('# `via` is how the join was made. `direct` means UBERON\'s own xref id is used')
  L.push('# by an asset here. `fma-child` means it is not, and the ids in `in_repo` are the')
  L.push('# SIDED FMA terms found by descending FMA\'s is_a hierarchy from that xref —')
  L.push('# `tibia` FMA:24476 has children FMA:24477 right and FMA:24478 left, which is what')
  L.push('# the atlases actually use. Both are authoritative; neither is a name match.')
  L.push('uberon\tlabel\tfma\tconfidence\tvia\tin_repo')
  for (const r of rows.sort((a, b) => a.uberon.localeCompare(b.uberon)))
    L.push(`${r.uberon}\t${r.label}\t${r.fma}\t${r.confidence}\t${r.via || 'none'}\t${r.inRepo}`)
  writeFileSync(OUT, L.join('\n') + '\n')
  console.log(`\nwrote ${OUT} (${rows.length} rows)`)
  return 0
}

process.exit(await main())
