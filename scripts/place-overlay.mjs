#!/usr/bin/env node
/**
 * Register an organ overlay into an atlas by CORRESPONDING LANDMARKS.
 *
 * Overlays are separate works from the body they sit in — a different specimen,
 * scanned in its own frame — so something has to say where they go.
 * `organOverlays.ts` stores a position and a quaternion per atlas, and until now
 * those numbers were measured by hand, once, for the heart. This does it as a
 * repeatable computation instead.
 *
 * THE METHOD, AND WHY THIS ONE
 * ----------------------------
 * Horn's quaternion solution to the absolute-orientation problem: build the 4x4
 * symmetric matrix of the cross-covariance between the two landmark sets, and its
 * largest eigenvector IS the optimal rotation quaternion. Two properties make it
 * the right choice here over the more familiar SVD/Kabsch route:
 *
 *   1. It returns a quaternion directly, which is what the registry stores.
 *   2. It can only ever produce a PROPER rotation. An SVD fit can return a
 *      reflection when the correspondence is wrong, and a reflected ear is a
 *      mirrored ear — an anatomical error that renders plausibly. Here a wrong
 *      correspondence shows up as a large residual instead, which is a fact you
 *      can read rather than a bug you have to notice.
 *
 * ⚠️ WHICH SIDE IS NOT ASSUMED. A temporal-bone specimen is one ear, and nothing
 * in its own coordinates says whether it is the left or the right. So the fit runs
 * against BOTH sides of the atlas and the residual decides. A left specimen fitted
 * to a right ear cannot be rotated into place, so its residual is large — several
 * millimetres against a fraction of one.
 *
 * SCALE IS REPORTED, NOT APPLIED
 * ------------------------------
 * The optimal uniform scale is computed and printed because two specimens are two
 * people and their ears are not the same size. Whether to apply it is a judgement
 * for the caller: the fit itself stays rigid so the printed residual is the true
 * rigid residual.
 *
 * Usage:
 *   node scripts/place-overlay.mjs --overlay public/models/openear-zeta.glb \
 *     --atlas public/models/z-anatomy.ao.glb --pairs ear
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { NodeIO } = require('@gltf-transform/core')
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions')
const { MeshoptDecoder } = require('meshoptimizer')

const argv = process.argv.slice(2)
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`)
  return i === -1 ? d : argv[i + 1]
}
const OVERLAY = arg('overlay')
const ATLAS = arg('atlas')
const PAIRS = arg('pairs', 'ear')
const CANONICAL_HEIGHT_M = 1.7

if (!OVERLAY || !ATLAS) {
  console.error('Usage: node scripts/place-overlay.mjs --overlay <glb> --atlas <glb> [--pairs ear]')
  process.exit(1)
}

/**
 * Landmark correspondences, as data.
 *
 * Each entry names a structure in the ATLAS and the overlay mesh (or meshes) that
 * depict the same thing. Several-to-one is allowed and used: OpenEar models the
 * cochlea as its two scalae, where Z-Anatomy has one `Cochlea`, so the two scalae
 * are pooled into a single centroid rather than dropped.
 */
const PAIR_SETS = {
  ear: [
    { atlas: 'Malleus', overlay: ['Malleus'] },
    { atlas: 'Incus', overlay: ['Incus'] },
    { atlas: 'Stapes', overlay: ['Stapes'] },
    { atlas: 'Cochlea', overlay: ['Scala Tympani', 'Scala Vestibuli'] },
    { atlas: 'Tympanic membrane', overlay: ['Tympanic Membrane'] },
  ],
}
const pairs = PAIR_SETS[PAIRS]
if (!pairs) throw new Error(`unknown pair set ${PAIRS}; have ${Object.keys(PAIR_SETS)}`)

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })

// --------------------------------------------------------------------------- //
// Linear algebra: Jacobi eigenvalues for a symmetric 4x4, then Horn's fit.
// --------------------------------------------------------------------------- //
/** Largest-eigenvalue eigenvector of a symmetric 4x4, by cyclic Jacobi rotations. */
function largestEigenvector(Ain) {
  const n = 4
  const A = Ain.map((r) => r.slice())
  const V = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ]
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j]
    if (off < 1e-24) break
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-30) continue
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q])
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
        const c = 1 / Math.sqrt(t * t + 1)
        const s = t * c
        for (let k = 0; k < n; k++) {
          const akp = A[k][p], akq = A[k][q]
          A[k][p] = c * akp - s * akq
          A[k][q] = s * akp + c * akq
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k], aqk = A[q][k]
          A[p][k] = c * apk - s * aqk
          A[q][k] = s * apk + c * aqk
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p], vkq = V[k][q]
          V[k][p] = c * vkp - s * vkq
          V[k][q] = s * vkp + c * vkq
        }
      }
    }
  }
  let best = 0
  for (let i = 1; i < n; i++) if (A[i][i] > A[best][best]) best = i
  return { value: A[best][best], vector: [V[0][best], V[1][best], V[2][best], V[3][best]] }
}

/** Rotate v by quaternion q = [w, x, y, z]. */
function rotate(q, v) {
  const [w, x, y, z] = q
  const t = [2 * (y * v[2] - z * v[1]), 2 * (z * v[0] - x * v[2]), 2 * (x * v[1] - y * v[0])]
  return [
    v[0] + w * t[0] + (y * t[2] - z * t[1]),
    v[1] + w * t[1] + (z * t[0] - x * t[2]),
    v[2] + w * t[2] + (x * t[1] - y * t[0]),
  ]
}

/**
 * Horn's absolute orientation: the rotation taking P onto Q, both N x 3.
 * Returns the quaternion as [w, x, y, z], the translation, the RMS residual and
 * the optimal uniform scale (reported, not applied).
 */
function hornFit(P, Q) {
  const n = P.length
  const cp = [0, 0, 0], cq = [0, 0, 0]
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { cp[k] += P[i][k] / n; cq[k] += Q[i][k] / n }
  const p = P.map((v) => v.map((x, k) => x - cp[k]))
  const q = Q.map((v) => v.map((x, k) => x - cq[k]))

  // Cross-covariance S = sum p q^T
  const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  for (let i = 0; i < n; i++)
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) S[a][b] += p[i][a] * q[i][b]

  const [[Sxx, Sxy, Sxz], [Syx, Syy, Syz], [Szx, Szy, Szz]] = S
  // Horn's symmetric 4x4, in [w, x, y, z] order.
  const N = [
    [Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx],
    [Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz],
    [Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy],
    [Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz],
  ]
  const { vector } = largestEigenvector(N)
  const norm = Math.hypot(...vector)
  const quat = vector.map((v) => v / norm)

  // Optimal uniform scale, Horn eq. 41 — reported only.
  let sp = 0, sq = 0
  for (let i = 0; i < n; i++) { sp += p[i][0] ** 2 + p[i][1] ** 2 + p[i][2] ** 2; sq += q[i][0] ** 2 + q[i][1] ** 2 + q[i][2] ** 2 }
  const scale = Math.sqrt(sq / sp)

  const rcp = rotate(quat, cp)
  const t = [cq[0] - rcp[0], cq[1] - rcp[1], cq[2] - rcp[2]]

  let sse = 0
  const per = []
  for (let i = 0; i < n; i++) {
    const r = rotate(quat, P[i])
    const d = Math.hypot(r[0] + t[0] - Q[i][0], r[1] + t[1] - Q[i][1], r[2] + t[2] - Q[i][2])
    per.push(d)
    sse += d * d
  }
  return { quat, t, rms: Math.sqrt(sse / n), per, scale }
}

// --------------------------------------------------------------------------- //
// Landmark extraction
// --------------------------------------------------------------------------- //
/** Apply a glTF 4x4 (column-major) to a point. */
function xform(m, v) {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
  ]
}

