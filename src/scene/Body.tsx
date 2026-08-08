import { Suspense, useEffect, useMemo } from 'react'
import { useTwin, useResolvedAnatomyMode } from '../store'
import { ProceduralBody } from './ProceduralBody'
import { AtlasBody, useAtlasAvailability } from './AtlasBody'
import { OrganOverlays } from './OrganOverlay'
import { activeSources, ANATOMY_SOURCES } from './anatomySources'
import { AssetErrorBoundary } from './AssetErrorBoundary'
import { StructureLabel } from './StructureLabel'

/**
 * The body, from whichever geometry source is available.
 *
 *   atlas GLB present   -> AtlasBody, structures resolved by ontology id
 *   otherwise           -> ProceduralBody, the zero-asset anatomical fallback
 *
 * The app must run with no binary assets at all, so a missing GLB is a normal
 * state and not an error: `useAtlasAvailability` probes for the file and the
 * procedural body renders until one appears. Selection, colouring and the
 * no-data rules are identical across both, so swapping the source changes what
 * you see and nothing about how it behaves.
 *
 * To use the real atlas: follow `docs/MODEL_PIPELINE.md`, drop the compressed
 * GLB at the path its registry entry declares (`src/scene/anatomySources.ts`),
 * and reload. No code change.
 */
export function Body() {
  const mode = useResolvedAnatomyMode()
  const sex = useTwin((s) => s.sex)
  // ⚠️ The boundary wraps the whole of `BodyContent` from outside, rather than
  // sitting inside its returned tree around the atlas subtree. A boundary catches
  // only what its DESCENDANTS throw, and `BodyContent` itself touches assets — it
  // runs the availability probe and publishes the result in an effect — so a
  // boundary nested in its JSX cannot cover it. From here, everything that loads
  // geometry is inside.
  //
  // Verified by breaking it on purpose: `z-anatomy.ao.glb` truncated to 4 kB, which
  // passes the presence probe and then fails to parse. Without a boundary the throw
  // reaches react-three-fiber's own, which rethrows outside the Canvas — a live
  // blank canvas with the interface still drawn around it. With this one the console
  // names the file and the cause (`Invalid typed array length`), the procedural body
  // takes over, and switching to a readable atlas recovers fully.
  return (
    <AssetErrorBoundary
      label="anatomy geometry"
      consequence="the procedural body took over"
      resetKey={`${mode}:${sex}`}
      fallback={<ProceduralBody />}
    >
      <BodyContent />
    </AssetErrorBoundary>
  )
}

function BodyContent() {
  const clearSel = useTwin((s) => s.selectSystem)
  const mode = useResolvedAnatomyMode()
  const publishAvailability = useTwin((s) => s.setAtlasAvailability)

  // Probe every registered atlas, not just the ones this mode needs, so the
  // switcher can say up front which options will actually render.
  const urls = useMemo(() => Object.values(ANATOMY_SOURCES).map((s) => s.url), [])
  const availability = useAtlasAvailability(urls)
  const sources = useMemo(() => activeSources(mode), [mode])

  useEffect(() => {
    publishAvailability(availability)
  }, [availability, publishAvailability])

  const present = useMemo(
    () => (availability ? sources.filter((s) => availability[s.url]) : []),
    [availability, sources],
  )
  const presentUrls = useMemo(() => present.map((s) => s.url), [present])

  // Still probing: show the procedural body rather than an empty frame.
  const useAtlas = availability !== null && present.length > 0

  return (
    <group>
      {/* click empty space to deselect */}
      <mesh position={[0, 1, -0.6]} visible={false} onClick={() => clearSel(null)}>
        <planeGeometry args={[4, 4]} />
        <meshBasicMaterial />
      </mesh>

      {useAtlas ? (
        <Suspense fallback={<ProceduralBody />}>
          {present.map((s) => (
            <AtlasBody key={s.id} source={s} mode={mode} presentUrls={presentUrls} />
          ))}
        </Suspense>
      ) : (
        <ProceduralBody />
      )}

      {/*
        Organ overlays sit HERE — a sibling of `AtlasBody`, not a child.

        `AtlasBody` scales each atlas to canonical height inside its own group, so
        this level IS the canonical frame: centred in x and z, y = 0 at the feet,
        1.7 m tall. One placement per overlay is therefore correct for every atlas
        and for `composed`, with no per-atlas table.

        Its own Suspense boundary, because an overlay that is still downloading
        must not suspend the body and drop it back to the procedural placeholder.

        The per-overlay error boundary is in `OrganOverlays` itself, one per
        overlay, NOT here around the collection. Here it would have made an
        unreadable heart also cost you the eye and the ear — which is the opposite
        of what an isolation boundary is for.
      */}
      <Suspense fallback={null}>
        <OrganOverlays />
      </Suspense>

      {/*
        The selected structure's name, floating at the structure. Mounted at this
        level for the same reason the overlays are: this IS the canonical frame,
        so `StructureEntry.centroid` — recorded in canonical metres at build time
        — can be used as a world position with no per-atlas offset table.
      */}
      <StructureLabel />
    </group>
  )
}
