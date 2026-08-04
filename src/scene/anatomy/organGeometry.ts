/**
 * Procedurally-generated anatomical geometry.
 *
 * These are *stylised but anatomically plausible* organ shapes built from
 * three.js primitives and swept curves — a ribcage of tapering arcs, a spine
 * with vertebrae, a coiled intestine, lobed lungs. They exist so the twin reads
 * as a human body with ZERO binary assets and no licence entanglement, which is
 * what makes `npm install && npm run dev` show the real product immediately.
 *
 * They are NOT a substitute for the real atlas. When `hra.opt.glb` is present,
 * `AtlasBody` loads it instead and this becomes the fallback. See
 * `docs/MODEL_PIPELINE.md`.
 *
 * Everything here is in METRES, +Y up, subject facing +Z, origin at the pelvis
 * root — the canonical world convention from HANDOVER_SPEC section 5, so
 * procedural and atlas geometry are interchangeable in the same frame.
 */
import {
  BufferGeometry,
  CatmullRomCurve3,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  LatheGeometry,
  Matrix4,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Apply a translation/rotation/scale to a geometry before merging it. */
function placed(
  geo: BufferGeometry,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
): BufferGeometry {
  const m = new Matrix4()
  const r = new Matrix4()
  m.makeScale(...scale)
  r.makeRotationFromEuler({ x: rotation[0], y: rotation[1], z: rotation[2], order: 'XYZ' } as never)
  m.premultiply(r)
  m.premultiply(new Matrix4().makeTranslation(...position))
  return geo.clone().applyMatrix4(m)
}

function merge(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts, false)
  parts.forEach((p) => p.dispose())
  if (!merged) throw new Error('organGeometry: failed to merge parts')
  merged.computeVertexNormals()
  return merged
}

/** Sweep a smooth tube through control points. Used for gut, vessels, spine. */
function tube(points: [number, number, number][], radius: number, segments = 96, radial = 12) {
  const curve = new CatmullRomCurve3(points.map((p) => new Vector3(...p)))
  return new TubeGeometry(curve, segments, radius, radial, false)
}

/* ------------------------------------------------------------------ *
 * Body shell (integumentary)
 * ------------------------------------------------------------------ */

/**
 * The outer body. A lathed torso profile gives a proper taper — shoulders,
 * waist, hips — rather than the capsule that read as a pill. Head, neck and
 * limbs are attached as tapered capsules.
 */
export function buildBodyShell(): BufferGeometry {
  // Torso profile: [radius, height] pairs from hips up to shoulders.
  const profile = [
    [0.02, 0.62],
    [0.15, 0.66],
    [0.18, 0.74],
    [0.17, 0.84],
    [0.145, 0.95],
    [0.15, 1.06],
    [0.17, 1.16],
    [0.185, 1.26],
    [0.17, 1.34],
    [0.10, 1.40],
    [0.02, 1.42],
  ].map(([r, y]) => new Vector2(r, y))

  const torso = new LatheGeometry(profile, 48)

  const neck = new CapsuleGeometry(0.055, 0.08, 6, 20)
  const head = new SphereGeometry(0.115, 32, 32)
  const jaw = new SphereGeometry(0.085, 24, 24)

  const upperArm = new CapsuleGeometry(0.048, 0.26, 6, 18)
  const foreArm = new CapsuleGeometry(0.04, 0.24, 6, 18)
  const hand = new SphereGeometry(0.05, 16, 16)

  const thigh = new CapsuleGeometry(0.075, 0.32, 6, 20)
  const shin = new CapsuleGeometry(0.055, 0.32, 6, 20)
  const foot = new SphereGeometry(0.06, 16, 16)

  const parts: BufferGeometry[] = [
    torso,
    placed(neck, [0, 1.46, 0]),
    placed(head, [0, 1.60, 0.01], [0, 0, 0], [1, 1.12, 1.04]),
    placed(jaw, [0, 1.55, 0.03], [0, 0, 0], [0.9, 0.7, 0.95]),

    // arms, angled slightly out from the shoulders
    placed(upperArm, [-0.235, 1.16, 0], [0, 0, 0.14]),
    placed(upperArm, [0.235, 1.16, 0], [0, 0, -0.14]),
    placed(foreArm, [-0.275, 0.87, 0.01], [0, 0, 0.07]),
    placed(foreArm, [0.275, 0.87, 0.01], [0, 0, -0.07]),
    placed(hand, [-0.293, 0.71, 0.01], [0, 0, 0], [0.7, 1.25, 0.45]),
    placed(hand, [0.293, 0.71, 0.01], [0, 0, 0], [0.7, 1.25, 0.45]),

    // legs
    placed(thigh, [-0.085, 0.48, 0]),
    placed(thigh, [0.085, 0.48, 0]),
    placed(shin, [-0.085, 0.16, 0]),
    placed(shin, [0.085, 0.16, 0]),
    placed(foot, [-0.085, 0.02, 0.04], [0, 0, 0], [0.9, 0.45, 1.9]),
    placed(foot, [0.085, 0.02, 0.04], [0, 0, 0], [0.9, 0.45, 1.9]),
  ]

  return merge(parts)
}

