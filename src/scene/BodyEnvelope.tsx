import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { Box3, DoubleSide, Mesh, MeshPhysicalMaterial, Vector3 } from 'three'
import { useDonorSex, useTwin } from '../store'
import type { Sex } from './anatomySources'
import { BODY_ENVELOPES, envelopeForDonor, envelopeSex } from './bodyEnvelopes'

/**
 * A parametric skin envelope, drawn around whatever atlas is mounted.
 *
 * WHY IT SITS WHERE IT DOES
 * -------------------------
 * Mounted in `Body.tsx` as a SIBLING of `AtlasBody`, in the canonical frame:
 * centred in x and z, y = 0 at the feet, 1.7 m tall. `AtlasBody` scales each
 * atlas into that frame inside its own group, so one placement is correct for
 * every atlas and for `composed`, with no per-atlas table. Organ overlays mount
 * at the same level for the same reason.
 *
 * ⚠️ THE MATERIAL FOLLOWS THE SHELL BRANCH, NOT THE ANATOMY BRANCH, AND THE
 * REPOSITORY'S RULE HERE IS THE OPPOSITE WAY ROUND FROM WHAT IT LOOKS LIKE.
 * `AtlasBody` sets `alphaHash` on anatomy and REAL ALPHA BLENDING on the hull —
 * stochastic transparency is the default and the shell is the exception. The
 * reason is in its own comment: blending has no valid draw order for mutually
 * enclosing meshes, but the hull is a single object that must never occlude
 * anything, so `depthWrite: false` is right there and wrong as a blanket rule.
 *
 * An envelope IS a hull, so: alpha blending, `DoubleSide`, and depth writes only
 * while fully opaque. Getting this backwards gives a grainy envelope and, with
 * front-face culling, a body that reads as full of holes.
 *
 * ⚠️ AND IT IS NOT ANATOMY. It carries no structures and no ontology terms, so
 * it is excluded from raycasting entirely — hovering it must not report anything,
 * and it must never swallow a click meant for an organ underneath. `raycast` is
 * a no-op for that reason, not as an optimisation.
 */
export function BodyEnvelope() {
  const envelopeId = useTwin((s) => s.bodyEnvelope)
  const availability = useTwin((s) => s.envelopeAvailability)
  const setEnvelope = useTwin((s) => s.setBodyEnvelope)
  const donorSex = useDonorSex()

  /**
   * Keep the envelope's sex matched to the DONOR on screen.
   *
   * ⚠️ THE PAIRING IS A CLAIM, AND NOTHING WAS CHECKING IT. An envelope reads no
   * atlas state at all, so "Adult male" could sit around the female CT donor
   * silently — in an app that otherwise carries three separate donor-mismatch
   * warnings (see `AttributionBar`). Switching atlas is exactly when the pairing
   * silently goes wrong, because the envelope stays as it was.
   *
   * So on a donor CHANGE, a sex-specific envelope is swapped to its sibling — and
   * ONLY on a donor change. A viewer who deliberately picks the mismatched preset
   * is allowed to, and the dock labels the mismatch rather than undoing it.
   * Defaults should be coherent; overrides should be possible and visible. See
   * the note on the effect below for why that is harder than it looks.
   *
   * `child` and `elder` are baked at the gender midpoint, so `envelopeSex`
   * returns null for them and they are left alone — there is no matching sibling
   * to swap to, and picking one for them would substitute a shape study for a
   * pairing.
   *
   * Placed HERE rather than in the dock because `SceneDock` unmounts its body
   * when collapsed, and a default that only applies while a panel happens to be
   * open is not a default.
   */
  /**
   * ⚠️ KEYED ON THE DONOR ALONE, AND READING THE ENVELOPE THROUGH `getState()`.
   *
   * The obvious version lists `envelopeId` as a dependency, and it is wrong in a
   * way that only shows up when you try to use it: the effect then re-runs on a
   * PILL CLICK, sees the mismatch the click just created, and swaps straight back.
   * The override becomes impossible, and the mismatch warning in the dock becomes
   * unreachable code — a warning that cannot fire is worse than none, because it
   * looks like the case is handled.
   *
   * So the last donor is tracked in a ref and the effect returns early unless the
   * DONOR actually changed. `bodyEnvelope` is read imperatively at that moment
   * rather than subscribed to, which is what keeps a user's choice out of the
   * trigger while still being visible to the swap.
   */
  const lastDonor = useRef<Sex | null | undefined>(undefined)
  useEffect(() => {
    if (lastDonor.current === donorSex) return
    lastDonor.current = donorSex
    if (!donorSex) return
    const id = useTwin.getState().bodyEnvelope
    if (!id) return
    const current = envelopeSex(id)
    if (!current || current === donorSex) return
    setEnvelope(envelopeForDonor(donorSex))
  }, [donorSex, setEnvelope])

  const entry = envelopeId ? BODY_ENVELOPES[envelopeId] : null
  const present = entry ? (availability?.[entry.url] ?? false) : false
  if (!entry || !present) return null
  return <EnvelopeMesh key={entry.id} url={entry.url} />
}

