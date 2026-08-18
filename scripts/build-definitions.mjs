#!/usr/bin/env node
/**
 * Anatomical definitions for the structures this app can name, keyed by
 * ONTOLOGY TERM.
 *
 *   node scripts/build-definitions.mjs --measure   # coverage only, writes nothing
 *   node scripts/build-definitions.mjs             # build public/data/definitions.json
 *
 * WHY THIS EXISTS. The app can already tell you a structure is `FMA:7163`. That
 * is an identifier, not an answer — a viewer who does not already know what the
 * structure is learns nothing from it.
 *
 * ⚠️ KEYED BY TERM, NOT BY NAME, AND THAT IS THE WHOLE DESIGN. Z-Anatomy's
 * definitions are name-keyed, so a rename or a rebuild silently breaks the join.
 * Structure ids are positional and names drift; an FMA or UBERON CURIE is stable
 * across atlases and across rebuilds, so one file serves EVERY atlas here — a
 * term means the same thing in all of them. This is the first user-visible
 * payoff of the ontology work (D18-D19).
 *
 * ⚠️ BUILT OFFLINE INTO A STATIC FILE, NEVER FETCHED AT RUNTIME. A visitor's
 * browser must talk to our host and nobody else — the Inter font was un-CDN'd
 * for exactly this reason (see `inter-font` in licences.json and the German
 * ruling cited there).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ THE SOURCE IS THE ONTOLOGIES THEMSELVES, AND THE FIRST ATTEMPT WAS WRONG.
 *
 * This script first resolved terms to Wikipedia articles via Wikidata. Measured
 * on the shipped assets, that reached 396 of 2,746 terms — 14.4 %, and only
 * 8 % of Z-Anatomy, 11 % of BodyParts3D. The failure had a shape: Wikipedia has
 * an article for "liver" and none for "ureteric segment of left renal artery",
 * so coverage collapsed exactly where an atlas is fine-grained, and the two
 * default bodies were the two worst served.
 *
 * The ontologies define their own terms, by construction. So:
 *
 *   UBERON -> OLS4 (the EBI service scripts/build-fma-uberon-bridge.mjs already
 *             talks to), which serves each term's own definition.
 *   FMA    -> NOT on OLS4 in any usable form (0 of 45 sampled Z-Anatomy terms).
 *             Its authors publish it as one OWL release, and the `definition`
 *             annotation is right there on the class.
 *
 * A definition written for the term cannot drift from the term the way an
 * article can, and it is written by anatomists rather than for a general
 * audience. Wikipedia is dropped rather than kept as a fallback.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * LICENCES, both read at source rather than from a summary (18 August 2026):
 *   - FMA 5.1.0: the release ships a LICENSE file that is the full CC BY 4.0
 *     text. ⚠️ Secondary sources say "CC BY 3.0"; the release itself says 4.0.
 *     Structural Informatics Group, University of Washington.
 *   - UBERON: CC BY 3.0, per the ontology's own metadata.
 * Both are attribution-only. Recorded in licences.json, rendered where the text
 * is shown, which is a condition and not a courtesy.
 *
 * ⚠️ EVERY DEFINITION IS RUN THROUGH THE CLAIMS LEXICON AND DROPPED IF IT TRIPS.
 * `npm run lint:claims` guards this repository's own copy against health-claim
 * creep (D8, D15); ingesting outside prose would be a hole straight through that
 * gate. Anatomical description is wanted; clinical or diagnostic language is not.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, createReadStream } from 'node:fs'
import { join, dirname } from 'node:path'
import { createInterface } from 'node:readline'
import { createRequire } from 'node:module'
import { lintClaims } from './claims/lexicon.mjs'

const require = createRequire(import.meta.url)
const { NodeIO } = require('@gltf-transform/core')
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions')
const { MeshoptDecoder } = require('meshoptimizer')

const ROOT = process.cwd()
const MEASURE_ONLY = process.argv.includes('--measure')
const MODELS = join(ROOT, 'public/models')
const OUT = join(ROOT, 'public/data/definitions.json')
const FMA_OWL = join(ROOT, '.cache/fma.owl')
const FMA_URL = 'http://sig.biostr.washington.edu/share/downloads/fma/release/latest/fma.owl'
const OLS_CACHE = join(ROOT, '.cache/ols4-definitions.json')
const OLS = 'https://www.ebi.ac.uk/ols4/api/ontologies/uberon/terms'

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const CURIE = /\b(UBERON|FMA)[:_]?(\d+)\b/i

/** Every CURIE any shipped asset carries, and which files carry it. */
async function collectTerms() {
  const terms = new Map()
  const add = (raw, file) => {
    if (typeof raw !== 'string') return
    const m = CURIE.exec(raw)
    if (!m) return
    const key = `${m[1].toUpperCase()}:${m[2]}`
    const e = terms.get(key) ?? new Set()
    e.add(file)
    terms.set(key, e)
  }
  const { readdirSync } = await import('node:fs')
  const files = existsSync(MODELS)
    ? readdirSync(MODELS).filter((f) => f.endsWith('.glb') && !/\.(raw|opt|stripped)\./.test(f))
    : []
  for (const f of files) {
    let doc
    try {
      doc = await io.read(join(MODELS, f))
    } catch {
      continue // an intermediate or half-written file is not an error here
    }
    for (const s of doc.getRoot().listScenes()[0]?.getExtras()?.structures ?? [])
      add(s?.ontologyid, f)
    for (const n of doc.getRoot().listNodes()) add(n.getExtras()?.ontologyid, f)
  }
  return terms
}

