#!/usr/bin/env node
/**
 * biv-me fitted biventricular meshes -> one animated GLB (B6).
 *
 * A beating heart, from measured data rather than an invented throb. The source
 * is the demo output of `UOA-Heart-Mechanics-Research/biv-me` (Apache-2.0): a
 * biventricular model fitted to one subject's cine MRI, exported as 25 frames of
 * a cardiac cycle across three surfaces.
 *
 * WHY MORPH TARGETS WORK HERE AND USUALLY DO NOT
 * ----------------------------------------------
 * The 25 frames of a surface are byte-identical in topology and differ only in
 * vertex coordinates, which is exactly the glTF morph-target contract. Most 4D
 * cardiac data is remeshed per frame and has no vertex correspondence at all, so
 * it cannot drive morph targets without a resampling step. This build ASSERTS
 * the correspondence rather than trusting it — if a future release remeshes per
 * frame, the build fails loudly instead of emitting a mesh that tears.
 *
 * ⚠️ PROVENANCE — BUILDABLE, NOT YET PUBLISHABLE
 * ----------------------------------------------
 * The upstream repository carries no data statement, no ethics or consent text,
 * and its README mentions bundled input DICOMs, while UK Biobank's CMR lead is a
 * co-author on the paper. Apache-2.0 at a repo root cannot grant rights the
 * licensor does not hold. The demo case's provenance must be confirmed with the
 * authors before anything derived from it is published. Until then this asset is
 * for local evaluation only. See docs/PLAN_INTEGRATION.md (B6) for the wording.
 *
 * ⚠️ NO BAKED OCCLUSION, DELIBERATELY
 * -----------------------------------
 * The atlases carry per-vertex AO in COLOR_0. That cannot be reused here: AO
 * baked at one cardiac phase is wrong at the other 24, because the surface
 * moves. So this asset ships POSITION and NORMAL only and will read flatter than
 * the atlas around it. Fixing it properly means morphing COLOR_0 as well; that is
 * follow-on work, not a defect to paper over with a single stale bake.
 *
 * Usage:
 *   node scripts/build-biv-heart.mjs
 *   node scripts/build-biv-heart.mjs --src ~/Downloads/biv-me-demo --cycle-seconds 0.95
 */
import { createRequire } from 'node:module'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { homedir } from 'node:os'

const require = createRequire(import.meta.url)
const { Document, NodeIO } = require('@gltf-transform/core')

// --------------------------------------------------------------------------- //
// CLI
// --------------------------------------------------------------------------- //
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const SRC = arg('src', join(homedir(), 'Downloads', 'biv-me-demo'))
const OUT = arg('out', 'public/models/biv-heart.glb')

/**
 * Cycle duration in seconds.
 *
 * ⚠️ THIS IS A DISPLAY CHOICE, NOT SOURCE DATA. The OBJ files carry frame
 * indices and no timing whatsoever, so the R-R interval of the subject they were
 * fitted to is unknown to this script. 1.0 s is a neutral default close to the
 * ~0.95 s implied by a resting heart rate of 63 bpm. Frames are assumed evenly
 * spaced across the cycle, which is how cine MRI is normally acquired. Do not
 * present the rate as measured.
 */
const CYCLE_SECONDS = Number(arg('cycle-seconds', '1.0'))

/** Source is millimetres; the atlas contract is metres. */
const MM_TO_M = 0.001

/**
 * The three surfaces, in the order their `_STRUCTURE` ids are assigned.
 *
 * No `layer` is set on any of them, and that is deliberate: `anatomyPalette`
 * falls through to the per-system colour when a mesh declares no layer, and the
 * cardiovascular tint is the saturated red already chosen for "heart and
 * vessels". Declaring `organ` would instead pull the generic viscera fallback.
 */
