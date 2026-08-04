#!/usr/bin/env node
/**
 * The schematic optical eye, GENERATED rather than sourced (B8).
 *
 * Every other asset in this project is somebody else's work under somebody
 * else's terms. This one is not, and that is the point of building it.
 *
 * The classical schematic eyes are published as radii, conic constants,
 * thicknesses and refractive indices. Those are measurements, and measurements
 * are not copyrightable expression — so a mesh generated from them belongs to
 * this project outright, with no upstream licence, no attribution chain and no
 * provenance question. It is the one organ here with nothing to disclose.
 *
 * The model is **Arizona** (Schwiegerling), chosen over Gullstrand-LeGrand,
 * Liou-Brennan and Navarro because it publishes ACCOMMODATION FORMULAS: every
 * radius, conic and thickness is a function of accommodation in dioptres, so the
 * geometry focuses rather than being a fixed shell. Liou-Brennan was rejected for
 * a second reason — it decentres the pupil 0.5 mm nasally and so is not a surface
 * of revolution at all.
 *
 * ⚠️ THIS IS AN OPTICAL MODEL, NOT AN ANATOMICAL ONE.
 * It has a cornea, a lens and a retina. It has NO sclera, no iris, no ciliary
 * body, no extraocular muscles, no optic nerve and no vasculature, because a
 * schematic eye does not model them. It must be labelled a schematic and must not
 * be presented as a donor's eye or as filling the anatomical gap. What it is
 * honestly good for: correct refracting surfaces that accommodate.
 *
 * WHAT IS DERIVED AND WHAT IS CHOSEN
 * ----------------------------------
 *   derived from the model   every radius, conic, thickness, index; the lens
 *                            EDGE, solved where the two lens surfaces meet
 *   chosen for display       the corneal semi-diameter (the model says nothing
 *                            about where cornea becomes sclera), and the mesh
 *                            resolution
 *
 * Usage:
 *   node scripts/build-eye.mjs
 *   node scripts/build-eye.mjs --accommodation 4     # 4 dioptres, near focus
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { Document, NodeIO } = require('@gltf-transform/core')

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const OUT = arg('out', 'public/models/eye.glb')
/** Accommodation in dioptres. 0 = relaxed, distance focus. */
const A = Number(arg('accommodation', '0'))
/** Rings and segments per surface of revolution. */
const RINGS = Number(arg('rings', '48'))
const SEGMENTS = Number(arg('segments', '96'))
/**
 * Corneal semi-diameter in mm — a DISPLAY CHOICE, not model data.
 * The Arizona model says nothing about where the cornea ends and the sclera
 * begins, because it does not model a sclera. 5.75 mm is the usual anatomical
 * half-width of the cornea at the limbus.
 */
const CORNEA_SEMI = Number(arg('cornea-semi', '5.75'))
/** Retinal cup half-width in mm. Also a display choice; the model is unbounded. */
const RETINA_SEMI = Number(arg('retina-semi', '11.5'))

const MM_TO_M = 0.001

// --------------------------------------------------------------------------- //
// The Arizona eye model
// --------------------------------------------------------------------------- //
/**
 * Every value here is published. The accommodation-dependent ones are the
 * model's own formulas in A (dioptres), reproduced verbatim in form.
 */
function arizona(A) {
  return {
    cornea: {
      anterior: { R: 7.8, K: -0.25 },
      posterior: { R: 6.5, K: -0.25 },
      thickness: 0.55,
      n: 1.377,
    },
    aqueous: { depth: 2.97 - 0.04 * A, n: 1.337 },
    lens: {
      anterior: { R: 12.0 - 0.4 * A, K: -7.518749 + 1.28572 * A },
      posterior: { R: -5.224557 + 0.2 * A, K: -1.353971 - 0.431762 * A },
      thickness: 3.767 + 0.04 * A,
      n: 1.42 + 0.00256 * A - 0.00022 * A * A,
    },
    vitreous: { depth: 16.713, n: 1.336 },
    retina: { R: -13.4, K: 0 },
  }
}

/**
 * Conic sag: how far a surface has fallen back from its vertex at radius r.
 *
 *   z(r) = (r²/R) / (1 + sqrt(1 - (K+1) r²/R²))
 *
 * Returns NaN outside the surface's own domain rather than a silently wrong
 * number, so a too-large semi-diameter fails visibly.
 */
