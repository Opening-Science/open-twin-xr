import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import { evaluateAnny, measureBody, ANNY_NEUTRAL, type AnnyGrid, type AnnyParams } from './annyGrid'

/**
 * The parametric body's numbers, measured against the REAL assets.
 *
 * ⚠️ THIS EXISTS BECAUSE THREE SEPARATE DEFECTS EACH PRODUCED A PLAUSIBLE WRONG
 * NUMBER THAT THE RENDERING COULD NOT SHOW.
 *
 *  1. ANNY's triangle winding is inconsistent as it comes out of the model, so
 *     the signed-volume sum cancelled: 0.43 L for a ~60 L body.
 *  2. The grid borrowed its index buffer from the COMPRESSED GLB, whose vertices
 *     meshopt had reordered — every triangle scrambled, volume 0.56 L. Height and
 *     every slider still read exactly correct, because those come from positions.
 *  3. The waist slice at 60 % of standing height catches the ARMS, and a convex
 *     hull wrapped elbow to elbow: 222 cm.
 *
 * Volume is the load-bearing assertion here. It is the only one of these numbers
 * that depends on positions AND topology AND winding at once, so it is what
 * fails when any of the three drifts. A vertex-count check does not: the counts
 * matched throughout defect 2.
 *
 * Skipped when the assets are absent — a fresh clone ships no models, and this
 * repository must run without them.
 */
const GRID_BIN = 'public/models/anny-grid.bin'
const GRID_IDX = 'public/models/anny-grid.idx'
const GRID_JSON = 'public/models/anny-grid.json'
const GLB = 'public/models/anny-adult-f.glb'
const haveAssets = existsSync(GRID_BIN) && existsSync(GRID_IDX) && existsSync(GRID_JSON)

function loadGridSync(): AnnyGrid {
  const meta = JSON.parse(readFileSync(GRID_JSON, 'utf8'))
  const raw = readFileSync(GRID_BIN)
  const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
  const n = meta.vertices * 3
  const idx = readFileSync(GRID_IDX)
  return {
    meta,
    neutral: new Float32Array(buf, 0, n),
    deltas: new Int16Array(buf, n * 4),
    indices: new Uint32Array(idx.buffer.slice(idx.byteOffset, idx.byteOffset + idx.byteLength)),
  }
}

describe.skipIf(!haveAssets)('parametric body measurements', () => {
  const grid = haveAssets ? loadGridSync() : (null as unknown as AnnyGrid)

  /** Feet to y = 0, exactly as `ParametricBody` does before measuring. */
  function evalGrounded(params: AnnyParams): Float32Array {
    const out = new Float32Array(grid.neutral.length)
    evaluateAnny(grid, params, out)
    let minY = Infinity
    for (let i = 1; i < out.length; i += 3) if (out[i] < minY) minY = out[i]
    for (let i = 1; i < out.length; i += 3) out[i] -= minY
    return out
  }

  it('ships a topology matching its own vertex array', () => {
    expect(grid.indices.length).toBe(grid.meta.triangles * 3)
    let max = 0
    for (const i of grid.indices) if (i > max) max = i
    expect(max).toBe(grid.meta.vertices - 1)
  })

  const CASES: { name: string; params: AnnyParams }[] = [
    { name: 'neutral', params: ANNY_NEUTRAL },
    { name: 'adult female', params: { ...ANNY_NEUTRAL, gender: 1, age: 0.75 } },
    { name: 'adult male', params: { ...ANNY_NEUTRAL, gender: 0, age: 0.75 } },
    { name: 'child', params: { ...ANNY_NEUTRAL, gender: 0.5, age: 0.25 } },
    { name: 'heavy', params: { ...ANNY_NEUTRAL, gender: 0, age: 0.75, weight: 1 } },
    { name: 'light', params: { ...ANNY_NEUTRAL, gender: 1, age: 0.75, weight: 0 } },
  ]

  it.each(CASES)('$name has physically sane measurements', ({ params }) => {
    const m = measureBody(evalGrounded(params), grid.indices)

    // Ranges, not fixed values: this pins "not nonsense", and a tighter
    // assertion would break on any legitimate re-bake.
    expect(m.heightM).toBeGreaterThan(0.6)
    expect(m.heightM).toBeLessThan(2.1)
    // Both bugs above put this near zero. A child is the smallest case here.
    expect(m.volumeL).toBeGreaterThan(10)
    expect(m.volumeL).toBeLessThan(160)
    expect(m.massKg).toBeGreaterThan(10)
    expect(m.massKg).toBeLessThan(160)
    expect(m.bmi).toBeGreaterThan(10)
    expect(m.bmi).toBeLessThan(45)
    // The arm-inclusion bug put this at 222 cm; an elbow-to-elbow hull cannot
    // come back under 130.
    expect(m.waistCm).toBeGreaterThan(35)
    expect(m.waistCm).toBeLessThan(130)
  })

  it('volume and waist track the weight axis', () => {
    const base: AnnyParams = { ...ANNY_NEUTRAL, gender: 0, age: 0.75 }
    const light = measureBody(evalGrounded({ ...base, weight: 0 }), grid.indices)
    const heavy = measureBody(evalGrounded({ ...base, weight: 1 }), grid.indices)
    // Monotonicity proves the measurement reads the SHAPE rather than a constant
    // that happens to land inside the ranges above.
    expect(heavy.volumeL).toBeGreaterThan(light.volumeL * 1.15)
    expect(heavy.waistCm).toBeGreaterThan(light.waistCm)
  })

  /**
   * The regression guard for defect 2, stated as the fact that caused it: the
   * shipped GLB's index buffer is NOT interchangeable with the grid's.
   *
   * If a future change to `npm run convert:anny` ever made them agree again this
   * fails, which is the right outcome — it means someone should re-read why the
   * grid carries its own topology rather than quietly reintroducing the coupling.
   */
  it.skipIf(!existsSync(GLB))('does not depend on the compressed GLB topology', async () => {
    const io = new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
    const doc = await io.read(GLB)
    const glbIdx = doc.getRoot().listMeshes()[0].listPrimitives()[0].getIndices()!.getArray()!
    const pos = evalGrounded(ANNY_NEUTRAL)

    const ours = measureBody(pos, grid.indices).volumeL
    const theirs = measureBody(pos, glbIdx).volumeL
    expect(ours).toBeGreaterThan(30)
    // Scrambled triangles integrate to roughly nothing. This is the measurement
    // that exposed the bug in the first place.
    expect(theirs).toBeLessThan(5)
  })
})
