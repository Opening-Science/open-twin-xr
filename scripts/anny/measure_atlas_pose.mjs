#!/usr/bin/env node
/**
 * Measure each atlas's limb pose, so the ANNY envelope can be baked to match it.
 *
 * WHAT THIS ANSWERS
 * -----------------
 * D16 measured that the envelope encloses the torso and not the limbs, and that
 * the difference is ANGULAR rather than dimensional — the envelope stands in
 * ANNY's wide A-pose while Z-Anatomy stands with its arms at its sides. A scale
 * cannot fix an angle. What can is posing the envelope, and posing it needs a
 * target: for each atlas, the direction each limb segment actually points.
 *
 * That is all this script produces — six unit vectors per side per atlas, plus
 * the provenance of each one. `scripts/anny/bake.py --pose <id>` consumes them.
 *
 * ⚠️ GENERATED OUTPUT. `scripts/anny/atlas-poses.json` is written by this script
 * and must never be hand-edited. D18 is the reason it is spelled out: a
 * hand-typed structure id in a generated document silently invalidated a mask
 * and would have hidden the wrong anatomy. A hand-typed pose vector would
 * silently mis-pose a body, which is the same failure with a nicer surface.
 *
 * ⚠️ REGISTRATION IS DELIBERATELY NOT APPLIED, AND THAT IS A CORRECTNESS
 * ARGUMENT RATHER THAN A SHORTCUT. `AtlasBody.fit` registers every atlas into
 * the canonical frame with a UNIFORM scale plus a translation. A unit direction
 * is invariant under both, so measuring before or after registration gives the
 * same axis to floating point. What is NOT invariant is the per-node transform
 * inside a quantised asset, which can scale the axes differently — so node
 * matrices ARE applied, in full, below.
 *
 * ⚠️ MEASURED ON WHAT THE REGISTRY LOADS, with one documented exception. The
 * first cut of this work measured `z-anatomy.glb`, `hra.glb` and friends —
 * intermediate files that are NOT shipped. The registry loads the `.ao.glb`
 * variants, and reading the wrong file gave a bounding box in raw quantised
 * integers (65534 "metres" tall) that looked like a real measurement. Every
 * source below is the registry's own url, read from `anatomySources.ts` rather
 * than typed here.
 *
 * The exception is HRA. Its shipped asset merges 956 named meshes down to 96
 * unnamed nodes and carries no structure table, so nothing in it can name a
 * femur. The unmerged `hra.glb` is the same geometry before that merge, and
 * this script VERIFIES that claim (bounding boxes must agree within 1 mm)
 * rather than assuming it. If the check fails the atlas is reported unmeasured;
 * it does not fall back to a guess.
 *
 *     node scripts/anny/measure_atlas_pose.mjs
 *     node scripts/anny/measure_atlas_pose.mjs --json   # machine-readable only
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../..')
const MODELS = resolve(REPO, 'public/models')

/**
 * The four segments a pose is expressed in, and the ANNY bones each one drives.
 *
 * ⚠️ TWO BONES PER SEGMENT, AND BOTH GET THE SAME ROTATION. ANNY splits every
 * limb segment into a bone and its twist bone (`upperarm01` / `upperarm02`).
 * The upstream tutorial poses both halves together, and driving only the first
 * leaves the twist bone in the rest pose — which bends the limb in the middle.
 */
/**
 * `minLengthM` is a FRAGMENT TEST, not a size expectation.
 *
 * ⚠️ A PARTIAL BONE STILL FITS AN AXIS, AND THE AXIS IS MEANINGLESS. The CT
 * torso atlas holds 9 cm of one forearm where a forearm is ~25 cm; PCA over
 * that stub returns a confident unit vector pointing wherever the stub happens
 * to lie. These floors are set at roughly 60 % of the shortest plausible adult
 * segment, so a real bone always clears them and a fragment never does. Every
 * atlas here is an adult, and the CT sources are life-size, so absolute metres
 * are the right units for this test.
 */
const SEGMENTS = {
  upperarm: { bones: ['upperarm01', 'upperarm02'], label: 'upper arm', minLengthM: 0.18 },
  forearm: { bones: ['lowerarm01', 'lowerarm02'], label: 'forearm', minLengthM: 0.15 },
  thigh: { bones: ['upperleg01', 'upperleg02'], label: 'thigh', minLengthM: 0.25 },
  shank: { bones: ['lowerleg01', 'lowerleg02'], label: 'shank', minLengthM: 0.2 },
}

/**
 * How each atlas names its own long bones.
 *
 * ⚠️ ONE ADAPTER PER ATLAS, BECAUSE THERE IS NO SHARED VOCABULARY. Z-Anatomy
 * carries a structure table with a `side` field; BodyParts3D carries one where
 * the side is part of the name ("left femur"); HRA names its mesh NODES
 * (`VH_F_femur_R`); the CT atlases name theirs by bare UBERON id, and
 * `htb-ct-003` puts BOTH sides in one mesh so it has to be split by x sign.
 *
 * A forearm or shank takes two bones (radius+ulna, tibia+fibula) and is
 * measured from their union — one bone alone gives a systematically rotated
 * axis, because neither runs down the middle of the segment.
 */
