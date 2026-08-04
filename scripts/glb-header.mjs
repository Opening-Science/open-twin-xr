#!/usr/bin/env node
/**
 * Read a GLB's JSON chunk WITHOUT loading its binary payload.
 *
 * The raw atlases are 100-400 MB and a full parse needs gigabytes of heap, but
 * every question about what an asset *contains* — which attributes, how many
 * textures, what the materials are — is answered by the JSON chunk alone. GLB
 * puts that chunk first, so it costs one small read.
 *
 *   node scripts/glb-header.mjs public/models/hra.glb
 */
import { openSync, readSync, closeSync, statSync } from 'node:fs'

for (const path of process.argv.slice(2)) {
  const fd = openSync(path, 'r')
  const head = Buffer.alloc(20)
  readSync(fd, head, 0, 20, 0)
  const jsonLen = head.readUInt32LE(12)
  const json = Buffer.alloc(jsonLen)
  readSync(fd, json, 0, jsonLen, 20)
  closeSync(fd)
  const g = JSON.parse(json.toString('utf8'))

  const semantics = new Map()
  let prims = 0
  for (const mesh of g.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      prims++
      for (const sem of Object.keys(prim.attributes ?? {})) {
        semantics.set(sem, (semantics.get(sem) ?? 0) + 1)
      }
    }
  }

  console.log('='.repeat(72))
  console.log(`${path}  (${(statSync(path).size / 1e6).toFixed(1)} MB)`)
  console.log('='.repeat(72))
  console.log(`generator     ${g.asset?.generator ?? '?'}`)
  console.log(`extensions    ${(g.extensionsUsed ?? []).join(', ') || '(none)'}`)
  console.log(`meshes/prims  ${(g.meshes ?? []).length} / ${prims}`)
  console.log(`nodes         ${(g.nodes ?? []).length}`)
  console.log(`materials     ${(g.materials ?? []).length}`)
  console.log(`textures      ${(g.textures ?? []).length}`)
  console.log(`images        ${(g.images ?? []).length}`)
  console.log(
    `attributes    ${[...semantics]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${Math.round((100 * v) / prims)}%`)
      .join('  ')}`,
  )
  const m0 = (g.materials ?? [])[0]
  if (m0) console.log(`material[0]   ${JSON.stringify(m0).slice(0, 320)}`)
  const img = (g.images ?? [])[0]
  if (img) console.log(`image[0]      ${JSON.stringify(img).slice(0, 200)}`)
  console.log()
}