function sag(r, R, K) {
  const c = 1 / R
  const disc = 1 - (K + 1) * r * r * c * c
  if (disc < 0) return NaN
  return (r * r * c) / (1 + Math.sqrt(disc))
}

/**
 * Where two surfaces meet, solved rather than assumed.
 *
 * The lens edge is not published by the Arizona model, but it is *implied*: the
 * anterior and posterior surfaces, separated by the lens thickness, intersect at
 * exactly one radius. Bisection on `sagA(r) - sagP(r) - thickness`, which is
 * monotonic in r because the posterior surface curves the other way.
 */
function solveEdge(front, back, thickness) {
  const f = (r) => sag(r, front.R, front.K) - sag(r, back.R, back.K) - thickness
  /**
   * How far each surface is defined at all.
   *
   * A conic with K+1 > 0 is an ellipsoid and STOPS: the sag is undefined beyond
   * r = R/sqrt(K+1). Only K+1 <= 0 (paraboloid or hyperboloid) continues forever.
   */
  const domain = (s) => ((s.K + 1) > 0 ? (Math.abs(s.R) / Math.sqrt(s.K + 1)) * 0.999 : Infinity)
  const limit = Math.min(domain(front), domain(back), 20)

  if (f(limit) >= 0) {
    let lo = 0
    let hi = limit
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2
      if (f(mid) < 0) lo = mid
      else hi = mid
    }
    return { r: (lo + hi) / 2, closed: true, limit }
  }

  /**
   * The surfaces never meet inside their own domain, so the model does not define
   * an equator here. That is a real property of the Arizona model at high
   * accommodation: past roughly 6 D its anterior lens conic goes POSITIVE, the
   * surface becomes oblate and terminates early. Close at the domain limit with a
   * rim band rather than inventing an intersection, and say so.
   */
  return { r: limit, closed: false, limit }
}

/**
 * Paraxial power of the whole eye, in dioptres.
 *
 * Ray transfer on (height, n·angle): refraction subtracts y·P, translation adds
 * (t/n)·nu. Launch a ray parallel to the axis at unit height and the emergent
 * n·angle is minus the system power. This is a CHECK, not part of the asset —
 * if the generated surfaces do not reproduce the model's published power, the
 * numbers were transcribed wrong.
 */
function systemPower(surfaces, gaps) {
  let y = 1
  let nu = 0
  surfaces.forEach((s, i) => {
    nu -= (y * (s.n2 - s.n1)) / (s.R * MM_TO_M) // P in dioptres needs R in metres
    if (i < gaps.length) y += ((gaps[i] * MM_TO_M) / s.n2) * nu
  })
  return -nu
}

function paraxialPower(m) {
  return systemPower(
    [
      { R: m.cornea.anterior.R, n1: 1.0, n2: m.cornea.n },
      { R: m.cornea.posterior.R, n1: m.cornea.n, n2: m.aqueous.n },
      { R: m.lens.anterior.R, n1: m.aqueous.n, n2: m.lens.n },
      { R: m.lens.posterior.R, n1: m.lens.n, n2: m.vitreous.n },
    ],
    [m.cornea.thickness, m.aqueous.depth, m.lens.thickness],
  )
}

/**
 * Self-test for the routine above, on a model whose total power IS published.
 *
 * Arizona does not publish a total power, so there is nothing to compare its
 * 60.6 D against — checking it would be circular. Gullstrand-LeGrand does:
 * **59.94 D**. Running the same code over LeGrand's four surfaces and getting
 * that number back validates the ray transfer, the sign conventions and the
 * millimetre-to-dioptre conversion. Only then does the Arizona figure mean
 * anything.
 */
function leGrandPowerCheck() {
  return systemPower(
    [
      { R: 7.8, n1: 1.0, n2: 1.3771 },
      { R: 6.5, n1: 1.3771, n2: 1.3374 },
      { R: 10.2, n1: 1.3374, n2: 1.42 },
      { R: -6.0, n1: 1.42, n2: 1.336 },
    ],
    [0.55, 3.05, 4.0],
  )
}

