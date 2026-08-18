#!/usr/bin/env node
/**
 * Anatomical definitions for the structures this app can name, keyed by
 * ONTOLOGY TERM.
 *
 *   node scripts/build-definitions.mjs --measure   # what would resolve? writes nothing
 *   node scripts/build-definitions.mjs             # build public/data/definitions.json
 *
 * WHY THIS EXISTS. The app can already tell you a structure is `FMA:7163`. That
 * is an identifier, not an answer — a viewer who does not already know what the
 * structure is learns nothing from it. Z-Anatomy's viewer shows a definition per
 * structure and it is the thing their interface does that ours did not.
 *
 * ⚠️ KEYED BY TERM, NOT BY NAME, AND THAT IS THE WHOLE DESIGN. Z-Anatomy's
 * definitions are name-keyed, which means a rename or a rebuild silently breaks
 * the join. Structure ids are positional and names drift; an FMA or UBERON CURIE
 * is stable across atlases and across rebuilds, so a definition fetched once
 * stays attached to the right structure — and the same file serves EVERY atlas,
 * because a term means the same thing in all of them. This is the first
 * user-visible payoff of the ontology work (D18-D19).
 *
 * ⚠️ BUILT OFFLINE INTO A STATIC FILE, NEVER FETCHED AT RUNTIME. A visitor's
 * browser must talk to our host and nobody else — the Inter font was un-CDN'd
 * for exactly this reason (see `inter-font` in licences.json, and the German
 * ruling cited there). A live Wikipedia call per selection would reintroduce
 * that, and would also make the app's behaviour depend on someone else's
 * uptime.
 *
 * THE SOURCE IS WIKIPEDIA, VIA WIKIDATA. Wikidata records FMA (P1402) and UBERON
 * (P1554) ids on anatomical entities, so a CURIE resolves to an entity, and the
 * entity to an article. The text is CC BY-SA 4.0 — recorded in licences.json and
 * credited wherever it is shown, which is a licence condition and not a courtesy.
 *
 * ⚠️ EVERY EXTRACT IS RUN THROUGH THE CLAIMS LEXICON AND DROPPED IF IT TRIPS.
 * `npm run lint:claims` guards this repository's own copy against health-claim
 * creep (D8, D15); pulling in outside prose would be a hole straight through
 * that gate. Anatomical description is what we want — "the largest organ of the
 * body" — and clinical or diagnostic language is what we do not.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ MEASURED 18 AUGUST 2026: WIKIPEDIA IS THE WRONG SOURCE FOR THIS REPO.
 *
 * Run `--measure` before building on any of this. What it found, on the
 * shipped assets, is why the definitions feature is NOT wired into the app yet:
 *
 *     2,746 distinct terms          ->  396 resolve to an article  (14.4 %)
 *       z-anatomy.ao.glb  1,479     ->  115                        ( 8 %)
 *       bodyparts3d.ao.glb 1,295    ->  142                        (11 %)
 *       hra.ao.glb / hra-m.ao.glb   ->                             (39-43 %)
 *       htb-ct-003.glb       33     ->   30                        (91 %)
 *
 * The failure has a shape: Wikipedia has an article for "liver" and none for
 * "ureteric segment of left renal artery". Coverage collapses exactly where an
 * atlas is fine-grained, which is the half a viewer most needs explained. The
 * two default bodies are the two worst served.
 *
 * TWO FURTHER SOURCES WERE PROBED, and they split by vocabulary:
 *
 *   - UBERON: OLS4 (the EBI service `build-fma-uberon-bridge.mjs` already
 *     talks to) serves the ontology's OWN definitions — 51 % of a sample of
 *     HRA's terms, authored by anatomists rather than by an encyclopedia.
 *   - FMA: NOT on OLS4 in any usable form — 0 of 45 sampled Z-Anatomy terms
 *     and 1 of 45 BodyParts3D terms were present at all. FMA is published as
 *     one 208 MB OWL file by its authors at the University of Washington
 *     (http://purl.org/sig/ont/fma.owl), which is a build-time ingest, not an
 *     API call, and needs its licence read at source first.
 *
 * SO THE REVISED DESIGN IS ONTOLOGY-FIRST: UBERON definitions from OLS4, FMA
 * definitions from the OWL release, Wikipedia dropped rather than kept as a
 * fallback — a definition written by an anatomist for the term is better than
 * a general-audience lede, and it cannot drift from the term the way an
 * article can. Not built here yet; this file measures, and the Wikipedia path
 * below still runs so the measurement is reproducible end to end.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { lintClaims } from './claims/lexicon.mjs'

const require = createRequire(import.meta.url)
const { NodeIO } = require('@gltf-transform/core')
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions')
const { MeshoptDecoder } = require('meshoptimizer')

const ROOT = process.cwd()
const MEASURE_ONLY = process.argv.includes('--measure')
const LIMIT = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 0)
const MODELS = join(ROOT, 'public/models')
const OUT = join(ROOT, 'public/data/definitions.json')
const CACHE = join(ROOT, '.cache/definitions-wikidata.json')

/** Wikidata's identifier properties for the two vocabularies this repo speaks. */
const PROP = { FMA: 'P1402', UBERON: 'P1554' }

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })

/** Every CURIE any shipped asset carries, with the names that use it. */
async function collectTerms() {
  const terms = new Map()
  const files = existsSync(MODELS)
    ? (await import('node:fs')).readdirSync(MODELS).filter((f) => f.endsWith('.glb'))
    : []
  for (const f of files) {
    let doc
    try {
      doc = await io.read(join(MODELS, f))
    } catch {
      continue // an intermediate or a half-written file is not an error here
    }
    const scene = doc.getRoot().listScenes()[0]
    const rows = scene?.getExtras()?.structures ?? []
    for (const s of rows) add(terms, s?.ontologyid, s?.name, f)
    // Atlases without a structure table carry the term on the node instead.
    for (const n of doc.getRoot().listNodes()) {
      const ex = n.getExtras() ?? {}
      add(terms, ex.ontologyid, ex.label ?? n.getName(), f)
    }
  }
  return terms
}

const CURIE = /\b(UBERON|FMA)[:_]?(\d+)\b/i
function add(map, raw, name, file) {
  if (typeof raw !== 'string') return
  const m = CURIE.exec(raw)
  if (!m) return
  const key = `${m[1].toUpperCase()}:${m[2]}`
  const e = map.get(key) ?? { names: new Set(), files: new Set() }
  if (name) e.names.add(String(name))
  e.files.add(file)
  map.set(key, e)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Fetch JSON from a public Wikimedia endpoint, politely.
 *
 * ⚠️ THESE ARE FREE SERVICES AND THEY RATE-LIMIT. The first run of this script
 * took a 429 on its second SPARQL batch. So: one descriptive User-Agent with a
 * contact route (Wikimedia asks for it), a pause between calls, and a backoff
 * that honours `Retry-After` when the server sends one. The alternative — retry
 * immediately in a loop — is how a build script gets an IP blocked.
 */
async function getJSON(url, accept) {
  const headers = {
    Accept: accept,
    'User-Agent': 'open-twin-xr/1.0 (https://github.com/Opening-Science/open-twin-xr)',
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(url, { headers })
    if (r.ok) return r.json()
    if (r.status === 404) return null
    if (r.status === 429 || r.status >= 500) {
      const after = Number(r.headers.get('retry-after'))
      const wait = Number.isFinite(after) && after > 0 ? after * 1000 : 2000 * 2 ** attempt
      process.stderr.write(`  ${r.status}; waiting ${Math.round(wait / 1000)}s\n`)
      await sleep(wait)
      continue
    }
    throw new Error(`${r.status} from ${url.slice(0, 80)}`)
  }
  throw new Error(`gave up after 5 attempts: ${url.slice(0, 80)}`)
}

/** Wikidata SPARQL: CURIEs -> entity + English article title, in batches. */
async function resolve(terms, cache) {
  const todo = [...terms.keys()].filter((t) => !(t in cache))
  const batches = []
  for (let i = 0; i < todo.length; i += 120) batches.push(todo.slice(i, i + 120))

  for (const [i, batch] of batches.entries()) {
    const byProp = { FMA: [], UBERON: [] }
    for (const t of batch) {
      const [pre, num] = t.split(':')
      byProp[pre]?.push(num)
    }
    const clauses = Object.entries(byProp)
      .filter(([, ids]) => ids.length)
      .map(
        ([pre, ids]) =>
          `{ VALUES ?id { ${ids.map((n) => `"${n}"`).join(' ')} } ` +
          `?item wdt:${PROP[pre]} ?id . BIND("${pre}" AS ?vocab) }`,
      )
      .join(' UNION ')

    const query = `SELECT ?id ?vocab ?item ?article WHERE { ${clauses}
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . } }`

    const url =
      'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query)
    const json = await getJSON(url, 'application/sparql-results+json')
    // Cache what has been learned SO FAR, so a rate-limit or a Ctrl-C costs the
    // current batch and not the whole run.
    mkdirSync(dirname(CACHE), { recursive: true })
    writeFileSync(CACHE, JSON.stringify(cache, null, 2))

    for (const t of batch) cache[t] = null // absence is a result, and is cached
    for (const b of json.results.bindings) {
      const key = `${b.vocab.value}:${b.id.value}`
      const title = b.article?.value
        ? decodeURIComponent(b.article.value.split('/wiki/')[1] ?? '').replace(/_/g, ' ')
        : null
      if (!title) continue
      cache[key] = { title, url: b.article.value }
    }
    process.stderr.write(`  wikidata batch ${i + 1}/${batches.length}\r`)
    if (i < batches.length - 1) await sleep(1200)
  }
  return cache
}

/** The lede of an article, trimmed to something a card can hold. */
async function summarise(title) {
  const url =
    'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_'))
  const j = await getJSON(url, 'application/json')
  if (!j) return null
  const text = String(j.extract ?? '').trim()
  if (!text) return null
  // Two sentences is a definition; a paragraph is an article. Cut on sentence
  // boundaries so the text never ends mid-clause.
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [text]
  let out = ''
  for (const s of sentences) {
    if (out && (out + s).length > 400) break
    out += s
    if (out.length > 240) break
  }
  return out.trim() || null
}

