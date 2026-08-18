#!/usr/bin/env node
/**
 * Does a posed envelope actually fit the atlas it was posed for?
 *
 * D16's acceptance metric, measured rather than looked at. Two numbers per
 * (preset, pose), both in the canonical frame the app renders in:
 *
 *   span delta    across-the-arms extent, envelope vs atlas. This is the number
 *                 D16 recorded the failure in: 1.124 m against 0.646 m.
 *   containment   the fraction of the atlas's own surface that falls inside the
 *                 envelope. Span can agree while the shape still does not
 *                 enclose, so the two together are the test and neither alone is.
 *
 * ⚠️ CONTAINMENT IS NOT EXPECTED TO REACH 100 %, and a target of 100 % would be
 * the wrong target. D16 measured the atlas protruding ~5 mm behind the
 * envelope's back even where the fit is good, and three of the atlases model
 * anatomy the envelope has no surface for. What matters is that it is high and
 * that the exceptions are named.
 *
 *     node scripts/anny/check_posed_fit.mjs
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../..')
const MODELS = resolve(REPO, 'public/models')

/** Canonical frame, as `AtlasBody` and `BodyEnvelope` both use it. */
const CANONICAL_HEIGHT_M = 1.7
/** `EnvelopeMesh`'s pad — "a hair over, so the envelope encloses". */
const PAD = 1.015

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })

function trs(node) {
  const t = node.getTranslation()
  const [x, y, z, w] = node.getRotation()
  const s = node.getScale()
  const x2 = x + x, y2 = y + y, z2 = z + z
  const xx = x * x2, xy = x * y2, xz = x * z2
  const yy = y * y2, yz = y * z2, zz = z * z2
  const wx = w * x2, wy = w * y2, wz = w * z2
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ]
}
const mul = (a, b) => {
  const o = new Array(16).fill(0)
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]
  return o
}
const apply = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
]

/** Every vertex of a file, in scene space, as a flat Float64Array. */
async function vertices(file) {
  const doc = await io.read(resolve(MODELS, file))
  const scene = doc.getRoot().listScenes()[0]
  const out = []
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  const walk = (node, parent) => {
    const world = mul(parent, trs(node))
    const mesh = node.getMesh()
    if (mesh)
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION')
        if (!pos) continue
        const p = [0, 0, 0]
        for (let i = 0; i < pos.getCount(); i++) {
          pos.getElement(i, p)
          const w = apply(world, p)
          out.push(w[0], w[1], w[2])
        }
      }
    for (const c of node.listChildren()) walk(c, world)
  }
  for (const n of scene.listChildren()) walk(n, I)
  return Float64Array.from(out)
}

function bounds(v) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < v.length; i += 3)
    for (let k = 0; k < 3; k++) {
      if (v[i + k] < min[k]) min[k] = v[i + k]
      if (v[i + k] > max[k]) max[k] = v[i + k]
    }
  return { min, max, size: max.map((m, i) => m - min[i]) }
}

/** Apply `AtlasBody.fit` — uniform scale to canonical height, centred, grounded. */
function registerAtlas(v, realScale, anchor) {
  const b = bounds(v)
  const centre = b.max.map((m, i) => (m + b.min[i]) / 2)
  const scale = realScale ? 1 : b.size[1] > 0 ? CANONICAL_HEIGHT_M / b.size[1] : 1
  const offset = realScale
    ? [-centre[0], anchor.worldY - anchor.rawY, -centre[2]]
    : [-centre[0] * scale, -b.min[1] * scale, -centre[2] * scale]
  const out = new Float64Array(v.length)
  for (let i = 0; i < v.length; i += 3) {
    out[i] = v[i] * scale + offset[0]
    out[i + 1] = v[i + 1] * scale + offset[1]
    out[i + 2] = v[i + 2] * scale + offset[2]
  }
  return out
}