// --------------------------------------------------------------------------- //
// Meshing
// --------------------------------------------------------------------------- //
/**
 * A surface of revolution about the optical axis.
 *
 * `zFront` is the vertex position in atlas z (metres, +z anterior), and the
 * surface recedes POSTERIORLY as r grows, so z = zFront - sag. `flip` reverses
 * the winding, which is what the two sides of a closed body need.
 */
function revolve(surface, zFront, rMax, flip) {
  const positions = []
  const indices = []
  // Ring 0 is the single apex vertex, so the fan at the centre has no seam.
  positions.push(0, 0, zFront)
  for (let i = 1; i <= RINGS; i++) {
    // Quadratic ring spacing: samples the curved centre more finely than the rim.
    const r = rMax * (i / RINGS) ** 1.35
    const s = sag(r, surface.R, surface.K)
    if (Number.isNaN(s)) throw new Error(`sag undefined at r=${r.toFixed(3)}mm for R=${surface.R}`)
    const z = zFront - s * MM_TO_M
    for (let j = 0; j < SEGMENTS; j++) {
      const th = (j / SEGMENTS) * Math.PI * 2
      positions.push(r * MM_TO_M * Math.cos(th), r * MM_TO_M * Math.sin(th), z)
    }
  }
  const ring = (i) => 1 + (i - 1) * SEGMENTS
  for (let j = 0; j < SEGMENTS; j++) {
    const a = ring(1) + j
    const b = ring(1) + ((j + 1) % SEGMENTS)
    indices.push(...(flip ? [0, b, a] : [0, a, b]))
  }
  for (let i = 1; i < RINGS; i++) {
    for (let j = 0; j < SEGMENTS; j++) {
      const a = ring(i) + j
      const b = ring(i) + ((j + 1) % SEGMENTS)
      const c = ring(i + 1) + j
      const d = ring(i + 1) + ((j + 1) % SEGMENTS)
      if (flip) indices.push(a, d, b, a, c, d)
      else indices.push(a, b, d, a, d, c)
    }
  }
  return { positions, indices, rimStart: ring(RINGS) }
}

/** Join two rims of equal segment count into a closed band. */
function stitch(indices, rimA, rimB) {
  for (let j = 0; j < SEGMENTS; j++) {
    const a = rimA + j
    const b = rimA + ((j + 1) % SEGMENTS)
    const c = rimB + j
    const d = rimB + ((j + 1) % SEGMENTS)
    indices.push(a, b, d, a, d, c)
  }
}

