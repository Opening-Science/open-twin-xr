/**
 * Posing the parametric body — forward kinematics and linear blend skinning, in
 * the browser, on top of the shape grid.
 *
 * `annyGrid.ts` answers "what SHAPE is this body". This answers "and what
 * POSITION is it in". The two are deliberately separate: shape comes from a
 * sampled tensor because MakeHuman's macros are a tensor, and pose comes from a
 * rig because a rotation is exact and sampling it would be an approximation the
 * size of a hard disk (three stops of one joint angle would triple a 28 MB grid,
 * and there are eight joints).
 *
 * WHY THIS IS SO LITTLE CODE FOR "SKINNING"
 * ----------------------------------------
 * A slider rotates one joint about a pivot, and every bone below that joint
 * inherits the rotation. So a bone's skinning matrix is the PRODUCT of the pivot
 * rotations of its driven ancestors — nothing else. `bake_rig.py` stores that
 * ancestor list per bone, which removes local rest frames, bind poses and any
 * per-frame kinematic walk from the runtime. What is left is: build eight small
 * matrices, then one weighted sum per vertex.
 *
 * ⚠️ JOINT POSITIONS INTERPOLATE WITH THE SHAPE, and leaving that out is the
 * subtle bug this design exists to avoid. An elbow is not in the same place on a
 * child and on a tall adult. A single rest skeleton would bend every body at the
 * neutral body's joints — visible as a forearm that starts above or below the
 * actual elbow, which reads as a skinning artefact rather than as the data error
 * it is. The rig file stores joint positions at every grid point and they are
 * interpolated on exactly the same tent basis as the vertices.
 *
 * ⚠️ NOT PER FRAME. Same rule as `evaluateAnny`: this runs when a slider moves.
 */

import { ANNY_AXES, type AnnyAxis, type AnnyGrid, type AnnyParams } from './annyGrid'

/** The position sliders. Arms and legs only — see `bake_rig.py`. */
export const POSE_SLIDERS = ['armAbduct', 'elbow', 'hipAbduct', 'knee'] as const
export type PoseSlider = (typeof POSE_SLIDERS)[number]
export type PoseParams = Record<PoseSlider, number>

/**
 * Everything at zero is the model's own rest pose — the wide A-pose ANNY ships.
 *
 * ⚠️ NOT the standing pose. A viewer opening the parametric mode sees ANNY as it
 * actually is, and the sliders move away from that. Defaulting to "arms down"
 * would mean the mode never shows the shape the grid was baked at, and every
 * measurement in `measureBody` is taken at rest.
 */
export const POSE_NEUTRAL: PoseParams = { armAbduct: 0, elbow: 0, hipAbduct: 0, knee: 0 }

export interface RigJointAxis {
  bone: string
  slider: PoseSlider
  axis: [number, number, number]
  mirrored: boolean
  side: 'L' | 'R'
}

export interface AnnyRigMeta {
  vertices: number
  bones: number
  influences: number
  drivenJoints: string[]
  sliders: PoseSlider[]
  limitsDeg: Record<PoseSlider, [number, number]>
  jointAxes: RigJointAxis[]
  /** Per bone, the driven joints above it, root-most first. */
  chains: number[][]
  gridPoints: number
  package: string
}

export interface AnnyRig {
  meta: AnnyRigMeta
  /** Per vertex, `influences` bone indices. */
  boneIndex: Uint8Array
  /** Per vertex, `influences` weights, already normalised to 0..1. */
  boneWeight: Float32Array
  /** Per grid point, per driven joint, an xyz position. */
  joints: Float32Array
}

/**
 * ⚠️ WRITTEN AS LITERAL URLS so `pruneUnshippedModels` can see them — the same
 * reason `ANNY_GRID_URLS` is. That plugin regex-scans source for `/models/…`,
 * and a template literal is invisible to it.
 */
export const ANNY_RIG_URLS = ['/models/anny-grid.rig', '/models/anny-grid-rig.json'] as const

