#!/usr/bin/env node
/**
 * Bake ambient occlusion into COLOR_0, offline, per vertex.
 *
 * WHY PER-VERTEX AND NOT A TEXTURE
 * --------------------------------
 * Ambient occlusion is the single largest depth cue available to this renderer,
 * and the usual two ways to get it are both closed to us:
 *
 *   - A baked AO *texture* needs UVs. Neither atlas has any. HRA carries
 *     TEXCOORD_0 on 3 % of its primitives and BodyParts3D on none, so there is
 *     no parameterisation to bake into without unwrapping 1,833 meshes first.
 *   - Screen-space AO (GTAO/N8AO) needs a post-processing pass, which costs a
 *     full-resolution depth+normal prepass and — the part that matters here —
 *     is applied per eye in WebXR, where the frame budget is 11 ms, not 16.
 *
 * Vertices we do have: 1.33 M of them, already welded, already meshopt-encoded.
 * COLOR_0 multiplies base colour in three.js when `material.vertexColors` is
 * true, which is exactly what an AO term should do. It costs one byte per
 * channel per vertex, survives meshopt compression, needs no shader change, and
 * renders identically in VR and on a phone.
 *
 * WHY THE RAYS ARE SHORT
 * ----------------------
 * `--max-dist` defaults to 3 cm on a 1.7 m body, which makes this *cavity* AO
 * rather than global AO. That is deliberate, for two reasons.
 *
 * The renderer lets the viewer hide whole layers — take the muscle off and look
 * at the viscera. Global AO bakes one fixed visibility into the vertices, so
 * anything under the skin would stay dark after the skin is switched off, and
 * the shading would contradict what is on screen. Short rays only see immediate
 * neighbours, so the term stays true under every layer combination.
 *
 * It is also the part that carries the detail. Long-range occlusion is a slow
 * gradient the eye reads as "dim"; the contact shadow where two structures meet
 * is what reads as "solid". We want the second one.
 *
 * Usage:
 *   node --max-old-space-size=8192 scripts/bake-ao.mjs public/models/x.opt.glb
 *   node scripts/bake-ao.mjs in.glb --rays 64 --max-dist 0.04 --strength 0.9
 *
 * Run it AFTER `gltf-transform optimize` and `add-normals.mjs`: welding changes
 * the vertex set, and the bake needs the normals it writes.
 */
import { createRequire } from 'node:module'
import { statSync, readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { NodeIO } = require('@gltf-transform/core')
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions')
const { MeshoptDecoder, MeshoptEncoder } = require('meshoptimizer')
const THREE = require('three')
const { MeshBVH } = require('three-mesh-bvh')

// ---------------------------------------------------------------- arguments

const argv = process.argv.slice(2)
const file = argv.find((a) => !a.startsWith('--'))
if (!file) {
  console.error(
    'Usage: node scripts/bake-ao.mjs <file.glb> [--rays N] [--max-dist M] ' +
      '[--strength S] [--min L] [--out FILE]',
  )
  process.exit(1)
}
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? fallback : Number(argv[i + 1])
}
const str = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? fallback : argv[i + 1]
}

/** Hemisphere samples per vertex. 32 is clean; 16 is visibly noisy on flats. */
const RAYS = flag('rays', 32)
/** Metres. Beyond this an occluder is ignored — see "why the rays are short". */
const MAX_DIST = flag('max-dist', 0.03)
/**
 * Neighbour-averaging passes applied to the baked AO. See `smoothAo`.
 * 0 restores the pre-28-July behaviour, which stippled on thin geometry.
 */
const SMOOTH = flag('smooth', 2)
/**
 * 1 = full occlusion range, lower keeps the effect subtle.
 *
 * Settled at 0.5 on 28 July, from measurement rather than taste. At 0.85 the
 * floor is 0.448 and a quarter of HRA's vertices sat exactly on it — a body
 * where 25 % of the surface is pinned at maximum darkness reads as murky rather
 * than occluded, and Z-Anatomy's median landed at 0.455, barely off the floor.
 * At 0.5 the floor lifts to 0.675 and the usable contrast span halves from 0.553
 * to 0.325, which keeps cavity shading legible without crushing it.
 *
 * ⚠️ Do not re-bake to change this. `scripts/restrength-ao.mjs` re-maps a baked
 * asset to any other strength exactly and in seconds, because the term is a
 * linear function of the occlusion fraction. An hour of bake to move one number
 * is never the right trade.
 */