/* ------------------------------------------------------------------ *
 * Musculoskeletal — spine, ribcage, pelvis, long bones
 * ------------------------------------------------------------------ */

export function buildSkeleton(): BufferGeometry {
  const parts: BufferGeometry[] = []

  // Spine: a gentle S-curve (lordosis/kyphosis), with vertebrae strung along it.
  const spinePts: [number, number, number][] = [
    [0, 0.66, -0.015],
    [0, 0.80, -0.035],
    [0, 0.95, -0.045],
    [0, 1.10, -0.030],
    [0, 1.25, -0.015],
    [0, 1.38, -0.020],
    [0, 1.48, -0.020],
  ]
  parts.push(tube(spinePts, 0.016, 64, 10))

  const curve = new CatmullRomCurve3(spinePts.map((p) => new Vector3(...p)))
  for (let i = 0; i <= 16; i++) {
    const p = curve.getPointAt(i / 16)
    parts.push(placed(new CylinderGeometry(0.028, 0.028, 0.016, 12), [p.x, p.y, p.z]))
  }

  // Ribcage: paired arcs tapering top and bottom, hinged at the spine.
  const RIBS = 9
  for (let i = 0; i < RIBS; i++) {
    const t = i / (RIBS - 1)
    const y = 1.30 - t * 0.34
    // widest around the middle of the cage
    const spread = Math.sin((0.25 + t * 0.62) * Math.PI)
    const rx = 0.085 + spread * 0.085
    const arc = new TorusGeometry(rx, 0.008, 8, 40, Math.PI * 1.06)
    // rotate so the arc opens forward and slopes down toward the sternum
    parts.push(placed(arc, [0, y, -0.02], [Math.PI / 2 - 0.22 - t * 0.12, 0, -Math.PI * 0.03], [1, 1, 0.78]))
  }

  // Sternum
  parts.push(placed(new CylinderGeometry(0.022, 0.016, 0.20, 10), [0, 1.19, 0.10]))

  // Clavicles
  parts.push(placed(new CapsuleGeometry(0.011, 0.15, 4, 10), [-0.09, 1.33, 0.05], [0, 0.32, Math.PI / 2]))
  parts.push(placed(new CapsuleGeometry(0.011, 0.15, 4, 10), [0.09, 1.33, 0.05], [0, -0.32, Math.PI / 2]))

  // Pelvis: an open ring plus the iliac blades
  parts.push(placed(new TorusGeometry(0.105, 0.019, 10, 32, Math.PI * 1.25), [0, 0.70, 0], [Math.PI / 2 + 0.28, 0, 0], [1, 1, 0.72]))
  parts.push(placed(new SphereGeometry(0.075, 20, 16), [-0.09, 0.76, -0.01], [0, 0, 0.4], [0.42, 1, 0.72]))
  parts.push(placed(new SphereGeometry(0.075, 20, 16), [0.09, 0.76, -0.01], [0, 0, -0.4], [0.42, 1, 0.72]))

  // Long bones
  parts.push(placed(new CapsuleGeometry(0.021, 0.30, 5, 12), [-0.085, 0.48, 0]))
  parts.push(placed(new CapsuleGeometry(0.021, 0.30, 5, 12), [0.085, 0.48, 0]))
  parts.push(placed(new CapsuleGeometry(0.016, 0.30, 5, 12), [-0.085, 0.16, 0]))
  parts.push(placed(new CapsuleGeometry(0.016, 0.30, 5, 12), [0.085, 0.16, 0]))
  parts.push(placed(new CapsuleGeometry(0.016, 0.24, 5, 12), [-0.235, 1.16, 0], [0, 0, 0.14]))
  parts.push(placed(new CapsuleGeometry(0.016, 0.24, 5, 12), [0.235, 1.16, 0], [0, 0, -0.14]))
  parts.push(placed(new CapsuleGeometry(0.012, 0.22, 5, 12), [-0.275, 0.87, 0.01], [0, 0, 0.07]))
  parts.push(placed(new CapsuleGeometry(0.012, 0.22, 5, 12), [0.275, 0.87, 0.01], [0, 0, -0.07]))

  // Skull
  parts.push(placed(new SphereGeometry(0.098, 24, 20), [0, 1.60, 0.01], [0, 0, 0], [1, 1.1, 1.02]))

  return merge(parts)
}

