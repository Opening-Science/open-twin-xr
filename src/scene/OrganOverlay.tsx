/**
 * One organ, overlaid on whichever atlas is showing.
 *
 * Mounted as a SIBLING of `AtlasBody`, never inside it, so it sits in the
 * canonical frame rather than inheriting one atlas's fit.
 *
 * ⚠️ The canonical frame is necessary but NOT sufficient. It makes every atlas the
 * same size in the same box; it does not make them the same person. Placement is
 * therefore per-atlas — see `placements` in `organOverlays.ts`, and `usePlacements`
 * below, which routes through the atlas actually supplying the organ's system.
 */
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useAnimations, useGLTF } from '@react-three/drei'
import type { Group } from 'three'
import { useResolvedAnatomyMode, useTwin } from '../store'
import type { SystemId } from '../data/schema'
import { activeSources, sourceForSystem, type AnatomySourceId } from './anatomySources'
import { useAtlasAvailability } from './AtlasBody'
import { ORGAN_OVERLAYS, type OrganOverlayId, type OverlayInstance } from './organOverlays'
import { AssetErrorBoundary } from './AssetErrorBoundary'

/** The closed `SystemId` set, for testing an overlay's free-text system string. */
const SYSTEM_IDS: ReadonlySet<string> = new Set<SystemId>([
  'cardiovascular', 'respiratory', 'nervous', 'digestive', 'musculoskeletal',
  'endocrine', 'reproductive', 'metabolic', 'integumentary',
])

/**
 * Which atlas's placement to use — resolved from the atlas actually supplying
 * this organ's system, not from the overlay alone.
 *
 * The atlases are different donors, so the same organ is in a different place in
 * each. `composed` matters most here: it takes cardiovascular from Z-Anatomy, so a
 * heart placed at HRA's coordinates sat 29.3 mm out in the default view.
 */
function usePlacements(id: OrganOverlayId): readonly OverlayInstance[] {
  const overlay = ORGAN_OVERLAYS[id]
  const mode = useResolvedAnatomyMode()
  return useMemo(() => {
    if (!overlay.placements) return overlay.instances
    const system = overlay.system as SystemId
    // A system outside the `SystemId` union (the eye's `sensory`) cannot be
    // routed by `sourceForSystem`, so fall back to whatever the mode resolves to.
    const source = SYSTEM_IDS.has(overlay.system)
      ? sourceForSystem(mode, system)
      : activeSources(mode)[0]
    return (source && overlay.placements[source.id]) ?? overlay.instances
  }, [overlay, mode])
}

function Overlay({
  id,
  instance,
  placements,
}: {
  id: OrganOverlayId
  instance: number
  placements: readonly OverlayInstance[]
}) {
  const overlay = ORGAN_OVERLAYS[id]
  const placement = placements[instance] ?? overlay.instances[0]
  const group = useRef<Group>(null)
  const bpm = useTwin((s) => s.heartRateBpm)
  const { scene, animations } = useGLTF(overlay.url)
  const { actions, names } = useAnimations(animations, group)

  /**
   * A private copy per mounted overlay.
   *
   * `useGLTF` caches by url and hands back the SAME object graph to every caller,
   * so mutating it — which `useAnimations` does, via the mixer — would be shared
   * state. Cloning is cheap here: 6,030 vertices, and the geometry and material
   * are still shared by reference.
   */
  const object = useMemo(() => scene.clone(true), [scene])

  useEffect(() => {
    const action = actions[names[0]]
    if (!action) return
    action.reset().play()
    return () => void action.stop()
  }, [actions, names])

  /**
   * Rate as a time scale.
   *
   * The clip is authored at `baseCycleSeconds`, so playing it in 60/bpm seconds
   * means scaling by `baseCycleSeconds * bpm / 60`. At 60 bpm that is exactly 1
   * and the asset plays at its authored speed.
   */
  useEffect(() => {
    const action = actions[names[0]]
    if (!action) return
    action.timeScale = ((overlay.animation?.baseCycleSeconds ?? 1) * bpm) / 60
  }, [actions, names, bpm, overlay.animation])

  return (
    <group
      ref={group}
      position={placement.position as unknown as [number, number, number]}
      quaternion={placement.quaternion as unknown as [number, number, number, number]}
    >
      <primitive object={object} />
    </group>
  )
}

/**
 * Which overlay assets are actually on the server.
 *
 * ⚠️ THIS EXISTS BECAUSE A PUBLISHABLE BUILD HAS TO BE ABLE TO WITHHOLD ONE.
 * An atlas has always been allowed to be absent — `Body` probes, falls back to the
 * procedural body, and the switcher says "not installed". Overlays had no such
 * path: every one was `useGLTF.preload`ed at module scope and mounted on demand, so
 * a withheld asset meant a 404 inside the Canvas rather than a graceful gap.
 *
 * That matters the first time a build legitimately omits one. The beating heart is
 * marked `publishable: false` — its subject's provenance is unconfirmed upstream —
 * so a deploy must ship without it, and "the deploy crashes the 3D view" is not an
 * acceptable way to enforce a licence gate.
 *
 * The probe is `useAtlasAvailability`, unchanged: it is URL-generic, it already
 * retries rather than trusting a single aborted fetch, and it already refuses to
 * treat a dev server's HTML fallback as a hit.
 */
export function useOverlayAvailability(): Record<string, boolean> | null {
  const urls = useMemo(() => Object.values(ORGAN_OVERLAYS).map((o) => o.url), [])
  return useAtlasAvailability(urls)
}