const BONE_NAMES = {
  structureTable: {
    // Z-Anatomy: `name` + `side` fields, capitalised singular.
    'z-anatomy': {
      match: (s, want, side) =>
        (s.side ?? null) === side && want.some((w) => (s.name ?? '').toLowerCase() === w),
      upperarm: ['humerus'],
      forearm: ['radius', 'ulna'],
      thigh: ['femur'],
      shank: ['tibia', 'fibula'],
    },
    // BodyParts3D: side is a word inside the name, and there is no `side` field.
    //
    // ⚠️ `thigh` IS AN ALIAS FOR THE FEMUR HERE, AND IT IS NOT A TIDINESS FIX.
    // The atlas names the left bone "left femur" and the right one "right
    // thigh" — measured, not assumed. Without the alias the right thigh reports
    // "no geometry found" while the left measures fine, which reads as a
    // missing bone rather than as a naming inconsistency in the source data.
    bodyparts3d: {
      match: (s, want, side) => want.some((w) => (s.name ?? '').toLowerCase() === `${side} ${w}`),
      upperarm: ['humerus'],
      forearm: ['radius', 'ulna'],
      thigh: ['femur', 'thigh'],
      shank: ['tibia', 'fibula'],
    },
    /**
     * The regions atlas has no bones at all — it is 257 surface regions. Its
     * pose is still measurable from the regions that COVER each segment, and
     * measuring it is the point: `z-anatomy-regions` is expected to share
     * `z-anatomy`'s pose (same upstream export), and this is what turns that
     * expectation into a checked claim rather than an assumption.
     *
     * ⚠️ Matched by prefix, not equality, because the names are compound
     * ("Anterior region of arm", "Posterior region of forearm") and both
     * aspects of a segment are wanted. One source name is misspelled
     * ("Anterior region of thighj") and carries no side, so it is excluded by
     * the side test rather than by a special case.
     */
    'z-anatomy-regions': {
      match: (s, want, side) => {
        if ((s.side ?? null) !== side) return false
        const n = (s.name ?? '').toLowerCase()
        return want.some((w) => n.endsWith(` of ${w}`))
      },
      upperarm: ['arm'],
      forearm: ['forearm'],
      thigh: ['thigh'],
      shank: ['leg'],
    },
  },
  /** Mesh-node naming, for the atlases with no structure table. */
  nodeName: {
    hra: { suffix: (side) => (side === 'left' ? '_L' : '_R'), stems: hraStems('VH_F') },
    'hra-m': { suffix: (side) => (side === 'left' ? '_L' : '_R'), stems: hraStems('VH_M') },
  },
  /** UBERON ids. `split` means one mesh holds both sides and x sign separates them. */
  uberon: {
    upperarm: ['UBERON_0000976'],
    forearm: ['UBERON_0001423', 'UBERON_0001424'],
    thigh: ['UBERON_0000981'],
    shank: ['UBERON_0000979', 'UBERON_0001446'],
  },
}

function hraStems(prefix) {
  return {
    upperarm: [`${prefix}_humerus`],
    forearm: [`${prefix}_radius`, `${prefix}_ulna`],
    thigh: [`${prefix}_femur`],
    shank: [`${prefix}_tibia`, `${prefix}_fibula`],
  }
}

/* ------------------------------------------------------------------ *
 * Geometry helpers. No three.js here — this is a build script, and the
 * app's copy of three is not a build dependency.
 * ------------------------------------------------------------------ */

/** Compose a node's local TRS into a 4x4, column-major as glTF stores it. */
function trs(node) {
  const t = node.getTranslation()
  const r = node.getRotation() // quaternion xyzw
  const s = node.getScale()
  const [x, y, z, w] = r
  const x2 = x + x,
    y2 = y + y,
    z2 = z + z
  const xx = x * x2,
    xy = x * y2,
    xz = x * z2
  const yy = y * y2,
    yz = y * z2,
    zz = z * z2
  const wx = w * x2,
    wy = w * y2,
    wz = w * z2
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ]
}

function mul(a, b) {
  const o = new Array(16).fill(0)
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]
  return o
}

function apply(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ]
}

/** Every mesh in the scene, with its world matrix and its node's name. */
function meshInstances(scene) {
  const out = []
  const walk = (node, parent) => {
    const world = mul(parent, trs(node))
    const mesh = node.getMesh()
    if (mesh) out.push({ mesh, world, name: node.getName() || mesh.getName() || '' })
    for (const child of node.listChildren()) walk(child, world)
  }
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  for (const node of scene.listChildren()) walk(node, I)
  return out
}

/**
 * The principal axis of a point cloud, by power iteration on its covariance.
 *
 * A long bone is overwhelmingly its own longest dimension, so the dominant
 * eigenvector IS the shaft direction. Power iteration converges in a handful of
 * steps here and needs no eigen library; the covariance is 3x3.
 */
function principalAxis(points) {
  const n = points.length / 3
  if (n < 8) return null
  let cx = 0,
    cy = 0,
    cz = 0
  for (let i = 0; i < points.length; i += 3) {
    cx += points[i]
    cy += points[i + 1]
    cz += points[i + 2]
  }
  cx /= n
  cy /= n
  cz /= n
  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0
  for (let i = 0; i < points.length; i += 3) {
    const dx = points[i] - cx,
      dy = points[i + 1] - cy,
      dz = points[i + 2] - cz
    xx += dx * dx; xy += dx * dy; xz += dx * dz
    yy += dy * dy; yz += dy * dz; zz += dz * dz
  }
  let v = [0, -1, 0]
  for (let it = 0; it < 64; it++) {
    const nx = xx * v[0] + xy * v[1] + xz * v[2]
    const ny = xy * v[0] + yy * v[1] + yz * v[2]
    const nz = xz * v[0] + yz * v[1] + zz * v[2]
    const len = Math.hypot(nx, ny, nz)
    if (len < 1e-20) return null
    v = [nx / len, ny / len, nz / len]
  }
  return { axis: v, centroid: [cx, cy, cz] }
}

/** The two extreme points of a cloud along its own axis, and its extent. */
function extremes(points, axis, centroid) {
  let lo = Infinity, hi = -Infinity, loP = null, hiP = null
  for (let i = 0; i < points.length; i += 3) {
    const d =
      (points[i] - centroid[0]) * axis[0] +
      (points[i + 1] - centroid[1]) * axis[1] +
      (points[i + 2] - centroid[2]) * axis[2]
    if (d < lo) { lo = d; loP = [points[i], points[i + 1], points[i + 2]] }
    if (d > hi) { hi = d; hiP = [points[i], points[i + 1], points[i + 2]] }
  }
  return { ends: [loP, hiP], lengthM: hi - lo }
}