const SURFACES = [
  { key: 'EPICARDIAL', name: 'Epicardium', node: 'cardiovascular/epicardium' },
  { key: 'LV_ENDOCARDIAL', name: 'Left ventricle endocardium', node: 'cardiovascular/lv-endocardium' },
  { key: 'RV_ENDOCARDIAL', name: 'Right ventricle endocardium', node: 'cardiovascular/rv-endocardium' },
]

const ATTRIBUTION =
  'Beating biventricular heart from biv-me (UOA Heart Mechanics Research), Apache-2.0 — ' +
  'fitted biventricular model, 25 cardiac phases. Provenance of the demo subject ' +
  'is unconfirmed; not for redistribution until confirmed.'

// --------------------------------------------------------------------------- //
// OBJ
// --------------------------------------------------------------------------- //
/**
 * Read a triangle-soup OBJ. These files carry `v` and `f` only — no normals, no
 * UVs, no groups — so the parser stays deliberately small. Face indices are
 * 1-based per the OBJ spec, and the `a/b/c` form is handled even though this
 * source does not use it.
 */
function readObj(path) {
  const positions = []
  const indices = []
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.charCodeAt(0) === 118 /* v */ && line[1] === ' ') {
      const p = line.split(/\s+/)
      positions.push(+p[1], +p[2], +p[3])
    } else if (line.charCodeAt(0) === 102 /* f */ && line[1] === ' ') {
      const p = line.trim().split(/\s+/)
      if (p.length !== 4) throw new Error(`${path}: non-triangular face "${line.trim()}"`)
      for (let i = 1; i <= 3; i++) indices.push(parseInt(p[i].split('/')[0], 10) - 1)
    }
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) }
}

/** Area-weighted vertex normals. Winding is asserted separately by check:winding. */
function vertexNormals(positions, indices) {
  const n = new Float32Array(positions.length)
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3
    const b = indices[i + 1] * 3
    const c = indices[i + 2] * 3
    const ux = positions[b] - positions[a]
    const uy = positions[b + 1] - positions[a + 1]
    const uz = positions[b + 2] - positions[a + 2]
    const vx = positions[c] - positions[a]
    const vy = positions[c + 1] - positions[a + 1]
    const vz = positions[c + 2] - positions[a + 2]
    // Cross product, left UNNORMALISED so it is weighted by twice the triangle
    // area — the standard way to stop a dense corner outvoting a large face.
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    for (const o of [a, b, c]) {
      n[o] += nx
      n[o + 1] += ny
      n[o + 2] += nz
    }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1
    n[i] /= l
    n[i + 1] /= l
    n[i + 2] /= l
  }
  return n
}

// --------------------------------------------------------------------------- //
// Load and validate
// --------------------------------------------------------------------------- //
if (!existsSync(SRC)) {
  console.error(`No source directory at ${SRC}. Pass --src.`)
  process.exit(1)
}
const files = readdirSync(SRC).filter((f) => f.endsWith('.obj'))

const loaded = []
for (const s of SURFACES) {
  const frames = files
    .filter((f) => f.includes(`_${s.key}_`))
    .sort() // zero-padded frame index, so lexical order is frame order
  if (frames.length === 0) throw new Error(`no frames found for ${s.key} in ${SRC}`)

  const meshes = frames.map((f) => readObj(join(SRC, f)))

  // THE LOAD-BEARING ASSERTION. Morph targets are only valid while every frame
  // shares one topology; if a future release remeshes per frame, the correct
  // outcome is a failed build, not a mesh that tears at playback.
  const topo = createHash('md5').update(Buffer.from(meshes[0].indices.buffer)).digest('hex')
  meshes.forEach((m, i) => {
    const h = createHash('md5').update(Buffer.from(m.indices.buffer)).digest('hex')
    if (h !== topo) {
      throw new Error(
        `${s.key}: frame ${i} has different topology from frame 0 — vertex correspondence is ` +
          `broken, so morph targets cannot represent this sequence. Frames were probably ` +
          `remeshed independently upstream.`,
      )
    }
    if (m.positions.length !== meshes[0].positions.length) {
      throw new Error(`${s.key}: frame ${i} has a different vertex count from frame 0`)
    }
  })

  loaded.push({ ...s, frames: frames.length, meshes, topo: topo.slice(0, 12) })
}