/**
 * Thrown when the rig files are simply not installed — a normal state.
 *
 * ⚠️ DISTINGUISHED FROM A BROKEN RIG ON PURPOSE, because collapsing the two hid
 * a real bug for exactly as long as it existed. The callers treat "no rig" as
 * "show the shape sliders and no position sliders", which is right for an asset
 * a build chose not to ship and WRONG for a file that is present and unreadable.
 * With one catch covering both, a byte-alignment error in the loader looked
 * identical to a deliberately slim build: the sliders were missing and nothing
 * anywhere said why.
 */
export class RigNotInstalled extends Error {}

export async function loadAnnyRig(base = '/models/anny-grid'): Promise<AnnyRig> {
  const [meta, buf] = await Promise.all([
    fetch(`${base}-rig.json`).then((r) => {
      if (r.status === 404) throw new RigNotInstalled('anny rig metadata not installed')
      if (!r.ok) throw new Error(`anny rig metadata: HTTP ${r.status}`)
      return r.json() as Promise<AnnyRigMeta>
    }),
    fetch(`${base}.rig`).then((r) => {
      if (r.status === 404) throw new RigNotInstalled('anny rig data not installed')
      if (!r.ok) throw new Error(`anny rig data: HTTP ${r.status}`)
      return r.arrayBuffer()
    }),
  ])

  const n = meta.vertices * meta.influences
  const jointCount = meta.drivenJoints.length
  const expected = n * 1 + n * 2 + meta.gridPoints * jointCount * 3 * 4
  if (buf.byteLength < expected) {
    // Loud, for the reason the grid loader is loud: a truncated binary produces a
    // body that bends slightly wrongly rather than an error.
    throw new Error(
      `anny rig: expected at least ${expected} bytes, got ${buf.byteLength}`,
    )
  }

  /**
   * ⚠️ THE ORDER HERE IS FIXED BY ALIGNMENT, NOT BY TASTE, and getting it wrong
   * is a silent feature-off rather than a visible error.
   *
   * A `Float32Array` view must begin at a byte offset divisible by 4 and a
   * `Uint16Array` at one divisible by 2. The first version of this file put the
   * uint8 indices first, which pushed the joint block to byte 370,386 — not a
   * multiple of 4 — and the constructor threw a RangeError. The load failure was
   * caught as "the rig is simply not installed", so the position sliders just
   * never appeared and nothing said why. Widest type first makes every offset
   * legal whatever the vertex count.
   */
  const jointBytes = meta.gridPoints * jointCount * 3
  const joints = new Float32Array(buf, 0, jointBytes)
  const rawWeight = new Uint16Array(buf, jointBytes * 4, n)
  const boneWeight = new Float32Array(n)
  for (let i = 0; i < n; i++) boneWeight[i] = rawWeight[i] / 65535
  const boneIndex = new Uint8Array(buf, jointBytes * 4 + n * 2, n)

  return { meta, boneIndex, boneWeight, joints }
}

/** Tent weight — identical to the grid's, and deliberately so. */
function tent(value: number, stop: number, stops: number): number {
  const step = 1 / (stops - 1)
  return Math.max(0, 1 - Math.abs(value - stop) / step)
}

/**
 * Where each driven joint sits for the CURRENT shape.
 *
 * The same weighted sum over the same grid points the vertices use, so a joint
 * cannot drift away from the body it belongs to.
 */
export function interpolateJoints(
  grid: AnnyGrid,
  rig: AnnyRig,
  params: AnnyParams,
  out: Float32Array,
): Float32Array {
  const jointCount = rig.meta.drivenJoints.length
  out.fill(0)
  for (let gi = 0; gi < grid.meta.coreCombos.length; gi++) {
    const combo = grid.meta.coreCombos[gi]
    let w = 1
    for (let a = 0; a < grid.meta.core.length; a++) {
      const axis = grid.meta.core[a] as AnnyAxis
      w *= tent(params[axis], combo[a], grid.meta.stops[axis])
      if (w === 0) break
    }
    if (w === 0) continue
    const off = gi * jointCount * 3
    for (let i = 0; i < jointCount * 3; i++) out[i] += rig.joints[off + i] * w
  }
  return out
}