/**
 * Orient two chained segments proximal -> distal, by finding the joint between
 * them.
 *
 * ⚠️ PCA GIVES A LINE, NOT AN ARROW. The sign is arbitrary, and getting it
 * wrong points a limb backwards — which renders as a plausible body with an arm
 * on inside out, not as an obvious failure.
 *
 * ⚠️ THE OBVIOUS RULE IS WRONG, AND IT WAS TRIED FIRST. "The proximal end is
 * the one nearer the body's centre" is true for the leg and FALSE for the arm:
 * the body's bounding-box centre sits at about navel height, and the elbow is
 * nearer to the navel than the shoulder is. Measured on Z-Anatomy, it put every
 * arm axis at y = +0.98 — pointing from elbow to shoulder, i.e. straight up.
 *
 * What is true regardless of pose, atlas or limb: **two chained segments share
 * a joint**, and that joint is where their nearest endpoints meet. So the elbow
 * is whichever pairing of (humerus end, forearm end) is closest, and everything
 * else follows — the humerus points TOWARDS it, the forearm points AWAY from
 * it. This needs no anatomical prior and survives the raised-arm CT, where a
 * shoulder sits below an elbow and every y-based rule inverts.
 *
 * The gap at the found joint is reported, because a large one means the two
 * clouds are not actually a chain and the orientation should not be trusted.
 */
function orientChain(proximalSeg, distalSeg) {
  const a = proximalSeg.extremes.ends
  const b = distalSeg.extremes.ends
  let best = { d: Infinity, i: 0, j: 0 }
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      const d = Math.hypot(a[i][0] - b[j][0], a[i][1] - b[j][1], a[i][2] - b[j][2])
      if (d < best.d) best = { d, i, j }
    }
  // The proximal segment points TOWARDS the shared joint; the distal one AWAY.
  const sign = (seg, endIdx, towards) => {
    const from = seg.extremes.ends[towards ? 1 - endIdx : endIdx]
    const to = seg.extremes.ends[towards ? endIdx : 1 - endIdx]
    const dot =
      (to[0] - from[0]) * seg.axis[0] +
      (to[1] - from[1]) * seg.axis[1] +
      (to[2] - from[2]) * seg.axis[2]
    return dot < 0 ? [-seg.axis[0], -seg.axis[1], -seg.axis[2]] : seg.axis
  }
  return {
    jointGapM: best.d,
    joint: a[best.i],
    proximalAxis: sign(proximalSeg, best.i, true),
    distalAxis: sign(distalSeg, best.j, false),
  }
}

/* ------------------------------------------------------------------ *
 * Reading vertices for a segment, per atlas flavour.
 * ------------------------------------------------------------------ */

/** Vertices belonging to a set of structure-table ids, via `_STRUCTURE`. */
function pointsForStructures(instances, ids) {
  const want = new Set(ids)
  const out = []
  for (const { mesh, world } of instances) {
    for (const prim of mesh.listPrimitives()) {
      const sAttr = prim.getAttribute('_STRUCTURE')
      const pos = prim.getAttribute('POSITION')
      if (!sAttr || !pos) continue
      const n = pos.getCount()
      const p = [0, 0, 0]
      for (let i = 0; i < n; i++) {
        if (!want.has(sAttr.getScalar(i))) continue
        pos.getElement(i, p)
        const w = apply(world, p)
        out.push(w[0], w[1], w[2])
      }
    }
  }
  return out
}

/** Vertices of whole mesh nodes whose name matches, optionally split by x sign. */
function pointsForNodes(instances, predicate, side, splitBySide, bodyCentreX) {
  const out = []
  for (const { mesh, world, name } of instances) {
    if (!predicate(name)) continue
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')
      if (!pos) continue
      const n = pos.getCount()
      const p = [0, 0, 0]
      for (let i = 0; i < n; i++) {
        pos.getElement(i, p)
        const w = apply(world, p)
        if (splitBySide) {
          /**
           * ⚠️ ANATOMICAL LEFT IS +x, AND THIS WAS WRITTEN THE OTHER WAY ROUND
           * FIRST. Measured, twice, independently: Z-Anatomy's structures with
           * `side: 'left'` have mean centroid x = +0.090 against right's
           * −0.093, and HRA-male's `_L` nodes average x = +0.016 against `_R`
           * at −0.015. Reasoning from "the body faces +z" gave the opposite
           * answer and would have swapped the arms on every atlas split this
           * way — a mirrored pose that looks entirely plausible on a
           * near-symmetric body.
           */
          const isLeft = w[0] > bodyCentreX
          if ((side === 'left') !== isLeft) continue
        }
        out.push(w[0], w[1], w[2])
      }
    }
  }
  return out
}

/**
 * Extract an arm's centreline from the body surface, for an atlas that has arms
 * but no arm bones.
 *
 * ⚠️ WHY THIS EXISTS, AND WHY THE TWO SIMPLER IDEAS BOTH FAILED MEASURABLY.
 * HRA models no clavicle, scapula, humerus, radius or ulna — but it ships
 * `VH_F_skin`, so it HAS arms and they are 0.986 m across in the canonical
 * frame. Two cheaper answers were tried and measured against that body:
 *
 *   borrow the standing atlas's arms   span 0.643 m   -0.34 m, and WRONG
 *   leave the arms at ANNY's rest      span 1.061 m   +0.08 m span, but the
 *                                      containment collapsed — the total width
 *                                      matched by coincidence while the arms
 *                                      sat at the wrong angle entirely
 *
 * The second is the instructive one: it shows span alone cannot judge a pose,
 * which is why the acceptance check measures containment beside it.
 *
 * THE METHOD. At any height through the upper body, an arm is a cluster of
 * surface separated from the torso by a gap in x. Walking down in slices and
 * taking the OUTERMOST cluster's centroid traces the arm's centreline; a line
 * fitted through those centroids is its axis. Unlike a bulk selection of
 * "everything lateral to the torso" — which returns the whole side of the body
 * and an axis pointing straight down — this follows the limb.
 *
 * ⚠️ It yields ONE direction for the whole limb. A surface silhouette cannot
 * separate an upper arm from a forearm, so both bones take the same axis and
 * the arm is posed straight. Stated in the output, not hidden.
 */
