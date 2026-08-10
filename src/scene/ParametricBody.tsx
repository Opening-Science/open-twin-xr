import { useEffect, useMemo, useState } from 'react'
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
  const setMeasurements = useTwin((s) => s.setBodyMeasurements)
  const [grid, setGrid] = useState<AnnyGrid | null>(null)
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
  useEffect(() => {
    if (!geometry || !grid) return
    const attr = geometry.getAttribute('position') as BufferAttribute
    const out = attr.array as Float32Array
    evaluateAnny(grid, params, out)

    // Ground the feet at y = 0, so changing height does not sink or float the
    // body. The canonical frame this mounts into puts y = 0 at the floor.
    let minY = Infinity
    for (let i = 1; i < out.length; i += 3) if (out[i] < minY) minY = out[i]
    for (let i = 1; i < out.length; i += 3) out[i] -= minY

    attr.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()

    setMeasurements(measureBody(out, grid.indices))
  }, [geometry, grid, params, setMeasurements])

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
