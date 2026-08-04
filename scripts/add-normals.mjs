#!/usr/bin/env node
/**
 * Compute vertex normals into a GLB, offline.
 *
 * The pipeline strips NORMAL before compression, because split normals stop
 * vertex welding dead and welding is what lets meshoptimizer simplify at all
 * (see scripts/strip-atlas.mjs). That works, but it leaves the renderer to call
 * `computeVertexNormals()` on every mesh at load — and on BodyParts3D that is
 * 1,833 meshes over 2.6M triangles on the main thread, which stalled the first
 * paint for roughly nineteen seconds.
 *
 * Doing it here moves that cost off the critical path entirely. It runs AFTER
 * welding and simplification, so it costs none of the compression they buy.
 *
 *   node scripts/add-normals.mjs public/models/x.opt.glb
 */
import { createRequire } from 'node:module'
import { statSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { NodeIO } = require('@gltf-transform/core')
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions')
const { MeshoptDecoder, MeshoptEncoder } = require('meshoptimizer')

const file = process.argv[2]
if (!file) {
  console.error('Usage: node scripts/add-normals.mjs <file.glb>')
  process.exit(1)
}

// This runs on the already-compressed output, so the meshopt extension has to
// be registered or the file cannot even be opened — and re-registered on write
// so the result stays compressed.
await MeshoptDecoder.ready
await MeshoptEncoder.ready
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })
const doc = await io.read(file)
const root = doc.getRoot()
const buffer = root.listBuffers()[0] ?? doc.createBuffer()

let done = 0
let skipped = 0
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    if (prim.getAttribute('NORMAL')) {
      skipped++
      continue
    }
    const P = prim.getAttribute('POSITION')
    const I = prim.getIndices()
    if (!P) continue
    const pos = P.getArray()
    const idx = I ? I.getArray() : null
    const n = new Float32Array(pos.length)

    // Area-weighted smooth normals: accumulate each face's cross product onto
    // its three vertices, then normalise. Area weighting falls out of not
    // normalising the cross product first, and it is what you want — big faces
    // should dominate the shading of a shared vertex.
    const count = idx ? idx.length : pos.length / 3
    for (let i = 0; i < count; i += 3) {
      const a = (idx ? idx[i] : i) * 3
      const b = (idx ? idx[i + 1] : i + 1) * 3
      const c = (idx ? idx[i + 2] : i + 2) * 3
      const e1x = pos[b] - pos[a]
      const e1y = pos[b + 1] - pos[a + 1]
      const e1z = pos[b + 2] - pos[a + 2]
      const e2x = pos[c] - pos[a]
      const e2y = pos[c + 1] - pos[a + 1]
      const e2z = pos[c + 2] - pos[a + 2]
      const nx = e1y * e2z - e1z * e2y
      const ny = e1z * e2x - e1x * e2z
      const nz = e1x * e2y - e1y * e2x
      for (const v of [a, b, c]) {
        n[v] += nx
        n[v + 1] += ny
        n[v + 2] += nz
      }
    }
    for (let i = 0; i < n.length; i += 3) {
      const len = Math.hypot(n[i], n[i + 1], n[i + 2])
      if (len > 0) {
        n[i] /= len
        n[i + 1] /= len
        n[i + 2] /= len
      } else {
        n[i + 1] = 1 // degenerate face; point it somewhere valid
      }
    }
    prim.setAttribute(
      'NORMAL',
      doc.createAccessor().setType('VEC3').setArray(n).setBuffer(buffer),
    )
    done++
  }
}

const before = statSync(file).size / 1048576
await io.write(file, doc)
const after = statSync(file).size / 1048576
console.log(
  `normals computed for ${done} primitives (${skipped} already had them); ` +
    `${before.toFixed(1)} MB -> ${after.toFixed(1)} MB`,
)