function armFromSlices(instances, stats, side) {
  const { min, max, centre } = stats
  const height = max[1] - min[1]
  const sign = side === 'left' ? 1 : -1
  // Sample the upper body only: shoulder down to fingertips of a hanging arm,
  // which is roughly the top half. Below that the legs would be picked up.
  const yTop = min[1] + height * 0.8
  const yBot = min[1] + height * 0.42
  const SLICES = 24
  const band = (yTop - yBot) / SLICES
  const buckets = Array.from({ length: SLICES }, () => [])
  for (const { mesh, world } of instances) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')
      if (!pos) continue
      const p = [0, 0, 0]
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, p)
        const w = apply(world, p)
        const bi = Math.floor((w[1] - yBot) / band)
        if (bi < 0 || bi >= SLICES) continue
        const dx = (w[0] - centre[0]) * sign
        if (dx > 0) buckets[bi].push([dx, w[1], w[2]])
      }
    }
  }
  const pts = []
  for (const bucket of buckets) {
    if (bucket.length < 30) continue
    bucket.sort((a, b) => a[0] - b[0])
    // Find the outermost cluster: walk in from the most lateral point until a
    // gap wider than `GAP` appears. That gap is the space between arm and torso.
    const GAP = 0.02
    const end = bucket.length - 1
    let start = end
    while (start > 0 && bucket[start][0] - bucket[start - 1][0] < GAP) start--
    // A cluster that reaches the midline is the torso itself, not an arm.
    if (start === 0) continue
    const n = end - start + 1
    if (n < 10) continue
    let sx = 0, sy = 0, sz = 0
    for (let i = start; i <= end; i++) {
      sx += bucket[i][0]
      sy += bucket[i][1]
      sz += bucket[i][2]
    }
    pts.push([centre[0] + (sx / n) * sign, sy / n, sz / n])
  }
  if (pts.length < 6) return null
  // The centreline, proximal (highest) to distal (lowest).
  pts.sort((a, b) => b[1] - a[1])
  const flat = []
  for (const p of pts) flat.push(p[0], p[1], p[2])
  const pca = principalAxis(flat)
  if (!pca) return null
  const first = pts[0]
  const last = pts[pts.length - 1]
  const v = [last[0] - first[0], last[1] - first[1], last[2] - first[2]]
  const dot = v[0] * pca.axis[0] + v[1] * pca.axis[1] + v[2] * pca.axis[2]
  const axis = dot < 0 ? pca.axis.map((c) => -c) : pca.axis
  return {
    axis,
    slices: pts.length,
    lengthM: Math.hypot(v[0], v[1], v[2]),
  }
}

function bodyStats(instances) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const { mesh, world } of instances) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')
      if (!pos) continue
      const n = pos.getCount()
      const p = [0, 0, 0]
      for (let i = 0; i < n; i++) {
        pos.getElement(i, p)
        const w = apply(world, p)
        for (let k = 0; k < 3; k++) {
          if (w[k] < min[k]) min[k] = w[k]
          if (w[k] > max[k]) max[k] = w[k]
        }
      }
    }
  }
  const size = max.map((v, i) => v - min[i])
  const centre = max.map((v, i) => (v + min[i]) / 2)
  return { min, max, size, centre }
}

/* ------------------------------------------------------------------ *
 * Per-atlas measurement.
 * ------------------------------------------------------------------ */

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })

async function load(file) {
  const doc = await io.read(resolve(MODELS, file))
  const scene = doc.getRoot().listScenes()[0]
  return { doc, scene, instances: meshInstances(scene) }
}

/**
 * Read the registry's own urls rather than restating them.
 *
 * ⚠️ THE SHIPPED ASSET IS THE `.ao.glb`, NOT THE `.glb`, for five of the seven
 * sources. Typing the file names here is exactly how the first measurement pass
 * ended up reporting a body 65,534 units tall: it read an intermediate file that
 * happens to exist beside the real one. Parsed from source, so the two cannot
 * drift.
 */
function registryUrls() {
  const src = readFileSync(resolve(REPO, 'src/scene/anatomySources.ts'), 'utf8')
  const out = {}
  const rx = /id:\s*'([a-z0-9-]+)'[\s\S]{0,4000}?url:\s*'\/models\/([A-Za-z0-9._-]+)'/g
  let m
  while ((m = rx.exec(src))) if (!out[m[1]]) out[m[1]] = m[2]
  return out
}

/**
 * Each atlas's donor label, parsed from the registry.
 *
 * Used for one job only: an atlas whose own geometry cannot yield a trustworthy
 * axis may inherit the pose of another atlas DECLARED TO BE THE SAME BODY. The
 * regions atlas is the case in point — it carries no bones at all, and it and
 * `z-anatomy` both declare the donor "TARO, via Z-Anatomy retopology" from the
 * same retopology, so they are one export of one body. Inheriting there is a
 * statement about provenance rather than a guess about shape.
 *
 * ⚠️ NOT a general same-donor rule. BodyParts3D is also TARO, but it is a
 * different reconstruction with its own label, and it measures its own pose
 * perfectly well. Inheritance is the fallback for atlases that cannot measure,
 * never a shortcut for atlases that can.
 */
function donorLabels() {
  const src = readFileSync(resolve(REPO, 'src/scene/anatomySources.ts'), 'utf8')
  const out = {}
  const rx = /id:\s*'([a-z0-9-]+)'[\s\S]{0,6000}?donor:\s*\{[\s\S]{0,400}?label:\s*'([^']+)'/g
  let m
  while ((m = rx.exec(src))) if (!out[m[1]]) out[m[1]] = m[2]
  return out
}

/** `composedMap()`'s musculoskeletal source, parsed rather than restated. */
function composedMusculoskeletal() {
  const src = readFileSync(resolve(REPO, 'src/scene/anatomySources.ts'), 'utf8')
  const pick = (constName) => {
    const block = src.slice(src.indexOf(`export const ${constName}`))
    const m = block.match(/musculoskeletal:\s*'([a-z0-9-]+)'/)
    return m ? m[1] : null
  }
  return { composed: pick('COMPOSED_SOURCE'), 'composed-f': pick('COMPOSED_SOURCE_F') }
}