const STRENGTH = flag('strength', 0.5)
/** Darkest the term may go. Never 0: a black organ reads as a hole, not a crevice. */
const MIN = flag('min', 0.35)
const OUT = str('out', file)

// ------------------------------------------------------------------ helpers

/**
 * Cosine-weighted hemisphere directions around +Z, from a Hammersley sequence.
 *
 * Cosine weighting matches the Lambert term the AO stands in for, so samples
 * are dense where they contribute most. A deterministic low-discrepancy set
 * beats random sampling at these counts — random leaves visible clumping at 32
 * samples, and being deterministic means a rebuild produces the same asset.
 */
function cosineHemisphere(n) {
  const dirs = []
  for (let i = 0; i < n; i++) {
    // radical inverse base 2
    let bits = i
    bits = ((bits << 16) | (bits >>> 16)) >>> 0
    bits = (((bits & 0x55555555) << 1) | ((bits & 0xaaaaaaaa) >>> 1)) >>> 0
    bits = (((bits & 0x33333333) << 2) | ((bits & 0xcccccccc) >>> 2)) >>> 0
    bits = (((bits & 0x0f0f0f0f) << 4) | ((bits & 0xf0f0f0f0) >>> 4)) >>> 0
    bits = (((bits & 0x00ff00ff) << 8) | ((bits & 0xff00ff00) >>> 8)) >>> 0
    const u = (i + 0.5) / n
    const v = bits * 2.3283064365386963e-10
    const r = Math.sqrt(u)
    const phi = 2 * Math.PI * v
    dirs.push([r * Math.cos(phi), r * Math.sin(phi), Math.sqrt(Math.max(0, 1 - u))])
  }
  return dirs
}

/** Any unit vector perpendicular to `n`, chosen to avoid the degenerate axis. */
function basisFrom(n, t, b) {
  const a = Math.abs(n.z) < 0.9 ? _up : _right
  t.crossVectors(a, n).normalize()
  b.crossVectors(n, t)
}
const _up = new THREE.Vector3(0, 0, 1)
const _right = new THREE.Vector3(1, 0, 0)

// ------------------------------------------------------------------- read in

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })

console.log(`[bake-ao] reading ${file} (${(statSync(file).size / 1e6).toFixed(1)} MB)`)
const doc = await io.read(file)
const root = doc.getRoot()

/**
 * World matrix per node.
 *
 * The occluder set has to live in one space or a rib will not shadow the lung
 * beside it. glTF keeps transforms on nodes, so the positions have to be pushed
 * through the node chain before they can share a BVH.
 */
function worldMatrix(node) {
  const m = new THREE.Matrix4()
  const chain = []
  for (let n = node; n; n = n.getParentNode?.() ?? null) chain.unshift(n)
  for (const n of chain) m.multiply(new THREE.Matrix4().fromArray(n.getMatrix()))
  return m
}

/** Every primitive, with the node transform that places it. */
const items = []
for (const node of root.listNodes()) {
  const mesh = node.getMesh()
  if (!mesh) continue
  const matrix = worldMatrix(node)
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION')
    const nrm = prim.getAttribute('NORMAL')
    if (!pos) continue
    items.push({ prim, node, matrix, pos, nrm })
  }
}
if (!items.length) {
  console.error('[bake-ao] no primitives with POSITION found')
  process.exit(1)
}
/**
 * Normals are computed here when the asset has none, and NOT written back.
 *
 * The pipeline deliberately ships POSITION only — dropping NORMAL is what lets
 * welding build a manifold that meshoptimizer can simplify, and re-adding it
 * offline as f32 tripled the file for a cost the browser pays in ~220 ms. None
 * of that argues against needing normals *here*: the hemisphere has to be
 * oriented against the surface or the rays fire in arbitrary directions and the
 * result is noise. So compute them in memory, use them, discard them.
 */
