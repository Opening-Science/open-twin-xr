#!/usr/bin/env node
/**
 * Which structures touch which, derived from our own geometry (D24, Phase 2).
 *
 *   node scripts/build-adjacency.mjs --measure        # sizes and shape, writes nothing
 *   node scripts/build-adjacency.mjs                  # writes public/data/adjacency.json
 *
 * WHY DERIVED AND NOT INGESTED. Anatomed ships a neighbour graph, and it was
 * measured before this was written: 96.3 % of its 84,360 edges have a distance
 * of exactly zero, so the distance carries almost no signal, and it joins to
 * only a fraction of our structures. The geometry it describes is the geometry
 * we already own — so computing it here covers every structure, at whatever
 * threshold we choose, with no third-party data to credit or to re-fetch.
 *
 * ⚠️ BOXES, NOT CENTROIDS, AND THAT IS THE POINT. The centroid of a sciatic
 * nerve sits nowhere near either end of it; ranking neighbours by centroid
 * distance would call the far side of the pelvis a neighbour and miss the muscle
 * the nerve runs through. An axis-aligned box per structure, and a gap measured
 * between boxes, is coarse in a way that is honest — it over-reports contact for
 * a long diagonal structure rather than inventing a nearness that is not there.
 *
 * ⚠️ THE OUTPUT IS ADAPTED CC BY-SA DATA. It is derived from Z-Anatomy geometry,
 * so it travels with the asset under the asset's terms and never into `src/`.
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { NodeIO } = require('@gltf-transform/core')
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions')
const { MeshoptDecoder } = require('meshoptimizer')

const ROOT = process.cwd()
const MEASURE = process.argv.includes('--measure')
const SRC = join(ROOT, 'public/models/z-anatomy.ao.glb')
const OUT = join(ROOT, 'public/data/adjacency.json')

/**
 * Contact threshold in METRES.
 *
 * 2 mm is about the thickness of the fascia between two structures that a viewer
 * would call touching. Stated here once, in the unit the data is in.
 *
 * ⚠️ METRES ONLY AFTER THE NODE TRANSFORM IS APPLIED, and the first version of
 * this script did not apply it. The atlas is `KHR_mesh_quantization`d: every
 * mesh node carries its own scale and translation, and raw `POSITION` is in a
 * per-node quantised space, NOT in metres. Measured on the shipped asset: the
 * eleven nodes carry scales from 0.7853 to 0.8463 and Y translations from 0.7950
 * to 0.8540, so reading POSITION verbatim put a bone and a ligament on different
 * rulers 59 mm apart — thirty times this threshold — and made every cross-mesh
 * gap meaningless. `worldBox()` below is what makes the unit true.
 */
const GAP_M = 0.002
/** Neighbours kept per structure, nearest first. */
const K = 12

if (!existsSync(SRC)) {
  console.error(`✗ ${SRC} is not installed — build the atlas first`)
  process.exit(1)
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })

const doc = await io.read(SRC)
const root = doc.getRoot()
const scene = root.getDefaultScene() ?? root.listScenes()[0]
const table = scene?.getExtras()?.structures ?? []

/* --- 2.1: an axis-aligned box per structure, IN WORLD SPACE ---------------- */
/**
 * Walk the NODES rather than the meshes, because the transform lives on the node
 * and a mesh does not know where it was placed. `getWorldMatrix()` composes the
 * whole parent chain, so this stays correct if the scene graph ever gains
 * rotation or nesting — today every node is a direct child of the scene with a
 * pure scale and translation, and that was exactly enough to be wrong.
 */
const box = new Map() // id -> [minx,miny,minz,maxx,maxy,maxz], world metres
for (const node of root.listNodes()) {
  const mesh = node.getMesh()
  if (!mesh) continue
  const m = node.getWorldMatrix()
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION')
    const sid = prim.getAttribute('_STRUCTURE')
    if (!pos || !sid) continue
    const p = [0, 0, 0]
    for (let i = 0; i < pos.getCount(); i++) {
      const id = sid.getElement(i, [0])[0]
      pos.getElement(i, p)
      // Column-major 4x4 times (x, y, z, 1).
      const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]
      const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]
      const z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]
      const b = box.get(id)
      if (!b) box.set(id, [x, y, z, x, y, z])
      else {
        if (x < b[0]) b[0] = x
        if (y < b[1]) b[1] = y
        if (z < b[2]) b[2] = z
        if (x > b[3]) b[3] = x
        if (y > b[4]) b[4] = y
        if (z > b[5]) b[5] = z
      }
    }
  }
}
console.log(`${table.length.toLocaleString()} structures, ${box.size.toLocaleString()} with geometry`)

/**
 * ⚠️ ASSERT THE UNIT, because the bug this replaces was silent. Reading POSITION
 * without the node transform produced a "body" 2.000 units tall and every
 * downstream number still looked reasonable — the threshold, the edge count and
 * the zero-gap percentage were all plausible and all measured on the wrong
 * ruler. A gap threshold in metres is only meaningful if the geometry is in
 * metres, so check it here rather than trusting it.
 */