const SIDES = ['left', 'right']

/** Angle between two unit vectors, in degrees. */
function angleDeg(a, b) {
  const d = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))
  return (Math.acos(d) * 180) / Math.PI
}

/**
 * Below this, two poses are the same pose and one bake serves both.
 *
 * It is the same threshold `bake.py` uses to decide whether a bone is worth
 * driving at all: if a difference is too small to be worth posing, it is too
 * small to be worth a second asset.
 */
const SAME_POSE_DEG = 5

/**
 * Which atlases share a pose, measured rather than assumed.
 *
 * ⚠️ THE EXPECTED SHARINGS ARE NOT ASSERTED HERE, THEY ARE TESTED. Z-Anatomy
 * and the regions atlas come from the same upstream export and BodyParts3D is
 * the same donor as Z-Anatomy, so all three are EXPECTED to agree — but an
 * expectation written into a table is how a wrong pose ships. Grouping is done
 * on the numbers, and the report prints the worst disagreement inside each
 * group so a marginal grouping is visible rather than silent.
 */
function groupPoses(measured) {
  const measuredCount = (id) =>
    Object.values(measured[id].segments ?? {}).filter((s) => s.source === 'measured').length
  /**
   * ⚠️ BEST-MEASURED FIRST, AND COMPARED ON MEASURED SEGMENTS ONLY. Both halves
   * of that were got wrong first, and together they mis-grouped the atlases.
   *
   * Comparing DEFAULTED segments manufactures agreement: HRA has no arms, so its
   * arms are filled from the standing default, and comparing those against
   * BodyParts3D's real arms compares the default with itself. Iterating in
   * object order then made HRA — which measures four segments of eight — the
   * primary of a group containing two atlases that measure all eight, so the
   * output read "BodyParts3D uses HRA's pose" when the truth is the reverse.
   */
  const ids = Object.keys(measured)
    .filter((id) => measuredCount(id) > 0)
    .sort((a, b) => measuredCount(b) - measuredCount(a))
  /**
   * ⚠️ AGREEING ON ANGLES IS NOT ENOUGH — THE SAME LIMBS HAVE TO BE POSED.
   *
   * A bake is one asset with all four limbs in it, so two atlases can only
   * share one if they want the same limbs MOVED and the same limbs LEFT ALONE.
   * Comparing only the segments both measured misses that completely: HRA
   * measures its legs and leaves its arms at rest, BodyParts3D measures all
   * eight, and their legs agree within 5 deg — so HRA was assigned BodyParts3D's
   * bake and silently inherited its arms-at-the-sides, which is the exact 34 cm
   * error the rest-pose fallback above was introduced to stop. The two rules
   * only work together.
   */
  const posedKeys = (id) =>
    Object.entries(measured[id].segments ?? {})
      .filter(([, s]) => s.source === 'measured')
      .map(([k]) => k)
      .sort()
      .join(',')
  const compare = (a, b) => {
    if (posedKeys(a) !== posedKeys(b)) return { worst: -1, shared: 0, pattern: false }
    let worst = -1
    let shared = 0
    for (const key of Object.keys(measured[a].segments)) {
      const sa = measured[a].segments[key]
      const sb = measured[b].segments?.[key]
      if (sa?.source !== 'measured' || sb?.source !== 'measured') continue
      shared++
      worst = Math.max(worst, angleDeg(sa.axis, sb.axis))
    }
    return { worst, shared, pattern: true }
  }
  const groups = []
  for (const id of ids) {
    const fit = groups.find((g) => {
      const { worst, shared } = compare(g.members[0], id)
      return shared >= 4 && worst >= 0 && worst < SAME_POSE_DEG
    })
    if (fit) {
      const { worst } = compare(fit.members[0], id)
      fit.members.push(id)
      fit.worstWithinDeg = Math.max(fit.worstWithinDeg, worst)
    } else {
      groups.push({ id, members: [id], worstWithinDeg: 0 })
    }
  }
  return groups
}