/** Area-weighted vertex normals. */
function normals(pos, idx) {
  const n = new Float32Array(pos.length)
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3
    const b = idx[i + 1] * 3
    const c = idx[i + 2] * 3
    const ux = pos[b] - pos[a]
    const uy = pos[b + 1] - pos[a + 1]
    const uz = pos[b + 2] - pos[a + 2]
    const vx = pos[c] - pos[a]
    const vy = pos[c + 1] - pos[a + 1]
    const vz = pos[c + 2] - pos[a + 2]
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

/** Boundary edges — zero means watertight. */
function boundaryEdges(idx) {
  const e = new Map()
  for (let i = 0; i < idx.length; i += 3) {
    const t = [idx[i], idx[i + 1], idx[i + 2]]
    for (let k = 0; k < 3; k++) {
      const a = t[k]
      const b = t[(k + 1) % 3]
      const key = a < b ? `${a}_${b}` : `${b}_${a}`
      e.set(key, (e.get(key) ?? 0) + 1)
    }
  }
  let open = 0
  for (const v of e.values()) if (v !== 2) open++
  return open
}

// --------------------------------------------------------------------------- //
// Build
// --------------------------------------------------------------------------- //
const m = arizona(A)

// Axial positions, measured posteriorly from the corneal vertex.
const dCorneaBack = m.cornea.thickness
const dLensFront = dCorneaBack + m.aqueous.depth
const dLensBack = dLensFront + m.lens.thickness
const dRetina = dLensBack + m.vitreous.depth
const axialLength = dRetina

// Centre the eye on its own globe so placement is a translation, and put the
// optical axis along +z with the cornea forward.
const zCornea = (axialLength / 2) * MM_TO_M
const zAt = (d) => zCornea - d * MM_TO_M

const lens = solveEdge(m.lens.anterior, m.lens.posterior, m.lens.thickness)
const lensEdge = lens.r

const parts = []

// --- Cornea: two surfaces plus a rim band, closed at the chosen semi-diameter.
{
  const front = revolve(m.cornea.anterior, zAt(0), CORNEA_SEMI, false)
  const back = revolve(m.cornea.posterior, zAt(dCorneaBack), CORNEA_SEMI, true)
  const offset = front.positions.length / 3
  const positions = [...front.positions, ...back.positions]
  const indices = [...front.indices, ...back.indices.map((i) => i + offset)]
  stitch(indices, front.rimStart, back.rimStart + offset)
  parts.push({ name: 'Cornea', positions, indices })
}

// --- Lens: closed with NO invented rim, because the model's own surfaces meet.
{
  const front = revolve(m.lens.anterior, zAt(dLensFront), lensEdge, false)
  const back = revolve(m.lens.posterior, zAt(dLensBack), lensEdge, true)
  const offset = front.positions.length / 3
  const positions = [...front.positions, ...back.positions]
  const indices = [...front.indices, ...back.indices.map((i) => i + offset)]
  // The two rims coincide by construction, so stitching closes it exactly.
  stitch(indices, front.rimStart, back.rimStart + offset)
  parts.push({ name: 'Lens', positions, indices })
}

// --- Retina: an open cup, and honestly so. The eye is open at the front.
{
  const cup = revolve(m.retina, zAt(dRetina), RETINA_SEMI, true)
  parts.push({ name: 'Retina', positions: cup.positions, indices: cup.indices })
}

const doc = new Document()
doc.getRoot().getAsset().generator = 'open-twin-openXR build-eye (Arizona schematic eye)'
doc.getRoot().getAsset().copyright =
  'Schematic optical eye generated by open-twin-openXR from the published Arizona eye model ' +
  '(Schwiegerling). Geometry is original to this project; the parameters it is generated from ' +
  'are published measurements and are not themselves copyrightable.'

const buffer = doc.createBuffer()
const scene = doc.createScene('eye')
doc.getRoot().setDefaultScene(scene)
const acc = (a, t) => doc.createAccessor().setArray(a).setType(t).setBuffer(buffer)

/**
 * Transparent, because an opaque eye hides the lens and the lens is the point.
 * `KHR_materials_transmission` would be more physical, but it needs a
 * screen-space pass, and postprocessing does not work in a WebXR session at all
 * (docs/RESOURCES.md). Plain alpha blending works in the headset.
 */
const TINT = {
  Cornea: [0.86, 0.9, 0.94, 0.28],
  Lens: [0.93, 0.95, 0.88, 0.42],
  Retina: [0.72, 0.33, 0.3, 0.95],
}

const structures = []
parts.forEach((p, structureId) => {
  const pos = new Float32Array(p.positions)
  const idx = new Uint32Array(p.indices)
  const open = boundaryEdges(idx)
  const mat = doc
    .createMaterial(p.name.toLowerCase())
    .setBaseColorFactor(TINT[p.name])
    .setMetallicFactor(0)
    .setRoughnessFactor(p.name === 'Retina' ? 0.55 : 0.08)
    .setAlphaMode(TINT[p.name][3] < 1 ? 'BLEND' : 'OPAQUE')
    .setDoubleSided(true)

  const prim = doc
    .createPrimitive()
    .setMaterial(mat)
    .setIndices(acc(idx, 'SCALAR'))
    .setAttribute('POSITION', acc(pos, 'VEC3'))
    .setAttribute('NORMAL', acc(normals(pos, idx), 'VEC3'))
    .setAttribute('_STRUCTURE', acc(new Uint16Array(pos.length / 3).fill(structureId), 'SCALAR'))

  const node = doc.createNode(`sensory/${p.name.toLowerCase()}`).setMesh(doc.createMesh(p.name).addPrimitive(prim))
  node.setExtras({ label: p.name, source: 'generated-arizona-eye' })
  scene.addChild(node)

  let c = [0, 0, 0]
  for (let i = 0; i < pos.length; i += 3) {
    c[0] += pos[i]
    c[1] += pos[i + 1]
    c[2] += pos[i + 2]
  }
  c = c.map((v) => +((v / (pos.length / 3))).toFixed(5))
  structures.push({ name: p.name, mesh: `sensory/${p.name.toLowerCase()}`, centroid: c, watertight: open === 0 })
  p.tris = idx.length / 3
  p.verts = pos.length / 3
  p.open = open
})

const power = paraxialPower(m)

scene.setExtras({
  structures,
  structure_attribute: '_STRUCTURE',
  model: {
    name: 'Arizona schematic eye (Schwiegerling)',
    accommodation_dioptres: A,
    axial_length_mm: +axialLength.toFixed(3),
    paraxial_power_dioptres: +power.toFixed(2),
    lens_edge_diameter_mm: +(lensEdge * 2).toFixed(3),
    lens_edge_is_model_intersection: lens.closed,
    surfaces: {
      cornea_anterior: m.cornea.anterior,
      cornea_posterior: m.cornea.posterior,
      lens_anterior: m.lens.anterior,
      lens_posterior: m.lens.posterior,
      retina: m.retina,
    },
  },
  /** Say what this is, so nothing downstream has to guess. */
  caveat:
    'SCHEMATIC OPTICAL model, not anatomy. Cornea, lens and retina only — no sclera, iris, ' +
    'ciliary body, extraocular muscles, optic nerve or vasculature, because a schematic eye ' +
    'does not model them. Geometry generated from published parameters and original to this ' +
    'project; the corneal and retinal half-widths are display choices, everything else is ' +
    'derived from the model, including the lens edge.',
  generated: true,
})

await new NodeIO().write(OUT, doc)

// --------------------------------------------------------------------------- //
// Verify
// --------------------------------------------------------------------------- //
console.log(`\n${OUT}  —  Arizona schematic eye, accommodation ${A} D\n`)
for (const p of parts) {
  console.log(
    `  ${p.name.padEnd(9)} ${String(p.tris).padStart(6)} tris  ${String(p.verts).padStart(6)} verts  ` +
      (p.open === 0 ? 'watertight' : `${p.open} boundary edge(s)`),
  )
}
const leGrand = leGrandPowerCheck()
console.log(`
  axial length      ${axialLength.toFixed(3)} mm      expect exactly 24.000 at A=0
  paraxial power    ${power.toFixed(2)} D         Arizona publishes no total power, so this is
                                     trusted only because the routine reproduces
                                     LeGrand's published 59.94 D -> got ${leGrand.toFixed(2)} D
  lens edge         ${(lensEdge * 2).toFixed(2)} mm      implied by the model, solved not assumed.
                                     NOT a match for Atchison's 9.6 mm, and should not be —
                                     that is a different model with different lens conics.
                                     Arizona's anterior lens is markedly hyperbolic (K=-7.5),
                                     which puts the intersection wider. Noted, not corrected.
  retina rim        ${parts.find((p) => p.name === 'Retina').open} edges     one clean ring: the eye is open at the front
`)

const problems = []
if (Math.abs(axialLength - 24) > 0.01 && A === 0) problems.push(`axial length ${axialLength.toFixed(3)} != 24.000`)
// The real gate. If LeGrand does not come back at its published value, the
// paraxial routine is wrong and the Arizona number it prints is meaningless.
if (Math.abs(leGrand - 59.94) > 0.05) {
  problems.push(`LeGrand self-test gave ${leGrand.toFixed(2)} D, published is 59.94 — routine is wrong`)
}
// Accommodating by A dioptres should add roughly A dioptres of power, so the
// band tracks A rather than being fixed — an earlier fixed 55–65 gate failed
// every accommodated build, which was the gate being wrong and not the eye.
if (power - A < 55 || power - A > 66) {
  problems.push(`relaxed-equivalent power ${(power - A).toFixed(2)} D outside 55–66 (raw ${power.toFixed(2)} at A=${A})`)
}
if (parts.find((p) => p.name === 'Retina').open !== SEGMENTS) {
  problems.push(`retina rim is ${parts.find((p) => p.name === 'Retina').open} edges, expected one ring of ${SEGMENTS}`)
}
if (parts.find((p) => p.name === 'Lens').open !== 0) problems.push('lens is not watertight')
if (parts.find((p) => p.name === 'Cornea').open !== 0) problems.push('cornea is not watertight')
if (problems.length) {
  console.error('✗ ' + problems.join('\n✗ '))
  process.exit(1)
}
console.log('✓ all checks pass\n')
