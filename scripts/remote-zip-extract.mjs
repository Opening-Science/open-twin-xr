#!/usr/bin/env node
/**
 * Extract named members from a remote ZIP over range requests.
 *
 *   node scripts/remote-zip-extract.mjs <url> <index.json> <outDir> <nameRegex> [maxMB]
 *
 * Pairs with `remote-zip-index.mjs`. Handles both STORED and DEFLATE members, and
 * reads each member's own local header rather than trusting the central
 * directory's lengths, because the two are allowed to differ.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import { basename, join } from 'node:path'

const U = process.argv[2]
const dirJson = process.argv[3]
const outDir = process.argv[4]
const pattern = new RegExp(process.argv[5], 'i')
const maxMB = Number(process.argv[6] ?? '1e9')

const dir = JSON.parse(await (await import('node:fs/promises')).readFile(dirJson, 'utf8'))
mkdirSync(outDir, { recursive: true })

async function range(lo, hi) {
  const r = await fetch(U, { headers: { Range: `bytes=${lo}-${hi}` } })
  if (!r.ok && r.status !== 206) throw new Error(`HTTP ${r.status}`)
  return Buffer.from(await r.arrayBuffer())
}

for (const f of dir) {
  if (!pattern.test(f.name)) continue
  if (f.usize / 1e6 > maxMB) { console.log(`skip (too big) ${f.name}`); continue }
  // Local header: 30 fixed bytes, then name, then extra. Its lengths can differ
  // from the central directory's, so read them here rather than reusing those.
  const head = await range(f.localOff, f.localOff + 29)
  const nameLen = head.readUInt16LE(26)
  const extraLen = head.readUInt16LE(28)
  const dataAt = f.localOff + 30 + nameLen + extraLen
  const raw = await range(dataAt, dataAt + f.csize - 1)
  const bytes = f.method === 0 ? raw : inflateRawSync(raw)
  const out = join(outDir, basename(f.name).replace(/\s+/g, '_'))
  writeFileSync(out, bytes)
  console.log(`${(bytes.length / 1e6).toFixed(2).padStart(8)} MB  ${out}`)
}