/**
 * The 3x4 transform for one driven joint: rotate `deg` about `axis`, about the
 * pivot `p`.
 *
 * Written into `m` at `base` as 12 numbers, row-major 3x4 — a rotation and a
 * translation, which is all a pivot rotation ever is. Full 4x4s would be a third
 * more arithmetic per vertex for a row that is always (0,0,0,1).
 */
function pivotRotation(
  m: Float32Array,
  base: number,
  axis: readonly [number, number, number],
  deg: number,
  px: number,
  py: number,
  pz: number,
): void {
  const t = (deg * Math.PI) / 180
  const c = Math.cos(t)
  const s = Math.sin(t)
  const len = Math.hypot(axis[0], axis[1], axis[2]) || 1
  const x = axis[0] / len
  const y = axis[1] / len
  const z = axis[2] / len
  const k = 1 - c
  // Rodrigues.
  const r00 = c + x * x * k
  const r01 = x * y * k - z * s
  const r02 = x * z * k + y * s
  const r10 = y * x * k + z * s
  const r11 = c + y * y * k
  const r12 = y * z * k - x * s
  const r20 = z * x * k - y * s
  const r21 = z * y * k + x * s
  const r22 = c + z * z * k
  m[base] = r00; m[base + 1] = r01; m[base + 2] = r02
  m[base + 3] = px - (r00 * px + r01 * py + r02 * pz)
  m[base + 4] = r10; m[base + 5] = r11; m[base + 6] = r12
  m[base + 7] = py - (r10 * px + r11 * py + r12 * pz)
  m[base + 8] = r20; m[base + 9] = r21; m[base + 10] = r22
  m[base + 11] = pz - (r20 * px + r21 * py + r22 * pz)
}

/** `out = a * b`, both 3x4 row-major. */
function mul34(out: Float32Array, ob: number, a: Float32Array, ab: number, b: Float32Array, bb: number): void {
  for (let r = 0; r < 3; r++) {
    const a0 = a[ab + r * 4], a1 = a[ab + r * 4 + 1], a2 = a[ab + r * 4 + 2], a3 = a[ab + r * 4 + 3]
    out[ob + r * 4] = a0 * b[bb] + a1 * b[bb + 4] + a2 * b[bb + 8]
    out[ob + r * 4 + 1] = a0 * b[bb + 1] + a1 * b[bb + 5] + a2 * b[bb + 9]
    out[ob + r * 4 + 2] = a0 * b[bb + 2] + a1 * b[bb + 6] + a2 * b[bb + 10]
    out[ob + r * 4 + 3] = a0 * b[bb + 3] + a1 * b[bb + 7] + a2 * b[bb + 11] + a3
  }
}

/** Scratch, module-level so a slider drag allocates nothing. */
const IDENT34 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0])

export interface PoseScratch {
  joints: Float32Array
  jointM: Float32Array
  boneM: Float32Array
}

export function makePoseScratch(rig: AnnyRig): PoseScratch {
  const j = rig.meta.drivenJoints.length
  return {
    joints: new Float32Array(j * 3),
    jointM: new Float32Array(j * 12),
    boneM: new Float32Array(rig.meta.bones * 12),
  }
}

/**
 * Deform `positions` in place, from the rest shape to the posed one.
 *
 * ⚠️ `positions` MUST be the rest-pose shape as `evaluateAnny` produced it, and
 * must not be fed back in. Skinning is not idempotent: applying it twice bends
 * every joint twice. The caller keeps the rest shape and writes the posed result
 * into the geometry, never the other way round.
 *
 * Returns `false` when nothing is posed, so the caller can skip the copy
 * entirely and keep the neutral case free.
 */