/** Apply `EnvelopeMesh`'s fit — scale to canonical height with the 1.5 % pad. */
function registerEnvelope(v) {
  const b = bounds(v)
  const scale = (CANONICAL_HEIGHT_M / (b.size[1] || 1)) * PAD
  const y = -b.min[1] * scale
  const cx = (b.max[0] + b.min[0]) / 2
  const cz = (b.max[2] + b.min[2]) / 2
  const out = new Float64Array(v.length)
  for (let i = 0; i < v.length; i += 3) {
    out[i] = (v[i] - cx) * scale
    out[i + 1] = v[i + 1] * scale + y
    out[i + 2] = (v[i + 2] - cz) * scale
  }
  return out
}

/**
 * Containment, by ray casting against the envelope's triangles.
 *
 * A closed manifold contains a point when a ray from it crosses the surface an
 * odd number of times. `fix_normals()` in the bake is what makes the envelope
 * closed and consistently wound, so this is valid here and would not be on a
 * raw atlas mesh.
 *
 * ⚠️ SAMPLED, NOT EXHAUSTIVE. Z-Anatomy alone is ~1.4 M vertices and the
 * envelope 27 k triangles; the full cross product is not worth the wall clock
 * for a number that converges long before then. The sample count is reported so
 * a reader can judge the precision rather than assume it.
 */
async function containment(atlasV, envFile, sampleN = 4000) {
  const doc = await io.read(resolve(MODELS, envFile))
  const scene = doc.getRoot().listScenes()[0]
  const tris = []
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  const walk = (node, parent) => {
    const world = mul(parent, trs(node))
    const mesh = node.getMesh()
    if (mesh)
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION')
        const idx = prim.getIndices()
        if (!pos || !idx) continue
        const p = [0, 0, 0]
        const get = (i) => {
          pos.getElement(i, p)
          return apply(world, p)
        }
        for (let i = 0; i < idx.getCount(); i += 3)
          tris.push([get(idx.getScalar(i)), get(idx.getScalar(i + 1)), get(idx.getScalar(i + 2))])
      }
    for (const c of node.listChildren()) walk(c, world)
  }
  for (const n of scene.listChildren()) walk(n, I)

  // Re-register the triangle soup exactly as the runtime would.
  const flat = new Float64Array(tris.length * 9)
  tris.forEach((t, ti) =>
    t.forEach((p, pi) => {
      flat[ti * 9 + pi * 3] = p[0]
      flat[ti * 9 + pi * 3 + 1] = p[1]
      flat[ti * 9 + pi * 3 + 2] = p[2]
    }),
  )
  const reg = registerEnvelope(flat)

  const b = bounds(reg)
  const inside = (px, py, pz) => {
    // Ray along +x. Count crossings of triangles spanning (py, pz).
    let hits = 0
    for (let t = 0; t < reg.length; t += 9) {
      const ay = reg[t + 1], az = reg[t + 2]
      const by = reg[t + 4], bz = reg[t + 5]
      const cy = reg[t + 7], cz = reg[t + 8]
      // Barycentric test in the (y,z) plane.
      const d = (by - ay) * (cz - az) - (bz - az) * (cy - ay)
      if (Math.abs(d) < 1e-14) continue
      const u = ((py - ay) * (cz - az) - (pz - az) * (cy - ay)) / d
      if (u < 0 || u > 1) continue
      const v = ((by - ay) * (pz - az) - (bz - az) * (py - ay)) / d
      if (v < 0 || u + v > 1) continue
      const x = reg[t] + u * (reg[t + 3] - reg[t]) + v * (reg[t + 6] - reg[t])
      if (x > px) hits++
    }
    return hits % 2 === 1
  }

  const n = atlasV.length / 3
  const step = Math.max(1, Math.floor(n / sampleN))
  let tested = 0, contained = 0
  let worst = { d: 0, p: null }
  for (let i = 0; i < n; i += step) {
    const px = atlasV[i * 3], py = atlasV[i * 3 + 1], pz = atlasV[i * 3 + 2]
    if (py < b.min[1] - 0.02 || py > b.max[1] + 0.02) {
      tested++
      continue // outside the envelope's vertical span; counted as not contained
    }
    tested++
    if (inside(px, py, pz)) contained++
    else {
      const d = Math.min(
        Math.abs(px - b.min[0]), Math.abs(px - b.max[0]),
        Math.abs(pz - b.min[2]), Math.abs(pz - b.max[2]),
      )
      if (d > worst.d) worst = { d, p: [px, py, pz] }
    }
  }
  return { tested, contained, fraction: contained / tested, worst }
}