async function measureAtlas(id, file, opts = {}) {
  const { instances } = await load(file)
  const stats = bodyStats(instances)
  const result = {
    atlas: id,
    measuredFrom: file,
    bbox: {
      widthM: +stats.size[0].toFixed(4),
      heightM: +stats.size[1].toFixed(4),
      depthM: +stats.size[2].toFixed(4),
      widthOverHeight: +(stats.size[0] / stats.size[1]).toFixed(4),
    },
    segments: {},
    notes: [],
  }
  if (opts.note) result.notes.push(opts.note)

  const table = BONE_NAMES.structureTable[id]
  const nodeCfg = BONE_NAMES.nodeName[id]
  let structures = null
  if (table) {
    const { scene } = await load(file)
    structures = (scene.getExtras() ?? {}).structures ?? []
  }

  const raw = {}
  for (const segKey of Object.keys(SEGMENTS)) {
    for (const side of SIDES) {
      let pts = []
      let via = null
      if (table && structures) {
        const want = table[segKey]
        const ids = structures
          .map((s, i) => [i, s])
          .filter(([, s]) => table.match(s, want, side))
          .map(([i]) => i)
        if (ids.length) {
          pts = pointsForStructures(instances, ids)
          via = `structure table (${ids.length} entries)`
        }
      } else if (nodeCfg) {
        const suffix = nodeCfg.suffix(side)
        const stems = nodeCfg.stems[segKey]
        const pred = (n) => stems.some((st) => n === st + suffix)
        pts = pointsForNodes(instances, pred, side, false, stats.centre[0])
        via = `mesh nodes ${stems.map((s) => s + suffix).join(', ')}`
      } else {
        const uber = BONE_NAMES.uberon[segKey]
        // `.left` / `.right` suffixed first; if absent, one mesh per bone holds
        // both sides and x sign separates them.
        const suffixed = (n) => uber.some((u) => n === `${u}.${side}`)
        const anySuffixed = instances.some(({ name }) => uber.some((u) => name.startsWith(`${u}.`)))
        if (anySuffixed) {
          pts = pointsForNodes(instances, suffixed, side, false, stats.centre[0])
          via = `UBERON nodes ${uber.map((u) => u + '.' + side).join(', ')}`
        } else {
          pts = pointsForNodes(instances, (n) => uber.includes(n), side, true, stats.centre[0])
          via = `UBERON nodes ${uber.join(', ')} split by x sign`
        }
      }

      const key = `${segKey}.${side === 'left' ? 'L' : 'R'}`
      if (!pts.length) {
        result.segments[key] = { source: 'absent', via, note: 'no geometry found for this segment' }
        continue
      }
      const pca = principalAxis(pts)
      if (!pca) {
        result.segments[key] = { source: 'absent', via, note: 'too few vertices to fit an axis' }
        continue
      }
      raw[key] = {
        segKey, side, via,
        vertices: pts.length / 3,
        axis: pca.axis,
        extremes: extremes(pts, pca.axis, pca.centroid),
      }
    }
  }

  /**
   * Orient each limb by its own joint, not by a global rule. See `orientChain`.
   *
   * A segment whose chain partner is missing cannot be oriented this way and is
   * reported as `unoriented` rather than guessed at — an axis with an arbitrary
   * sign is worse than a stated gap, because it looks like an answer.
   */
  const CHAINS = [
    ['upperarm', 'forearm'],
    ['thigh', 'shank'],
  ]
  for (const side of SIDES) {
    const S = side === 'left' ? 'L' : 'R'
    for (const [pk, dk] of CHAINS) {
      const p = raw[`${pk}.${S}`]
      const d = raw[`${dk}.${S}`]
      const emit = (seg, key, axis, extra) => {
        const len = seg.extremes.lengthM
        const floor = SEGMENTS[seg.segKey].minLengthM
        const fragment = len < floor
        result.segments[key] = {
          source: fragment
            ? 'fragment'
            : axis
              ? 'measured'
              : extra?.untrusted
                ? 'untrusted'
                : 'unoriented',
          via: seg.via,
          vertices: seg.vertices,
          ...(axis && !fragment ? { axis: axis.map((v) => +v.toFixed(5)) } : {}),
          lengthM: +len.toFixed(4),
          bones: SEGMENTS[seg.segKey].bones.map((b) => `${b}.${S}`),
          ...extra,
          ...(fragment
            ? {
                note:
                  `⚠️ ${len.toFixed(3)} m of geometry where a ${SEGMENTS[seg.segKey].label} ` +
                  `is at least ${floor} m — a fragment, not a bone; no axis reported`,
              }
            : {}),
        }
      }
      if (p && d) {
        const o = orientChain(p, d)
        const gap = +o.jointGapM.toFixed(4)
        /**
         * A real joint is a contact, not a neighbourhood. 5 cm is generous for
         * an elbow or a knee and still catches clouds that are not a chain.
         *
         * ⚠️ AN UNTRUSTED AXIS IS NOT A MEASURED ONE, and this distinction is
         * why the flag exists rather than just printing a warning. The regions
         * atlas has no bones — it is surface patches — so "anterior region of
         * arm" fits an axis along the PATCH, which is skewed away from the limb
         * by up to 19°. Those axes look perfectly reasonable in isolation. The
         * joint gap is what exposes them: two patches that are not a kinematic
         * chain do not meet.
         */
        const trusted = o.jointGapM < 0.05
        const note = trusted
          ? undefined
          : `⚠️ joint gap ${gap} m — these clouds are not a kinematic chain, so the ` +
            `axis follows the geometry's own shape rather than the limb`
        emit(p, `${pk}.${S}`, trusted ? o.proximalAxis : null, {
          jointGapM: gap, ...(note ? { note, untrusted: true } : {}),
        })
        emit(d, `${dk}.${S}`, trusted ? o.distalAxis : null, {
          jointGapM: gap, ...(note ? { note, untrusted: true } : {}),
        })
      } else if (p || d) {
        const only = p ?? d
        emit(only, `${only.segKey}.${S}`, null, {
          note: `chain partner (${p ? dk : pk}.${S}) absent — axis direction cannot be resolved`,
        })
      }
    }
  }
  return result
}

/**
 * HRA ships merged and unnamed, so it is measured from the unmerged file.
 * The equivalence is CHECKED, not assumed: same bounding box to 1 mm.
 */
async function verifyUnmergedMatches(shipped, unmerged) {
  const a = bodyStats((await load(shipped)).instances)
  const b = bodyStats((await load(unmerged)).instances)
  const worst = Math.max(
    ...a.size.map((v, i) => Math.abs(v - b.size[i])),
    ...a.min.map((v, i) => Math.abs(v - b.min[i])),
  )
  return { ok: worst < 0.001, worstDeltaM: +worst.toFixed(6) }
}