/**
 * Every mesh primitive in a scene, with the node world matrix that places it.
 *
 * ⚠️ THE NODE TRANSFORMS MATTER AND WERE MISSED ONCE. Reading POSITION alone gave
 * Z-Anatomy a 2.0 m span and so a fit scale of 0.85, where the running app reports
 * 1.0001 — because `AtlasBody` uses `Box3.setFromObject`, which walks the graph and
 * applies each node's matrix. Landmarks computed in raw attribute space are in a
 * different frame from the one the registry stores, and every placement derived
 * from them would be wrong by whatever the nodes encode.
 */
function placedPrimitives(root) {
  const scene = root.getDefaultScene() ?? root.listScenes()[0]
  const out = []
  const walk = (node) => {
    const mesh = node.getMesh()
    if (mesh) {
      const m = node.getWorldMatrix()
      for (const prim of mesh.listPrimitives()) {
        if (prim.getAttribute('POSITION')) out.push({ prim, m, mesh: mesh.getName() })
      }
    }
    for (const c of node.listChildren()) walk(c)
  }
  for (const n of scene.listChildren()) walk(n)
  return out
}

/** Per-structure centroids from an atlas carrying `_STRUCTURE`, in canonical metres. */
async function atlasLandmarks(path) {
  const doc = await io.read(path)
  const root = doc.getRoot()
  const scene = root.getDefaultScene() ?? root.listScenes()[0]
  const table = scene.getExtras().structures ?? []
  if (!table.length) throw new Error(`${path} carries no structure table`)

  // The same fit AtlasBody applies: centre x/z, stand on y=0, scale to canonical.
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]
  const prims = []
  for (const { prim, m } of placedPrimitives(root)) {
    const pos = prim.getAttribute('POSITION')
    const id = prim.getAttribute('_STRUCTURE')
    const el = [0, 0, 0]
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, el)
      const w = xform(m, el)
      for (let k = 0; k < 3; k++) { if (w[k] < mn[k]) mn[k] = w[k]; if (w[k] > mx[k]) mx[k] = w[k] }
    }
    prims.push({ pos, id, m })
  }
  const sizeY = mx[1] - mn[1]
  const scale = sizeY > 0 ? CANONICAL_HEIGHT_M / sizeY : 1
  const centre = [(mn[0] + mx[0]) / 2, 0, (mn[2] + mx[2]) / 2]
  const off = [-centre[0] * scale, -mn[1] * scale, -centre[2] * scale]
  console.log(`[place] ${path}: fit scale ${scale.toFixed(4)}, offset [${off.map((v) => v.toFixed(3))}]`)

  // Accumulate per structure id, splitting each name into its left/right copies by
  // the sign of x AFTER the fit — the canonical frame is centred, so the sign is
  // the side.
  const acc = new Map()
  const el = [0, 0, 0]
  for (const { pos, id, m } of prims) {
    if (!id) continue
    for (let i = 0; i < pos.getCount(); i++) {
      const sid = id.getScalar(i)
      const name = table[sid]?.name
      if (!name) continue
      pos.getElement(i, el)
      const w = xform(m, el)
      const x = w[0] * scale + off[0]
      const y = w[1] * scale + off[1]
      const z = w[2] * scale + off[2]
      const key = `${name}|${x < 0 ? 'R' : 'L'}`
      let a = acc.get(key)
      if (!a) acc.set(key, (a = { n: 0, s: [0, 0, 0] }))
      a.n++
      a.s[0] += x; a.s[1] += y; a.s[2] += z
    }
  }
  const out = new Map()
  for (const [k, a] of acc) out.set(k, { n: a.n, c: a.s.map((v) => v / a.n) })
  return out
}

/** Per-mesh centroids from the overlay, in its own metres, node transforms applied. */
async function overlayLandmarks(path) {
  const doc = await io.read(path)
  const acc = new Map()
  for (const { prim, m, mesh: name } of placedPrimitives(doc.getRoot())) {
    let a = acc.get(name)
    if (!a) acc.set(name, (a = { n: 0, s: [0, 0, 0] }))
    const pos = prim.getAttribute('POSITION')
    const el = [0, 0, 0]
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, el)
      const w = xform(m, el)
      for (let k = 0; k < 3; k++) a.s[k] += w[k]
      a.n++
    }
  }
  const out = new Map()
  for (const [k, a] of acc) out.set(k, { n: a.n, c: a.s.map((v) => v / a.n) })
  return out
}

