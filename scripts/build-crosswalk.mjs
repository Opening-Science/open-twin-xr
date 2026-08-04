#!/usr/bin/env node
/**
 * Z-Anatomy structure name -> FMA term, via BodyParts3D.
 *
 * ⚠️ THE SHORTCUT THAT MAKES THIS TRACTABLE: Z-Anatomy IS BodyParts3D,
 * retopologised by medical illustrators (D11). They are the same donor and the
 * same structure set, so their names should correspond — which turns "build a
 * 1,800-row ontology crosswalk by hand" into "join two lists that already
 * describe the same body".
 *
 * BodyParts3D carries an FMA id on every structure. Z-Anatomy carries none, and
 * D11 records that gap as the reason the ontology join is outstanding. This
 * closes it for the largest atlas without inventing a single term.
 *
 * FMA rather than UBERON deliberately. FMA is what BodyParts3D already uses and
 * what `anatomySources.ts` declares for both atlases, so a matched term is
 * immediately usable and immediately consistent. Going on to UBERON needs an
 * FMA->UBERON mapping, which is a separate network-fetched artifact and a
 * separate decision — see the note at the end of the run.
 *
 * ⚠️ EXACT MATCHES ONLY, AFTER NORMALISATION. No fuzzy matching, no edit
 * distance, no "closest label". A wrong ontology id is worse than a missing one:
 * missing is visibly missing, wrong is silently wrong and will be trusted. Every
 * name that does not match exactly is reported unmatched and left alone.
 *
 *   node scripts/build-crosswalk.mjs                  # report only
 *   node scripts/build-crosswalk.mjs --write          # write docs/z-anatomy-fma.tsv
 */
import { readFileSync, writeFileSync, openSync, readSync, closeSync } from 'node:fs'

const WRITE = process.argv.includes('--write')
const OUT = 'docs/z-anatomy-fma.tsv'

/** Read a GLB's scene extras without decoding its buffers. */
function sceneExtras(path) {
  const fd = openSync(path, 'r')
  const head = Buffer.alloc(20)
  readSync(fd, head, 0, 20, 0)
  const len = head.readUInt32LE(12)
  const json = Buffer.alloc(len)
  readSync(fd, json, 0, len, 20)
  closeSync(fd)
  const g = JSON.parse(json.toString('utf8'))
  return g.scenes?.[g.scene ?? 0]?.extras ?? {}
}

/**
 * Reduce a name to what both atlases agree on.
 *
 * The two differ in punctuation, case and a handful of tissue nouns that one
 * spells out and the other omits — "Gracilis muscle" against "gracilis". They do
 * NOT differ in the anatomical term itself, which is why exact-after-normalising
 * is safe where fuzzy matching would not be.
 */