export function poseAnny(
  grid: AnnyGrid,
  rig: AnnyRig,
  shape: AnnyParams,
  pose: PoseParams,
  rest: Float32Array,
  out: Float32Array,
  scratch: PoseScratch,
  /**
   * How far the caller moved the body down to stand it on y = 0.
   *
   * ⚠️ NOT OPTIONAL IN PRACTICE, AND OMITTING IT DESTROYS THE BODY. The rig
   * stores joint positions in ANNY's own ungrounded frame, while
   * `ParametricBody` grounds the vertices by subtracting their minimum y — about
   * 0.9 m. Rotating grounded vertices about ungrounded pivots swings every limb
   * around a point most of a metre away from the joint it is meant to be, which
   * renders as arms and legs stretched into flat sheets rather than as anything
   * recognisable as a wrong angle. The pivots have to live in the same frame as
   * the points they pivot.
   */
  groundOffsetY = 0,
): boolean {
  const active = POSE_SLIDERS.some((s) => Math.abs(pose[s] ?? 0) > 1e-6)
  if (!active) {
    if (out !== rest) out.set(rest)
    return false
  }

  interpolateJoints(grid, rig, shape, scratch.joints)
  // Into the caller's frame. See `groundOffsetY`.
  if (groundOffsetY !== 0)
    for (let j = 1; j < scratch.joints.length; j += 3) scratch.joints[j] -= groundOffsetY

  // One pivot rotation per driven joint.
  const axes = rig.meta.jointAxes
  for (let j = 0; j < rig.meta.drivenJoints.length; j++) {
    const bone = rig.meta.drivenJoints[j]
    const spec = axes.find((a) => a.bone === bone)
    if (!spec) {
      scratch.jointM.set(IDENT34, j * 12)
      continue
    }
    const raw = pose[spec.slider] ?? 0
    // Mirrored axes make "abduction" mean away-from-the-body on both sides
    // rather than towards +x on both — otherwise one arm rises while the other
    // crosses the chest.
    const deg = spec.mirrored && spec.side === 'R' ? -raw : raw
    pivotRotation(
      scratch.jointM,
      j * 12,
      spec.axis,
      deg,
      scratch.joints[j * 3],
      scratch.joints[j * 3 + 1],
      scratch.joints[j * 3 + 2],
    )
  }

  // Per bone, the product of its driven ancestors' rotations.
  const tmp = new Float32Array(12)
  for (let b = 0; b < rig.meta.bones; b++) {
    const chain = rig.meta.chains[b]
    const base = b * 12
    if (!chain || chain.length === 0) {
      scratch.boneM.set(IDENT34, base)
      continue
    }
    scratch.boneM.set(scratch.jointM.subarray(chain[0] * 12, chain[0] * 12 + 12), base)
    for (let c = 1; c < chain.length; c++) {
      tmp.set(scratch.boneM.subarray(base, base + 12))
      mul34(scratch.boneM, base, scratch.jointM, chain[c] * 12, tmp, 0)
    }
  }

  // Linear blend skinning.
  const inf = rig.meta.influences
  const n = rig.meta.vertices
  for (let v = 0; v < n; v++) {
    const px = rest[v * 3], py = rest[v * 3 + 1], pz = rest[v * 3 + 2]
    let ox = 0, oy = 0, oz = 0
    for (let i = 0; i < inf; i++) {
      const w = rig.boneWeight[v * inf + i]
      if (w === 0) continue
      const m = rig.boneIndex[v * inf + i] * 12
      const M = scratch.boneM
      ox += w * (M[m] * px + M[m + 1] * py + M[m + 2] * pz + M[m + 3])
      oy += w * (M[m + 4] * px + M[m + 5] * py + M[m + 6] * pz + M[m + 7])
      oz += w * (M[m + 8] * px + M[m + 9] * py + M[m + 10] * pz + M[m + 11])
    }
    out[v * 3] = ox
    out[v * 3 + 1] = oy
    out[v * 3 + 2] = oz
  }
  return true
}

/** Every slider at its baked limits, for the UI. */
export function poseLimits(rig: AnnyRig | null): Record<PoseSlider, [number, number]> {
  return (
    rig?.meta.limitsDeg ?? {
      armAbduct: [0, 0],
      elbow: [0, 0],
      hipAbduct: [0, 0],
      knee: [0, 0],
    }
  )
}

/** Named so the axis list cannot drift from the grid's. */
export const SHAPE_AXES = ANNY_AXES