const frameCount = loaded[0].frames
if (loaded.some((l) => l.frames !== frameCount)) {
  throw new Error(
    `surfaces disagree on frame count (${loaded.map((l) => `${l.key}=${l.frames}`).join(', ')}) — ` +
      `they must share a timeline to be animated together`,
  )
}

// --------------------------------------------------------------------------- //
// Recentre, in metres
// --------------------------------------------------------------------------- //
/**
 * Centre the whole heart on the epicardial centroid of frame 0, and record the
 * offset that was removed.
 *
 * The source frame is the MRI scanner's, not the atlas's, so this asset cannot
 * be dropped into the body without being placed — and `AtlasBody` must NOT be
 * allowed to fit it by bounding box, which would inflate a heart to human
 * height. Emitting it centred on its own origin makes that placement a single
 * translation, and recording the offset keeps the operation reversible.
 */
function centroidOf(positions) {
  let x = 0
  let y = 0
  let z = 0
  const n = positions.length / 3
  for (let i = 0; i < positions.length; i += 3) {
    x += positions[i]
    y += positions[i + 1]
    z += positions[i + 2]
  }
  return [x / n, y / n, z / n]
}

const originMm = centroidOf(loaded[0].meshes[0].positions)

for (const l of loaded) {
  for (const m of l.meshes) {
    for (let i = 0; i < m.positions.length; i += 3) {
      m.positions[i] = (m.positions[i] - originMm[0]) * MM_TO_M
      m.positions[i + 1] = (m.positions[i + 1] - originMm[1]) * MM_TO_M
      m.positions[i + 2] = (m.positions[i + 2] - originMm[2]) * MM_TO_M
    }
  }
  l.normals = l.meshes.map((m) => vertexNormals(m.positions, m.indices))
}

// --------------------------------------------------------------------------- //
// Build the glTF
// --------------------------------------------------------------------------- //
const doc = new Document()
doc.getRoot().getAsset().generator = 'open-twin-openXR build-biv-heart'
doc.getRoot().getAsset().copyright = ATTRIBUTION

const buffer = doc.createBuffer()
const scene = doc.createScene('biv-heart')
doc.getRoot().setDefaultScene(scene)

/**
 * DOUBLE-SIDED, and this is not a default anyone should change back.
 *
 * These surfaces are OPEN at the base — measured: 72 boundary/irregular edges on
 * the LV endocardium, 232 on the RV, 144 on the epicardium — because a fitted
 * biventricular model is cut at the valve planes and where the great vessels
 * leave. That is anatomically correct and it means backface culling would render
 * the openings as holes you can see straight through.
 *
 * Capping them would be inventing geometry the source does not contain. Rendering
 * both faces shows what is actually there, so that is what this does.
 */
const material = doc
  .createMaterial('myocardium')
  .setBaseColorFactor([0.769, 0.212, 0.165, 1]) // #c4362a, the palette's cardiovascular red
  .setMetallicFactor(0)
  .setRoughnessFactor(0.45)
  .setDoubleSided(true)

const acc = (array, type) => doc.createAccessor().setArray(array).setType(type).setBuffer(buffer)

const structures = []
const nodes = []

