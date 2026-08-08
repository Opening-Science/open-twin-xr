#!/usr/bin/env node
/**
 * Write the attribution into a GLB's own `asset.copyright` field.
 *
 *   node scripts/set-copyright.mjs <glb> "<copyright string>"
 *
 * WHY THE ASSET AND NOT JUST THE UI
 * ---------------------------------
 * Every licence in this repository requires attribution, and a credit rendered
 * only in the interface travels exactly as far as the interface does. A GLB
 * handed to someone else — dropped into Blender, re-hosted, embedded in another
 * viewer — carries its terms with it only if they are inside the file.
 * `build-bodyparts3d.mjs` and `build-z-anatomy.mjs` both set this at build time
 * for that reason, and `check:licences` reads it back: an asset with no
 * `copyright` is reported as **NO CREDIT**, loudly, in `docs/LICENCE_LOG.md`.
 *
 * This exists because the ANNY bake is the one asset produced by a tool that
 * cannot set it. `trimesh.export()` writes a minimal glTF asset block with no
 * copyright field, so the envelopes arrived uncredited and the licence log said
 * so — correctly. Rather than special-case them in the register, the pipeline
 * writes the notice, which is what Apache-2.0 notice retention actually asks for.
 *
 * ⚠️ EDITS THE JSON CHUNK IN PLACE, byte-exactly. GLB chunks are 4-byte aligned
 * and the header carries both a total length and a per-chunk length, so a naive
 * string substitution corrupts the file — silently, because the JSON still
 * parses if the padding happens to work out. The rewrite below recomputes all
 * three lengths and re-pads with spaces (0x20), which is what the spec requires
 * for the JSON chunk.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [path, copyright] = process.argv.slice(2)
if (!path || !copyright) {
  console.error('Usage: node scripts/set-copyright.mjs <glb> "<copyright>"')
  process.exit(1)
}

const buf = readFileSync(path)
if (buf.readUInt32LE(0) !== 0x46546c67) {
  console.error(`${path}: not a GLB (bad magic)`)
  process.exit(1)
}

const jsonLen = buf.readUInt32LE(12)
const jsonType = buf.readUInt32LE(16)
if (jsonType !== 0x4e4f534a) {
  console.error(`${path}: first chunk is not JSON`)
  process.exit(1)
}

const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'))
json.asset = json.asset ?? {}
json.asset.copyright = copyright

// Re-encode and pad to a 4-byte boundary with SPACES, per the glTF spec.
let out = Buffer.from(JSON.stringify(json), 'utf8')
const pad = (4 - (out.length % 4)) % 4
if (pad) out = Buffer.concat([out, Buffer.alloc(pad, 0x20)])

const rest = buf.subarray(20 + jsonLen) // every chunk after the JSON one
const header = Buffer.alloc(20)
header.writeUInt32LE(0x46546c67, 0) // magic
header.writeUInt32LE(2, 4) // version
header.writeUInt32LE(20 + out.length + rest.length, 8) // total length
header.writeUInt32LE(out.length, 12) // json chunk length
header.writeUInt32LE(0x4e4f534a, 16) // json chunk type

writeFileSync(path, Buffer.concat([header, out, rest]))
console.log(`${path}: copyright set (${out.length} B JSON, ${rest.length} B payload)`)