/**
 * Every switched-on overlay, once per placed instance.
 *
 * Bilateral organs get two independent copies rather than one mirrored group,
 * because mirroring inverts winding and would turn every normal inside out.
 */
export function OrganOverlays() {
  const overlays = useTwin((s) => s.overlays)
  const available = useOverlayAvailability()
  const setOverlayAvailability = useTwin((s) => s.setOverlayAvailability)

  // Published to the store so the toggle row can grey out what it cannot load,
  // rather than every consumer probing the same URLs again.
  useEffect(() => {
    setOverlayAvailability(available)
  }, [available, setOverlayAvailability])

  const on = (Object.keys(ORGAN_OVERLAYS) as OrganOverlayId[]).filter(
    // Absent until the probe answers, so a slow probe shows nothing rather than
    // mounting a loader for a file that may not be there.
    (id) => overlays[id] && available?.[ORGAN_OVERLAYS[id].url],
  )
  if (on.length === 0) return null
  return (
    <>
      {on.map((id) => (
        // ⚠️ One boundary and one Suspense PER OVERLAY, not one around the set.
        // Wrapping the collection meant a single unreadable GLB took all three
        // overlays down with it, and a single slow download hid the ones that had
        // already arrived — both of them failures of the isolation this is for.
        //
        // No `resetKey` is needed here and that is not an omission: an overlay
        // toggled off drops out of `on`, so its boundary unmounts, and toggling it
        // back on mounts a fresh one that has never failed. Remounting IS the retry.
        <AssetErrorBoundary
          key={id}
          label={`overlay "${ORGAN_OVERLAYS[id].label}" (${ORGAN_OVERLAYS[id].url})`}
          consequence="that overlay is hidden, the body and the other overlays are unaffected"
          fallback={null}
        >
          <Suspense fallback={null}>
            <PlacedOverlay id={id} />
          </Suspense>
        </AssetErrorBoundary>
      ))}
    </>
  )
}

/** Splits an overlay into its placed copies, once its atlas is known. */
function PlacedOverlay({ id }: { id: OrganOverlayId }) {
  const placements = usePlacements(id)
  return (
    <>
      {placements.map((inst, i) => (
        <Overlay key={`${id}:${inst.side || i}`} id={id} instance={i} placements={placements} />
      ))}
    </>
  )
}

/**
 * Node-name tests for organs an active overlay stands in for, for one atlas.
 *
 * `AtlasBody` uses this to hide the static organ so the body does not show two.
 * Returns an empty array when nothing is superseded, which is the common case:
 * only HRA ships the heart as its own node, so only HRA can be masked cleanly.
 */
/**
 * The contiguous `_STRUCTURE` id range an active overlay replaces, or null.
 *
 * Resolved from the atlas's own structure table BY NAME every time it loads, so a
 * rebuild that renumbers structures cannot point this at the wrong organ. Returns
 * a single `[lo, hi]` because the shader test is a range compare; if a future
 * overlay's structures are not contiguous this warns and hides nothing rather than
 * hiding the span between them.
 */
export function useHiddenStructureRange(
  structures: readonly { name: string; system?: string }[] | null,
): { lo: number; hi: number } | null {
  const overlays = useTwin((s) => s.overlays)
  return useMemo(() => {
    if (!structures) return null
    for (const id of Object.keys(ORGAN_OVERLAYS) as OrganOverlayId[]) {
      if (!overlays[id]) continue
      const rule = ORGAN_OVERLAYS[id].supersedesStructures
      if (!rule) continue
      const ids: number[] = []
      structures.forEach((s, i) => {
        if (s.system !== rule.system) return
        if (!rule.is.test(s.name)) return
        if (rule.not?.test(s.name)) return
        ids.push(i)
      })
      if (ids.length === 0) continue
      if (ids.length !== rule.expect) {
        // Loud, because the failure mode is silent: a renamed structure upstream
        // makes the organ quietly stop disappearing, and nothing else notices.
        console.warn(
          `[overlay ${id}] expected ${rule.expect} structures to supersede, matched ${ids.length}. ` +
            `Names have probably drifted upstream — check supersedesStructures.`,
        )
      }
      const lo = ids[0]
      const hi = ids[ids.length - 1]
      if (hi - lo + 1 !== ids.length) {
        console.warn(
          `[overlay ${id}] the ${ids.length} superseded structures are NOT contiguous ` +
            `(${lo}..${hi}); hiding nothing rather than hiding what sits between them.`,
        )
        continue
      }
      return { lo, hi }
    }
    return null
  }, [overlays, structures])
}

export function useSupersededBy(sourceId: AnatomySourceId): RegExp[] {
  const overlays = useTwin((s) => s.overlays)
  return useMemo(
    () =>
      (Object.keys(ORGAN_OVERLAYS) as OrganOverlayId[])
        .filter((id) => overlays[id])
        .map((id) => ORGAN_OVERLAYS[id].supersedes?.[sourceId])
        .filter((r): r is RegExp => r !== undefined),
    [overlays, sourceId],
  )
}

/**
 * ⚠️ NO EAGER PRELOAD. This used to warm every overlay at module scope:
 *
 *   for (const o of Object.values(ORGAN_OVERLAYS)) useGLTF.preload(o.url)
 *
 * which fetches assets a build may deliberately not ship. A failed preload also
 * poisons `useGLTF`'s cache for that URL, so the later guarded mount inherits the
 * rejection instead of finding a clean slate. Overlays are opt-in and small; they
 * load when switched on, after the availability probe has said they exist.
 */