const heights = [...box.values()]
const bodyHeight = Math.max(...heights.map((b) => b[4])) - Math.min(...heights.map((b) => b[1]))
if (!(bodyHeight > 1.4 && bodyHeight < 2.1)) {
  console.error(
    `✗ body height measures ${bodyHeight.toFixed(3)} — that is not metres.\n` +
      '  GAP_M is a threshold in metres, so this run would be meaningless.\n' +
      '  Check that the node world transform is being applied to POSITION.',
  )
  process.exit(1)
}
console.log(`  body height           : ${bodyHeight.toFixed(3)} m (unit check passed)`)

/* --- 2.2: adjacency by box gap --------------------------------------------- */
const ids = [...box.keys()]
/** Gap between two boxes: 0 when they overlap, else the shortest separation. */
const gap = (a, b) => {
  const dx = Math.max(0, Math.max(a[0] - b[3], b[0] - a[3]))
  const dy = Math.max(0, Math.max(a[1] - b[4], b[1] - a[4]))
  const dz = Math.max(0, Math.max(a[2] - b[5], b[2] - a[5]))
  return Math.hypot(dx, dy, dz)
}

/**
 * A uniform grid over the body, so this is not 3,617² comparisons.
 *
 * Cell size is the threshold plus the median box extent; a structure is entered
 * in every cell its box touches, and only structures sharing a cell are ever
 * compared. On this atlas that turns ~6.5 M pair tests into a fraction of them.
 */
const CELL = 0.05
const grid = new Map()
const cellsOf = (b) => {
  const out = []
  for (let x = Math.floor((b[0] - GAP_M) / CELL); x <= Math.floor((b[3] + GAP_M) / CELL); x++)
    for (let y = Math.floor((b[1] - GAP_M) / CELL); y <= Math.floor((b[4] + GAP_M) / CELL); y++)
      for (let z = Math.floor((b[2] - GAP_M) / CELL); z <= Math.floor((b[5] + GAP_M) / CELL); z++)
        out.push(`${x},${y},${z}`)
  return out
}
for (const id of ids) {
  for (const c of cellsOf(box.get(id))) {
    let bucket = grid.get(c)
    if (!bucket) grid.set(c, (bucket = []))
    bucket.push(id)
  }
}

const neighbours = new Map()
let pairTests = 0
for (const bucket of grid.values()) {
  for (let i = 0; i < bucket.length; i++) {
    for (let j = i + 1; j < bucket.length; j++) {
      const a = bucket[i]
      const b = bucket[j]
      pairTests++
      const d = gap(box.get(a), box.get(b))
      if (d > GAP_M) continue
      for (const [x, y] of [
        [a, b],
        [b, a],
      ]) {
        let list = neighbours.get(x)
        if (!list) neighbours.set(x, (list = new Map()))
        const prev = list.get(y)
        if (prev === undefined || d < prev) list.set(y, d)
      }
    }
  }
}

const edges = [...neighbours.values()].reduce((n, m) => n + m.size, 0)
const withAny = neighbours.size
const zero = [...neighbours.values()].reduce(
  (n, m) => n + [...m.values()].filter((d) => d === 0).length,
  0,
)
console.log(`  pair tests            : ${pairTests.toLocaleString()} (grid-limited)`)
console.log(`  structures with a neighbour: ${withAny.toLocaleString()} (${((100 * withAny) / box.size).toFixed(0)} %)`)
console.log(`  directed edges        : ${edges.toLocaleString()} at ${GAP_M * 1000} mm`)
console.log(`  of which gap exactly 0: ${((100 * zero) / (edges || 1)).toFixed(1)} %`)

/* --- 2.3: the payload, measured before deciding where it lives ------------- */
const trimmed = {}
for (const [id, list] of neighbours) {
  trimmed[id] = [...list.entries()]
    .sort((a, b) => a[1] - b[1])
    .slice(0, K)
    .map(([n, d]) => [n, Math.round(d * 10000) / 10000])
}
const payload = {
  $meta: {
    note:
      'Structure adjacency derived from z-anatomy.ao.glb by axis-aligned box gap. ' +
      'Adapted from CC BY-SA 4.0 geometry — travels with the atlas, under its terms.',
    source: 'public/models/z-anatomy.ao.glb',
    gapMetres: GAP_M,
    neighboursPerStructure: K,
    structures: box.size,
    withNeighbour: withAny,
  },
  neighbours: trimmed,
}
const json = JSON.stringify(payload)
console.log(`  payload               : ${(json.length / 1024).toFixed(0)} KB (K=${K}, gzip ~⅓ of that)`)

if (MEASURE) {
  console.log('\n--measure: nothing written.')
  process.exit(0)
}
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, json)
console.log(`✓ ${OUT}`)