/**
 * FMA definitions, streamed out of the OWL release.
 *
 * ⚠️ STREAMED, NEVER PARSED AS A DOM. The file is 208 MB of RDF/XML; loading it
 * would need most of a gigabyte of heap for a job that is really "read two
 * fields per class". A line reader accumulating one class block at a time is
 * flat in memory and takes seconds.
 */
async function fmaDefinitions(wanted) {
  if (!existsSync(FMA_OWL)) {
    console.error(
      `✗ ${FMA_OWL} is missing. Fetch it once (~208 MB, CC BY 4.0):\n` +
        `    mkdir -p .cache && curl -o .cache/fma.owl ${FMA_URL}`,
    )
    process.exit(1)
  }
  const out = new Map()
  const rl = createInterface({ input: createReadStream(FMA_OWL), crlfDelay: Infinity })
  let id = null
  let label = null
  let def = null
  let inClass = false
  const strip = (s) =>
    s
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .trim()

  for await (const line of rl) {
    if (line.includes('<owl:Class ')) {
      inClass = true
      id = null
      label = null
      def = null
    }
    if (!inClass) continue
    if (id === null) {
      const m = /<fma:FMAID[^>]*>(\d+)</.exec(line)
      if (m) id = `FMA:${m[1]}`
    }
    if (label === null) {
      const m = /<rdfs:label[^>]*>([^<]+)</.exec(line)
      if (m) label = strip(m[1])
    }
    if (def === null && line.includes('<fma:definition')) {
      // The definition sits in a nested <fma:name>/<fma:value> pair or inline.
      const m = /<fma:definition[^>]*>([\s\S]*?)<\/fma:definition>/.exec(line)
      if (m) def = strip(m[1])
      else def = '' // opened on this line; the value arrives below
    } else if (def === '' && !line.includes('</fma:definition')) {
      const v = strip(line)
      if (v && !v.startsWith('<')) def = v
    }
    if (line.includes('</owl:Class>')) {
      inClass = false
      if (id && def && wanted.has(id)) out.set(id, { text: def, label })
    }
  }
  return out
}

/**
 * The definition among OLS4's `description` entries — which is not always the
 * first one.
 *
 * ⚠️ UBERON:0000948 (heart) is the case that caught this: entry 0 is
 * `Taxon notes:" the ascidian tube-like heart lacks chambers..."` and entry 1 is
 * the actual definition. Taking [0] put a note about sea squirts under the human
 * heart, which is both wrong and absurd on a page about a person's body. Cross-
 * species notes are UBERON doing its job — it is a multi-species ontology — but
 * they are not what a viewer of a human atlas asked for.
 */
function pickDefinition(descriptions) {
  const all = (descriptions ?? []).map((d) => String(d).trim()).filter(Boolean)
  const isNote = (d) => /^(taxon notes?|note|comment|editor note)\b/i.test(d)
  const best = all.find((d) => !isNote(d))
  if (!best) return ''
  // A definition that trails into a note keeps only the definition.
  return best.split(/\s*Taxon notes?:/i)[0].trim()
}

