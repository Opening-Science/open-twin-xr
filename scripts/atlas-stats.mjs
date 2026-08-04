#!/usr/bin/env node
/**
 * Report what an atlas GLB actually contains, before deciding what to do to it.
 *
 * The build pipeline makes destructive choices — `strip-atlas.mjs` drops
 * TEXCOORD_0 and COLOR_0, `gltf-transform optimize` welds and simplifies — and
 * each of those is only defensible if you know what was there to begin with.
 * This prints the numbers those decisions rest on: attribute coverage, triangle
 * budget, draw-call count, and the `extras` keys the renderer resolves against.
 *
 *   node scripts/atlas-stats.mjs public/models/hra.glb public/models/hra.opt.glb
 */
import { createRequire } from 'node:module'
import { statSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { NodeIO } = require('@gltf-transform/core')
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions')
const { MeshoptDecoder } = require('meshoptimizer')

const files = process.argv.slice(2)
if (!files.length) {
  console.error('Usage: node scripts/atlas-stats.mjs <file.glb> [more.glb ...]')
  process.exit(1)
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })

const n = (x) => Math.round(x).toLocaleString()

for (const path of files) {
  const doc = await io.read(path)
  const root = doc.getRoot()
  const meshes = root.listMeshes()

  let tris = 0
  let verts = 0
  let prims = 0
  const attrSets = new Map()
  const attrCoverage = new Map()

  for (const mesh of meshes) {
    for (const prim of mesh.listPrimitives()) {
      prims++
      const pos = prim.getAttribute('POSITION')
      const idx = prim.getIndices()
      verts += pos ? pos.getCount() : 0
      tris += idx ? idx.getCount() / 3 : pos ? pos.getCount() / 3 : 0
      for (const sem of prim.listSemantics()) {
        attrCoverage.set(sem, (attrCoverage.get(sem) ?? 0) + 1)
      }
      const key = prim.listSemantics().sort().join(',')
      attrSets.set(key, (attrSets.get(key) ?? 0) + 1)
    }
  }

  // `extras` is where every atlas hides its ontology terms; the renderer's
  // whole resolution strategy depends on which keys are present and how often.
  const extrasKeys = new Map()
  let nodesWithExtras = 0
  for (const node of root.listNodes()) {
    const extras = node.getExtras()
    if (!extras || !Object.keys(extras).length) continue
    nodesWithExtras++
    for (const k of Object.keys(extras)) extrasKeys.set(k, (extrasKeys.get(k) ?? 0) + 1)
  }

  const perMesh = meshes
    .map((mesh) => {
      let t = 0
      for (const prim of mesh.listPrimitives()) {
        const idx = prim.getIndices()
        const pos = prim.getAttribute('POSITION')
        t += idx ? idx.getCount() / 3 : pos ? pos.getCount() / 3 : 0
      }
      return { name: mesh.getName(), t }
    })
    .sort((a, b) => b.t - a.t)

  console.log('='.repeat(72))
  console.log(`${path}  (${(statSync(path).size / 1e6).toFixed(1)} MB on disk)`)
  console.log('='.repeat(72))
  console.log(`meshes / primitives   ${meshes.length} / ${prims}   <- draw calls`)
  console.log(`triangles             ${n(tris)}`)
  console.log(`vertices              ${n(verts)}`)
  console.log(`materials / textures  ${root.listMaterials().length} / ${root.listTextures().length}`)
  console.log(
    `attribute coverage    ${[...attrCoverage]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${Math.round((100 * v) / prims)}%`)
      .join('  ')}`,
  )
  console.log(
    `attribute sets        ${[...attrSets]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([k, v]) => `[${k}] x${v}`)
      .join('  ')}`,
  )
  console.log(`nodes with extras     ${nodesWithExtras} / ${root.listNodes().length}`)
  console.log(
    `extras keys           ${[...extrasKeys]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k, v]) => `${k}:${v}`)
      .join(', ')}`,
  )
  console.log(`median mesh           ${n(perMesh[Math.floor(perMesh.length / 2)]?.t ?? 0)} tris`)
  console.log(`meshes under 200 tris ${perMesh.filter((m) => m.t < 200).length}`)
  console.log(
    `heaviest              ${perMesh
      .slice(0, 6)
      .map((m) => `${m.name || '(unnamed)'}=${n(m.t)}`)
      .join(', ')}`,
  )
  console.log()
}