/* ------------------------------------------------------------------ *
 * Cardiovascular — heart with apex, plus the aortic arch
 * ------------------------------------------------------------------ */

export function buildHeart(): BufferGeometry {
  const body = placed(new SphereGeometry(0.052, 28, 24), [0, 0, 0], [0, 0, 0], [1, 1.12, 0.86])
  const apex = placed(new ConeGeometry(0.05, 0.075, 24), [0.004, -0.062, 0], [Math.PI, 0, 0.22])
  const atrium = placed(new SphereGeometry(0.032, 20, 16), [-0.028, 0.042, -0.012], [0, 0, 0], [1, 0.85, 0.9])

  // Aortic arch sweeping up and over
  const aorta = tube(
    [
      [0.012, 0.03, 0.012],
      [0.016, 0.078, 0.004],
      [0.002, 0.104, -0.016],
      [-0.026, 0.094, -0.028],
      [-0.032, 0.052, -0.026],
      [-0.030, 0.006, -0.022],
    ],
    0.013,
    48,
    12,
  )

  // Pulmonary trunk
  const trunk = placed(new CylinderGeometry(0.012, 0.014, 0.06, 12), [0.028, 0.05, -0.004], [0.2, 0, -0.18])

  return merge([body, apex, atrium, aorta, trunk])
}

/* ------------------------------------------------------------------ *
 * Respiratory — lobed lungs with a cardiac notch, trachea, bronchi
 * ------------------------------------------------------------------ */

function lungLobe(sx: number, sy: number, sz: number): BufferGeometry {
  return placed(new SphereGeometry(1, 24, 20), [0, 0, 0], [0, 0, 0], [sx, sy, sz])
}

export function buildLungs(): BufferGeometry {
  const parts: BufferGeometry[] = []

  // Right lung (subject's right = -X here): three lobes, fuller.
  parts.push(placed(lungLobe(0.062, 0.085, 0.052), [-0.075, 0.055, -0.005]))
  parts.push(placed(lungLobe(0.058, 0.055, 0.05), [-0.077, -0.05, 0.0]))

  // Left lung: two lobes, slimmer — the cardiac notch makes room for the heart.
  parts.push(placed(lungLobe(0.055, 0.082, 0.05), [0.078, 0.055, -0.008]))
  parts.push(placed(lungLobe(0.046, 0.052, 0.046), [0.086, -0.05, -0.004]))

  // Trachea and the two main bronchi
  parts.push(placed(new CylinderGeometry(0.013, 0.013, 0.13, 14), [0, 0.165, -0.012]))
  parts.push(placed(new CylinderGeometry(0.008, 0.009, 0.075, 10), [-0.03, 0.088, -0.012], [0, 0, 0.62]))
  parts.push(placed(new CylinderGeometry(0.008, 0.009, 0.075, 10), [0.03, 0.088, -0.012], [0, 0, -0.62]))

  return merge(parts)
}