const missingNormals = items.filter((i) => !i.nrm)
if (missingNormals.length) {
  console.log(`[bake-ao] ${missingNormals.length}/${items.length} primitives have no NORMAL — computing in memory`)
  for (const it of missingNormals) {
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(Float32Array.from(it.pos.getArray()), it.pos.getElementSize()),
    )
    const idx = it.prim.getIndices()
    if (idx) g.setIndex(new THREE.BufferAttribute(Uint32Array.from(idx.getArray()), 1))
    g.computeVertexNormals()
    const arr = g.getAttribute('normal').array
    // Quantised POSITION means the accessor array is integer-normalised; the
    // computed normals are plain floats either way, so wrap them in a local
    // accessor-like shim rather than round-tripping through the document.
    it.nrm = {
      getCount: () => arr.length / 3,
      getElement: (i, out) => {
        out[0] = arr[i * 3]
        out[1] = arr[i * 3 + 1]
        out[2] = arr[i * 3 + 2]
        return out
      },
    }
  }
}

// -------------------------------------------------------- build the occluder

/**
 * One BVH over every triangle in the file.
 *
 * Structures occlude each other — the whole point — so this cannot be done
 * per-mesh. Positions are baked to world space here so the BVH and the query
 * points agree.
 */
console.log(`[bake-ao] merging ${items.length} primitives into one occluder…`)
let totalIdx = 0
for (const it of items) {
  const idx = it.prim.getIndices()
  totalIdx += idx ? idx.getCount() : it.pos.getCount()
}
const mergedPos = new Float32Array(totalIdx * 3)
let w = 0
const _v = new THREE.Vector3()
for (const it of items) {
  const idx = it.prim.getIndices()
  const count = idx ? idx.getCount() : it.pos.getCount()
  const el = [0, 0, 0]
  for (let i = 0; i < count; i++) {
    const vi = idx ? idx.getScalar(i) : i
    it.pos.getElement(vi, el)
    _v.set(el[0], el[1], el[2]).applyMatrix4(it.matrix)
    mergedPos[w++] = _v.x
    mergedPos[w++] = _v.y
    mergedPos[w++] = _v.z
  }
}
const occluder = new THREE.BufferGeometry()
occluder.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3))
const t0 = Date.now()
const bvh = new MeshBVH(occluder, { maxLeafTris: 12 })
console.log(
  `[bake-ao] BVH over ${(totalIdx / 3).toLocaleString()} triangles in ` +
    `${((Date.now() - t0) / 1000).toFixed(1)}s`,
)

// ------------------------------------------------------------------ the bake

const DIRS = cosineHemisphere(RAYS)
const ray = new THREE.Ray()
const origin = new THREE.Vector3()
const dir = new THREE.Vector3()
const normal = new THREE.Vector3()
const tangent = new THREE.Vector3()
const bitangent = new THREE.Vector3()
const normalMat = new THREE.Matrix3()

/** Nudge along the normal so a ray does not hit the face it started on. */
const EPS = MAX_DIST * 0.01

const totalVerts = items.reduce((s, i) => s + i.pos.getCount(), 0)
console.log(
  `[bake-ao] ${totalVerts.toLocaleString()} vertices x ${RAYS} rays ` +
    `= ${((totalVerts * RAYS) / 1e6).toFixed(1)}M casts, max-dist ${MAX_DIST} m`,
)

let done = 0
let lastLog = Date.now()
const tBake = Date.now()
let sumAo = 0

