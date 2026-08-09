/**
 * The parametric body, evaluated in the browser from a baked shape grid.
 *
 * WHY A GRID AND NOT MORPH TARGETS — this is the part to read before changing
 * anything, because the obvious mechanism was measured and is unusable.
 *
 *   per-axis deltas as glTF morph targets (12 targets)     103 mm worst error
 *   multilinear over the 2^6 hypercube corners             284 mm
 *   stops-aligned core + height/proportions as corrections 116 mm
 *   THIS — full 6-D tensor at the model's own stops         36 mm worst, 5.6 median
 *
 * Measured as maximum vertex displacement against the real ANNY model at random
 * slider positions, on a 1.7 m body. See `scripts/anny/bake_grid.py`.
 *
 * MakeHuman's macros are a TENSOR of pre-combined targets — its files are named
 * `universal-{gender}-{age}-{muscle}-{weight}.target.gz` — so independent
 * per-axis deltas miss every cross-term. And each axis is non-linear along its
 * own length: `age` has five stops, so interpolating newborn straight to old
 * puts age 0.5 at 1.24 m where the model says 1.63 m.
 *
 * Sampling at the model's own stops fixes both. The tent basis below is EXACT at
 * every stop, and interpolates only across spans the model varies smoothly over.
 *
 * ⚠️ NO PYTORCH IN THE BROWSER, and none is needed. Evaluation is a weighted sum
 * over at most 2^6 = 64 of the 360 grid points, because a tent basis gives each
 * axis at most two non-zero stops. About 2.6 M multiply-adds — a few milliseconds
 * on a slider change, and NOTHING per frame.
 */

export interface AnnyGridMeta {
  vertices: number
  triangles: number
  axes: string[]
  stops: Record<string, number>
  core: string[]
  coreCombos: number[][]
  scale: number
  package: string
  measuredErrorMm?: { worst: number; median: number; points: number; note: string }
}

export interface AnnyGrid {
  meta: AnnyGridMeta
  /** The grid's centre shape, in metres. */
  neutral: Float32Array
  /** Quantised deltas from neutral, one block of `vertices * 3` per grid point. */
  deltas: Int16Array
  /** ANNY's own face order, outward-wound. See `ANNY_GRID_URLS`. */
  indices: Uint32Array
}

export const ANNY_AXES = [
  'gender',
  'age',
  'muscle',
  'weight',
  'height',
  'proportions',
] as const
export type AnnyAxis = (typeof ANNY_AXES)[number]
export type AnnyParams = Record<AnnyAxis, number>

/** Every axis at its midpoint — the shape the grid is centred on. */
export const ANNY_NEUTRAL: AnnyParams = {
  gender: 0.5,
  age: 0.5,
  muscle: 0.5,
  weight: 0.5,
  height: 0.5,
  proportions: 0.5,
}

/**
 * What each slider means, in the model's own vocabulary.
 *
 * ⚠️ THE LABELS DESCRIBE PARAMETERS, NOT PEOPLE. `gender` runs male(0) to
 * female(1) — measured, and the inverse of what the source notes claimed — and
 * `age` spans five MakeHuman stops, so 0.75 is the adult and 0.5 an adolescent.
 * Stating the stops in the UI is what stops "age 0.5" reading as "middle-aged".
 */
export const ANNY_AXIS_INFO: Record<AnnyAxis, { label: string; ends: [string, string] }> = {
  gender: { label: 'Gender', ends: ['male', 'female'] },
  age: { label: 'Age', ends: ['newborn', 'old'] },
  muscle: { label: 'Muscle', ends: ['least', 'most'] },
  weight: { label: 'Weight', ends: ['least', 'most'] },
  height: { label: 'Height', ends: ['shortest', 'tallest'] },
  proportions: { label: 'Proportions', ends: ['uncommon', 'ideal'] },
}

/**
 * ⚠️ THREE FILES, AND THE THIRD IS NOT OPTIONAL.
 *
 * `.idx` carries ANNY's triangle indices. The grid used to ship positions only
 * and borrow the index buffer from `anny-adult-f.glb`, because the topology is
 * identical at every grid point — true of the MODEL, false of the ASSET.
 * `npm run convert:anny` runs meshopt, which REORDERS vertices for cache
 * locality, so the compressed GLB numbers its vertices differently from the
 * model this grid was baked against, and pairing the two scrambled every
 * triangle.
 *
 * Nothing on screen showed it. Positions come from the grid, so height and every
 * slider read exactly right; the scrambled surface still fills the body's
 * silhouette; and the vertex counts match on both sides. Signed volume is what
 * exposed it — 0.56 L where the same positions under the model's own face order
 * give 51.20 L — and `annyGrid.test.ts` now pins that.
 *
 * ⚠️ WRITTEN AS LITERAL URLS so `pruneUnshippedModels` can see them.
 *
 * That plugin decides what survives into `dist` by regex-scanning registry
 * source for `/models/<name>`. A template literal is invisible to it — which is
 * exactly how the five body envelopes were pruned once already — so these two
 * are spelled out rather than built from `base`.
 */
