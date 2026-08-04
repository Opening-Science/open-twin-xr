#!/usr/bin/env node
/**
 * Build a BodyParts3D atlas GLB for the twin.
 *
 * Takes the OBJ meshes from DBCLS's BodyParts3D distribution (CC BY 4.0),
 * keeps only the systems you ask for, tags every mesh with its FMA term and
 * resolved body system, normalises the whole thing into this project's
 * canonical frame, and writes a single GLB.
 *
 * The system for each mesh is NOT guessed here — it was resolved offline from
 * BodyParts3D's own IS-A and PART-OF trees and committed to
 * `docs/bodyparts3d-system-map.tsv`. See `docs/PERMISSIVE_ANATOMY.md` for how
 * that mapping was derived and why it needs both trees.
 *
 *   1. Download `isa_BP3D_4.0_obj_99.zip` from
 *      https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/
 *   2. Unzip it somewhere.
 *   3. node scripts/build-bodyparts3d.mjs --src <that dir>
 *   4. npm run convert:bodyparts3d
 *
 * Attribution is a licence condition and is written into the GLB's asset
 * copyright field as well as being rendered in-app by AttributionBar.
 */
import { createRequire } from 'node:module'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'

const require = createRequire(import.meta.url)
const { Document, NodeIO } = require('@gltf-transform/core')

const COPYRIGHT =
  'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International'

/* ---------------------------------------------------------------- args -- */

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const SRC = arg('src')
const MANIFEST = arg('manifest', 'docs/bodyparts3d-system-map.tsv')
const SYSTEMS = arg('systems', 'musculoskeletal').split(',').map((s) => s.trim())
const OUT = arg('out', 'public/models/bodyparts3d.glb')
/** Target standing height in metres; BodyParts3D ships in unknown units. */
const HEIGHT = Number(arg('height', '1.7'))

if (!SRC) {
  console.error(`Usage: node scripts/build-bodyparts3d.mjs --src <obj-dir> [options]

  --src <dir>        directory of BodyParts3D .obj files (required)
  --manifest <tsv>   default docs/bodyparts3d-system-map.tsv
  --systems <list>   comma-separated, default "musculoskeletal"
  --out <glb>        default public/models/bodyparts3d.glb
  --height <metres>  normalise standing height, default 1.7
`)
  process.exit(1)
}

/* ------------------------------------------------------------ manifest -- */

if (!existsSync(MANIFEST)) {
  console.error(`Manifest not found: ${MANIFEST}`)
  process.exit(1)
}
const wanted = new Map() // basename without extension -> {system, fma, label}
for (const line of readFileSync(MANIFEST, 'utf8').split('\n').slice(1)) {
  if (!line.trim()) continue
  const [file, system, layer, fma, label] = line.split('\t')
  if (!SYSTEMS.includes(system)) continue
  wanted.set(file.replace(/\.obj$/i, ''), { system, layer, fma, label: label ?? '' })
}
console.log(`manifest: ${wanted.size} meshes wanted for [${SYSTEMS.join(', ')}]`)
if (wanted.size === 0) {
  console.error('Nothing selected — check --systems against the manifest.')
  process.exit(1)
}

/* ------------------------------------------------------------ obj parse -- */

/**
 * Minimal OBJ reader. BodyParts3D ships plain triangulated meshes with `v` and
 * `f` and no materials, so a full parser would be dead weight — but polygons
 * with more than three vertices are fan-triangulated just in case, and negative
 * (relative) indices are handled because the format permits them.
 */
function parseObj(text) {
  const pos = []
  const idx = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('v ')) {
      const p = line.split(/\s+/)
      pos.push(+p[1], +p[2], +p[3])
    } else if (line.startsWith('f ')) {
      const verts = line
        .split(/\s+/)
        .slice(1)
        .map((tok) => {
          const v = parseInt(tok.split('/')[0], 10)
          return v < 0 ? pos.length / 3 + v : v - 1
        })
      for (let i = 1; i + 1 < verts.length; i++) idx.push(verts[0], verts[i], verts[i + 1])
    }
  }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) }
}

/* ------------------------------------------------------------- collect -- */

const files = readdirSync(SRC).filter((f) => /\.obj$/i.test(f))
console.log(`source: ${files.length} .obj files in ${SRC}`)

const parsed = []
let skipped = 0
for (const f of files) {
  const key = basename(f).replace(/\.obj$/i, '')
  const meta = wanted.get(key)
  if (!meta) {
    skipped++
    continue
  }
  const { pos, idx } = parseObj(readFileSync(join(SRC, f), 'utf8'))
  if (pos.length === 0 || idx.length === 0) {
    console.warn(`  empty mesh, skipping: ${f}`)
    continue
  }
  parsed.push({ key, meta, pos, idx })
}
console.log(`matched ${parsed.length}, ignored ${skipped} not in the selected systems`)