const A = await atlasLandmarks(ATLAS)
const O = await overlayLandmarks(OVERLAY)

/** Pooled centroid over several overlay meshes, weighted by vertex count. */
function pooled(names) {
  const s = [0, 0, 0]
  let n = 0
  for (const nm of names) {
    const e = O.get(nm)
    if (!e) throw new Error(`overlay has no mesh "${nm}"; has ${[...O.keys()].join(', ')}`)
    for (let k = 0; k < 3; k++) s[k] += e.c[k] * e.n
    n += e.n
  }
  return s.map((v) => v / n)
}

console.log('\n[place] landmark pairs:')
const P = []
for (const p of pairs) {
  const c = pooled(p.overlay)
  P.push(c)
  console.log(`  ${p.atlas.padEnd(20)} <- ${p.overlay.join(' + ')}`)
}

/**
 * Check a placement already stored in `organOverlays.ts`, rather than deriving one.
 *
 * `--verify "x,y,z" "qx,qy,qz,qw"` reports the residual of THOSE numbers against
 * each side's landmarks. Two things it catches that recomputing cannot: a
 * transcription slip between this script's output and the registry, and a silent
 * left/right swap — the one error here that renders entirely plausibly, because a
 * mirrored ear still looks like an ear.
 */
const VERIFY = argv.indexOf('--verify')
if (VERIFY !== -1) {
  const pos = argv[VERIFY + 1].split(',').map(Number)
  const q3 = argv[VERIFY + 2].split(',').map(Number)
  const quat = [q3[3], q3[0], q3[1], q3[2]] // three.js xyzw -> Horn wxyz
  console.log(`\n[place] verifying stored placement pos=[${pos}] quat(xyzw)=[${q3}]`)
  for (const side of ['L', 'R']) {
    let sse = 0
    let n = 0
    const per = []
    for (let i = 0; i < pairs.length; i++) {
      const e = A.get(`${pairs[i].atlas}|${side}`)
      if (!e) continue
      const r = rotate(quat, P[i])
      const d = Math.hypot(r[0] + pos[0] - e.c[0], r[1] + pos[1] - e.c[1], r[2] + pos[2] - e.c[2])
      per.push(`${pairs[i].atlas} ${(d * 1000).toFixed(2)}mm`)
      sse += d * d
      n++
    }
    console.log(
      `  vs the ${side === 'L' ? 'LEFT ' : 'RIGHT'} ear: RMS ${((Math.sqrt(sse / n) * 1000) || 0).toFixed(2)} mm   ${per.join(', ')}`,
    )
  }
  process.exit(0)
}

for (const side of ['L', 'R']) {
  const Q = []
  let ok = true
  for (const p of pairs) {
    const e = A.get(`${p.atlas}|${side}`)
    if (!e) { console.log(`\n[place] side ${side}: atlas has no "${p.atlas}" on that side — skipped`); ok = false; break }
    Q.push(e.c)
  }
  if (!ok) continue
  const f = hornFit(P, Q)
  console.log(
    `\n[place] === fitted to the ${side === 'L' ? 'LEFT' : 'RIGHT'} ear ===\n` +
      `  RMS residual   ${(f.rms * 1000).toFixed(2)} mm\n` +
      `  optimal scale  ${f.scale.toFixed(4)}  (reported, NOT applied — two specimens are two people)\n` +
      `  position       [${f.t.map((v) => v.toFixed(4)).join(', ')}]\n` +
      `  quaternion     [${[f.quat[1], f.quat[2], f.quat[3], f.quat[0]].map((v) => v.toFixed(6)).join(', ')}]   (x, y, z, w — three.js order)`,
  )
  for (let i = 0; i < pairs.length; i++)
    console.log(`     ${pairs[i].atlas.padEnd(20)} off by ${(f.per[i] * 1000).toFixed(2)} mm`)
}