/** The atlases, their registration, and the pose each resolves to. */
function atlasPlan() {
  const poses = JSON.parse(readFileSync(resolve(HERE, 'atlas-poses.json'), 'utf8'))
  const src = readFileSync(resolve(REPO, 'src/scene/anatomySources.ts'), 'utf8')
  const urls = {}
  const rx = /id:\s*'([a-z0-9-]+)'[\s\S]{0,4000}?url:\s*'\/models\/([A-Za-z0-9._-]+)'/g
  let m
  while ((m = rx.exec(src))) if (!urls[m[1]]) urls[m[1]] = m[2]
  return { poses, urls }
}

async function main() {
  const { poses, urls } = atlasPlan()
  console.log('Posed envelope fit, in the canonical 1.7 m frame.\n')
  console.log('atlas                pose            span: atlas  envelope   delta    containment')

  const rows = []
  for (const [atlasId, entry] of Object.entries(poses.atlases)) {
    const file = urls[atlasId]
    if (!file) continue // composed modes have no file of their own
    const poseId = entry.poseId
    const raw = await vertices(file)
    // Registration flags, read from the registry rather than restated.
    const src = readFileSync(resolve(REPO, 'src/scene/anatomySources.ts'), 'utf8')
    const block = src.slice(src.indexOf(`id: '${atlasId}'`), src.indexOf(`id: '${atlasId}'`) + 6000)
    const realScale = /realScale:\s*true/.test(block)
    const anchorM = block.match(/anchor:\s*\{\s*rawY:\s*(-?[\d.]+),\s*worldY:\s*(-?[\d.]+)/)
    const anchor = anchorM
      ? { rawY: parseFloat(anchorM[1]), worldY: parseFloat(anchorM[2]) }
      : { rawY: 0, worldY: 0 }
    const atlasV = registerAtlas(raw, realScale, anchor)
    const ab = bounds(atlasV)

    for (const sex of ['f', 'm']) {
      const env = poseId
        ? `anny-adult-${sex}.pose-${poseId}.glb`
        : `anny-adult-${sex}.glb`
      let envV
      try {
        envV = registerEnvelope(await vertices(env))
      } catch {
        console.log(`  ${atlasId}: ${env} missing`)
        continue
      }
      const eb = bounds(envV)
      const c = await containment(atlasV, env)
      rows.push({ atlasId, poseId: poseId ?? 'rest', sex, atlasSpan: ab.size[0], envSpan: eb.size[0], c })
      console.log(
        `${atlasId.padEnd(20)} ${(poseId ?? 'rest').padEnd(14)} ` +
          `${ab.size[0].toFixed(3)}     ${eb.size[0].toFixed(3)}   ` +
          `${(eb.size[0] - ab.size[0] >= 0 ? '+' : '')}${(eb.size[0] - ab.size[0]).toFixed(3)}   ` +
          `${(100 * c.fraction).toFixed(1)}%  (${c.contained}/${c.tested})  [adult-${sex}]`,
      )
    }
  }

  console.log('\nFor comparison, the same atlases against the UNPOSED envelope:')
  for (const atlasId of ['z-anatomy', 'bodyparts3d']) {
    const raw = await vertices(urls[atlasId])
    const atlasV = registerAtlas(raw, false, { rawY: 0, worldY: 0 })
    const ab = bounds(atlasV)
    const envV = registerEnvelope(await vertices('anny-adult-m.glb'))
    const eb = bounds(envV)
    const c = await containment(atlasV, 'anny-adult-m.glb')
    console.log(
      `${atlasId.padEnd(20)} ${'rest'.padEnd(14)} ${ab.size[0].toFixed(3)}     ` +
        `${eb.size[0].toFixed(3)}   +${(eb.size[0] - ab.size[0]).toFixed(3)}   ` +
        `${(100 * c.fraction).toFixed(1)}%`,
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