export const ANNY_GRID_URLS = [
  '/models/anny-grid.bin',
  '/models/anny-grid.idx',
  '/models/anny-grid.json',
] as const

export async function loadAnnyGrid(base = '/models/anny-grid'): Promise<AnnyGrid> {
  const [meta, buf, idxBuf] = await Promise.all([
    fetch(`${base}.json`).then((r) => {
      if (!r.ok) throw new Error(`anny grid metadata: HTTP ${r.status}`)
      return r.json() as Promise<AnnyGridMeta>
    }),
    fetch(`${base}.bin`).then((r) => {
      if (!r.ok) throw new Error(`anny grid data: HTTP ${r.status}`)
      return r.arrayBuffer()
    }),
    fetch(`${base}.idx`).then((r) => {
      if (!r.ok) throw new Error(`anny grid topology: HTTP ${r.status}`)
      return r.arrayBuffer()
    }),
  ])

  const n = meta.vertices * 3
  const neutral = new Float32Array(buf, 0, n)
  const deltas = new Int16Array(buf, n * 4)
  const expected = meta.coreCombos.length * n
  if (deltas.length < expected) {
    // Loud, because a truncated binary produces a body that is subtly the wrong
    // shape rather than an error — the same failure mode a truncated GLB has.
    throw new Error(
      `anny grid: expected ${expected} deltas for ${meta.coreCombos.length} grid points, got ${deltas.length}`,
    )
  }
  const indices = new Uint32Array(idxBuf)
  if (indices.length !== meta.triangles * 3) {
    throw new Error(
      `anny grid: expected ${meta.triangles * 3} indices, got ${indices.length}`,
    )
  }
  return { meta, neutral, deltas, indices }
}

/**
 * Tent-basis weight of one grid stop for one axis value.
 *
 * Zero unless `value` is within one step of the stop, which is what keeps the
 * active set at 2^6 rather than all 360.
 */
function tent(value: number, stop: number, stops: number): number {
  const step = 1 / (stops - 1)
  return Math.max(0, 1 - Math.abs(value - stop) / step)
}

/**
 * Evaluate the body at a slider position, into `out`.
 *
 * `out` is passed in rather than allocated so the caller can write straight into
 * a `BufferAttribute`'s array — a 41 kB allocation per slider tick would be
 * pure garbage.
 */
export function evaluateAnny(grid: AnnyGrid, params: AnnyParams, out: Float32Array): Float32Array {
  const { meta, neutral, deltas } = grid
  const n = neutral.length
  out.set(neutral)

  const scale = meta.scale
  for (let gi = 0; gi < meta.coreCombos.length; gi++) {
    const combo = meta.coreCombos[gi]
    let w = 1
    for (let a = 0; a < meta.core.length; a++) {
      const axis = meta.core[a] as AnnyAxis
      w *= tent(params[axis], combo[a], meta.stops[axis])
      if (w === 0) break
    }
    if (w === 0) continue
    const off = gi * n
    const ws = w * scale
    for (let i = 0; i < n; i++) out[i] += deltas[off + i] * ws
  }
  return out
}

/**
 * Geometric measurements of the evaluated shape.
 *
 * ⚠️ THESE DESCRIBE THE GENERATED SURFACE, NOT A PERSON, and the distinction is
 * the whole reason they are safe to show. Height, waist and volume are read off
 * the mesh. Mass and BMI are NOT measured — they are derived from volume by
 * assuming one uniform density, which is stated in the UI beside them. A real
 * body is not uniform, so those two are properties of a shape under an
 * assumption, and nothing here is a measurement of anybody.
 */
export const BODY_DENSITY_KG_PER_M3 = 1010

export interface BodyMeasurements {
  heightM: number
  volumeL: number
  massKg: number
  bmi: number
  waistCm: number
}