/**
 * Average each vertex's AO with its mesh neighbours, `--smooth` times.
 *
 * ⚠️ THIS IS WHY THE ATLAS STOPPED LOOKING LIKE A POINT CLOUD.
 *
 * With N rays a vertex can only take N+1 distinct occlusion values, and on thin,
 * open geometry — HRA's hollow organ shells, the surface-region patches — a ray
 * either escapes entirely or hits immediately, so the result piles up at the two
 * extremes. Measured on `hra.ao.glb` before this existed: 5th percentile sat on
 * the darkness floor (0.447) and the 95th on 1.000, with almost nothing between.
 * Store that per VERTEX, interpolate it across large post-simplify triangles, and
 * you get the stippled, dotted look that reads as a point cloud. BodyParts3D
 * escaped it only because its geometry is denser and more enclosed (p05 0.616,
 * p95 0.855 — a narrow, continuous band).
 *
 * Smoothing borrows samples from adjacent vertices, so it buys the same
 * continuity more rays would, at a cost measured in seconds. **Raising `--rays`
 * instead is the obvious fix and it is a trap**: the Z-Anatomy bake is 1.63 M
 * vertices, so 32 rays already costs 54 minutes and 128 would cost about 3.6
 * hours for an effect this achieves for free.
 *
 * It is a blur, so it does soften genuine contact shadows slightly. Two passes
 * is the point where the speckle is gone and cavity darkening still reads; that
 * is why the default is 2 rather than "as many as it takes".
 */
function smoothAo(ao, index, count, passes) {
  if (!passes || !index) return ao
  // Adjacency from the index buffer: every triangle edge is a neighbour link.
  const start = new Uint32Array(count + 1)
  const idx = index.getArray()
  for (let i = 0; i < idx.length; i += 3)
    for (let k = 0; k < 3; k++) {
      start[idx[i + k]] += 2
    }
  let run = 0
  for (let v = 0; v <= count; v++) {
    const c = v < count ? start[v] : 0
    start[v] = run
    run += c
  }
  const nbr = new Uint32Array(run)
  const fill = start.slice()
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2]
    nbr[fill[a]++] = b; nbr[fill[a]++] = c
    nbr[fill[b]++] = a; nbr[fill[b]++] = c
    nbr[fill[c]++] = a; nbr[fill[c]++] = b
  }
  let cur = ao
  for (let p = 0; p < passes; p++) {
    const next = new Float32Array(count)
    for (let v = 0; v < count; v++) {
      let sum = cur[v]
      let k = 1
      for (let e = start[v]; e < start[v + 1]; e++) {
        sum += cur[nbr[e]]
        k++
      }
      next[v] = sum / k
    }
    cur = next
  }
  return cur
}

for (const it of items) {
  const n = it.pos.getCount()
  const colors = new Uint8Array(n * 3)
  const aoBuf = new Float32Array(n)
  normalMat.getNormalMatrix(it.matrix)
  const pe = [0, 0, 0]
  const ne = [0, 0, 0]

  for (let i = 0; i < n; i++) {
    it.pos.getElement(i, pe)
    it.nrm.getElement(i, ne)
    origin.set(pe[0], pe[1], pe[2]).applyMatrix4(it.matrix)
    normal.set(ne[0], ne[1], ne[2]).applyMatrix3(normalMat).normalize()
    basisFrom(normal, tangent, bitangent)
    origin.addScaledVector(normal, EPS)

    let hits = 0
    for (let r = 0; r < RAYS; r++) {
      const d = DIRS[r]
      dir
        .copy(tangent)
        .multiplyScalar(d[0])
        .addScaledVector(bitangent, d[1])
        .addScaledVector(normal, d[2])
        .normalize()
      ray.origin.copy(origin)
      ray.direction.copy(dir)
      // Double-sided: an organ wall is a thin shell and its back face is a real
      // occluder for the structure behind it.
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide)
      if (hit && hit.distance < MAX_DIST) hits++
    }

    // Occlusion falls to MIN at full enclosure, never to black.
    const open = 1 - (hits / RAYS) * STRENGTH
    // Written to bytes only after smoothing — see `smoothAo`. Quantising to 8
    // bits first would bake the speckle in before it could be averaged out.
    aoBuf[i] = MIN + (1 - MIN) * open

    // Progress is reported per VERTEX, not per primitive. It used to sit in the
    // outer loop, which was fine at 1,833 meshes and useless once the atlas was
    // merged to 11: a single mesh can be half a million vertices, so the bake
    // would run for tens of minutes between two log lines and look hung.
    if ((done + i) % 20000 === 0 && Date.now() - lastLog > 5000) {
      const at = done + i
      const pct = ((100 * at) / totalVerts).toFixed(1)
      const rate = at / ((Date.now() - tBake) / 1000)
      const eta = ((totalVerts - at) / rate / 60).toFixed(1)
      console.log(
        `[bake-ao]   ${pct}%  ${Math.round(rate).toLocaleString()} verts/s  ETA ${eta} min`,
      )
      lastLog = Date.now()
    }
  }

  // Smooth, then quantise. Neighbours come from this primitive's own index
  // buffer, so the blur never crosses a mesh boundary.
  const smoothed = smoothAo(aoBuf, it.prim.getIndices(), n, SMOOTH)
  for (let i = 0; i < n; i++) {
    sumAo += smoothed[i]
    const byte = Math.max(0, Math.min(255, Math.round(smoothed[i] * 255)))
    colors[i * 3] = byte
    colors[i * 3 + 1] = byte
    colors[i * 3 + 2] = byte
  }

  // u8-normalised keeps this at 3 bytes/vertex; meshopt compresses it further.
  const accessor = doc
    .createAccessor()
    .setType('VEC3')
    .setArray(colors)
    .setNormalized(true)
    .setBuffer(root.listBuffers()[0])
  it.prim.setAttribute('COLOR_0', accessor)

  done += n
}

