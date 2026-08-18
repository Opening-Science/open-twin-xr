import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  MeshPhysicalMaterial,
  type Material,
} from 'three'
import { useTwin } from '../store'
import {
  evaluateAnny,
  loadAnnyGrid,
  measureBody,
  type AnnyGrid,
  type BodyMeasurements,
} from './annyGrid'
import {
  loadAnnyRig,
  makePoseScratch,
  poseAnny,
  RigNotInstalled,
  type AnnyRig,
  type PoseScratch,
} from './annyRig'

/**
 * The parametric body, STANDALONE — its own mode, not a skin over an atlas.
 *
 * ⚠️ WHY STANDALONE, AND WHY THAT IS THE HONEST SHAPE FOR IT. D16a measured that
 * the envelope reads no atlas state at all, so drawing it over anatomy created a
 * pairing nothing checked: an adult male surface around a female donor, or — once
 * the sliders exist — a child surface around adult organs. Making the shape
 * adjustable makes that WORSE, because every slider is another way to build a
 * body whose outside and inside describe different people.
 *
 * As its own mode there is no inside to disagree with. The sliders are then just
 * what they are: a shape space you can move around in.
 *
 * ⚠️ IT REMAINS NOT ANATOMY. No organs, no structures, no ontology terms, no
 * donor. It is generated from MakeHuman shape targets — artist priors, not
 * anthropometric ground truth — so nothing here supports a measurement,
 * body-composition or health claim. `ParametricPanel` says so in the interface.
 *
 * ⚠️ TOPOLOGY AND POSITIONS BOTH COME FROM THE GRID, and this used to borrow the
 * index buffer from `anny-adult-f.glb` on the reasoning that the topology is the
 * same at every grid point. True of the MODEL, false of the ASSET: compressing
 * that GLB runs meshopt, which REORDERS vertices for cache locality, so its
 * indices number a different vertex array than the grid was baked against and
 * every triangle was scrambled.
 *
 * Nothing on screen could show it — positions still came from the grid, so
 * height and every slider read exactly correct, and a scrambled surface still
 * fills the body's silhouette. Signed volume is what exposed it. See `annyGrid.ts`.
 *
 * The mode is now genuinely standalone: it loads no GLB at all.
 */