function norm(s) {
  return s
    .toLowerCase()
    .replace(/[_\-–—]/g, ' ')
    .replace(/[().,'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The same, with a trailing tissue noun removed. Applied to BOTH sides. */
function stripTissue(s) {
  return s.replace(/\s+(muscle|bone|ligament|tendon|nerve|artery|vein|cartilage)$/, '').trim()
}

/**
 * Split leading laterality out of a BodyParts3D label.
 *
 * ⚠️ The two atlases encode side DIFFERENTLY, and missing this is what made the
 * first attempt match 7 %. BodyParts3D puts it in the label — 974 of its 1,838
 * labels begin "left " or "right " — while Z-Anatomy strips it to a `side` field
 * and calls the structure "Tibia". So "Tibia" + side left has to be matched
 * against "left tibia", not against "tibia", which does not exist there.
 *
 * Side must be kept, not discarded: FMA gives the left and right tibia DIFFERENT
 * ids, so collapsing them would either pick one arbitrarily or throw both away
 * as ambiguous. Keyed by side instead.
 */
function splitSide(label) {
  // Laterality is not always leading: BodyParts3D writes "distal phalanx of
  // LEFT second toe" as well as "LEFT tibia", so it has to be lifted out from
  // wherever it sits rather than only from the front.
  const m = label.match(/(?:^|\s)(left|right)(?:\s|$)/)
  if (!m) return { side: 'none', rest: label }
  const rest = label.replace(/(?:^|\s)(left|right)(?=\s|$)/, ' ').replace(/\s+/g, ' ').trim()
  return { side: m[1], rest }
}

/**
 * Terminology the two atlases genuinely spell differently for the same thing.
 *
 * ⚠️ Kept SHORT and factual, and applied to both sides so it can only ever make
 * two names agree — never invent a structure. Each entry is a translation
 * difference, not a judgement: Z-Anatomy renders the Latin literally ("finger of
 * foot" for digitus pedis) where BodyParts3D uses the English clinical term.
 *
 * This is the one place fuzziness could creep in, so it is a fixed list rather
 * than a rule. If a pair is not obviously the same structure to an anatomist, it
 * does not belong here — leaving a structure termless is the safe failure.
 */
const SYNONYMS = [
  [/\bfinger of foot\b/g, 'toe'],
  [/\bfinger of hand\b/g, 'finger'],
  [/\bfirst toe\b/g, 'big toe'],
  [/\bvertebral column\b/g, 'spine'],
]

function synonymise(s) {
  let out = s
  for (const [re, to] of SYNONYMS) out = out.replace(re, to)
  return out.replace(/\s+/g, ' ').trim()
}

// --- BodyParts3D: label -> FMA -------------------------------------------
const byName = new Map()
const rows = readFileSync('docs/bodyparts3d-system-map.tsv', 'utf8').split('\n').slice(1)
let bpCount = 0
for (const line of rows) {
  const c = line.split('\t')
  if (c.length < 5) continue
  const [, , , fma, label] = c
  if (!fma || !label) continue
  bpCount++
  const term = fma.replace(/^FMA/, 'FMA:')
  const { side, rest } = splitSide(synonymise(norm(label)))
  for (const base of [rest, stripTissue(rest)]) {
    const k = `${side}|${base}`
    // A key that would map to TWO different terms is dropped rather than
    // arbitrated — an ambiguous term is not a term.
    if (!byName.has(k)) byName.set(k, term)
    else if (byName.get(k) !== term) byName.set(k, null)
  }
}
const ambiguous = [...byName.values()].filter((v) => v === null).length
console.log(`BodyParts3D: ${bpCount.toLocaleString()} labelled structures, ${byName.size.toLocaleString()} lookup keys (${ambiguous} dropped as ambiguous)`)

// --- Z-Anatomy: match ------------------------------------------------------
const structures = sceneExtras('public/models/z-anatomy.glb').structures ?? []
if (!structures.length) {
  console.error('public/models/z-anatomy.glb has no structure table — build it first.')
  process.exit(1)
}

const seen = new Map()
for (const s of structures) {
  // Attachment sites are named for their muscle and are not structures in their
  // own right; they inherit whatever the muscle resolves to.
  if (s.attachment) continue
  const key = `${s.name}|${s.side ?? 'none'}`
  if (!seen.has(key)) seen.set(key, s)
}

const matched = []
const unmatched = []
for (const [, s] of seen) {
  const name = s.name
  const n = synonymise(norm(name))
  // Z-Anatomy's own side, matched against the side embedded in the BP3D label.
  // Falls back to an unsided key for midline structures.
  const side = s.side ?? 'none'
  const term =
    byName.get(`${side}|${n}`) ??
    byName.get(`${side}|${stripTissue(n)}`) ??
    byName.get(`none|${n}`) ??
    byName.get(`none|${stripTissue(n)}`) ??
    null
  if (term) matched.push({ name, side: s.side, term, system: s.system, layer: s.layer })
  else unmatched.push({ name, system: s.system })
}

const pct = ((100 * matched.length) / seen.size).toFixed(1)
console.log(
  `Z-Anatomy: ${seen.size.toLocaleString()} distinct structures (attachment sites excluded)\n` +
    `  matched   ${matched.length.toLocaleString()} (${pct}%)\n` +
    `  unmatched ${unmatched.length.toLocaleString()}`,
)

const bySystem = {}
for (const m of matched) bySystem[m.system] = (bySystem[m.system] ?? 0) + 1
const missBySystem = {}
for (const m of unmatched) missBySystem[m.system] = (missBySystem[m.system] ?? 0) + 1
console.log('\nsystem            matched  unmatched')
for (const k of new Set([...Object.keys(bySystem), ...Object.keys(missBySystem)])) {
  console.log(`  ${k.padEnd(18)}${String(bySystem[k] ?? 0).padStart(6)}${String(missBySystem[k] ?? 0).padStart(11)}`)
}

console.log('\nsample unmatched (these stay termless — never guessed):')
for (const u of unmatched.slice(0, 12)) console.log('   ', u.name)

if (WRITE) {
  const tsv = [
    'name\tside\tfma\tsystem\tlayer',
    ...matched.map((m) => `${m.name}\t${m.side ?? ''}\t${m.term}\t${m.system}\t${m.layer ?? ''}`),
  ].join('\n')
  writeFileSync(OUT, tsv + '\n')
  console.log(`\nwrote ${OUT} — ${matched.length.toLocaleString()} rows`)
  console.log('Next: build-z-anatomy.mjs reads this and writes `ontologyid` into the structure table.')
} else {
  console.log('\n(report only — pass --write to emit the crosswalk)')
}