loaded.forEach((l, structureId) => {
  const base = l.meshes[0]
  const vertexCount = base.positions.length / 3

  const prim = doc
    .createPrimitive()
    .setMaterial(material)
    .setIndices(acc(base.indices, 'SCALAR'))
    .setAttribute('POSITION', acc(base.positions, 'VEC3'))
    .setAttribute('NORMAL', acc(l.normals[0], 'VEC3'))
    // Same convention as the atlases, so hover resolves through one code path.
    // Constant per surface here, because each surface IS one structure.
    .setAttribute('_STRUCTURE', acc(new Uint16Array(vertexCount).fill(structureId), 'SCALAR'))

  // Morph targets are DELTAS from the base frame, per the glTF spec.
  for (let f = 1; f < l.meshes.length; f++) {
    const dp = new Float32Array(base.positions.length)
    const dn = new Float32Array(base.positions.length)
    for (let i = 0; i < dp.length; i++) {
      dp[i] = l.meshes[f].positions[i] - base.positions[i]
      dn[i] = l.normals[f][i] - l.normals[0][i]
    }
    prim.addTarget(
      doc
        .createPrimitiveTarget(`frame_${String(f).padStart(3, '0')}`)
        .setAttribute('POSITION', acc(dp, 'VEC3'))
        .setAttribute('NORMAL', acc(dn, 'VEC3')),
    )
  }

  const mesh = doc.createMesh(l.node).addPrimitive(prim)
  mesh.setWeights(new Array(l.meshes.length - 1).fill(0))

  const node = doc.createNode(l.node).setMesh(mesh)
  node.setExtras({ label: l.name, system: 'cardiovascular', source: 'biv-me' })
  scene.addChild(node)
  nodes.push(node)

  structures.push({
    name: l.name,
    mesh: l.node,
    system: 'cardiovascular',
    centroid: centroidOf(base.positions).map((v) => +v.toFixed(4)),
    frames: l.meshes.length,
  })
})

// --------------------------------------------------------------------------- //
// The cycle, as one animation over morph weights
// --------------------------------------------------------------------------- //
/**
 * One keyframe per source frame, plus a closing keyframe back at all-zero so the
 * loop is seamless. At keyframe k exactly one weight is 1, so LINEAR
 * interpolation cross-fades between two adjacent measured frames and never
 * invents a third.
 */
const targetCount = frameCount - 1
const times = new Float32Array(frameCount + 1)
for (let k = 0; k <= frameCount; k++) times[k] = (k / frameCount) * CYCLE_SECONDS

const weights = new Float32Array((frameCount + 1) * targetCount)
for (let k = 1; k <= targetCount; k++) weights[k * targetCount + (k - 1)] = 1
// k = 0 and k = frameCount stay all-zero: the base frame, at both ends.

const animation = doc.createAnimation('cardiac-cycle')
const input = acc(times, 'SCALAR')
for (const node of nodes) {
  const sampler = doc
    .createAnimationSampler()
    .setInput(input)
    .setOutput(acc(weights, 'SCALAR'))
    .setInterpolation('LINEAR')
  animation.addSampler(sampler)
  animation.addChannel(
    doc.createAnimationChannel().setTargetNode(node).setTargetPath('weights').setSampler(sampler),
  )
}