async function main() {
  const jsonOnly = process.argv.includes('--json')
  const log = (...a) => !jsonOnly && console.log(...a)
  const urls = registryUrls()
  const composed = composedMusculoskeletal()

  log('Atlas urls from the registry:')
  for (const [id, f] of Object.entries(urls)) log(`  ${id.padEnd(20)} ${f}`)
  log('')

  const measured = {}

  for (const [id, file] of Object.entries(urls)) {
    let target = file
    const notes = []
    if (id === 'hra' || id === 'hra-m') {
      const unmerged = file.replace('.ao.glb', '.glb')
      const check = await verifyUnmergedMatches(file, unmerged)
      if (!check.ok) {
        log(`⚠️  ${id}: ${unmerged} does not match the shipped ${file} ` +
            `(worst bbox delta ${check.worstDeltaM} m) — NOT measured.`)
        measured[id] = {
          atlas: id, measuredFrom: null, segments: {},
          notes: [`unmerged file disagrees with shipped asset by ${check.worstDeltaM} m; refused to measure`],
        }
        continue
      }
      target = unmerged
      notes.push(
        `shipped asset ${file} is merged and unnamed; measured from ${unmerged}, ` +
        `verified to match its bounding box within ${check.worstDeltaM} m`,
      )
    }
    log(`measuring ${id} from ${target} …`)
    measured[id] = await measureAtlas(id, target, { note: notes[0] })
  }

  /**
   * Fill segments no atlas can supply, from a DECLARED default.
   *
   * ⚠️ HRA HAS NO ARMS AT ALL — not the bones, and not the vessels or nerves
   * either. Checked before defaulting: the only arm-named geometry in either
   * HRA asset is the brachiocephalic artery and vein, which are thoracic. So
   * the reviewed decision "vasculature if it reaches the arm, else a declared
   * default" resolves to the default, and this records WHICH default and why
   * rather than silently emitting an axis.
   *
   * The default is the standing arms-at-sides pose measured from Z-Anatomy —
   * chosen because the atlas being enveloped has no arm anatomy to contradict
   * it, and because a viewer reads a standing body as the neutral case. It is
   * labelled `default` in the output, so nothing downstream can mistake it for
   * something measured off this donor.
   */
  /**
   * A limb this atlas cannot measure STAYS AT ANNY'S REST POSE. It does not
   * borrow another atlas's limb.
   *
   * ⚠️ THIS REVERSES THE FIRST IMPLEMENTATION, AND THE MEASUREMENT IS WHY.
   * Borrowing looked reasonable — HRA has no arm bones, so fill its arms from
   * the standing atlas and at least have an answer. Measured against HRA's own
   * body, that answer was 34 cm WRONG and worse than doing nothing: HRA spans
   * 0.986 m across the arms in the canonical frame, the borrowed standing pose
   * gives 0.643 m, and ANNY's untouched rest pose gives 1.124 m. HRA's arms are
   * ABDUCTED, close to ANNY's own A-pose, and nothing about the donor it was
   * borrowing from said so.
   *
   * The general form of that: a limb's pose is a property of the body it
   * belongs to, and importing one from a different body is a claim about a
   * person that nothing measured. Rest is the honest answer — it is ANNY's own
   * shape, presented as itself, and it is what the envelope already was before
   * any of this work.
   *
   * ⚠️ ALSO WHY THE FILL IS PER-LIMB AND NEVER PER-SEGMENT. The CT torso atlas
   * measures a humerus raised up and forward but holds only a 9 cm stub of one
   * forearm; filling per segment gave it an upper arm going up and a forearm
   * hanging down, an elbow folded the wrong way. A limb is measured as a whole
   * or left alone as a whole.
   */
  /**
   * Before giving up on an arm, try the body surface. See `armFromSlices`.
   *
   * ⚠️ NOT FOR AN ATLAS THAT IS ANOTHER ATLAS'S BODY. The regions atlas is the
   * same Z-Anatomy export of the same donor, and Z-Anatomy measures all four
   * limbs from actual bone. Reading arms off the regions atlas's surface patches
   * instead gives a second, worse answer for one body, and — because the two
   * then disagree — splits them into two poses and two assets. Provenance beats
   * a surface fit: where a same-donor twin has measured bones, inherit from it.
   */
  const donorOf = donorLabels()
  const hasBoneTwin = (id) =>
    Object.keys(measured).some(
      (other) =>
        other !== id &&
        donorOf[other] &&
        donorOf[other] === donorOf[id] &&
        Object.values(measured[other].segments ?? {}).filter((s) => s.source === 'measured')
          .length >= 8,
    )
  for (const [id, m] of Object.entries(measured)) {
    if (!m.segments || !m.measuredFrom) continue
    if (hasBoneTwin(id)) continue
    for (const side of SIDES) {
      const S = side === 'left' ? 'L' : 'R'
      if (
        m.segments[`upperarm.${S}`]?.source === 'measured' &&
        m.segments[`forearm.${S}`]?.source === 'measured'
      )
        continue
      const { instances } = await load(m.measuredFrom)
      const arm = armFromSlices(instances, bodyStats(instances), side)
      if (!arm) continue
      for (const seg of ['upperarm', 'forearm']) {
        m.segments[`${seg}.${S}`] = {
          source: 'measured',
          via: `arm centreline from the body surface, ${arm.slices} slices — this atlas has arms but no arm bones`,
          axis: arm.axis.map((v) => +v.toFixed(5)),
          lengthM: +arm.lengthM.toFixed(4),
          bones: SEGMENTS[seg].bones.map((b) => `${b}.${S}`),
          note:
            'one direction for the whole limb: a surface silhouette cannot separate an ' +
            'upper arm from a forearm, so the arm is posed straight',
        }
      }
    }
  }

  const CHAIN_KEYS = [
    ['upperarm.L', 'forearm.L'],
    ['upperarm.R', 'forearm.R'],
    ['thigh.L', 'shank.L'],
    ['thigh.R', 'shank.R'],
  ]
  for (const [, m] of Object.entries(measured)) {
    if (!m.segments) continue
    for (const chain of CHAIN_KEYS) {
      const intact = chain.every((k) => m.segments[k]?.source === 'measured')
      if (intact) continue
      for (const k of chain) {
        const mine = m.segments[k]
        m.segments[k] = {
          ...(mine ?? {}),
          source: 'rest',
          axis: undefined,
          note:
            `this limb is not fully measurable here ` +
            `(${chain.map((c) => `${c}: ${m.segments[c]?.source ?? 'absent'}`).join(', ')}), ` +
            `so it keeps ANNY's rest pose rather than borrowing another body's`,
        }
      }
    }
  }

  /**
   * An atlas earns its OWN pose only by measuring a complete limb on both
   * sides. One measured limb is not a pose: it is a fragment of one, and baking
   * an asset around it would present a left arm placed from data and a right
   * arm placed from a default as though both were the same claim. Atlases that
   * do not clear the bar keep ANNY's rest pose throughout — the same reasoning
   * as the per-limb rule above, applied to the body as a whole.
   */
  for (const m of Object.values(measured)) {
    if (!m.segments) continue
    const bothSides =
      (m.segments['upperarm.L']?.source === 'measured' &&
        m.segments['forearm.L']?.source === 'measured' &&
        m.segments['upperarm.R']?.source === 'measured' &&
        m.segments['forearm.R']?.source === 'measured') ||
      (m.segments['thigh.L']?.source === 'measured' &&
        m.segments['shank.L']?.source === 'measured' &&
        m.segments['thigh.R']?.source === 'measured' &&
        m.segments['shank.R']?.source === 'measured')
    if (bothSides) continue
    const kept = Object.values(m.segments).filter((s) => s.source === 'measured').length
    if (!kept) continue
    m.notes = [
      ...(m.notes ?? []),
      `${kept} segment(s) measured but no complete limb on both sides — too little to define a ` +
        `pose, so the envelope keeps ANNY's rest pose here`,
    ]
    for (const k of Object.keys(m.segments)) {
      m.segments[k] = {
        ...m.segments[k],
        source: 'rest',
        axis: undefined,
        note: 'no complete limb measured on both sides in this atlas',
      }
    }
  }

  // Composed modes inherit the pose of whichever atlas supplies their skeleton.
  for (const [mode, sourceId] of Object.entries(composed)) {
    if (!sourceId || !measured[sourceId]) continue
    measured[mode] = {
      atlas: mode,
      inheritsFrom: sourceId,
      measuredFrom: measured[sourceId].measuredFrom,
      segments: measured[sourceId].segments,
      notes: [`inherits the pose of '${sourceId}', which supplies its musculoskeletal system`],
    }
  }

  // Which atlases share a pose — measured, then assigned.
  const groups = groupPoses(measured)
  const poses = {}
  for (const g of groups) {
    const primary = g.members[0]
    poses[primary] = {
      id: primary,
      members: g.members,
      worstWithinGroupDeg: +g.worstWithinDeg.toFixed(2),
      measuredFrom: measured[primary].measuredFrom,
      segments: measured[primary].segments,
    }
    for (const id of g.members) measured[id].poseId = primary
  }
  /**
   * An atlas that measured nothing may still inherit from the same body — see
   * `donorLabels`. Everything else keeps ANNY's rest pose, stated rather than
   * approximated.
   */
  const donors = donorLabels()
  for (const [id, m] of Object.entries(measured)) {
    if (m.poseId) continue
    const twin = Object.keys(measured).find(
      (other) =>
        other !== id && measured[other].poseId && donors[other] && donors[other] === donors[id],
    )
    if (twin) {
      m.poseId = measured[twin].poseId
      m.inheritsFrom = twin
      m.notes = [
        ...(m.notes ?? []),
        `no trustworthy axis of its own; inherits '${twin}', declared the same body ` +
          `("${donors[id]}")`,
      ]
      poses[m.poseId].members.push(id)
      continue
    }
    m.poseId = null
    m.notes = [...(m.notes ?? []), "no segment measurable — the envelope stays in ANNY's rest pose"]
  }

  const out = {
    generatedBy: 'scripts/anny/measure_atlas_pose.mjs',
    warning: 'GENERATED FILE — do not hand-edit. Re-run the script instead.',
    canonicalFrame:
      'Directions are unit vectors in the atlas\'s own glTF frame (Y up). ' +
      'They are invariant under the uniform scale and translation AtlasBody applies, ' +
      'so no registration is needed. ANNY is Z-up: convert before use.',
    segments: Object.fromEntries(
      Object.entries(SEGMENTS).map(([k, v]) => [k, { bones: v.bones, label: v.label }]),
    ),
    samePoseThresholdDeg: SAME_POSE_DEG,
    /** What `bake.py --pose <id>` consumes: one entry per DISTINCT pose. */
    poses,
    /** Every mode, and which pose it resolves to. */
    atlases: measured,
  }
  const outPath = resolve(HERE, 'atlas-poses.json')
  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n')

  if (jsonOnly) {
    console.log(JSON.stringify(out, null, 2))
    return
  }

  console.log('\n--- pose signatures (shipped assets) ---')
  console.log('atlas                W/H     H (m)   segments measured')
  for (const [id, m] of Object.entries(measured)) {
    if (!m.bbox) continue
    const n = Object.values(m.segments).filter((s) => s.source === 'measured').length
    console.log(
      `${id.padEnd(20)} ${m.bbox.widthOverHeight.toFixed(3)}   ${m.bbox.heightM.toFixed(3)}   ${n}/8`,
    )
  }

  console.log('\n--- limb axes (unit, Y up; proximal -> distal) ---')
  for (const [id, m] of Object.entries(measured)) {
    if (m.inheritsFrom) { console.log(`${id}: inherits ${m.inheritsFrom}`); continue }
    console.log(`\n${id}  (${m.measuredFrom ?? 'not measured'})`)
    for (const [k, s] of Object.entries(m.segments)) {
      if (s.source !== 'measured') { console.log(`  ${k.padEnd(12)} — ${s.note}`); continue }
      const [x, y, z] = s.axis
      console.log(
        `  ${k.padEnd(12)} [${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)}]  ` +
        `len ${s.lengthM.toFixed(3)} m  joint ${(s.jointGapM ?? 0).toFixed(3)} m` +
        `  (${s.vertices} verts)${s.note ? '  ' + s.note : ''}`,
      )
    }
  }
  console.log('\n--- distinct poses to bake ---')
  for (const [id, p] of Object.entries(poses)) {
    console.log(
      `${id.padEnd(20)} covers: ${p.members.join(', ')}` +
      (p.members.length > 1 ? `   (worst disagreement within group ${p.worstWithinGroupDeg}°)` : ''),
    )
  }
  const unposed = Object.entries(measured).filter(([, m]) => !m.poseId).map(([id]) => id)
  if (unposed.length) console.log(`rest pose (nothing measurable): ${unposed.join(', ')}`)

  console.log(`\nwrote ${outPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