const terms = await collectTerms()
if (!terms.size) {
  console.error('✗ no ontology terms found in public/models — install an atlas first')
  process.exit(1)
}

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {}
await resolve(terms, cache)
mkdirSync(dirname(CACHE), { recursive: true })
writeFileSync(CACHE, JSON.stringify(cache, null, 2))

const resolved = [...terms.keys()].filter((t) => cache[t]?.title)
console.log(`\nterms carried by shipped assets : ${terms.size.toLocaleString()}`)
console.log(
  `  resolve to a Wikipedia article  : ${resolved.length.toLocaleString()}` +
    ` (${((resolved.length / terms.size) * 100).toFixed(1)} %)`,
)

/** Per-atlas coverage, because one number hides which body is served. */
const byFile = new Map()
for (const [t, e] of terms) {
  for (const f of e.files) {
    const c = byFile.get(f) ?? { total: 0, hit: 0 }
    c.total++
    if (cache[t]?.title) c.hit++
    byFile.set(f, c)
  }
}
for (const [f, c] of [...byFile].sort((a, b) => b[1].total - a[1].total)) {
  console.log(
    `    ${f.padEnd(28)} ${String(c.hit).padStart(5)} / ${String(c.total).padEnd(5)}` +
      ` ${((c.hit / c.total) * 100).toFixed(0)} %`,
  )
}

if (MEASURE_ONLY) {
  console.log('\n--measure: nothing written. Drop the flag to fetch extracts and build.')
  process.exit(0)
}

const out = {}
let dropped = 0
let empty = 0
const wanted = LIMIT ? resolved.slice(0, LIMIT) : resolved
for (const [i, term] of wanted.entries()) {
  const { title, url } = cache[term]
  const text = await summarise(title)
  if (!text) {
    empty++
    continue
  }
  // The claims gate, applied to text this repository did not write.
  const trips = lintClaims(text)
  if (trips.length) {
    dropped++
    continue
  }
  out[term] = { text, title, url, lang: 'en' }
  if ((i + 1) % 50 === 0) process.stderr.write(`  extracts ${i + 1}/${wanted.length}\r`)
}

const payload = {
  $meta: {
    source: 'Wikipedia, resolved from FMA/UBERON identifiers via Wikidata',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    note:
      'Built by scripts/build-definitions.mjs. Each entry carries the article it came ' +
      'from; attribution is rendered wherever the text is shown. Extracts that trip ' +
      "this repository's claims lexicon are dropped rather than displayed.",
    terms: terms.size,
    resolved: resolved.length,
    written: Object.keys(out).length,
    droppedByClaimsLint: dropped,
    noExtract: empty,
  },
  definitions: out,
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(payload, null, 1))
console.log(
  `\n✓ ${Object.keys(out).length.toLocaleString()} definitions -> ${OUT}` +
    `  (${dropped} dropped by the claims lint, ${empty} with no extract)`,
)