const missing = [...wanted.keys()].filter((k) => !parsed.some((p) => p.key === k))
if (missing.length) {
  // Loud, because a silently short atlas is the failure mode this project keeps
  // hitting — it renders fine and is simply incomplete.
  console.warn(
    `\n  WARNING: ${missing.length} manifest entries had no .obj in --src.` +
      `\n  First few: ${missing.slice(0, 8).join(', ')}` +
      `\n  Check you unzipped the full isa_BP3D_4.0_obj_99.zip.\n`,
  )
}
if (parsed.length === 0) process.exit(1)

/* ----------------------------------------------------------- transform -- */

// Measure before deciding anything: BodyParts3D's units and up-axis are not
// documented, so they are derived from the geometry rather than assumed.
const min = [Infinity, Infinity, Infinity]
const max = [-Infinity, -Infinity, -Infinity]
for (const { pos } of parsed) {
  for (let i = 0; i < pos.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      const v = pos[i + a]
      if (v < min[a]) min[a] = v
      if (v > max[a]) max[a] = v
    }
  }
}
const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
const longest = size.indexOf(Math.max(...size))
console.log(
  `bounds: [${min.map((v) => v.toFixed(1))}] .. [${max.map((v) => v.toFixed(1))}]  ` +
    `size ${size.map((v) => v.toFixed(1)).join(' x ')}  longest axis ${'XYZ'[longest]}`,
)

// A standing body's longest axis is its height. If that is Z, the data is Z-up
// (common for medical exports) and needs a -90 deg turn about X to reach the
// glTF/Y-up convention this scene uses.
const zUp = longest === 2
const scale = HEIGHT / size[longest]
console.log(
  zUp
    ? `orientation: Z-up detected, rotating -90 deg about X to Y-up`
    : `orientation: already Y-up, no rotation`,
)
console.log(`scale: ${scale.toFixed(6)} to normalise height to ${HEIGHT} m`)

/** Z-up -> Y-up, scaled. Grounding happens after, once Y is known. */
function toWorld(x, y, z) {
  return zUp ? [x * scale, z * scale, -y * scale] : [x * scale, y * scale, z * scale]
}

let groundY = Infinity
for (const { pos } of parsed) {
  for (let i = 0; i < pos.length; i += 3) {
    const y = toWorld(pos[i], pos[i + 1], pos[i + 2])[1]
    if (y < groundY) groundY = y
  }
}
console.log(`grounding: shifting Y by ${(-groundY).toFixed(4)} so the feet sit at y=0`)

/* --------------------------------------------------------------- build -- */

/**
 * Merge meshes that render identically.
 *
 * The app colours by system, toggles by layer, and selects by system — so every
 * mesh sharing a (system, layer) pair behaves the same way and can be one mesh.
 * That takes BodyParts3D from 1,838 meshes to about twenty.
 *
 * It matters because mesh count, not file size, is what makes the twin slow to
 * appear: the 24 MB download takes 101 ms, while building and reconciling
 * ~1,800 scene objects took the better part of a minute, during which the
 * viewer sees the placeholder and the controls look dead.
 *
 * The cost is per-structure hover: the readout can name "musculoskeletal /
 * bone", not "left eleventh rib". Pass --no-merge to keep every structure
 * separate if you need that back and can afford the load.
 */
const MERGE = !process.argv.includes('--no-merge')
const groups = new Map()
for (const item of parsed) {
  const key = MERGE ? `${item.meta.system}/${item.meta.layer}` : item.key
  if (!groups.has(key)) groups.set(key, [])
  groups.get(key).push(item)
}
console.log(`merging: ${parsed.length} meshes -> ${groups.size} groups${MERGE ? '' : ' (disabled)'}`)

const doc = new Document()
doc.getRoot().getAsset().generator = 'open-twin-openXR build-bodyparts3d'
doc.getRoot().getAsset().copyright = COPYRIGHT
const buffer = doc.createBuffer()
const scene = doc.createScene('BodyParts3D')

/**
 * Per-structure identity, the same contract Z-Anatomy already ships.
 *
 * Merging for draw-call budget throws the structure names away — hover could
 * only say "musculoskeletal / bone", never "left eleventh rib". A per-vertex
 * `_STRUCTURE` id plus a table on the scene gives them back without giving up
 * the merge: 2,235 structures against uint16's 65,535 leaves ample head-room.
 *
 * ⚠️ THIS ATLAS CAN DO SOMETHING Z-ANATOMY CANNOT. BodyParts3D is FMA-indexed,
 * so every structure carries an ontology id and the table can hold it. D11
 * records the ontology join as outstanding because the merge in `eebfa24` spent
 * it; for this atlas, writing the table restores it. That is the half of phase 5
 * that does not need a crosswalk built — the terms are already here.
 *
 * NO INDEX RANGES, for the same reason as Z-Anatomy: downstream
 * `gltf-transform optimize --simplify` rewrites the index buffer, so any range
 * recorded here is stale in the shipped asset and nothing errors — selection
 * just highlights the wrong geometry. The runtime derives ranges from the id
 * attribute, which cannot go stale because it IS the geometry.
 */