/* ------------------------------------------------------------------ *
 * Nervous — cerebral hemispheres, cerebellum, brain stem, spinal cord
 * ------------------------------------------------------------------ */

export function buildBrain(): BufferGeometry {
  const parts: BufferGeometry[] = []

  // Two hemispheres with a visible longitudinal fissure between them
  parts.push(placed(new SphereGeometry(0.062, 28, 22), [-0.026, 0.012, 0], [0, 0, 0], [0.92, 0.96, 1.1]))
  parts.push(placed(new SphereGeometry(0.062, 28, 22), [0.026, 0.012, 0], [0, 0, 0], [0.92, 0.96, 1.1]))

  // Frontal lobes lean forward
  parts.push(placed(new SphereGeometry(0.042, 20, 16), [-0.024, 0.006, 0.056], [0, 0, 0], [0.95, 0.85, 0.95]))
  parts.push(placed(new SphereGeometry(0.042, 20, 16), [0.024, 0.006, 0.056], [0, 0, 0], [0.95, 0.85, 0.95]))

  // Cerebellum, tucked under and behind
  parts.push(placed(new SphereGeometry(0.038, 20, 16), [0, -0.042, -0.052], [0, 0, 0], [1.25, 0.72, 0.85]))

  // Brain stem continuing into the cord
  parts.push(placed(new CylinderGeometry(0.014, 0.011, 0.075, 12), [0, -0.062, -0.018], [0.22, 0, 0]))

  return merge(parts)
}

/** The spinal cord, rendered as part of the nervous system. */
export function buildSpinalCord(): BufferGeometry {
  return tube(
    [
      [0, 1.50, -0.028],
      [0, 1.38, -0.030],
      [0, 1.22, -0.026],
      [0, 1.06, -0.040],
      [0, 0.92, -0.052],
      [0, 0.80, -0.044],
      [0, 0.72, -0.030],
    ],
    0.011,
    64,
    10,
  )
}

/* ------------------------------------------------------------------ *
 * Digestive — stomach, small and large intestine
 * ------------------------------------------------------------------ */

export function buildStomach(): BufferGeometry {
  // A J-shaped sac: swept curve, thickened by an overlapping body.
  const sweep = tube(
    [
      [-0.012, 0.055, 0],
      [-0.045, 0.035, 0.004],
      [-0.058, -0.005, 0.006],
      [-0.040, -0.042, 0.004],
      [-0.002, -0.050, 0],
      [0.026, -0.030, -0.004],
    ],
    0.030,
    48,
    16,
  )
  const body = placed(new SphereGeometry(0.042, 24, 20), [-0.032, -0.006, 0.002], [0, 0, 0.3], [1, 1.05, 0.72])
  return merge([sweep, body])
}

export function buildIntestines(): BufferGeometry {
  const parts: BufferGeometry[] = []

  // Large intestine: up the right, across, down the left (the colon frame).
  parts.push(
    tube(
      [
        [-0.085, -0.075, 0.010],
        [-0.092, -0.020, 0.012],
        [-0.088, 0.035, 0.010],
        [-0.045, 0.058, 0.014],
        [0.020, 0.058, 0.014],
        [0.078, 0.040, 0.010],
        [0.086, -0.015, 0.012],
        [0.070, -0.070, 0.008],
        [0.020, -0.090, 0.004],
        [0.000, -0.115, -0.004],
      ],
      0.021,
      120,
      14,
    ),
  )

  // Small intestine: a coil packed inside the colon frame.
  const coil: [number, number, number][] = []
  const TURNS = 3.4
  const STEPS = 130
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS
    const a = t * Math.PI * 2 * TURNS
    const r = 0.056 * (1 - t * 0.42)
    coil.push([Math.cos(a) * r, -0.085 + t * 0.11, 0.014 + Math.sin(a) * r * 0.62])
  }
  parts.push(tube(coil, 0.0145, 240, 10))

  return merge(parts)
}

