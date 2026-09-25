import { Suspense, useEffect, useMemo } from 'react'
import { useTwin, useResolvedAnatomyMode } from '../store'
import { ProceduralBody } from './ProceduralBody'
import { AtlasBody, useAtlasAvailability } from './AtlasBody'
import { OrganOverlays } from './OrganOverlay'
import { activeSources, ANATOMY_SOURCES } from './anatomySources'
import { AssetErrorBoundary } from './AssetErrorBoundary'
import { BodyEnvelope } from './BodyEnvelope'
import { StructureLabel } from './StructureLabel'
import { ParametricBody } from './ParametricBody'
import { ANNY_GRID_URLS } from './annyGrid'
import { BODY_ENVELOPES, BODY_ENVELOPE_IDS } from './bodyEnvelopes'
import { POSED_ENVELOPE_URL_LIST } from './envelopePoses'

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
  const envelope = useTwin((s) => s.bodyEnvelope)

  /**
   * Probe the envelopes the same way the atlases are probed, and for the same
   * reason: the app must run with no binary assets at all, so a build that ships
   * none of these is a supported state and the dock has to be able to say
   * "not installed" rather than let a 404 throw inside the Canvas.
   */
  /**
   * ⚠️ THE POSED VARIANTS ARE PROBED TOO. `BodyEnvelope` prefers a bake posed
   * like the atlas on screen and falls back to the rest-pose asset when there
   * is none — and that fallback only works if the probe knows about both. Left
   * out, every posed url reads as absent and the feature silently never
   * engages, which is indistinguishable from it not being built.
   */
  const envelopeUrls = useMemo(
    () => [...BODY_ENVELOPE_IDS.map((id) => BODY_ENVELOPES[id].url), ...POSED_ENVELOPE_URL_LIST],
    [],
  )
  const envelopeAvailability = useAtlasAvailability(envelopeUrls)
  const publishEnvelopes = useTwin((s) => s.setEnvelopeAvailability)
  useEffect(() => {
    publishEnvelopes(envelopeAvailability)
  }, [envelopeAvailability, publishEnvelopes])

  /**
   * ⚠️ THE SHAPE GRID IS PROBED TOO, AND IT WAS THE ONE ASSET THAT WAS NOT.
   *
   * Every other selectable thing here degrades honestly when its files are
   * absent — the pill reads "not installed" and the procedural body shows. The
   * parametric mode could not, for three reasons that compounded: its files are
   * gitignored like every other asset, `activeSources('parametric')` returns []
   * so the "is anything missing" test had nothing to test, and the early return
   * below removes the procedural fallback on purpose. `ParametricBody` then
   * caught the load failure itself and rendered `null`.
   *
   * The result on a fresh clone was a SILENT EMPTY CANVAS — no body, no pill
   * state, no error, nothing but a console warning. That is precisely the
   * "subtly wrong rather than visibly wrong" failure `docs/DEPLOY.md` credits
   * this app with avoiding.
   *
   * All THREE grid files are probed, not just the binary: the mode needs the
   * `.bin`, the `.idx` and the `.json` together, and a partial set fails in a
   * much more confusing way than a missing one.
   */
  const gridAvailability = useAtlasAvailability(ANNY_GRID_URLS as unknown as string[])
  const publishGrid = useTwin((s) => s.setGridAvailability)
  useEffect(() => {
    publishGrid(gridAvailability)
  }, [gridAvailability, publishGrid])

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

  /**
   * ⚠️ THE PARAMETRIC MODE REPLACES THE ANATOMY, IT DOES NOT SIT OVER IT.
   *
   * `activeSources('parametric')` returns [], so without this branch the atlas
   * path would fall through to the PROCEDURAL placeholder — the app would show
   * its zero-asset fallback body beside the parametric one and look broken. The
   * early return is what makes "standalone" true rather than merely intended.
   */
  /**
   * ⚠️ ONLY TAKE THIS BRANCH IF THE GRID IS ACTUALLY THERE.
   *
   * The early return exists so the procedural placeholder does not appear BESIDE
   * a generated body. When there is no generated body — the grid is not
   * installed — that reason evaporates, and returning early instead produces a
   * blank canvas: no body, no fallback, and an error boundary whose `fallback`
   * is `null` by design because a 3D scene has nowhere to put a message.
   *
   * So a missing grid falls through to the ordinary path, which draws the
   * procedural placeholder exactly as every other uninstalled mode does. The
   * dock already reads "not installed" from the same probe, so the two agree.
   *
   * `null` means "not probed yet" and is treated as available — the mode renders
   * as soon as it can, and a slow first probe does not flash the placeholder.
   */
  const gridMissing =
    gridAvailability !== null && Object.values(gridAvailability).some((ok) => !ok)

  if (mode === 'parametric' && !gridMissing) {
    return (
      <group>
        <mesh position={[0, 1, -0.6]} visible={false} onClick={() => clearSel(null)}>
          <planeGeometry args={[4, 4]} />
          <meshBasicMaterial />
        </mesh>
        <AssetErrorBoundary
          label="parametric body"
          consequence="the parametric body did not render"
          resetKey="parametric"
          /**
           * ⚠️ `fallback={null}` HERE WAS HALF THE BLANK-CANVAS BUG.
           *
           * A 3D scene has nowhere to put an error message, so this boundary was
           * given nothing to render — which meant a failed grid load produced an
           * empty canvas rather than a visibly wrong one. The probe in
           * `gridAvailability` catches the ordinary case before we ever get
           * here, but it is asynchronous, and on the first paint it is still
           * `null`. This is what covers that window, and any failure the probe
           * cannot foresee: a truncated file, a corrupt bake, a 200 that is
           * really an SPA fallback page.
           *
           * The procedural body is the correct thing to show — it is what every
           * other uninstalled mode falls back to, so the app looks the same way
           * for the same reason.
           */
          fallback={<ProceduralBody />}
        >
          <Suspense fallback={<ProceduralBody />}>
            <ParametricBody />
          </Suspense>
        </AssetErrorBoundary>
      </group>
    )
  }

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

      {/*
        The parametric skin envelope, at the same canonical level and for the
        same reason as the overlays above.

        ⚠️ It is a GENERATED SURFACE, not anatomy and not a donor — see
        `bodyEnvelopes.ts`. It exists because D14 measured that three of the seven
        sources ship no skin at all, so the glass hull is unavailable on exactly
        the atlases with the richest anatomy. Off unless the viewer asks for it.

        Its own error boundary and Suspense: an envelope that fails to load must
        cost the envelope, not the body. Same isolation rule the overlays follow.
      */}
      <AssetErrorBoundary
        label="body envelope"
        consequence="the envelope was left off"
        resetKey={String(envelope)}
        fallback={null}
      >
        <Suspense fallback={null}>
          <BodyEnvelope />
        </Suspense>
      </AssetErrorBoundary>
    </group>
  )
}