/** UBERON definitions, one term at a time from OLS4, cached on disk. */
async function uberonDefinitions(ids) {
  const cache = existsSync(OLS_CACHE) ? JSON.parse(readFileSync(OLS_CACHE, 'utf8')) : {}
  const todo = ids.filter((i) => !(i in cache))
  for (const [n, id] of todo.entries()) {
    const url = `${OLS}?obo_id=${encodeURIComponent(id)}&size=1`
    let got = null
    for (let a = 0; a < 4 && got === null; a++) {
      const r = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'open-twin-xr/1.0 (https://github.com/Opening-Science/open-twin-xr)',
        },
      })
      if (r.status === 429 || r.status >= 500) {
        await sleep(1500 * (a + 1))
        continue
      }
      if (!r.ok) break
      const t = (await r.json())?._embedded?.terms?.[0]
      got = t ? { text: pickDefinition(t.description), label: t.label } : false
      if (got && !got.text) got = false
    }
    cache[id] = got === null ? false : got
    if ((n + 1) % 25 === 0) {
      mkdirSync(dirname(OLS_CACHE), { recursive: true })
      writeFileSync(OLS_CACHE, JSON.stringify(cache, null, 1))
      process.stderr.write(`  uberon ${n + 1}/${todo.length}\r`)
    }
    await sleep(150)
  }
  mkdirSync(dirname(OLS_CACHE), { recursive: true })
  writeFileSync(OLS_CACHE, JSON.stringify(cache, null, 1))
  return new Map(Object.entries(cache).filter(([, v]) => v && v.text))
}

const terms = await collectTerms()
if (!terms.size) {
  console.error('✗ no ontology terms found in public/models — install an atlas first')
  process.exit(1)
}
const fmaWanted = new Set([...terms.keys()].filter((t) => t.startsWith('FMA:')))
const uberonWanted = [...terms.keys()].filter((t) => t.startsWith('UBERON:'))

console.log(`terms carried by shipped assets : ${terms.size.toLocaleString()}`)
console.log(`  FMA ${fmaWanted.size.toLocaleString()}   UBERON ${uberonWanted.length.toLocaleString()}`)

const fma = await fmaDefinitions(fmaWanted)
console.log(`  FMA definitions found    : ${fma.size.toLocaleString()} / ${fmaWanted.size.toLocaleString()}`)
const uberon = await uberonDefinitions(uberonWanted)
console.log(`  UBERON definitions found : ${uberon.size.toLocaleString()} / ${uberonWanted.length.toLocaleString()}`)

/** Per-asset coverage, because one number hides which body is served. */
const has = (t) => fma.has(t) || uberon.has(t)
const byFile = new Map()
for (const [t, files] of terms)
  for (const f of files) {
    const c = byFile.get(f) ?? { total: 0, hit: 0 }
    c.total++
    if (has(t)) c.hit++
    byFile.set(f, c)
  }
console.log('\n  per shipped asset:')
for (const [f, c] of [...byFile].sort((a, b) => b[1].total - a[1].total))
  console.log(
    `    ${f.padEnd(26)} ${String(c.hit).padStart(5)} / ${String(c.total).padEnd(5)}` +
      ` ${((c.hit / c.total) * 100).toFixed(0)} %`,
  )

if (MEASURE_ONLY) {
  console.log('\n--measure: nothing written.')
  process.exit(0)
}

const defs = {}
let dropped = 0
for (const [source, map, licence] of [
  ['FMA 5.1.0 (Structural Informatics Group, University of Washington)', fma, 'CC BY 4.0'],
  ['UBERON', uberon, 'CC BY 3.0'],
]) {
  for (const [term, v] of map) {
    if (defs[term]) continue // FMA first: it is the vocabulary both big atlases speak
    if (lintClaims(v.text).length) {
      dropped++
      continue
    }
    defs[term] = { text: v.text, label: v.label ?? null, source, licence }
  }
}

const payload = {
  $meta: {
    note:
      'Definitions are the ontologies\' own, keyed by CURIE so they survive an asset ' +
      'rebuild. Built by scripts/build-definitions.mjs; attribution is rendered ' +
      'wherever the text is shown. Definitions tripping this repository\'s claims ' +
      'lexicon are dropped rather than displayed.',
    sources: [
      {
        name: 'Foundational Model of Anatomy 5.1.0',
        holder: 'Structural Informatics Group, University of Washington',
        licence: 'CC BY 4.0',
        url: 'http://si.washington.edu/projects/fma',
      },
      {
        name: 'Uberon multi-species anatomy ontology',
        holder: 'the Uberon consortium',
        licence: 'CC BY 3.0',
        url: 'https://obophenotype.github.io/uberon/',
      },
    ],
    terms: terms.size,
    written: Object.keys(defs).length,
    droppedByClaimsLint: dropped,
  },
  definitions: defs,
}
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(payload, null, 1))
console.log(
  `\n✓ ${Object.keys(defs).length.toLocaleString()} definitions -> ${OUT}` +
    ` (${dropped} dropped by the claims lint)`,
)