console.log(
  `[bake-ao] baked in ${((Date.now() - tBake) / 1000 / 60).toFixed(1)} min, ` +
    `mean AO ${(sumAo / totalVerts).toFixed(3)}`,
)

// A mean near 1.0 means nothing was occluded and the asset gained weight for
// no visual gain — almost always a units mistake, since max-dist is in metres.
const mean = sumAo / totalVerts
if (mean > 0.97) {
  console.warn(
    `[bake-ao] mean AO is ${mean.toFixed(3)} — essentially no occlusion was found. ` +
      `Check that the model is in METRES (--max-dist ${MAX_DIST} assumes a ~1.7 m body).`,
  )
}

/**
 * Assert the credit on the way out.
 *
 * This is the LAST stage that writes a shipped asset, which makes it the only
 * place the credit can be guaranteed. `strip-atlas.mjs` stamps it too, but a
 * rebake that starts from an existing `.opt.glb` skips that stage entirely — and
 * that is not a hypothetical: re-baking HRA to fix its ambient occlusion did
 * exactly that, and would have quietly produced two uncredited CC BY 4.0 assets
 * if this did not exist. A credit that depends on which upstream stages happened
 * to run is not a credit.
 *
 * Preserve what the input carries; otherwise take it from the register, keyed on
 * the OUTPUT name. Loud when neither, because an uncredited asset is a licence
 * breach that looks like nothing at all.
 */
const existingCopyright = doc.getRoot().getAsset().copyright
if (existingCopyright?.trim()) {
  console.log(`[bake-ao] copyright: carried through from input`)
} else {
  const stem = OUT.replace(/\.(stripped|opt|ao)?\.glb$/, '').split('/').pop()
  const register = JSON.parse(readFileSync(new URL('../licences.json', import.meta.url), 'utf8'))
  const entry = register.assets.find((a) => a.file?.includes(`/${stem}.ao.glb`))
  if (entry?.attribution) {
    doc.getRoot().getAsset().copyright = entry.attribution
    console.log(`[bake-ao] copyright: stamped from licences.json (${entry.id})`)
  } else {
    console.warn(
      `[bake-ao] ⚠️  NO COPYRIGHT for ${OUT}: the input carries none and ` +
        `licences.json has no entry matching "${stem}". It will ship uncredited.`,
    )
  }
}

await io.write(OUT, doc)
console.log(`[bake-ao] wrote ${OUT} (${(statSync(OUT).size / 1e6).toFixed(1)} MB)`)
console.log(
  `[bake-ao] To see it: the material must set vertexColors: true, and the ` +
    `base colour must be the tissue colour (COLOR_0 multiplies it).`,
)