function EnvelopeMesh({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  const hullOpacity = useTwin((s) => s.hullOpacity)
  const glassHull = useTwin((s) => s.glassHull)

  /**
   * Normalise to the canonical 1.7 m frame.
   *
   * The presets are baked at their own natural stature — 1.227 m for the child,
   * 1.905 m for the adult male — because that is the honest output of the
   * phenotype axes and throwing it away at bake time would have destroyed the
   * one check that the axes work. But every atlas here is scaled to 1.7 m, so an
   * envelope at its own height would enclose nothing or engulf everything.
   *
   * So the SHAPE is the contribution and the SIZE is normalised, measured from
   * the mesh rather than read from the registry: the registry figure is a record
   * of the bake, and a scale derived from it would silently go wrong the moment
   * an asset was rebuilt with different parameters.
   */
  const fit = useMemo(() => {
    const box = new Box3().setFromObject(scene)
    const size = new Vector3()
    box.getSize(size)
    const height = size.y || 1
    const scale = 1.7 / height
    // A hair over, so the envelope encloses rather than intersects. 1.5 % is
    // enough to clear the shoulder and hip of every atlas measured here without
    // reading as a loose bag around the body.
    const pad = 1.015
    return { scale: scale * pad, y: -box.min.y * scale * pad }
  }, [scene])

  const material = useMemo(() => {
    const m = new MeshPhysicalMaterial({
      color: '#c9d6e0',
      roughness: 0.62,
      metalness: 0,
      clearcoat: 0.18,
      clearcoatRoughness: 0.5,
      ior: 1.38,
      transparent: true,
      // Never occlude the anatomy it wraps. Depth writes only when it is fully
      // opaque AND the Fresnel term is not taking it clear at the centre.
      depthWrite: hullOpacity >= 1 && !glassHull,
      // BodyParts3D's skin is not a closed manifold and front-face culling
      // turns any defect into a window through the body. The same caution
      // applies to a generated surface, which is closed but thin at the digits.
      side: DoubleSide,
      opacity: hullOpacity,
    })

    /**
     * The same Fresnel rim the atlas hull gets, and it is NOT optional here.
     *
     * ⚠️ Without it, enabling this envelope re-enables the "Glass hull" control —
     * because `useHasHull()` now counts an envelope as a skin — and the control
     * would then do nothing at all. A toggle that lights up and has no effect is
     * precisely the failure this repository refuses elsewhere (the hull pill says
     * "no skin" rather than sitting inert on a skinless atlas), so re-enabling the
     * control without honouring it would have traded one dead control for another.
     *
     * It also matters more here than on a real skin. This surface is a GENERATED
     * body in ANNY's own rest pose, and the atlas inside it is in a different one
     * — measured on Z-Anatomy, the envelope spans 1.124 m across the arms against
     * the atlas's 0.646 m. Rendered opaque it reads as "this body's skin", which
     * is a claim it cannot support. Rendered as a clear shell with a lit rim it
     * reads as a reference silhouette, which is what it actually is.
     *
     * Copied deliberately rather than shared: `materialFor` in `AtlasBody` is
     * bound to that component's caches and flags, and lifting it out for one
     * caller would tangle two lifetimes for no gain. The numbers are kept
     * identical so the two surfaces cannot drift apart visually.
     */
    if (glassHull) {
      m.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <alphahash_fragment>',
            [
              'float glRim = 0.0;',
              '#ifndef FLAT_SHADED',
              '  glRim = pow( 1.0 - abs( dot( normalize( vNormal ), normalize( vViewPosition ) ) ), 2.2 );',
              '#endif',
              '  diffuseColor.a = mix( diffuseColor.a * 0.30, 0.92, glRim );',
              '#include <alphahash_fragment>',
            ].join('\n'),
          )
          .replace(
            '#include <emissivemap_fragment>',
            [
              '#include <emissivemap_fragment>',
              'float glRimE = 0.0;',
              '#ifndef FLAT_SHADED',
              '  glRimE = pow( 1.0 - abs( dot( normalize( vNormal ), normalize( vViewPosition ) ) ), 2.2 );',
              '#endif',
              '  totalEmissiveRadiance += vec3( 0.55, 0.83, 1.0 ) * glRimE * 2.1;',
            ].join('\n'),
          )
      }
      // ⚠️ Without this three hands back an already-compiled program and
      // `onBeforeCompile` is never called — the trap `AtlasBody` documents at
      // length. This material is minted fresh on every toggle, which is exactly
      // the case that hits it.
      m.customProgramCacheKey = () => 'envelope-glass'
    }

    return m
  }, [hullOpacity, glassHull])

  useEffect(() => () => material.dispose(), [material])

  useEffect(() => {
    scene.traverse((o) => {
      if (!(o instanceof Mesh)) return
      o.material = material
      // Not anatomy: keep it out of hit-testing entirely, so it neither reports
      // a hover nor swallows a click meant for an organ inside it.
      o.raycast = () => {}
      if (!o.geometry.getAttribute('normal')) o.geometry.computeVertexNormals()
    })
  }, [scene, material])

  return (
    <group position={[0, fit.y, 0]} scale={fit.scale}>
      <primitive object={scene} />
    </group>
  )
}
