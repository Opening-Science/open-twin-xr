import { beforeAll, describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { evaluateAnny, ANNY_NEUTRAL, type AnnyGrid } from './annyGrid'
import {
  makePoseScratch,
  poseAnny,
  POSE_NEUTRAL,
  type AnnyRig,
  type AnnyRigMeta,
  type PoseScratch,
} from './annyRig'

/**
 * The pose rig, measured against the REAL baked files.
 *
 * ⚠️ THIS EXISTS BECAUSE POSING FAILS INVISIBLY, TWICE OVER, AND BOTH WAYS WERE
 * HIT WHILE BUILDING IT.
 *
 *  1. A byte-alignment error in the loader threw a RangeError that the caller
 *     caught as "the rig is not installed". The sliders simply never appeared.
 *  2. The joint pivots were left in ANNY's ungrounded frame while the vertices
 *     had been grounded to y = 0 — about 0.9 m apart. Every limb then rotated
 *     about a point most of a metre from its joint, which renders as arms and
 *     legs stretched into flat sheets. Nothing threw; the body was just wrong.
 *
 * The assertions below are chosen to catch exactly those: that the output is
 * finite at all, that the body stays a body-sized object near the floor, and
 * that bending a knee moves the shin WITHOUT moving the head. A "does it render"
 * check passes through both defects.
 *
 * Skipped when the assets are absent — a fresh clone ships no models, and this
 * repository must run without them.
 */
const GRID_BIN = 'public/models/anny-grid.bin'
const GRID_IDX = 'public/models/anny-grid.idx'
const GRID_META = 'public/models/anny-grid.json'
const RIG_BIN = 'public/models/anny-grid.rig'
const RIG_META = 'public/models/anny-grid-rig.json'

const have =
  existsSync(GRID_BIN) && existsSync(GRID_IDX) && existsSync(GRID_META) &&
  existsSync(RIG_BIN) && existsSync(RIG_META)

function loadGrid(): AnnyGrid {
  const meta = JSON.parse(readFileSync(GRID_META, 'utf8'))
  const raw = readFileSync(GRID_BIN)
  const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
  const n = meta.vertices * 3
  const idxRaw = readFileSync(GRID_IDX)
  return {
    meta,
    neutral: new Float32Array(buf, 0, n),
    deltas: new Int16Array(buf, n * 4),
    indices: new Uint32Array(
      idxRaw.buffer.slice(idxRaw.byteOffset, idxRaw.byteOffset + idxRaw.byteLength),
    ),
  }
}

function loadRig(): AnnyRig {
  const meta = JSON.parse(readFileSync(RIG_META, 'utf8')) as AnnyRigMeta
  const raw = readFileSync(RIG_BIN)
  const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
  const n = meta.vertices * meta.influences
  const jointFloats = meta.gridPoints * meta.drivenJoints.length * 3
  const joints = new Float32Array(buf, 0, jointFloats)
  const rawWeight = new Uint16Array(buf, jointFloats * 4, n)
  const boneWeight = new Float32Array(n)
  for (let i = 0; i < n; i++) boneWeight[i] = rawWeight[i] / 65535
  const boneIndex = new Uint8Array(buf, jointFloats * 4 + n * 2, n)
  return { meta, boneIndex, boneWeight, joints }
}

/** The rest shape, grounded exactly as `ParametricBody` grounds it. */
function restShape(grid: AnnyGrid) {
  const out = new Float32Array(grid.neutral.length)
  evaluateAnny(grid, { ...ANNY_NEUTRAL }, out)
  let minY = Infinity
  for (let i = 1; i < out.length; i += 3) if (out[i] < minY) minY = out[i]
  for (let i = 1; i < out.length; i += 3) out[i] -= minY
  return { rest: out, groundOffsetY: minY }
}

function bounds(v: Float32Array) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (let i = 0; i < v.length; i += 3) {
    if (v[i] < minX) minX = v[i]
    if (v[i] > maxX) maxX = v[i]
    if (v[i + 1] < minY) minY = v[i + 1]
    if (v[i + 1] > maxY) maxY = v[i + 1]
  }
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY }
}