/* ------------------------------------------------------------------ *
 * Metabolic — liver and pancreas
 * ------------------------------------------------------------------ */

export function buildLiver(): BufferGeometry {
  // Large right lobe, smaller left lobe, wedge-shaped and angled.
  const right = placed(new SphereGeometry(0.075, 28, 22), [-0.030, 0, 0], [0, 0, 0], [1, 0.62, 0.66])
  const left = placed(new SphereGeometry(0.050, 22, 18), [0.052, -0.006, 0.004], [0, 0, -0.18], [1, 0.46, 0.60])
  return merge([right, left])
}

export function buildPancreas(): BufferGeometry {
  return tube(
    [
      [-0.052, -0.004, 0],
      [-0.020, 0.006, 0.004],
      [0.016, 0.010, 0.004],
      [0.048, 0.002, 0],
    ],
    0.014,
    40,
    12,
  )
}

/* ------------------------------------------------------------------ *
 * Endocrine — thyroid and adrenals
 * ------------------------------------------------------------------ */

export function buildThyroid(): BufferGeometry {
  const l = placed(new SphereGeometry(0.022, 18, 14), [-0.020, 0, 0.004], [0, 0, 0.3], [0.72, 1.25, 0.72])
  const r = placed(new SphereGeometry(0.022, 18, 14), [0.020, 0, 0.004], [0, 0, -0.3], [0.72, 1.25, 0.72])
  const isthmus = placed(new CylinderGeometry(0.008, 0.008, 0.034, 10), [0, -0.008, 0.006], [0, 0, Math.PI / 2])
  return merge([l, r, isthmus])
}

/* ------------------------------------------------------------------ *
 * Renal / reproductive
 * ------------------------------------------------------------------ */

export function buildKidneys(): BufferGeometry {
  const parts: BufferGeometry[] = []
  for (const sx of [-1, 1]) {
    // Bean shape: a body with a notch carved visually by a smaller offset lobe.
    parts.push(placed(new SphereGeometry(0.030, 20, 16), [sx * 0.062, 0.008, 0], [0, 0, 0], [0.72, 1.35, 0.78]))
    parts.push(placed(new SphereGeometry(0.024, 18, 14), [sx * 0.070, -0.020, 0], [0, 0, sx * 0.3], [0.72, 1.0, 0.78]))
    // Ureter heading down to the bladder
    parts.push(
      tube(
        [
          [sx * 0.058, -0.030, 0],
          [sx * 0.048, -0.090, 0.006],
          [sx * 0.022, -0.150, 0.012],
        ],
        0.006,
        32,
        8,
      ),
    )
  }
  return merge(parts)
}

export function buildReproductive(): BufferGeometry {
  const body = placed(new SphereGeometry(0.034, 22, 18), [0, 0, 0], [0, 0, 0], [0.85, 1, 0.68])
  const l = placed(new SphereGeometry(0.016, 14, 12), [-0.046, 0.020, 0], [0, 0, 0], [1, 0.72, 0.8])
  const r = placed(new SphereGeometry(0.016, 14, 12), [0.046, 0.020, 0], [0, 0, 0], [1, 0.72, 0.8])
  const tl = tube(
    [
      [-0.010, 0.024, 0],
      [-0.028, 0.032, 0],
      [-0.042, 0.024, 0],
    ],
    0.005,
    24,
    8,
  )
  const tr = tube(
    [
      [0.010, 0.024, 0],
      [0.028, 0.032, 0],
      [0.042, 0.024, 0],
    ],
    0.005,
    24,
    8,
  )
  return merge([body, l, r, tl, tr])
}

/* ------------------------------------------------------------------ *
 * Integumentary — a thin skin shell, shown when the system is selected
 * ------------------------------------------------------------------ */

export function buildSkin(): BufferGeometry {
  return buildBodyShell()
}