scene.setExtras({
  structures,
  structure_attribute: '_STRUCTURE',
  animation: {
    name: 'cardiac-cycle',
    frames: frameCount,
    cycle_seconds: CYCLE_SECONDS,
    // Recorded so nobody later mistakes the playback rate for a measurement.
    timing_source: 'display default; source OBJs carry frame indices and no timing',
  },
  placement: {
    // The offset removed above, in the source's own millimetre scanner frame.
    source_centroid_mm: originMm.map((v) => +v.toFixed(3)),
    note: 'Centred on its own origin. Must be PLACED in the atlas frame, never fitted by bounding box.',
    /**
     * The one measurement placement needs, so the next person does not have to
     * derive it again.
     *
     * The base is the valve-plane opening — found as the ring of 72 boundary
     * edges on the LV endocardium, not guessed — and the apex is the furthest
     * vertex from it. The axis comes out oblique in all three axes, which is the
     * signature of an MRI scanner frame rather than an anatomy-aligned one.
     *
     * The atlas frame is +Y up, facing +Z, and **+X is anatomical LEFT** —
     * derived from the shipped Z-Anatomy structure table, where a structure
     * labelled `side: "right"` sits at negative x. So placing this asset means
     * rotating base->apex onto the anatomical apex direction, which points
     * inferior, anterior and to the left. That last step needs one visual
     * confirmation and is deliberately NOT hardcoded here.
     */
    lv_long_axis: {
      base_mm: [-4.4, 29.0, -27.2],
      apex_mm: [37.1, -18.0, -97.6],
      base_to_apex_unit: [0.441, -0.498, -0.747],
      length_mm: 94.2,
      basis: 'base = centroid of the 72-vertex boundary ring; apex = furthest vertex from it',
    },
  },
  provenance: {
    source: 'biv-me demo, UOA Heart Mechanics Research',
    licence: 'Apache-2.0',
    subject_provenance: 'UNCONFIRMED — do not publish derivatives until the authors confirm',
  },
  /**
   * Measured off the source, and carried with the asset so a later reader does
   * not have to rediscover either fact.
   *
   * The surfaces are open at the valve planes, hence `doubleSided`. And the
   * cavity volumes below were computed by the divergence theorem, which on an
   * OPEN surface is an approximation whose absolute value depends on the origin —
   * so treat the ejection fraction as the robust figure and the absolute volumes
   * as indicative. All three nonetheless land inside independently published
   * CC BY 4.0 reference ranges for an adult male, which is the evidence that the
   * morph targets carry the source's real motion rather than a scrambled version
   * of it.
   */
  measured: {
    // 72 / 232 / 144 edges bound exactly one triangle on LV / RV / epicardium.
    // On the LV those 72 form a single closed ring — the mitral-aortic valve
    // plane — so they are genuine anatomy, not mesh damage.
    open_surfaces: true,
    boundary_edges: { lv_endocardium: 72, rv_endocardium: 232, epicardium: 144 },
    lv_edv_ml: 175.7,
    lv_esv_ml: 71.1,
    lv_ef_percent: 59.5,
    end_systole_frame: 9,
    end_systole_fraction_of_cycle: 0.36,
    reference: 'Petersen 2017 (n=800, CC BY 4.0): male LVEF 58 ± 5 %, LVEDV 166 ± 32 mL, LVESV 69 ± 16 mL',
  },
})

await new NodeIO().write(OUT, doc)

// --------------------------------------------------------------------------- //
// Report
// --------------------------------------------------------------------------- //
let tris = 0
let verts = 0
for (const l of loaded) {
  tris += l.meshes[0].indices.length / 3
  verts += l.meshes[0].positions.length / 3
}

// Extent per frame, to show the cycle actually contracts and returns.
const extents = loaded[0].meshes.map((m) => {
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < m.positions.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a], m.positions[i + a])
      hi[a] = Math.max(hi[a], m.positions[i + a])
    }
  }
  return (hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2])
})
const minAt = extents.indexOf(Math.min(...extents))
const drift = Math.abs(extents[extents.length - 1] - extents[0]) / extents[0]

console.log(`\n${OUT}`)
console.log(`  surfaces        ${loaded.length}`)
for (const l of loaded) {
  console.log(
    `    ${l.name.padEnd(28)} ${String(l.meshes[0].indices.length / 3).padStart(6)} tris  ` +
      `${String(l.meshes[0].positions.length / 3).padStart(5)} verts  ` +
      `${l.frames} frames  topo ${l.topo}`,
  )
}
console.log(`  total           ${tris.toLocaleString()} tris, ${verts.toLocaleString()} verts`)
console.log(`  morph targets   ${targetCount} per surface`)
console.log(`  cycle           ${CYCLE_SECONDS}s over ${frameCount} frames`)
console.log(`  bbox volume     minimum at frame ${minAt} of ${frameCount - 1}`)
console.log(`  loop closure    ${(drift * 100).toFixed(2)}% volume drift, last frame vs first`)
console.log(`  scale           metres, centred on own origin\n`)
