#!/usr/bin/env node
/**
 * Write FMA terms from `docs/z-anatomy-fma.tsv` into a built asset's structure
 * table, without rebuilding it.
 *
 * ⚠️ WHY THIS EXISTS RATHER THAN A REBUILD. An ontology term is metadata: it
 * belongs to the structure TABLE, which lives in the glTF JSON chunk, and it
 * says nothing about geometry. Regenerating the asset to add one field would
 * cost a ~52 min AO bake and — the real objection — would push every vertex back
 * through simplify, weld and quantise, each of which is documented in
 * `docs/HANDOVER.md` as able to corrupt `_STRUCTURE` ids *without failing
 * loudly*. Paying that risk to add a string is a bad trade.
 *
 * So this edits the JSON chunk and copies the BIN chunk through byte for byte.
 * Geometry is not decoded, not re-encoded, not touched. `check:structures` after
 * a run should be identical to before it, and that is the point.
 *
 *   node scripts/apply-crosswalk.mjs public/models/z-anatomy.ao.glb
 *   node scripts/apply-crosswalk.mjs public/models/z-anatomy.ao.glb --dry-run
 */
import { readFileSync, writeFileSync, renameSync } from 'node:fs'

const args = process.argv.slice(2)
const DRY = args.includes('--dry-run')
const flag = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}
/**
 * Which crosswalk, into which field. Defaulting to the FMA pair keeps every
 * existing invocation and every doc line working unchanged; D24's Latin
 * nomenclature is the second caller.
 */
const TSV = flag('--tsv', 'docs/z-anatomy-fma.tsv')
const FIELD = flag('--field', 'ontologyid')
const targets = args.filter(
  (a, i) => !a.startsWith('--') && !['--tsv', '--field'].includes(args[i - 1]),
)

if (!targets.length) {
  console.error(
    'usage: node scripts/apply-crosswalk.mjs <asset.glb> [...] [--tsv FILE] [--field NAME] [--dry-run]',
  )
  process.exit(1)
}

/**
 * The crosswalk, keyed exactly as the structure table is.
 *
 * ⚠️ READ BY HEADER, NOT BY COLUMN POSITION. This used to destructure
 * `[name, side, fma]`, which silently binds to whatever the third column
 * happens to be — the FMA file carries `system` and `layer` after it, and a
 * second crosswalk with a different shape would have written the wrong string
 * into the asset with no error at all. The header names the value column.
 */
const lines = readFileSync(TSV, 'utf8').split('\n').filter((l) => l && !l.startsWith('#'))
const header = lines[0].split('\t').map((h) => h.trim())
const nameCol = header.indexOf('name')
const sideCol = header.indexOf('side')
const valueCol = header.findIndex((h) => h === FIELD || (FIELD === 'ontologyid' && h === 'fma'))
if (nameCol < 0 || sideCol < 0 || valueCol < 0) {
  console.error(
    `✗ ${TSV}: need columns name, side and a value column for --field ${FIELD}; header is [${header.join(', ')}]`,
  )
  process.exit(1)
}
const crosswalk = new Map()
for (const line of lines.slice(1)) {
  const cells = line.split('\t')
  const name = cells[nameCol]
  const value = cells[valueCol]
  if (name && value) crosswalk.set(`${name}|${cells[sideCol] || ''}`, value.trim())
}
console.log(
  `crosswalk: ${crosswalk.size.toLocaleString()} values from ${TSV} -> ${FIELD}`,
)

/** Split a GLB into its header, JSON chunk and everything after it. */
function readGlb(path) {
  const buf = readFileSync(path)
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB')
  const jsonLen = buf.readUInt32LE(12)
  if (buf.readUInt32LE(16) !== 0x4e4f534a) throw new Error('first chunk is not JSON')
  return {
    json: JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8')),
    // Everything from the BIN chunk header onwards, carried through untouched.
    rest: buf.slice(20 + jsonLen),
  }
}

/** Reassemble a GLB from a modified JSON chunk and an untouched remainder. */
function writeGlb(path, json, rest) {
  let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8')
  // The JSON chunk must be padded to a 4-byte boundary with SPACES (0x20), not
  // zeros — a zero-padded JSON chunk is malformed and some loaders reject it.
  const pad = (4 - (jsonBuf.length % 4)) % 4
  if (pad) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(pad, 0x20)])

  const header = Buffer.alloc(20)
  header.writeUInt32LE(0x46546c67, 0) // 'glTF'
  header.writeUInt32LE(2, 4) // version
  header.writeUInt32LE(12 + 8 + jsonBuf.length + rest.length, 8) // total length
  header.writeUInt32LE(jsonBuf.length, 12)
  header.writeUInt32LE(0x4e4f534a, 16) // 'JSON'

  // Write beside the target then rename, so an interrupted run cannot leave a
  // half-written atlas in place of a good one.
  const tmp = `${path}.tmp`
  writeFileSync(tmp, Buffer.concat([header, jsonBuf, rest]))
  renameSync(tmp, path)
}

for (const path of targets) {
  const { json, rest } = readGlb(path)
  const scene = json.scenes?.[json.scene ?? 0]
  const table = scene?.extras?.structures
  if (!Array.isArray(table)) {
    console.log(`\n${path}\n  no structure table — skipped`)
    continue
  }

  let added = 0
  let already = 0
  let missing = 0
  for (const s of table) {
    // Attachment sites are named for their muscle and are not structures in
    // their own right; they inherit whatever the muscle resolves to.
    if (s.attachment) continue
    const term = crosswalk.get(`${s.name}|${s.side ?? ''}`)
    if (!term) {
      missing++
      continue
    }
    if (s[FIELD] === term) already++
    else {
      s[FIELD] = term
      added++
    }
  }

  console.log(`\n${path}`)
  console.log(`  ${table.length.toLocaleString()} table entries`)
  // The field is a parameter now, so the wording follows it — a run that writes
  // Latin names must not report "gained an FMA term".
  const what = FIELD === 'ontologyid' ? 'an FMA term' : `a ${FIELD}`
  console.log(`  + ${added.toLocaleString()} gained ${what}`)
  if (already) console.log(`  = ${already.toLocaleString()} already had it`)
  console.log(`  · ${missing.toLocaleString()} have none (no exact match — never guessed)`)

  if (DRY) console.log('  (dry run — nothing written)')
  else if (added) {
    writeGlb(path, json, rest)
    console.log(`  wrote ${path} — JSON chunk only, geometry copied verbatim`)
  } else console.log('  nothing to change')
}