const structures = []

const perSystem = {}
for (const [groupKey, items] of groups) {
  const totalV = items.reduce((n, it) => n + it.pos.length, 0)
  const totalI = items.reduce((n, it) => n + it.idx.length, 0)
  const out = new Float32Array(totalV)
  const outIdx = new Uint32Array(totalI)
  const structureIds = new Uint16Array(totalV / 3)
  let vo = 0
  let io = 0
  let base = 0
  for (const { pos, idx, meta: m } of items) {
    const id = structures.length
    if (id > 65535) throw new Error('more than 65,536 structures — _STRUCTURE needs uint32')
    const centroid = [0, 0, 0]
    for (let i = 0; i < pos.length; i += 3) {
      const [x, y, z] = toWorld(pos[i], pos[i + 1], pos[i + 2])
      out[vo + i] = x
      out[vo + i + 1] = y - groundY
      out[vo + i + 2] = z
      structureIds[(vo + i) / 3] = id
      centroid[0] += x
      centroid[1] += y - groundY
      centroid[2] += z
    }
    for (let i = 0; i < idx.length; i++) outIdx[io + i] = idx[i] + base
    const n = pos.length / 3
    structures.push({
      name: m.label || 'unnamed',
      system: m.system,
      layer: m.layer,
      // The FMA term, normalised to the `FMA:7197` form the contract uses.
      // Present on nearly every structure here, and the reason this atlas is
      // the one that can answer an ontology query today.
      ...(m.fma ? { ontologyid: m.fma.replace(/^FMA/, 'FMA:') } : {}),
      centroid: centroid.map((c) => +(c / n).toFixed(4)),
    })
    base += n
    vo += pos.length
    io += idx.length
  }

  const meta = items[0].meta
  const name = MERGE ? groupKey : meta.label || items[0].key
  const position = doc.createAccessor().setType('VEC3').setArray(out).setBuffer(buffer)
  const indices = doc.createAccessor().setType('SCALAR').setArray(outIdx).setBuffer(buffer)
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', position)
    // `_`-prefixed per the glTF spec. three's GLTFLoader lowercases anything it
    // does not recognise, so this arrives as `geometry.attributes._structure`.
    .setAttribute(
      '_STRUCTURE',
      doc.createAccessor().setType('SCALAR').setArray(structureIds).setBuffer(buffer),
    )
    .setIndices(indices)
  const mesh = doc.createMesh(name).addPrimitive(prim)

  // These keys are what AtlasBody reads. `system` is the pre-resolved answer
  // from the manifest, which is what `groupKey` picks up; `layer` drives the
  // layer toggles and the muscle-is-an-outer-shell rule.
  const node = doc.createNode(name).setMesh(mesh)
  node.setExtras({
    ontologyid: !MERGE && meta.fma ? meta.fma.replace(/^FMA/, 'FMA:') : undefined,
    label: MERGE ? `${meta.system} / ${meta.layer}` : meta.label,
    system: meta.system,
    layer: meta.layer,
    merged_from: items.length,
  })
  scene.addChild(node)
  perSystem[meta.system] = (perSystem[meta.system] ?? 0) + items.length
}

/**
 * The table goes on the SCENE, because `AtlasBody` destructures `{ scene }` out
 * of `useGLTF` and three copies scene extras to `scene.userData`. On the glTF
 * root it would land on `gltf.userData`, which that component never sees.
 */
scene.setExtras({ structures, structure_attribute: '_STRUCTURE' })
console.log(
  `structure table: ${structures.length.toLocaleString()} entries, ` +
    `${structures.filter((x) => x.ontologyid).length.toLocaleString()} with an FMA term ` +
    `(${(JSON.stringify(structures).length / 1024).toFixed(0)} KB of JSON)`,
)

await new NodeIO().write(OUT, doc)

const tris = parsed.reduce((n, p) => n + p.idx.length / 3, 0)
const verts = parsed.reduce((n, p) => n + p.pos.length / 3, 0)
console.log(`\nwrote ${OUT}`)
console.log(`  meshes ${parsed.length}   verts ${verts.toLocaleString()}   tris ${tris.toLocaleString()}`)
console.log(`  ${Object.entries(perSystem).map(([s, n]) => `${s} ${n}`).join(', ')}`)
console.log(`  size ${(statSync(OUT).size / 1048576).toFixed(1)} MB`)
if (tris > 400_000) {
  console.log(
    `\n  NOTE: ${tris.toLocaleString()} triangles is well over the ~150k headset budget.` +
      `\n  Decimate in the compression step — see docs/MODEL_PIPELINE.md step 7.`,
  )
}
console.log(`\nNext:  npm run convert:bodyparts3d`)