describe.skipIf(!have)('anny pose rig', () => {
  /**
   * ⚠️ LOADED IN A HOOK, NOT IN THE SUITE BODY. vitest still RUNS the body of
   * a skipped `describe` while it collects the tests — `skipIf` only decides
   * whether the tests inside execute. With the loads written in the body, this
   * file threw ENOENT on every clone without the baked grid, which is what CI
   * is, and the suite the comment above promised would skip failed the whole
   * run instead — twice, on the same PR. Hooks of a skipped suite never run;
   * the body always does.
   */
  let grid: AnnyGrid
  let rig: AnnyRig
  let rest: Float32Array
  let groundOffsetY: number
  let scratch: PoseScratch
  let out: Float32Array

  beforeAll(() => {
    grid = loadGrid()
    rig = loadRig()
    const shape = restShape(grid)
    rest = shape.rest
    groundOffsetY = shape.groundOffsetY
    scratch = makePoseScratch(rig)
    out = new Float32Array(rest.length)
  })

  it('the rig matches the grid it poses', () => {
    expect(rig.meta.vertices).toBe(grid.meta.vertices)
    expect(rig.meta.gridPoints).toBe(grid.meta.coreCombos.length)
  })

  it('weights are normalised per vertex', () => {
    const inf = rig.meta.influences
    for (const v of [0, 1000, 7000, rig.meta.vertices - 1]) {
      let s = 0
      for (let i = 0; i < inf; i++) s += rig.boneWeight[v * inf + i]
      expect(s).toBeCloseTo(1, 4)
    }
  })

  it('the neutral pose is the rest shape, untouched', () => {
    const changed = poseAnny(grid, rig, { ...ANNY_NEUTRAL }, { ...POSE_NEUTRAL }, rest, out, scratch, groundOffsetY)
    expect(changed).toBe(false)
    expect(out[0]).toBe(rest[0])
  })

  /**
   * ⚠️ THE ONE THAT CATCHES THE UNGROUNDED-PIVOT BUG. With the pivots in the
   * wrong frame the body did not error — it stretched to several metres across.
   * A finite-and-body-sized assertion is what separates "posed" from "destroyed".
   */
  it('a bent knee leaves a body-sized body standing on the floor', () => {
    poseAnny(grid, rig, { ...ANNY_NEUTRAL }, { ...POSE_NEUTRAL, knee: 60 }, rest, out, scratch, groundOffsetY)
    for (let i = 0; i < out.length; i++) expect(Number.isFinite(out[i])).toBe(true)

    const b0 = bounds(rest)
    const b1 = bounds(out)
    // A knee bend shortens the body; it does not double it or blow it sideways.
    expect(b1.height).toBeGreaterThan(b0.height * 0.7)
    expect(b1.height).toBeLessThanOrEqual(b0.height + 0.01)
    expect(b1.width).toBeLessThan(b0.width * 1.25)
  })

  it('bending a knee moves the shin and not the head', () => {
    poseAnny(grid, rig, { ...ANNY_NEUTRAL }, { ...POSE_NEUTRAL, knee: 60 }, rest, out, scratch, groundOffsetY)
    const top = bounds(rest).maxY
    let headMoved = 0
    let shinMoved = 0
    for (let i = 0; i < rest.length; i += 3) {
      const d = Math.hypot(out[i] - rest[i], out[i + 1] - rest[i + 1], out[i + 2] - rest[i + 2])
      const y = rest[i + 1]
      if (y > top - 0.15) headMoved = Math.max(headMoved, d)
      // Between ankle and knee on this body.
      if (y > 0.1 && y < 0.35) shinMoved = Math.max(shinMoved, d)
    }
    expect(headMoved).toBeLessThan(0.005)
    expect(shinMoved).toBeGreaterThan(0.05)
  })

  it('raising the arms moves the arms and not the feet', () => {
    poseAnny(grid, rig, { ...ANNY_NEUTRAL }, { ...POSE_NEUTRAL, armAbduct: 45 }, rest, out, scratch, groundOffsetY)
    let feetMoved = 0
    let handsMoved = 0
    const b = bounds(rest)
    for (let i = 0; i < rest.length; i += 3) {
      const d = Math.hypot(out[i] - rest[i], out[i + 1] - rest[i + 1], out[i + 2] - rest[i + 2])
      if (rest[i + 1] < 0.08) feetMoved = Math.max(feetMoved, d)
      if (Math.abs(rest[i]) > b.width * 0.4) handsMoved = Math.max(handsMoved, d)
    }
    expect(feetMoved).toBeLessThan(0.005)
    expect(handsMoved).toBeGreaterThan(0.05)
  })

  /** Both sides must move away from the body, not both towards +x. */
  it('abduction is mirrored, so the two arms stay symmetric', () => {
    poseAnny(grid, rig, { ...ANNY_NEUTRAL }, { ...POSE_NEUTRAL, armAbduct: 45 }, rest, out, scratch, groundOffsetY)
    const b = bounds(out)
    expect(Math.abs(b.maxX + b.minX)).toBeLessThan(0.05)
  })
})