export function ParametricBody() {
  const params = useTwin((s) => s.annyParams)
  const pose = useTwin((s) => s.annyPose)
  const setMeasurements = useTwin((s) => s.setBodyMeasurements)
  const [grid, setGrid] = useState<AnnyGrid | null>(null)
  const [rig, setRig] = useState<AnnyRig | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadAnnyGrid()
      .then((g) => !cancelled && setGrid(g))
      .catch((e) => !cancelled && setFailed(String(e?.message ?? e)))
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * The rig loads SEPARATELY and its absence is not an error.
   *
   * ⚠️ Deliberately not folded into the grid's `Promise.all`. The rig is a later
   * addition and a much smaller file; a build that ships the grid but not the rig
   * is a supported state, and there the body should render perfectly with the
   * shape sliders and simply no position sliders. Joining the two loads would
   * turn a missing optional file into a blank canvas — which is exactly the
   * failure the grid probe in `Body.tsx` was added to stop.
   */
  useEffect(() => {
    let cancelled = false
    loadAnnyRig()
      .then((r) => !cancelled && setRig(r))
      .catch((e) => {
        // Not installed is normal and silent. Anything else is a defect in an
        // asset that IS there, and must not masquerade as an absent one.
        if (!(e instanceof RigNotInstalled)) {
          console.error('[parametric] the pose rig is present but unreadable:', e)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const geometry = useMemo(() => {
    if (!grid) return null
    const g = new BufferGeometry()
    g.setIndex(new BufferAttribute(grid.indices, 1))
    const pos = new Float32Array(grid.neutral.length)
    g.setAttribute('position', new BufferAttribute(pos, 3))
    return g
  }, [grid])

  useEffect(() => () => geometry?.dispose(), [geometry])

  const material = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: '#d8c3b4',
        roughness: 0.66,
        metalness: 0,
        clearcoat: 0.15,
        clearcoatRoughness: 0.55,
        ior: 1.38,
        // Opaque, unlike the overlay form. There is nothing inside it to see, so
        // transparency would only cost legibility of the silhouette.
        side: DoubleSide,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])

  /**
   * Re-evaluate on a slider change, and only then.
   *
   * ⚠️ NOT in `useFrame`. Evaluation is ~2.6 M multiply-adds; doing it per frame
   * would cost the frame budget for a shape that changes only when a human moves
   * a slider. Normals are recomputed here too, because a body lit with stale
   * normals reads as a shading bug rather than as a shape change.
   */
  /**
   * Scratch buffers for posing, kept across ticks so a slider drag allocates
   * nothing. Null until the rig arrives.
   */
  const restRef = useRef<Float32Array | null>(null)
  const scratchRef = useRef<PoseScratch | null>(null)

  useEffect(() => {
    if (!geometry || !grid) return
    const attr = geometry.getAttribute('position') as BufferAttribute
    const out = attr.array as Float32Array

    /**
     * ⚠️ SHAPE FIRST, MEASURE, THEN POSE — AND THAT ORDER IS THE POINT.
     *
     * `measureBody` reports height, waist, volume, mass and BMI. Every one of
     * those is a claim about a SHAPE, and none of them survives a pose: the
     * standing height of a body with bent knees is not its stature, and linear
     * blend skinning pinches volume at every joint it bends. Measuring after
     * posing would quietly make the knee slider change the reported BMI, which
     * is the kind of number a viewer would reasonably believe.
     *
     * So the rest shape is measured, and the pose is applied to a copy on its
     * way to the screen.
     */
    const rest = restRef.current ?? new Float32Array(out.length)
    restRef.current = rest
    evaluateAnny(grid, params, rest)

    // Ground the feet at y = 0, so changing height does not sink or float the
    // body. The canonical frame this mounts into puts y = 0 at the floor.
    let minY = Infinity
    for (let i = 1; i < rest.length; i += 3) if (rest[i] < minY) minY = rest[i]
    for (let i = 1; i < rest.length; i += 3) rest[i] -= minY

    setMeasurements(measureBody(rest, grid.indices))

    if (rig) {
      if (!scratchRef.current) scratchRef.current = makePoseScratch(rig)
      poseAnny(grid, rig, params, pose, rest, out, scratchRef.current, minY)
      /**
       * ⚠️ RE-GROUND AFTER POSING, BUT ONLY DOWNWARDS.
       *
       * Bending the knees lifts the feet off the floor, so the body has to be
       * re-seated or it hovers. Raising an ARM must not move the body at all —
       * and a naive "subtract the new minimum" does exactly that whenever the
       * lowest point stops being a foot. Shifting only when the body has risen
       * keeps the feet planted without letting an arm slider bob it.
       */
      let posedMin = Infinity
      for (let i = 1; i < out.length; i += 3) if (out[i] < posedMin) posedMin = out[i]
      if (posedMin > 0) for (let i = 1; i < out.length; i += 3) out[i] -= posedMin
    } else {
      out.set(rest)
    }

    attr.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
  }, [geometry, grid, rig, params, pose, setMeasurements])

  /**
   * ⚠️ RETHROW. Catching this and rendering `null` is what made a fresh clone show
   * a silent empty canvas.
   *
   * The `AssetErrorBoundary` wrapping this component exists precisely to say
   * "the parametric body did not render", and it never fired, because the load
   * failure was swallowed here and turned into a `console.warn` nobody sees. A
   * caught error that produces no UI is indistinguishable from a body that has
   * not finished loading.
   *
   * Thrown during render so the boundary receives it. The dock reports the same
   * fact independently from `gridAvailability`, so the pill reads "not
   * installed" before you ever get here — this is the second line of defence,
   * not the only one.
   */
  if (failed) {
    throw new Error(
      `The ANNY shape grid could not be loaded (${failed}). ` +
        'Run `npm run bake:anny-grid` to generate it — see public/models/README.md. ' +
        'The five fixed ANNY envelopes do not need it.',
    )
  }

  if (!geometry) return null
  return (
    <mesh
      geometry={geometry}
      material={material as Material}
      // Not anatomy: nothing to identify, so it stays out of hit-testing rather
      // than reporting itself in the hover readout.
      raycast={() => {}}
    />
  )
}

export type { BodyMeasurements }