export function measureBody(
  positions: Float32Array,
  indices: ArrayLike<number>,
): BodyMeasurements {
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 1; i < positions.length; i += 3) {
    const y = positions[i]
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const heightM = maxY - minY

  /**
   * Signed volume by the divergence theorem — sum of tetrahedra from the origin
   * to each triangle. Exact for a closed mesh, and ANNY's body is closed
   * (measured: 0 boundary edges, E = 3F/2 exactly).
   *
   * ⚠️ IT DEPENDS ENTIRELY ON CONSISTENT WINDING, and ANNY's mesh does not have
   * it as it comes out of the model — 13,706 triangles wound one way against
   * 13,714 the other, so the signed sum CANCELLED and this returned 0.43 L for a
   * body of about 50 L. `scripts/anny/bake.py` now calls `fix_normals()`, which
   * is where the fix belongs; this function cannot repair it.
   *
   * ⚠️ And do not assume `npm run check:winding` guards this. That script
   * compares -x against +x, which is a left/right SYMMETRY test, not an
   * orientation one — it reported these meshes "consistent" throughout.
   */
  let v6 = 0
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const a = indices[t] * 3
    const b = indices[t + 1] * 3
    const c = indices[t + 2] * 3
    const ax = positions[a], ay = positions[a + 1], az = positions[a + 2]
    const bx = positions[b], by = positions[b + 1], bz = positions[b + 2]
    const cx = positions[c], cy = positions[c + 1], cz = positions[c + 2]
    v6 += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)
  }
  const volumeM3 = Math.abs(v6) / 6
  const massKg = volumeM3 * BODY_DENSITY_KG_PER_M3

  /**
   * Waist as the convex-hull perimeter of a horizontal slice.
   *
   * At 0.60 of standing height, which is a shape landmark rather than a clinical
   * one — the WHO waist protocol is the midpoint between the lowest rib and the
   * iliac crest, and this mesh has no ribs or crest to find. Convex hull rather
   * than the raw outline because a tape measure does not follow a concavity
   * either, which is the one respect in which this matches how a waist is taken.
   */
  const sliceY = minY + heightM * 0.6
  const band = heightM * 0.012
  const raw: [number, number][] = []
  for (let i = 0; i < positions.length; i += 3) {
    if (Math.abs(positions[i + 1] - sliceY) <= band) raw.push([positions[i], positions[i + 2]])
  }

  /**
   * ⚠️ DROP THE ARMS BEFORE HULLING, or the "waist" is the span from elbow to
   * elbow. At 60 % of standing height the arms hang beside the torso, so the
   * slice contains three separate blobs and a convex hull wraps all of them —
   * measured 222 cm on a body whose waist is nearer 80 cm.
   *
   * The torso is the blob containing the body axis, so keep only the run of
   * x-values connected to x = 0. Sorting by x and cutting at any gap wider than
   * 3 % of body height separates arm from trunk reliably, because the armpit gap
   * is far larger than the vertex spacing within either.
   */
  const pts: [number, number][] = []
  if (raw.length) {
    const byX = [...raw].sort((a, b) => a[0] - b[0])
    const gap = heightM * 0.03
    let lo = 0
    let hi = byX.length - 1
    // Walk outward from the point nearest the axis, stopping at the first gap.
    let mid = 0
    for (let i = 1; i < byX.length; i++) {
      if (Math.abs(byX[i][0]) < Math.abs(byX[mid][0])) mid = i
    }
    lo = mid
    while (lo > 0 && byX[lo][0] - byX[lo - 1][0] < gap) lo--
    hi = mid
    while (hi < byX.length - 1 && byX[hi + 1][0] - byX[hi][0] < gap) hi++
    for (let i = lo; i <= hi; i++) pts.push(byX[i])
  }
  let waistCm = 0
  if (pts.length > 2) {
    pts.sort((p, q) => p[0] - q[0] || p[1] - q[1])
    const cross = (o: number[], a: number[], b: number[]) =>
      (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    const hull: [number, number][] = []
    for (const p of pts) {
      while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0)
        hull.pop()
      hull.push(p)
    }
    const lower = hull.length + 1
    for (let i = pts.length - 2; i >= 0; i--) {
      const p = pts[i]
      while (hull.length >= lower && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0)
        hull.pop()
      hull.push(p)
    }
    for (let i = 0; i + 1 < hull.length; i++) {
      waistCm += Math.hypot(hull[i + 1][0] - hull[i][0], hull[i + 1][1] - hull[i][1])
    }
    waistCm *= 100
  }

  return {
    heightM,
    volumeL: volumeM3 * 1000,
    massKg,
    bmi: heightM > 0 ? massKg / (heightM * heightM) : 0,
    waistCm,
  }
}
