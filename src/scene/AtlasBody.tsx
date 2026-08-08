import { useEffect, useMemo, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  FrontSide,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Vector3,
  type Object3D,
} from 'three'
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
  CENTER,
  type MeshBVHOptions,
} from 'three-mesh-bvh'
import type { SystemId, SystemScore } from '../data/schema'
import { useTwin, type AnatomyLayer } from '../store'
import { scoreToColor, scoreToEmissive } from './metricColor'
import { anatomicalColor, scoreLift, tissueSurface } from './anatomyPalette'
import { TERM_TO_SYSTEM } from './anatomy/layout'
import { sourceForSystem, type AnatomyMode, type AnatomySource } from './anatomySources'
import { useHiddenStructureIds, useSupersededBy } from './OrganOverlay'
import { createStructureMask, inspectTint, writeStructureMask, MASK_WIDTH } from './structureMask'
import {
  normalise,
  structureTerm,
  NO_TERM,
  type AtlasComponent,
  type StructureEntry,
} from './structureEntry'
import { clearTunables, registerTunable } from './tuning'
import { setHoverCursor, useHoverRelease } from './hoverCursor'

/**
 * Real-atlas geometry, resolved by ONTOLOGY ID.
 *
 * This is the component that takes over from `ProceduralBody` once an atlas GLB
 * exists under `public/models/`. It never matches on mesh-node name strings:
 * every structure is addressed by its ontology term, the same identifier space
 * `SystemScore.structures[].id` uses, so the mapping survives a model swap and
 * an atlas change is a config change.
 *
 * WHERE THE TERM COMES FROM — verified against the real asset
 * ----------------------------------------------------------
 * Confirmed by parsing `3d-vh-f-united.glb` (HRA v1.10, 1160 nodes / 956
 * meshes) on 26 July 2026. Each mesh node's glTF `extras` — three.js
 * `object.userData` — carries:
 *
 *   ontologyid         a clean CURIE, e.g. "UBERON:0002097" or "FMA:73166",
 *                      or the string "-" when the node has no term
 *   representation_of  the same term as a purl, e.g.
 *                      "http://purl.obolibrary.org/obo/UBERON_0002097" or
 *                      "http://purl.org/sig/ont/fma/fma73166"
 *   label              human-readable, e.g. "skin of body"
 *
 * 742 of 956 meshes carry a real term; the other 214 are "-" and legitimately
 * have none.
 *
 * **HRA is not purely UBERON.** Of those 742: 429 UBERON, 313 FMA. Our data
 * addresses systems by UBERON, so FMA-keyed sub-structures will not match
 * directly — which is why resolution walks UP the parent chain collecting every
 * ancestor term and takes the first one that maps. An FMA-keyed detail inside a
 * UBERON-keyed organ therefore inherits its organ's system instead of
 * silently rendering as unresolved.
 *
 * The `assets/crosswalk.csv` shipped beside every model holds the same
 * node -> ontology mapping in tabular form; prefer it if you ever need the
 * mapping outside the renderer.
 *
 * Anything unresolved is rendered neutral and reported once via
 * `onUnresolved`, so gaps in the mapping are visible during the swap instead of
 * quietly looking like healthy grey organs.
 */

/**
 * Every atlas is scaled to this standing height so two of them line up. The
 * exact value matters less than that all sources agree on one.
 */
const CANONICAL_HEIGHT_M = 1.7

/**
 * How the hover acceleration structure is built. One of these three settings is
 * a correctness constraint; the other two are measured tuning.
 *
 * `indirect` IS NOT OPTIONAL. By default three-mesh-bvh reorders the index
 * buffer in place so each node's triangles sit contiguously — and this atlas
 * cannot survive that. Structure identity is recovered by scanning the index
 * buffer for runs of `_structure` (see `rangesFor`), and the selection
 * highlight draws a structure as a single `drawRange` over its run. Measured on
 * Z-Anatomy's `musculoskeletalconnective`: its 413 structures arrive as 413
 * contiguous runs, and a default build shatters them into 16,051 — the worst
 * structure's draw range then spans 1,087x its own triangle count, so the
 * highlight would paint most of the mesh instead of the part you clicked. With
 * `indirect` the index buffer is left alone (413 runs, 1.0x overdraw) and the
 * BVH keeps its permutation in a buffer of its own, while `faceIndex` still
 * refers to the original triangle — checked against a brute-force raycast at 30
 * points, agreeing on mesh, face and structure name at all 30.
 *
 * `CENTER` rather than drei's `SAH`: SAH costs 4.6x the build (7.9 s against
 * 1.7 s for Z-Anatomy) for the same memory, and both answer a hover in well
 * under a millisecond, so the better tree buys nothing anyone can perceive.
 *
 * `maxLeafTris: 20` rather than drei's 10 halves the tree — 14 MB down to
 * 7 MB for Z-Anatomy — for no measurable query cost. Worth having in a headset,
 * where `composed` mode mounts two atlases at once.
 *
 * The widened type is not defensive: three-mesh-bvh 0.7.8 implements `indirect`
 * but omits it from its own `MeshBVHOptions`, so the option has to be declared
 * here to be passed at all.
 */
const BVH_OPTIONS: MeshBVHOptions & { indirect: boolean } = {
  strategy: CENTER,
  maxLeafTris: 20,
  indirect: true,
}

function readTerm(o: Object3D): string | null {
  const ud = (o.userData ?? {}) as Record<string, unknown>
  // `ontologyid` is HRA's actual key (lowercase, no separator) and is checked
  // first; `representation_of` carries the same term as a purl.
  for (const key of ['ontologyid', 'representation_of', 'ontologyId', 'ontology_id']) {
    const v = ud[key]
    if (typeof v === 'string' && v !== NO_TERM && v.trim() !== '') {
      const t = normalise(v)
      if (t) return t
    }
  }
  return o.name ? normalise(o.name) : null
}

/**
 * Every ontology term on this node and its ancestors, nearest first. Lets a
 * caller prefer the most specific term that actually maps to a system, rather
 * than giving up on the first term found.
 */
function termChain(o: Object3D): string[] {
  const out: string[] = []
  let node: Object3D | null = o
  while (node) {
    const t = readTerm(node)
    if (t && !out.includes(t)) out.push(t)
    node = node.parent
  }
  return out
}

/**
 * Term -> system. Prefers the live data, so a payload that maps structures
 * differently wins over our built-in table without a code change.
 */
function useTermMap(): Map<string, SystemId> {
  const data = useTwin((s) => s.data)
  return useMemo(() => {
    const m = new Map<string, SystemId>(Object.entries(TERM_TO_SYSTEM) as [string, SystemId][])
    for (const sys of data?.systems ?? []) {
      for (const st of sys.structures ?? []) {
        const t = normalise(st.id)
        // An id the CURIE grammar does not recognise is a data defect worth
        // seeing, not something to silently drop into the map unnormalised.
        if (t) m.set(t, sys.id)
        else console.warn(`[AtlasBody] system "${sys.id}" has unparseable structure id "${st.id}"`)
      }
    }
    return m
  }, [data])
}

/**
 * One entry of the structure table an atlas may carry on its scene extras.
 *
 * Written by `scripts/build-z-anatomy.mjs`; see docs/ROADMAP.md phase 1. Index
 * ranges are deliberately absent — they cannot survive the downstream simplify,
 * so anything needing them derives them from the `_STRUCTURE` attribute, which
 * cannot go stale because it is the geometry.
 */
/**
 * Explode shaping, shared by the whole-mesh CPU path and the per-structure
 * shader path so the two are visually interchangeable.
 *
 * The offset SCALES with how far off-centre a thing sits rather than being a
 * fixed throw along a normalised direction. Normalising was tried first and
 * reads badly: a structure near the body axis has almost no radial direction, so
 * normalising amplifies its centroid noise and flings it somewhere arbitrary —
 * the brain shot sideways. Vertical is damped because at full strength the body
 * otherwise stretches into a 3 m column, which is accurate and useless.
 */
const EXPLODE_GAIN = 1.6
const EXPLODE_Y_DAMP = 0.35


/**
 * The outer body ENVELOPE, as distinct from other integumentary tissue.
 *
 * The renderer's notion of "shell" is a SYSTEM test — `systemId === 'integumentary'`
 * — and on HRA that system has TWO members: the skin (`VH_F_skin` / `VH_M_skin`,
 * UBERON:0002097) and `#VHFAdipose`, a 6,520-triangle subcutaneous fat patch inside
 * the abdomen. Both already receive the hull's opacity and `DoubleSide`, which
 * nobody notices at 10 %.
 *
 * ⚠️ The glass rim keyed on the system instead would light that patch up as a
 * glowing mass inside the belly — on both HRA builds, and in the DEFAULT view, since
 * the default is composed + female and that routes integumentary to HRA.
 * BodyParts3D's single integumentary mesh IS the skin, so it passes unchanged.
 *
 * Module-level so the material cache key and the material body ask one question in
 * one place, rather than two predicates that can drift apart.
 */
function isBodyHull(systemId: SystemId | null, group?: string): boolean {
  return systemId === 'integumentary' && !/adipose/i.test(group ?? '')
}

export function AtlasBody({
  source,
  mode,
  presentUrls,
}: {
  source: AnatomySource
  mode: AnatomyMode
  /** Atlas urls actually installed, so a missing one can be covered for. */
  presentUrls: string[]
}) {
  const url = source.url
  const { scene } = useGLTF(url)
  const data = useTwin((s) => s.data)
  const termMap = useTermMap()
  const colourMode = useTwin((s) => s.colourMode)
  const hullOpacity = useTwin((s) => s.hullOpacity)
  const xray = useTwin((s) => s.xray)
  const glassHull = useTwin((s) => s.glassHull)
  const smoothTransparency = useTwin((s) => s.smoothTransparency)
  const explode = useTwin((s) => s.explode)
  const selectedSystem = useTwin((s) => s.selectedSystem)
  const selectedLayer = useTwin((s) => s.selectedLayer)
  const selectSystem = useTwin((s) => s.selectSystem)
  const setPresentLayers = useTwin((s) => s.setPresentLayers)
  const setPresentSystemsFor = useTwin((s) => s.setPresentSystemsFor)
  const setHoveredLabel = useTwin((s) => s.setHoveredLabel)

  // Switching atlas unmounts this component straight out from under the pointer,
  // and r3f fires no pointer-out for that. See `hoverCursor.ts`.
  const hoverToken = useHoverRelease(() => setHoveredLabel(null))

  const byId = useMemo(
    () => new Map<SystemId, SystemScore>((data?.systems ?? []).map((s) => [s.id, s])),
    [data],
  )
  const hiddenSystems = useTwin((s) => s.hiddenSystems)
  const hiddenLayers = useTwin((s) => s.hiddenLayers)
  /** Organs an active overlay replaces, so this atlas does not draw them too. */
  const superseded = useSupersededBy(source.id)

  /** Flatten to meshes tagged with the system each one belongs to. */
  const entries = useMemo(() => {
    const out: {
      mesh: Mesh
      systemId: SystemId | null
      term: string | null
      layer?: string
      label?: string
      /** Excluded from the default render — donor-specific, not general anatomy. */
      hiddenGroup?: boolean
      /** The atlas's own grouping key, e.g. `#VHFPlacenta`. Names what was hidden. */
      groupKey?: string
    }[] = []
    scene.traverse((o) => {
      if (!(o instanceof Mesh)) return
      // The selection highlight is parented to the mesh it highlights so it
      // inherits the exploded-view transform. That puts it inside this
      // traversal, where it would be treated as anatomy and have its material
      // overwritten by the visibility effect below.
      if (o.userData?.__highlight) return
      // Each atlas reads its own grouping key; see anatomySources.ts.
      const group = source.groupKey?.((o.userData ?? {}) as Record<string, unknown>, o.name) ?? null
      // Donor-specific anatomy that would misread on a generic twin. It is
      // carried through as an entry and filtered later, NOT skipped here.
      //
      // Skipping used to be enough, back when the render was
      // `visible.map(e => <AtlasMesh/>)` and a mesh left out of the list simply
      // had no component. Now that the scene is handed to three.js as one node,
      // every mesh in the glTF renders by default and the only thing that turns
      // one off is `mesh.visible = false` in the effect below — which iterates
      // `entries`. So a mesh that never reaches `entries` is a mesh nothing ever
      // switches off, and the placenta came back.
      const hiddenGroup = group ? (source.isHiddenGroup?.(group) ?? false) : false
      // Kept for the report: a joined atlas leaves `label` as "-" on the merged
      // node, so the group key is the only thing that can name what was hidden.
      const groupKey = group ?? undefined
      // Nearest term first, then ancestors. HRA mixes UBERON and FMA, so a
      // detail keyed by an FMA term we do not map still inherits the system of
      // the UBERON-keyed organ that contains it.
      const chain = termChain(o)
      const term = chain.find((t) => termMap.has(t)) ?? chain[0] ?? null

      // Ontology term first — it is the cross-atlas contract. But HRA's terms
      // sit at structure granularity, not system granularity, so on the real
      // asset this hits for only ~0% of meshes on its own. The organ-group key
      // is the HRA-specific fallback that actually covers the model; see
      // `anatomy/hraGroups.ts` for why both exist.
      const systemId =
        (term ? (termMap.get(term) ?? null) : null) ??
        (group ? (source.systemForGroup?.(group) ?? null) : null) ??
        // Last resort: the atlas's own term table. Reaches structures whose
        // group key is a placeholder — 27 of HRA's renal calyces resolve here
        // and nowhere else. Deliberately last, so it can only ever fill a gap.
        (term ? (source.systemForTerm?.(term) ?? null) : null)

      /**
       * `aStructure`: a GLSL-safe alias for `_structure`, aliased here and not
       * in an effect.
       *
       * GLSL reserves leading-underscore identifiers, so `_structure` cannot be
       * declared in a shader — the overlay mask needs a legal name. Done at
       * enumeration time on purpose: an effect would run AFTER the first paint,
       * so the attribute would be unbound when the mask shader first compiled and
       * the organ would fail to hide until something forced a re-render.
       *
       * It shares the very same `BufferAttribute`, so this costs no memory and is
       * idempotent across mounts.
       */
      const idAttr = o.geometry.getAttribute('_structure')
      if (idAttr && !o.geometry.getAttribute('aStructure')) {
        o.geometry.setAttribute('aStructure', idAttr)
      }

      const ud = (o.userData ?? {}) as Record<string, unknown>
      const layer = typeof ud.layer === 'string' ? ud.layer : undefined
      const label = typeof ud.label === 'string' ? ud.label : undefined
      out.push({ mesh: o, systemId, term, layer, label, hiddenGroup, groupKey })
    })
    return out
  }, [scene, termMap, source])

  /**
   * Tell the sidebar which layers each system actually has in THIS atlas.
   *
   * Only the loaded asset knows. BodyParts3D and Z-Anatomy both split
   * musculoskeletal into bone / muscle / connective; HRA declares no layers at
   * all. Publishing it means the sidebar can offer separable sub-rows exactly
   * where they mean something, instead of showing controls that do nothing on an
   * atlas without layers.
   */
  useEffect(() => {
    const bySystem: Record<string, Set<string>> = {}
    for (const e of entries) {
      if (!e.systemId || !e.layer) continue
      ;(bySystem[e.systemId] ??= new Set()).add(e.layer)
    }
    const out: Record<string, AnatomyLayer[]> = {}
    for (const [sys, set] of Object.entries(bySystem)) {
      // Only worth splitting when there is more than one thing to split into.
      if (set.size > 1) out[sys] = [...set] as AnatomyLayer[]
    }
    setPresentLayers(out as never)
  }, [entries, setPresentLayers])

  /**
   * Which systems this atlas actually carries geometry for.
   *
   * ⚠️ Separate from `presentLayers`, which cannot answer this. That map only
   * records systems with MORE THAN ONE layer, because its job is to decide when a
   * sidebar row is worth splitting into sub-rows. A system with a single mesh —
   * integumentary, which is one skin — is correctly absent from it, so reading it
   * as "does this atlas have skin" silently answers no for every atlas.
   *
   * The glass-hull toggle needs the honest answer, because two of the seven sources
   * ship no skin at all (Z-Anatomy, and both CT atlases) and a control that does
   * nothing is worse than one that says it cannot.
   */
  useEffect(() => {
    const present = new Set<SystemId>()
    for (const e of entries) if (e.systemId) present.add(e.systemId)
    setPresentSystemsFor(source.id, [...present])
    // Withdrawn on unmount, so an atlas that is no longer mounted cannot still be
    // claiming to supply skin.
    return () => setPresentSystemsFor(source.id, null)
  }, [entries, source.id, setPresentSystemsFor])

  /**
   * Register the atlas into the canonical frame.
   *
   * Two atlases have to occupy the same body, and they do NOT share an origin or
   * a scale: HRA's origin sits mid-body and it stands 1.658 m, while
   * BodyParts3D's depth axis runs 0 to 0.24 m and it was normalised to 1.7 m.
   * Grounding in Y alone — which is all this did at first — leaves the viscera
   * floating roughly 15 cm in front of the skeleton, outside the body.
   *
   * So every atlas is normalised the same way: centred horizontally, stood on
   * y=0, and scaled to one canonical height. Deriving it from the loaded bounds
   * keeps male, female and any future atlas correct with no per-asset tuning.
   *
   * This is bounding-box registration, and it is crude — it assumes both atlases
   * are whole standing bodies with comparable proportions. It is NOT the
   * landmark or surface registration `HANDOVER_SPEC.md` section 6 calls for, and
   * it will not survive a partial atlas or a posed one. Good enough to put the
   * organs inside the ribcage; not good enough to claim anatomical alignment.
   */
  const fit = useMemo(() => {
    const box = new Box3().setFromObject(scene)
    if (!Number.isFinite(box.min.y)) return { scale: 1, offset: [0, 0, 0] as const }
    const size = new Vector3()
    const centre = new Vector3()
    box.getSize(size)
    box.getCenter(centre)

    /**
     * A PARTIAL atlas cannot be fitted from its bounds, and doing it anyway is
     * not a subtle error. The CT atlas holds 0.861 m of anatomy because it is a
     * torso study; stretching that to a 1.70 m stature scales it ~1.97× and
     * renders a giant ribcage. Such an atlas declares a real-world landmark
     * instead, and here we only translate it into place.
     *
     * A POSED atlas needs the same escape hatch for a different reason. In the
     * TCIA Healthy-Total-Body-CTs collection the subject is scanned with arms
     * raised above the head, so the bounding box measures toe-to-fingertip rather
     * than stature: the shipped subject-003 asset spans 1,857.9 mm (feet at
     * y=0.5941, fingertips at 2.4520) against a recorded height of 1,701.8 mm, a
     * 9.2 % overshoot that would render every organ ~9 % small. That atlas is
     * CT-derived and so already in real metres, which makes `realScale` the honest
     * answer rather than a workaround: it stands on a measured foot landmark and is
     * not rescaled at all. The raised arms then sit above the head where they
     * actually were, and nothing is cropped, rescaled or repositioned.
     */
    const reg = source.registration
    if (reg?.realScale) {
      return {
        scale: 1,
        offset: [-centre.x, reg.anchor.worldY - reg.anchor.rawY, -centre.z] as const,
      }
    }

    const scale = size.y > 0 ? CANONICAL_HEIGHT_M / size.y : 1
    return {
      scale,
      // Applied after scaling, so the offsets are scaled too.
      offset: [-centre.x * scale, -box.min.y * scale, -centre.z * scale] as const,
    }
  }, [scene, source])

  /**
   * Exploded view: where each structure travels to, and how far.
   *
   * Computed in the meshes' own parent space rather than world space, because
   * that is the space `mesh.position` is expressed in — the atlas sits under a
   * `fit` group that scales it to canonical height, and a world-space offset
   * would be wrong by exactly that factor. Geometry bounds times the mesh's own
   * matrix gives the centroid without depending on where the group is attached.
   *
   * Displacement is PROPORTIONAL to how far off-centre a structure already sits,
   * not a fixed throw along a normalised direction. The normalised version was
   * tried first and reads badly: a structure near the body axis has almost no
   * radial direction, so normalising amplifies whatever noise its centroid has
   * and flings it somewhere arbitrary — the brain shot sideways, because its
   * centroid is within a centimetre of the midline. Scaling the offset instead
   * means central structures barely move, peripheral ones travel, and the body
   * expands about its own centre while every part stays where you expect it.
   *
   * The vertical component is still damped: at full strength the body stretches
   * into a 3 m column, which is accurate but useless.
   *
   * THE FALLBACK PATH. It does nothing on an atlas whose merged groups span the
   * whole body: Z-Anatomy's groups are bilaterally symmetric and full-length, so
   * every group centroid lands on the body axis and the displacement is exactly
   * zero — measured at 45 % explode, all three reported an off-centre distance of
   * 0.000 and did not move. It works on BodyParts3D only because its eleven
   * groups are organs sitting off-centre.
   *
   * That is why `explodeAttr` above exists, and where an atlas carries
   * `_STRUCTURE` this path stands down entirely (see the guard in the effect
   * below) rather than adding a second displacement on top. This remains the
   * path for atlases without per-vertex ids — BodyParts3D and HRA today.
   */
  const explodeVectors = useMemo(() => {
    const centre = new Vector3()
    const size = new Vector3()
    const union = new Box3()
    const boxes = new Map<Mesh, Vector3>()

    for (const e of entries) {
      const g = e.mesh.geometry
      if (!g.boundingBox) g.computeBoundingBox()
      if (!g.boundingBox) continue
      e.mesh.updateMatrix()
      const b = g.boundingBox.clone().applyMatrix4(e.mesh.matrix)
      const c = new Vector3()
      b.getCenter(c)
      boxes.set(e.mesh, c)
      union.union(b)
    }
    if (boxes.size === 0) return new Map<Mesh, Vector3>()
    union.getCenter(centre)
    union.getSize(size)

    const out = new Map<Mesh, Vector3>()
    for (const [mesh, c] of boxes) {
      const offset = c.clone().sub(centre)
      offset.y *= 0.35
      // 1.6 at full slider roughly triples the body's width, which separates
      // every system while keeping the silhouette recognisable.
      out.set(mesh, offset.multiplyScalar(1.6))
    }
    return out
  }, [entries])

  /**
   * Per-structure identity, when the atlas carries it.
   *
   * The merge is what buys the draw-call budget and what costs the names: 2,077
   * Z-Anatomy structures arrive as three meshes. `scripts/build-z-anatomy.mjs`
   * writes a `_STRUCTURE` id on every vertex and a table on the scene, so the
   * names survive the merge as data. Atlases built before that simply have
   * neither, and everything here degrades to the old per-group behaviour.
   *
   * three's GLTFLoader lowercases any attribute it does not recognise, so
   * `_STRUCTURE` arrives as `_structure`.
   */
  const structures = useMemo(
    () => (scene.userData?.structures as StructureEntry[] | undefined) ?? null,
    [scene],
  )

  /**
   * The third-party components embedded in this atlas, published so the panel
   * can name the rights holder of the structure under the pointer.
   *
   * Two of Z-Anatomy's components are NON-COMMERCIAL while the atlas itself is
   * CC BY-SA, so "which licence am I looking at" has a per-structure answer that
   * the atlas-level credit cannot give. Published from the asset rather than
   * hardcoded, for the reason every table in this repository is: a hand-kept
   * copy goes stale the first time an asset is rebuilt.
   */
  const setAtlasComponents = useTwin((s) => s.setAtlasComponents)
  useEffect(() => {
    const list = (scene.userData?.components as AtlasComponent[] | undefined) ?? []
    setAtlasComponents(source.id, list.length ? list : null)
    return () => setAtlasComponents(source.id, null)
  }, [scene, source.id, setAtlasComponents])

  /**
   * How many structures carry a resolvable ontology term. Dev only.
   *
   * This is the check that the crosswalk actually reached the asset, and it
   * exists because `docs/ONTOLOGY_MAP.md` claimed Z-Anatomy carried ZERO terms
   * while the built GLB carried 1,048 — the document had been generated against
   * an older build and nobody noticed, because nothing in `src/` read the field.
   * A number in the console at load is what makes that kind of drift visible.
   *
   * ⚠️ Expect 0 on `z-anatomy-regions` and on the node-termed atlases, and that
   * is CORRECT rather than a failure: the regions atlas has 257 structures with
   * no CURIE at all, and HRA carries its terms on NODES, where `readTerm` finds
   * them. Gating on a non-zero count here would report a false failure on four
   * of the seven sources.
   */
  // Tell the dock whether this atlas can address structures at all, so the
  // inspect controls disable themselves rather than doing nothing.
  const setStructureCount = useTwin((s) => s.setStructureCount)
  useEffect(() => {
    setStructureCount(source.id, structures?.length ?? 0)
    return () => setStructureCount(source.id, null)
  }, [structures, source.id, setStructureCount])

  useEffect(() => {
    if (!import.meta.env.DEV || !structures) return
    const withTerm = structures.filter((s) => structureTerm(s)).length
    const restricted = structures.filter((s) => s.licence).length
    console.info(
      `[AtlasBody ${source.id}] ${structures.length.toLocaleString()} structures, ` +
        `${withTerm.toLocaleString()} with an ontology term` +
        (restricted ? `, ${restricted} under a component licence` : ''),
    )
  }, [structures, source.id])

  /**
   * The `_STRUCTURE` id range an active organ overlay stands in for, if any.
   *
   * This is how a MERGED node gives up part of itself. Node-level hiding
   * (`useSupersededBy`) only works where an atlas ships the organ as its own node,
   * which is HRA and nothing else; Z-Anatomy merges the whole cardiovascular
   * system into one draw call, so its heart has to be masked per vertex instead.
   * BodyParts3D can do neither — it carries no `_STRUCTURE` at all.
   */
  const hiddenIds = useHiddenStructureIds(structures)
  const structureInspect = useTwin((s) => s.structureInspect)

  /**
   * The per-structure lookup table, as an RGBA texture indexed by `_STRUCTURE`.
   *
   * Carries BOTH the overlay mask (alpha) and the inspect tint (rgb), because
   * they are read at the same index in the same draw and splitting them would
   * cost a second texture fetch per vertex for nothing. See `structureMask.ts`
   * for why this replaced the contiguous `{lo, hi}` range it grew out of.
   *
   * The TEXTURE OBJECT is stable for the life of an atlas and only its bytes
   * change, which is what keeps toggling an overlay or an inspect mode from
   * recompiling anything: the uniform still points at the same object, so no
   * material and no program is invalidated. Only `needsUpdate` is set.
   */
  const mask = useMemo(
    () => (structures ? createStructureMask(structures.length) : null),
    [structures],
  )
  useEffect(() => () => mask?.texture.dispose(), [mask])

  useEffect(() => {
    if (!mask || !structures) return
    writeStructureMask(
      mask,
      structures,
      hiddenIds,
      structureInspect === 'none' ? null : (e) => inspectTint(structureInspect, e),
    )
  }, [mask, structures, hiddenIds, structureInspect])

  /**
   * Whether the mask shader variant is needed at all.
   *
   * ⚠️ A SHADER VARIANT FLAG, so it belongs in the material cache key AND in the
   * hand-maintained dep array below — the two traps this file documents. It is
   * deliberately a BOOLEAN rather than the mask contents: the contents live in
   * the texture and change without a recompile, so keying on them would mint a
   * fresh program every time somebody dragged a toggle.
   */
  const maskOn = mask !== null && (hiddenIds !== null || structureInspect !== 'none')

  /**
   * PER-STRUCTURE EXPLODE — roadmap phase 4.
   *
   * The CPU path below moves whole meshes, which does nothing on Z-Anatomy: its
   * groups each span the entire body symmetrically, so every group centroid lands
   * on the body axis and the displacement is exactly zero. Measured at 45 %
   * explode, all three reported an off-centre distance of 0.000. The slider was
   * dead for the atlas that most needs it.
   *
   * The fix is to displace each STRUCTURE, which `_STRUCTURE` now makes possible.
   * The offset is precomputed here and written as a per-vertex attribute, so the
   * vertex shader is one line and no per-frame CPU work happens at all.
   *
   * ⚠️ WHY AN ATTRIBUTE AND NOT A CENTROID TEXTURE — this is the part that bites.
   * The shipped atlas uses `KHR_mesh_quantization`, and gltf-transform quantises
   * PER MESH: measured node scales on `z-anatomy.ao.glb` run from 0.0823
   * (reproductive) to 0.8463 (muscle). So object space differs mesh to mesh, and
   * the structure table's centroids — which are in canonical metres — cannot be
   * fed to a shader shared across meshes without per-mesh correction. Computing
   * the offset here, in each geometry's OWN space, sidesteps that entirely.
   *
   * The body centre is still computed in canonical space across every mesh, or
   * each mesh would explode about its own centre and the body would not separate.
   */
  /**
   * DEFERRED, not lazy — and the distinction is the whole design.
   *
   * ⚠️ THIS PRECOMPUTE IS THE COST OF STRUCTURE IDENTITY, AND IT LANDED ON THE
   * LANDING SCREEN. It is O(vertices) twice over — once to accumulate per-structure
   * centroids in two spaces, once to write a vec3 per vertex — plus a 637 × ~344
   * nearest-bone search. Measured on the BodyParts3D rebuild: the atlas went from
   * 2.9 s to 6.3 s to first paint, because that asset previously had no
   * `_STRUCTURE` and skipped this path entirely. `src/store.ts` justifies
   * BodyParts3D as the DEFAULT precisely on the grounds that it "has to look like
   * something in a few seconds on a link someone was sent", so ~3.4 s spent before
   * anything appears is spent against the one requirement that default exists for.
   *
   * ⚠️ LAZY-ON-FIRST-DRAG WOULD BE THE WRONG FIX, and it is the obvious one.
   * Computing on the first non-zero `explode` moves the whole stall into the
   * middle of an interaction: the viewer drags the slider and the app freezes for
   * three seconds with the body not yet moving. A freeze while you are waiting for
   * a page is tolerable; a freeze in response to your own input reads as broken.
   *
   * So the work is DEFERRED to an idle callback instead. The body paints on the
   * fast path, the attribute is built in the first idle moment after it, and by
   * the time anyone reaches for the slider it is there. `requestIdleCallback` has
   * a 2 s timeout so a permanently busy main thread cannot starve it forever, and
   * a `setTimeout` fallback covers Safari, which still does not implement it.
   *
   * The escape hatch matters too: if the viewer somehow reaches the slider first
   * — a scripted run, a very fast hand — the second effect arms it immediately
   * rather than making them wait for idle.
   */
  const [explodeArmed, setExplodeArmed] = useState(false)

  useEffect(() => {
    // A new atlas needs a new attribute, so disarm and re-schedule.
    setExplodeArmed(false)
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
      cancelIdleCallback?: (h: number) => void
    }
    if (w.requestIdleCallback) {
      const h = w.requestIdleCallback(() => setExplodeArmed(true), { timeout: 2000 })
      return () => w.cancelIdleCallback?.(h)
    }
    const t = setTimeout(() => setExplodeArmed(true), 400)
    return () => clearTimeout(t)
  }, [entries])

  // Reaching the slider before idle fires arms it now. One-way: once armed it
  // stays armed, so returning the slider to zero cannot throw the work away and
  // pay for it again.
  useEffect(() => {
    if (explode > 0) setExplodeArmed(true)
  }, [explode])

  const explodeAttr = useMemo(() => {
    if (!structures || !explodeArmed) return null
    const t0 = performance.now()
    type Acc = { sum: Float64Array; count: Uint32Array; mesh: Mesh }
    const per: Acc[] = []
    const canonical = new Map<number, [number, number, number]>()
    const totals = new Float64Array(structures.length * 3)
    const counts = new Uint32Array(structures.length)

    for (const e of entries) {
      const g = e.mesh.geometry
      const id = g.getAttribute('_structure')
      const pos = g.getAttribute('position')
      if (!id || !pos) continue
      const sum = new Float64Array(structures.length * 3)
      const count = new Uint32Array(structures.length)
      e.mesh.updateMatrix()
      const s = e.mesh.scale
      const t = e.mesh.position
      for (let i = 0; i < pos.count; i++) {
        const k = id.getX(i)
        sum[k * 3] += pos.getX(i)
        sum[k * 3 + 1] += pos.getY(i)
        sum[k * 3 + 2] += pos.getZ(i)
        count[k]++
        // Canonical = attribute space through this mesh's own dequantisation.
        totals[k * 3] += pos.getX(i) * s.x + t.x
        totals[k * 3 + 1] += pos.getY(i) * s.y + t.y
        totals[k * 3 + 2] += pos.getZ(i) * s.z + t.z
        counts[k]++
      }
      per.push({ sum, count, mesh: e.mesh })
    }
    if (!per.length) return null

    // Body centre: the mid-point of every structure centroid, in canonical space.
    const lo = [Infinity, Infinity, Infinity]
    const hi = [-Infinity, -Infinity, -Infinity]
    for (let k = 0; k < structures.length; k++) {
      if (!counts[k]) continue
      const c = [totals[k * 3] / counts[k], totals[k * 3 + 1] / counts[k], totals[k * 3 + 2] / counts[k]] as [number, number, number]
      canonical.set(k, c)
      for (let a = 0; a < 3; a++) {
        if (c[a] < lo[a]) lo[a] = c[a]
        if (c[a] > hi[a]) hi[a] = c[a]
      }
    }

    /**
     * Attachment decals ride with the bone they are painted on.
     *
     * 637 of the structures are muscle origin/insertion footprints — flat
     * patches lying ON a bone surface. Exploding each by its OWN centroid drifts
     * it off that surface, because a decal's centroid sits on the bone's skin
     * while the bone's sits at its middle. Measured: a mean 3.1 cm separation,
     * worst 10 cm, which the 1.6x gain turns into a visible ~5 cm float.
     *
     * Re-anchoring each decal to its nearest bone makes them move as one. Cost
     * is 637 x ~344 distance tests at load — a few milliseconds, and no rebuild,
     * which is why this is done here rather than baked into the asset.
     */
    const bones: number[] = []
    for (let k = 0; k < structures.length; k++) {
      if (canonical.has(k) && structures[k].layer === 'bone' && !structures[k].attachment) bones.push(k)
    }
    let reanchored = 0
    if (bones.length) {
      for (let k = 0; k < structures.length; k++) {
        if (!structures[k].attachment) continue
        const c = canonical.get(k)
        if (!c) continue
        let best = -1
        let bestD = Infinity
        for (const b of bones) {
          const o = canonical.get(b)!
          const d = (c[0] - o[0]) ** 2 + (c[1] - o[1]) ** 2 + (c[2] - o[2]) ** 2
          if (d < bestD) {
            bestD = d
            best = b
          }
        }
        if (best >= 0) {
          canonical.set(k, canonical.get(best)!)
          reanchored++
        }
      }
    }
    const centre = [0, 1, 2].map((a) => (lo[a] + hi[a]) / 2)

    const written: BufferGeometry[] = []
    for (const { mesh } of per) {
      const g = mesh.geometry
      const id = g.getAttribute('_structure')
      const pos = g.getAttribute('position')
      if (!id || !pos) continue
      const off = new Float32Array(pos.count * 3)
      const s = mesh.scale
      for (let i = 0; i < pos.count; i++) {
        const c = canonical.get(id.getX(i))
        if (!c) continue
        // Same shaping as the CPU path so the two look identical: scaled by how
        // far off-centre the structure sits (not normalised — a central
        // structure should barely move), vertical damped, 1.6 at full slider.
        const dx = (c[0] - centre[0]) * EXPLODE_GAIN
        const dy = (c[1] - centre[1]) * EXPLODE_GAIN * EXPLODE_Y_DAMP
        const dz = (c[2] - centre[2]) * EXPLODE_GAIN
        // Back into this mesh's attribute space; a delta ignores translation.
        off[i * 3] = dx / s.x
        off[i * 3 + 1] = dy / s.y
        off[i * 3 + 2] = dz / s.z
      }
      g.setAttribute('aExplode', new BufferAttribute(off, 3))
      written.push(g)
    }
    // Stated like the resolution report above: a silently absent explode
    // attribute is the difference between a working slider and a dead one, and
    // the dead version looks identical until you drag it.
    console.info(
      `[AtlasBody] ${url}: per-structure explode on ${written.length} mesh(es), ` +
        `${canonical.size}/${structures.length} structures anchored` +
        (reanchored ? `, ${reanchored} attachment decals re-anchored to their nearest bone` : '') +
        // Timed and printed because this is the cost that pushed the default
        // atlas past its load budget, and a deferred cost nobody measures is a
        // cost that creeps back. See the note on `explodeArmed`.
        ` — ${Math.round(performance.now() - t0)}ms, off the first-paint path`,
    )
    return written.length ? written : null
    // `url` is read only by the log line, but it is listed so the message can
    // never name a different atlas than the one just measured. It changes in
    // lockstep with `entries` anyway, so it costs no extra pass.
  }, [entries, structures, url, explodeArmed])

  /** Cleanup: the attribute belongs to this component, not to the cached GLTF. */
  useEffect(() => {
    const gs = explodeAttr
    return () => {
      for (const g of gs ?? []) g.deleteAttribute('aExplode')
    }
  }, [explodeAttr])

  /** Shared across every material; the slider writes this one value. */
  const explodeUniform = useRef({ value: 0 })
  /** Face-on opacity floor for the x-ray view. 1 = solid. See `materialFor`. */
  const xrayUniform = useRef({ value: 1 })
  const perStructureExplode = explodeAttr !== null
  const xrayOn = xray > 0
  // Only the gut for now — see the note at the use site.
  const smoothOn = smoothTransparency && xrayOn

  /** Positions before any explosion, so the offset is applied, not accumulated. */
  const homePositions = useRef(new Map<Mesh, Vector3>())
  useEffect(() => {
    const home = homePositions.current
    home.clear()
    for (const e of entries) home.set(e.mesh, e.mesh.position.clone())
    return () => {
      // Put everything back, or a mesh reused across an atlas switch keeps the
      // offset while its home is recomputed from the already-moved position.
      for (const [mesh, p] of home) mesh.position.copy(p)
      home.clear()
    }
  }, [entries])

  useEffect(() => {
    explodeUniform.current.value = explode
  }, [explode])

  // 0 on the slider means solid (floor 1.0); 1 means the most see-through the
  // view offers. Kept off zero so a face-on surface never vanishes entirely —
  // an organ you cannot see at all is worse than one you cannot see into.
  useEffect(() => {
    xrayUniform.current.value = 1 - xray * 0.88
  }, [xray])

  useEffect(() => {
    for (const e of entries) {
      const home = homePositions.current.get(e.mesh)
      const v = explodeVectors.get(e.mesh)
      if (!home || !v) continue
      // Per-structure path owns the displacement where it is available; letting
      // the whole-mesh path run too would add the two together.
      if (perStructureExplode) {
        e.mesh.position.copy(home)
        continue
      }
      // The skin hull stays put. It is the outline the separated parts are read
      // against; flinging it outwards too would just scale the whole body up.
      const k = e.systemId === 'integumentary' ? 0 : explode
      e.mesh.position.copy(home).addScaledVector(v, k)
    }
  }, [entries, explode, explodeVectors, perStructureExplode])

  /**
   * Only render meshes this atlas is responsible for under the current mode.
   *
   * With a fallback that matters: in `composed` mode `musculoskeletal` is
   * assigned to Z-Anatomy, so if that atlas is not installed those meshes would
   * be filtered out of HRA *and* have nowhere else to come from — the twin
   * would silently lose its skeleton. When the assigned atlas is missing, any
   * atlas that IS present covers for it.
   */
  const visible = useMemo(
    () =>
      entries.filter((e) => {
        if (e.hiddenGroup) return false
        if (e.layer && hiddenLayers.includes(e.layer as AnatomyLayer)) return false
        if (e.systemId && hiddenSystems.includes(e.systemId)) return false
        // An active organ overlay stands in for the static organ, so hide it
        // rather than render both. Tested against the node name AND the group
        // key, because an atlas may carry the organ under either.
        if (superseded.length > 0) {
          const name = `${e.mesh.name} ${e.groupKey ?? ''}`
          if (superseded.some((re) => re.test(name))) return false
        }
        if (e.systemId === null) return true
        const assigned = sourceForSystem(mode, e.systemId).url
        if (assigned === url) return true
        return !presentUrls.includes(assigned)
      }),
    [entries, mode, url, presentUrls, hiddenSystems, hiddenLayers, superseded],
  )

  /**
   * Resolution report. Swapping an atlas in is the step most likely to fail
   * quietly — a mis-keyed lookup yields a uniformly grey body and no error — so
   * the mapping outcome is always stated, not just its failures.
   */
  useEffect(() => {
    const bySystem = new Map<string, number>()
    for (const e of entries) {
      const k = e.systemId ?? '(unresolved)'
      bySystem.set(k, (bySystem.get(k) ?? 0) + 1)
    }
    const resolved = entries.length - (bySystem.get('(unresolved)') ?? 0)
    const pct = entries.length ? Math.round((100 * resolved) / entries.length) : 0
    // Stated out loud because "hidden" is a silent failure mode by nature: the
    // last regression here made the placenta reappear and nothing reported it.
    // The fit is reported because it is the step that can silently put the whole
    // body outside the frustum: a wrong scale renders nothing at all, and
    // "nothing at all" is indistinguishable from a load failure on screen.
    console.info(
      `[AtlasBody] ${url}: fit scale ${fit.scale.toFixed(4)}, ` +
        `offset [${fit.offset.map((n) => n.toFixed(3)).join(', ')}], ` +
        `parent ${scene.parent ? scene.parent.type : 'NONE'}, ` +
        `visible ${visible.length}/${entries.length}`,
    )
    const hidden = entries.filter((e) => e.hiddenGroup)
    if (hidden.length) {
      console.info(
        `[AtlasBody] ${url}: ${hidden.length} mesh(es) hidden as donor-specific — ` +
          hidden.map((e) => e.groupKey || e.label || e.term || '(unnamed)').join(', '),
      )
    }
    // Counts are MESHES, not geometry. An atlas pre-joined by group (see
    // scripts/strip-atlas.mjs --join-by) has far fewer, larger meshes, so the
    // percentage drops without any structure being lost — the unresolved ones
    // are simply the same ungrouped remainder over a smaller total.
    // performance.now() is measured from navigation start, so this is how long
    // the viewer actually stared at the placeholder before the atlas appeared.
    console.info(
      `[AtlasBody] ${url}: ready in ${Math.round(performance.now())}ms — ` +
        `${resolved}/${entries.length} meshes resolved (${pct}%) — ` +
        [...bySystem].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '),
    )
    if (pct < 50) {
      console.warn(
        `[AtlasBody] ${url}: under half the meshes resolved to a system. The body will render ` +
          `mostly neutral. Check readTerm()/systemForGroup() against this asset's glTF extras.`,
      )
    }
  }, [entries, url, fit, visible, scene])

  /**
   * Materials are SHARED, and this is the whole performance story.
   *
   * Rendering one React component per mesh meant 1,833 components each building
   * its own MeshStandardMaterial. Downloading the 24 MB atlas takes 101 ms;
   * reconciling that component tree took the best part of twenty seconds, which
   * is what made the twin look broken — the procedural fallback sat there while
   * the controls appeared dead, because the fallback does not implement them.
   *
   * three.js is perfectly happy with 1,833 meshes. So the scene is handed over
   * as a single node and materials are assigned imperatively, keyed by the few
   * things that actually vary: system, layer, mode, selection. That is roughly
   * forty materials instead of 1,833.
   */
  const materials = useRef(new Map<string, MeshPhysicalMaterial>())
  useEffect(() => {
    const cache = materials.current
    return () => {
      cache.forEach((m) => m.dispose())
      cache.clear()
      clearTunables()
    }
  }, [])

  const materialFor = (
    systemId: SystemId | null,
    layer: string | undefined,
    selected: boolean,
    baked: boolean,
    /** The atlas's own group key — colours groups that resolve to no system. */
    group?: string,
    /**
     * Whether THIS mesh carries `_structure`.
     *
     * ⚠️ NOT the same question as `maskOn`, and conflating them is a silent
     * mesh-eater. `maskOn` says the atlas has a mask; this says the mesh can be
     * indexed by it. A mesh without the attribute still compiles the injection
     * fine — WebGL supplies 0.0 for an unbound attribute — so every one of its
     * vertices would look up STRUCTURE 0 and take its mask. If structure 0
     * happens to be hidden by an overlay, the entire mesh collapses to the
     * origin and vanishes, with no error anywhere.
     *
     * Measured on the shipped Z-Anatomy: all 11 meshes carry it, so nothing hits
     * this today. It is guarded because the failure is invisible and the cost is
     * one boolean.
     */
    hasStructure = false,
  ): MeshPhysicalMaterial => {
    // `perStructureExplode` is part of the key: a material compiled without the
    // injection cannot gain it later without a recompile, and the two kinds must
    // not be shared.
    //
    // `maskOn` is a BOOLEAN here, and that is a change worth explaining rather
    // than a loosening. The key used to carry the hide RANGE verbatim, because
    // the range travelled as a uniform baked in at compile time: two atlases
    // masking different ranges under one key would both take whichever compiled
    // first, and on the way back to no overlay the heart stayed hidden with
    // nothing standing in for it.
    //
    // The mask is now a TEXTURE whose object identity never changes for the life
    // of an atlas — only its bytes do, and a byte change needs no recompile. So
    // the only thing the program depends on is whether the injection is present
    // at all, which is exactly what this boolean says. Keying on the contents
    // now would be actively wrong: it would mint a new program, and leak one
    // from the cache, every time somebody dragged a toggle.
    //
    // The per-atlas collision the old comment worried about is gone for the same
    // reason: each `AtlasBody` builds its own texture and its own material cache,
    // so two atlases cannot share a mask by sharing a key.
    // Scoped to the hull, so flipping the toggle cannot mint a duplicate
    // program for each of the ~65 organ materials that ignore it.
    const glassOn = glassHull && isBodyHull(systemId, group)
    const maskThis = maskOn && hasStructure
    const key = `${systemId}|${layer}|${group}|${colourMode}|${selected}|${hullOpacity.toFixed(2)}|${baked}|${perStructureExplode}|${xrayOn}|${smoothOn}|${maskThis}|${glassOn}`
    const cache = materials.current
    const hit = cache.get(key)
    if (hit) return hit

    const sys = systemId ? byId.get(systemId) : undefined
    const score = sys?.hasData ? sys.score : null
    const anatomical = colourMode === 'anatomical'
    const isShell = systemId === 'integumentary'
    const isMuscle = layer === 'muscle'
    const color = anatomical ? anatomicalColor(systemId, layer, group) : scoreToColor(score)
    const emissive = anatomical ? scoreLift(score) : scoreToEmissive(score)
    const unresolvedOrNoData = systemId === null || score === null

    /**
     * ⚠️ "No health score" must NOT dissolve the anatomy in the body view.
     *
     * This ghosted anything with `score === null` to 45 % opacity, which
     * `alphaHash` then renders as a DITHER — and at 45 % that discards more than
     * half the fragments, so a thin organ wall breaks into a cloud of dots. On
     * HRA it hit the liver, both intestines and every one of the 38 meshes that
     * resolve to no system at all, which is why the abdomen looked like a point
     * cloud while the scored musculoskeletal system stayed solid.
     *
     * It was reasonable when this repo was a health dashboard: an unmeasured
     * system SHOULD look unmeasured, and that rule is still right in `health`
     * mode. But **D8 moved scoring upstream to `etzm/open-twin` and this
     * repository became a body viewer**, so most systems now legitimately carry
     * no score — and ghosting them means the anatomy dissolves for a reason that
     * has nothing to do with anatomy.
     *
     * So the ghost is scoped to the mode that is actually making a claim about
     * health, exactly as the muscle rule on the line above already does.
     * `anatomical` is the atlas look and renders the body solid.
     */
    /**
     * ⚠️ Integumentary tissue that is NOT the outer envelope — on HRA, a
     * 6,520-triangle subcutaneous fat depot in the abdomen. It must not be driven by
     * the hull slider.
     *
     * It was, because the slider was gated on the SYSTEM. That was invisible while
     * the hull defaulted to 10 %, and stopped being invisible when the landing state
     * raised it to 80 %: two soft-tissue layers at 0.8 stack, and measured in the
     * browser the fat depot was veiling the gut behind it.
     *
     * Only the OPACITY is decoupled. The blend flags below still use `isShell`, and
     * deliberately: no depth write, alpha blending rather than the dither, and
     * `DoubleSide` are right for BOTH — they are translucent soft-tissue layers that
     * must not occlude. Sending the patch down the organ path instead would give it
     * `opacity: 1` in anatomical mode and `FrontSide`, which is worse twice over — an
     * opaque blocker, and a one-sided surface on a patch that is not closed.
     */
    const isSubcutaneous = isShell && !isBodyHull(systemId, group)

    const opacity = isSubcutaneous
      ? 0.3
      : isShell
        ? hullOpacity
        : isMuscle && !anatomical
          ? 0.22
          : unresolvedOrNoData && !anatomical
            ? 0.45
            : 1

    const surface = tissueSurface(systemId, layer)

    const m = new MeshPhysicalMaterial({
      color: isShell && !selected && !anatomical ? new Color('#bcd3e6') : color,
      /**
       * Emissive is added AFTER lighting and completely unlit — the last line of
       * three.js's physical shader is
       * `outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance`.
       * Setting `emissive` to the same colour as the albedo therefore added
       * 15-50 % of each organ's own colour as a flat, shadeless wash over the
       * top of it. It was a deliberate contrast-removal filter over the whole
       * body, and it is the second biggest reason the twin read as clip-art.
       *
       * Health still needs to be legible in anatomical mode, where hue is spoken
       * for by the tissue. It is now a small accent rather than a wash: enough to
       * notice, not enough to erase the form the lighting just built. Selection
       * lifts it further.
       */
      emissive: color,
      emissiveIntensity: isShell && !selected ? 0 : (selected ? emissive + 0.18 : emissive) * 0.3,
      /**
       * Ambient occlusion, baked per vertex into COLOR_0 by scripts/bake-ao.mjs.
       *
       * three.js's `color_fragment` chunk is just `diffuseColor *= vColor;`, so
       * switching this on multiplies the tissue colour by the occlusion term with
       * no shader work and no texture. It is the substitute for screen-space AO,
       * which cannot be used here at all: post-processing does not run inside a
       * WebXR session, and SSAO computes per eye, which produces different
       * results in each eye and reads as binocular rivalry.
       *
       * This MUST follow the geometry, and an earlier version of this comment
       * claimed the opposite — that three.js only defines USE_COLOR when the
       * attribute exists, so leaving it on was harmless. It is not. In
       * WebGLPrograms only `vertexAlphas` inspects `geometry.attributes.color`;
       * `USE_COLOR` is defined from `material.vertexColors` alone. With the
       * define on and no COLOR_0 bound, the attribute falls back to WebGL's
       * generic value of (0,0,0,1), and `diffuseColor *= vColor` multiplies the
       * whole atlas by zero. It renders solid black, not unoccluded — which is
       * exactly what Z-Anatomy did, having no baked AO yet.
       */
      vertexColors: baked,
      // No `isShell` special case here: the shell's roughness belongs in
      // `tissueSurface` with every other tissue, or the two disagree and the
      // one you can read is the one that loses.
      roughness: anatomical ? surface.roughness : 0.42,
      // Was 0.02. Non-zero metalness on a dielectric tints the specular
      // highlight by the albedo, which is wrong for every tissue in the body and
      // muddies the one lobe that carries the wet read.
      metalness: 0,
      clearcoat: anatomical ? surface.clearcoat : 0.25,
      clearcoatRoughness: anatomical ? surface.clearcoatRoughness : 0.3,
      sheen: anatomical ? surface.sheen : 0,
      // Soft tissue is close to water (1.33); the 1.5 default is window glass.
      ior: 1.38,
      opacity,
      /**
       * Stochastic transparency instead of alpha blending.
       *
       * The old approach could not work, and not for want of tuning: three.js
       * sorts transparents by the projected centre of their bounding sphere, and
       * the skin hull's bounding sphere is centred on the same point as the
       * liver's. One scalar per object cannot express "this mesh encloses that
       * one", so a correct order does not exist for mutually enclosing geometry.
       * `depthWrite: false` was the workaround, and it cost correct depth
       * everywhere else.
       *
       * `alphaHash` (three.js r154+) discards fragments against a hash of
       * OBJECT-SPACE position, so the dither pattern is glued to the surface
       * rather than the screen: it does not crawl when you orbit, and both eyes
       * in a headset see the same pattern, so there is no binocular rivalry.
       * The mesh stays in the OPAQUE queue and writes depth, which means depth
       * is finally correct — for sorting, for occlusion, and for anything
       * depth-based added later.
       *
       * The grain it trades for that is halved by the 4x MSAA the canvas now
       * requests, since `discard` is evaluated per sample.
       */
      /**
       * The SHELL is the exception, and it has to be.
       *
       * `alphaHash` dithers by discarding fragments, so at the hull's default
       * 10 % opacity it throws away nine fragments in ten — which is not a faint
       * ghost, it is a speckle field over the whole body, and because the shell
       * covers everything the grain lands on every organ behind it too.
       *
       * The hull is also the one case where alpha blending is genuinely correct:
       * the reason blending failed for the atlas at large is that mutually
       * enclosing meshes have no valid draw order, and the hull is a single
       * object that must never occlude anything. `depthWrite: false` on one such
       * object is the right call; it was only wrong as a blanket rule.
       *
       * Everything else keeps the hash, where it buys correct depth and costs
       * grain the 4x MSAA largely absorbs at these opacities.
       */
      alphaHash: opacity < 1 && !isShell,
      transparent: isShell && (opacity < 1 || glassOn),
      /**
       * The shell writes depth ONLY while it is opaque.
       *
       * `!isShell` was wrong: it meant a fully opaque skin still never wrote
       * depth, so every structure behind it drew straight over the top and the
       * body read as full of holes at 100 % hull. The rule is about
       * translucency, not about being the shell — a ghost hull must not occlude,
       * an opaque one must.
       */
      depthWrite: isShell ? opacity >= 1 && !glassOn : true,
      /**
       * Double-sided, because BodyParts3D's skin is not a closed manifold. Where
       * the surface is open or a normal is flipped, front-face culling turns the
       * defect into a window straight through the body. Rendering the back faces
       * hides the gap behind the inside of the skin, which is the honest thing to
       * show. It also improves the ghost look: at low opacity you see the far
       * body wall faintly through the near one.
       */
      side: isShell ? DoubleSide : FrontSide,
    })
    /**
     * Per-structure explode, injected into the stock physical shader.
     *
     * One line of GLSL: the offset is already baked into `aExplode` per vertex,
     * so nothing is computed here beyond a multiply. The uniform object is SHARED
     * across every material — `explodeUniform.current` — so moving the slider
     * writes one number and every mesh follows, with no material rebuild and no
     * per-frame CPU work.
     *
     * The skin hull is excluded: it is the outline the separated parts are read
     * against, and flinging it outwards too would just scale the body up.
     */
    /**
     * X-RAY: fade a surface where it faces you, keep it solid at grazing angles.
     *
     * Making the anatomy opaque (D13) was right — it killed the speckle — but it
     * cost the one thing the old dither was accidentally providing: you could see
     * INTO an organ. Solid organs read as blobs; the internal structure of the
     * breast and the interior of the bowel simply disappeared behind their own
     * outer wall.
     *
     * A Fresnel term restores that without going back to noise. Where the
     * surface normal points at the camera the alpha drops and you see through to
     * whatever is inside; at grazing angles it stays at 1, so the silhouette and
     * every fold stay crisp. That edge-solid/centre-clear profile is what makes
     * it read as a translucent organ rather than a broken mesh — the old 45 %
     * dither looked shredded precisely because it was uniform and had nothing
     * behind it worth seeing.
     *
     * ⚠️ It still goes through `alphaHash`, deliberately, and NOT through alpha
     * blending. The comment on `alphaHash` above is still binding: mutually
     * enclosing meshes have no valid draw order, so blending cannot be made
     * correct here at any opacity. The hash keeps these surfaces in the opaque
     * queue writing correct depth, and glues the dither to object space so it
     * neither crawls under orbit nor splits between the eyes in a headset.
     *
     * Injected before `<alphahash_fragment>` because that is what tests
     * `diffuseColor.a` — modulating it afterwards would change the colour and
     * leave the discard reading the unmodified value.
     */
    /**
     * Smooth translucency via `transmission`, as an alternative to the dither.
     *
     * `alphaHash` is the default for good reasons documented above — correct
     * depth, a pattern that does not crawl or split between the eyes in XR — but
     * its price is visible grain, and on a large smooth organ that grain is the
     * thing you notice. `transmission` refracts properly and has no grain at all.
     *
     * ⚠️ Scoped to the DIGESTIVE system on purpose. Transmission renders the
     * scene again into a back buffer every frame; applying it to every tissue
     * multiplies that cost, and on a headset it is the wrong trade. The gut is
     * the case that motivated it — a big convoluted tube whose interior is worth
     * seeing — so it is the case that gets it.
     *
     * Deliberately NOT combined with alphaHash: a surface cannot be both
     * stochastically discarded and refracted without doing both badly.
     */
    if (smoothOn && systemId === 'digestive' && !isShell) {
      m.transmission = 0.55 + 0.4 * xray
      m.thickness = 0.02
      m.ior = 1.35
      // Transmission does its own blending, so the hash must be off or the
      // surface is dithered AND refracted.
      m.alphaHash = false
      m.transparent = false
    } else if (xrayOn && !isShell) {
      const prev = m.onBeforeCompile
      m.alphaHash = true
      m.onBeforeCompile = (shader, renderer) => {
        prev?.(shader, renderer)
        shader.uniforms.uXrayFloor = xrayUniform.current
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float uXrayFloor;')
          .replace(
            '#include <alphahash_fragment>',
            [
              '#ifndef FLAT_SHADED',
              '  float xrFacing = abs( dot( normalize( vNormal ), normalize( vViewPosition ) ) );',
              // Squared so the clear zone stays tight to the facing direction and
              // the solid rim is generous — a linear falloff washes the whole
              // surface out and loses the shape.
              '  diffuseColor.a *= mix( 1.0, uXrayFloor, xrFacing * xrFacing );',
              '#endif',
              '#include <alphahash_fragment>',
            ].join('\n'),
          )
      }
    }

    /**
     * GLASS HULL — the same view-dependent trick as x-ray, aimed at the one
     * surface x-ray deliberately skips.
     *
     * X-ray is scoped to `!isShell` because the hull is not an organ you want to
     * see into; it is the thing in the way. But the hull is exactly where a
     * Fresnel profile pays, because a flat `hullOpacity` must pick ONE number for
     * every viewing angle and both ends of that choice are bad: low enough to see
     * the anatomy and the silhouette vanishes, high enough to state the silhouette
     * and the anatomy is veiled. On the dark theme the low end actively harms —
     * the grey hull swallows the body's own outline.
     *
     * The hull material is keyed on this flag, so turning the toggle off restores
     * exactly the material that shipped rather than a rim multiplied by zero. That
     * costs one material rebuild for one mesh, and it is what lets `transparent` and
     * `depthWrite` differ between the two states — which they must, because the rim
     * drives alpha below 1 even when the hull slider says opaque.
     *
     * Two anchors, for two different reasons:
     *
     *   `<alphahash_fragment>`  — the alpha half. That chunk is what reads
     *       `diffuseColor.a`, and it runs before `<opaque_fragment>` writes the
     *       blended alpha out. Same binding reason as x-ray above.
     *   AFTER `<emissivemap_fragment>` — the light half. That chunk MULTIPLIES
     *       `totalEmissiveRadiance`, so injecting before it would scale the rim
     *       away. Both anchors occur exactly once in three.js 0.169's
     *       meshphysical shader.
     *
     * Each site recomputes the term under its own name rather than sharing one:
     * they are separate `.replace()` calls into the same scope, and a shared name
     * would silently depend on injection order holding.
     */
    if (glassOn) {
      const prev = m.onBeforeCompile
      m.onBeforeCompile = (shader, renderer) => {
        prev?.(shader, renderer)
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <alphahash_fragment>',
            [
              'float glRim = 0.0;',
              '#ifndef FLAT_SHADED',
              // 2.2 keeps the clear zone wide and the lit edge tight. Lower and the
              // whole surface hazes over; higher and the rim thins to a wire.
              '  glRim = pow( 1.0 - abs( dot( normalize( vNormal ), normalize( vViewPosition ) ) ), 2.2 );',
              '#endif',
              // Face-on drops BELOW the slider's value so the anatomy reads better
              // than it does today, and the grazing edge goes nearly solid so the
              // silhouette is drawn in light rather than in grey.
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
              // Over 1.0 on purpose: the canvas tone-maps with AgX, so an over-bright
              // rim rolls off instead of clipping and reads as light, not as paint.
              //
              // ⚠️ 2.1 is a COMPROMISE, and the two atlases genuinely disagree. On
              // BodyParts3D — whose skin hugs the anatomy — 1.35 was already emphatic.
              // On HRA, which is the DEFAULT body and whose envelope is looser, larger
              // and carries baked AO in its vertex colours, the same value is barely
              // visible. Verified by instrumenting the material: HRA's hull really does
              // get the injection (its program cache key flips to 'g' and its material
              // id changes on toggle), so the difference is the geometry and the bake,
              // not the wiring. Tuned per atlas it would be two numbers; one number
              // means HRA reads clearly and BodyParts3D reads strong.
              '  totalEmissiveRadiance += vec3( 0.55, 0.83, 1.0 ) * glRimE * 2.1;',
            ].join('\n'),
          )
      }
    }

    /**
     * Hide the structures an organ overlay replaces, per vertex.
     *
     * Collapsing a hidden vertex to the origin makes every triangle touching it
     * degenerate, so it rasterises to nothing. That is deliberately not a
     * `discard`: a fragment discard costs the early-z optimisation on every
     * fragment of the mesh, and this mesh is millions of triangles. Collapsing
     * costs one compare in the vertex shader and leaves the rest untouched.
     *
     * `aStructure` rather than `_structure`, matching how `aExplode` is done
     * above: GLSL reserves leading-underscore identifiers, so the raw attribute
     * name is not safe to declare in a shader. The alias shares the very same
     * `BufferAttribute`, so it costs no memory.
     */
    if (maskThis && mask) {
      const prevHide = m.onBeforeCompile
      m.onBeforeCompile = (shader, renderer) => {
        prevHide?.(shader, renderer)
        shader.uniforms.uMask = { value: mask.texture }
        shader.uniforms.uMaskSize = { value: [MASK_WIDTH, mask.height] }

        /**
         * The lookup, shared by both stages.
         *
         * Sampled at the TEXEL CENTRE (`+ 0.5`) rather than at the corner. Off
         * by that half texel and a lookup lands on the boundary between two
         * entries, where the sampler is free to pick either — so a structure
         * would intermittently take its neighbour's mask, and only on some
         * drivers. `NearestFilter` makes the choice stable, not correct.
         *
         * `aStructure` rather than `_structure`: GLSL reserves leading-underscore
         * identifiers, so the alias created at enumeration time is the only legal
         * name. Same reason the explode injection uses its own attribute.
         */
        const lookup = `
vec4 otStructureMask( float id ) {
  float x = mod( id, uMaskSize.x );
  float y = floor( id / uMaskSize.x );
  vec2 uv = ( vec2( x, y ) + 0.5 ) / uMaskSize;
  return texture2D( uMask, uv );
}`

        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            '#include <common>\nattribute float aStructure;\nuniform sampler2D uMask;\nuniform vec2 uMaskSize;\nvarying vec3 vStructureTint;' +
              lookup,
          )
          /**
           * Collapsing a hidden vertex to the origin makes every triangle
           * touching it degenerate, so it rasterises to nothing. Deliberately
           * not a `discard`: a fragment discard costs the early-z optimisation
           * on every fragment of a mesh that is millions of triangles, where
           * this costs one compare in the vertex shader.
           *
           * The tint is carried to the fragment stage through a varying rather
           * than sampled again there — one texture fetch per vertex instead of
           * one per fragment, and the value is constant across a structure so
           * interpolation cannot change it.
           */
          .replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\nvec4 otMask = otStructureMask( aStructure );\nvStructureTint = otMask.rgb;\nif ( otMask.a < 0.5 ) transformed = vec3( 0.0 );',
          )

        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vStructureTint;')
          /**
           * MULTIPLIED into the lit colour, not substituted for it.
           *
           * Replacing the albedo would flatten every structure it touched into a
           * silhouette, which destroys exactly the form the AO bake and the
           * material work exist to build — and the default texel is white, so a
           * multiply is a true no-op wherever no tint is set. `<color_fragment>`
           * is the same insertion point three.js uses for vertex colours, so
           * this composes with the baked AO rather than fighting it.
           */
          .replace(
            '#include <color_fragment>',
            '#include <color_fragment>\ndiffuseColor.rgb *= vStructureTint;',
          )
      }
    }

    if (perStructureExplode && systemId !== 'integumentary') {
      const prevExplode = m.onBeforeCompile
      m.onBeforeCompile = (shader, renderer) => {
        prevExplode?.(shader, renderer)
        shader.uniforms.uExplode = explodeUniform.current
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            '#include <common>\nattribute vec3 aExplode;\nuniform float uExplode;',
          )
          .replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\ntransformed += aExplode * uExplode;',
          )
      }
    }

    /**
     * One key for every shader variant this material may carry.
     *
     * Without it three reuses a single compiled program across variants and
     * whichever compiled first wins for all of them — so an explode-only mesh
     * would silently get the x-ray shader, or neither would get either.
     *
     * The hide range goes in verbatim rather than as a flag. Sharing a program
     * means sharing the uniform objects `onBeforeCompile` created, so two atlases
     * masking different id ranges under one key would both take whichever range
     * compiled first and one of them would hide the wrong structures. Only
     * Z-Anatomy is masked today, so nothing collides yet; keying it out costs one
     * extra program in the case that would otherwise be silently wrong.
     */
    /**
     * ⚠️ `glassOn` MUST be here, and leaving it out fails in a way that looks like
     * the effect working.
     *
     * This key is what three.js uses to decide whether two materials may SHARE a
     * compiled program, and it is separate from this component's material cache.
     * A brand-new hull material whose key matches an already-compiled one is handed
     * that program and **`onBeforeCompile` is never called** — so the injection is
     * built, assigned, and silently discarded.
     *
     * The symptom: toggling did nothing on the atlas already on screen, but worked
     * perfectly on the next atlas switched to, because a fresh mount has no cached
     * program to reuse. Verified by logging — the injection ran on every toggle
     * while the compile hook fired only once per atlas.
     */
    if (xrayOn || perStructureExplode || maskThis || glassOn) {
      const variant = `${xrayOn ? 'x' : ''}${perStructureExplode ? 'e' : ''}${maskThis ? 'm' : ''}${glassOn ? 'g' : ''}`
      m.customProgramCacheKey = () => variant
    }

    cache.set(key, m)
    // Dev affordance only; see scene/tuning.ts. Grouped by tissue rather than by
    // cache key, so the tuner writes to every instance of a tissue at once.
    registerTunable(`${systemId}|${layer}`, m)
    return m
  }

  /**
   * The two things the geometry needs once, when it arrives.
   *
   * NORMALS — the pipeline ships no NORMAL, because stripping it is what lets
   * vertex welding build a manifold that meshoptimizer can actually simplify.
   * Baking normals back in offline tripled the file (7.7 MB -> 20.7 MB), and
   * with meshes merged down to about a dozen, computing them here costs
   * milliseconds.
   *
   * BOUNDS TREE — hover raycasts the atlas on every pointer move, and with no
   * acceleration structure that is a linear scan over every triangle in the
   * body. Measured in the browser: 311 ms per raycast on Z-Anatomy (1.5 M
   * triangles), 448 ms on BodyParts3D (2.6 M). With the tree, 0.1 ms.
   *
   * This was supposed to be drei's `<Bvh firstHitOnly>` wrapped around `<Body>`
   * in BodyScene, and that never built a tree for the atlas at all. drei
   * traverses in a mount-time `useEffect(..., [])`; child effects run before
   * parent effects, so when it fires `useAtlasAvailability` has not resolved,
   * `Body` is still rendering the procedural placeholder, and the only mesh in
   * the group is the invisible deselect plane. The atlas arrives later and the
   * one-shot traversal is long over — confirmed in the running app, where
   * exactly one geometry in the entire scene had a `boundsTree` and it was that
   * 2-triangle plane. So the tree is built HERE, keyed on the geometry, where
   * the geometry actually appears.
   *
   * Building costs 1.1 s for Z-Anatomy and 1.8 s for BodyParts3D on the main
   * thread, once, just after the atlas becomes visible. It is paid again on an
   * atlas switch, because the tree is disposed with the rest of this
   * component's resources rather than left on `useGLTF`'s cached geometry —
   * bounded memory (7-13 MB per atlas, and `composed` mode mounts two) over a
   * faster switch. three-mesh-bvh does ship a worker generator
   * (`computeBoundsTreeAsync`) if that stall ever needs to go away.
   */
  useEffect(() => {
    for (const e of entries) {
      const g = e.mesh.geometry
      if (!g.getAttribute('normal')) g.computeVertexNormals()
      g.computeBoundsTree = computeBoundsTree
      g.disposeBoundsTree = disposeBoundsTree
      // Guarded because meshes may share a geometry, and building twice would
      // strand the first tree.
      if (!g.boundsTree) g.computeBoundsTree(BVH_OPTIONS)
      e.mesh.raycast = acceleratedRaycast
    }
    return () => {
      for (const e of entries) {
        e.mesh.raycast = Mesh.prototype.raycast
        if (e.mesh.geometry.boundsTree) e.mesh.geometry.disposeBoundsTree()
      }
    }
  }, [entries])

  /** Apply visibility and materials to the real three.js objects. */
  useEffect(() => {
    const shown = new Set(visible.map((e) => e.mesh))
    for (const e of entries) {
      const on = shown.has(e.mesh)
      e.mesh.visible = on
      if (!on) continue
      e.mesh.material = materialFor(
        e.systemId,
        e.layer,
        // A layer-narrowed selection highlights only that layer. Selecting
        // "Musculoskeletal / Skeleton" must not light the musculature up too —
        // that fusion is the whole reason `selectedLayer` exists.
        e.systemId === selectedSystem && (selectedLayer === null || e.layer === selectedLayer),
        e.mesh.geometry.hasAttribute('color'),
        e.groupKey,
        e.mesh.geometry.hasAttribute('_structure'),
      )
    }
    // `xrayOn` is a SHADER VARIANT, so this effect has to re-run when it flips
    // and hand every mesh the newly-compiled material. The x-ray AMOUNT is a
    // uniform and deliberately absent — dragging the slider must not rebuild
    // materials, only write one float.
    //
    // `materialFor` is also deliberately absent, and that is what the disable
    // below is for: it is a plain function, so it is a new identity on every
    // render, and listing it would reassign all 11 materials every render. It
    // closes over exactly the values already listed here.
    // ⚠️ `glassHull` belongs here for the same reason as `xrayOn`, and leaving it
    // out is a bug that hides itself. `materialFor` keys the hull material on the
    // flag, so a fresh material exists the moment it flips — but nothing reassigns
    // it to the mesh unless this effect re-runs. The symptom was the toggle doing
    // nothing on the atlas already loaded while appearing to work perfectly on the
    // next atlas switched to, because a remount rebuilds materials anyway.
    //
    // ⚠️ `maskOn` belongs here for exactly the same reason as `xrayOn` and
    // `glassHull`: it is a SHADER VARIANT. `materialFor` mints a new material the
    // moment it flips, but nothing hands that material to a mesh unless this
    // effect re-runs — so switching an inspect mode on would do nothing on the
    // atlas already loaded and appear to work perfectly on the next one switched
    // to, because a remount rebuilds materials anyway. That is the bug this file
    // has now documented three times.
    //
    // The mask CONTENTS are deliberately absent, and belong in the effect that
    // writes the texture instead: rewriting bytes must not reassign materials.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    entries,
    visible,
    colourMode,
    hullOpacity,
    selectedSystem,
    selectedLayer,
    byId,
    xrayOn,
    glassHull,
    maskOn,
    // ⚠️ NEWLY LOAD-BEARING. `perStructureExplode` used to change only when
    // `entries` did, so listing `entries` covered it. Deferring the precompute
    // broke that: the flag now flips on an idle callback with `entries`
    // unchanged, so without this the materials compiled before the attribute
    // existed would never be replaced and the explode slider would be
    // permanently dead on the first atlas loaded — working perfectly on the next
    // one switched to, which is the exact signature this file documents twice.
    perStructureExplode,
  ])

  const byMesh = useMemo(() => {
    const m = new Map<Mesh, (typeof entries)[number]>()
    for (const e of entries) m.set(e.mesh, e)
    return m
  }, [entries])


  /**
   * Index ranges per structure, derived rather than shipped.
   *
   * The build could record `[firstIndex, indexCount]` while merging, and the
   * first version did — but `gltf-transform optimize --simplify` rewrites the
   * index buffer afterwards, so those numbers are stale in the shipped asset and
   * would highlight the wrong geometry with no error. Scanning the id attribute
   * here cannot go stale, because it is the geometry.
   *
   * One pass over the index buffer per mesh, on first selection only.
   *
   * Contiguity is not ASSUMED, but measurement says it holds: on the shipped
   * Z-Anatomy atlas all 2,077 structures survive simplification as a single run,
   * so the worst over-selection is 1.0x — the highlight draws exactly the
   * structure and nothing else. Should that ever stop being true, a structure
   * spanning several runs gets the full span from its first to its last
   * triangle, which over-draws rather than silently drawing only part of itself,
   * and `spans` records the run count so the degradation is measurable instead
   * of invisible.
   */
  const rangesRef = useRef(new Map<Mesh, Map<number, { start: number; count: number; spans: number }>>())
  useEffect(() => {
    rangesRef.current.clear()
  }, [entries])

  const rangesFor = (mesh: Mesh) => {
    const cached = rangesRef.current.get(mesh)
    if (cached) return cached
    const out = new Map<number, { start: number; count: number; spans: number }>()
    const attr = mesh.geometry.getAttribute('_structure')
    const index = mesh.geometry.getIndex()
    if (attr && index) {
      let prev = -1
      for (let t = 0; t < index.count; t += 3) {
        const id = attr.getX(index.getX(t))
        const hit = out.get(id)
        if (!hit) out.set(id, { start: t, count: 3, spans: 1 })
        else {
          hit.count = t + 3 - hit.start
          if (id !== prev) hit.spans++
        }
        prev = id
      }
    }
    rangesRef.current.set(mesh, out)
    return out
  }

  /** Name a structure the way the readout should show it. */
  const describe = (s: StructureEntry) => {
    const side = s.side ? ` (${s.side})` : ''
    // An attachment site is a footprint ON a bone, so saying only "Gracilis
    // muscle" while the pointer is over the tibia would be actively misleading.
    const what = s.attachment ? ` — ${s.attachment}` : ''
    return `${s.name}${what}${side}`
  }

  /**
   * The highlight for a selected structure.
   *
   * Drawn as a second mesh over the first, sharing the SAME `BufferAttribute`
   * objects — so it costs one draw call and no extra GPU memory, not a geometry
   * clone. It cannot simply set `drawRange` on the original geometry, because
   * that geometry is shared with the mesh actually rendering the whole group and
   * would truncate it.
   *
   * Parented to the highlighted mesh so it inherits every transform for free,
   * including the exploded-view offset. `polygonOffset` keeps it off the surface
   * it is coincident with instead of z-fighting against it.
   */
  /**
   * The MESH carrying the selection, which the store deliberately does not hold.
   *
   * The store publishes `{ sourceId, structureId, entry }` — facts about the
   * ANATOMY, which anything in the app can act on. It does not publish the
   * three.js `Mesh`, because a live scene object in global state outlives the
   * component that owns it: switching atlas disposes these meshes, and a store
   * still holding one would keep a disposed geometry alive and hand it to
   * whatever read the field next.
   *
   * So the mesh stays local and the store carries identity. This ref is the join
   * between them, and it is scoped to this component's own selection: the
   * effect below does nothing unless the published selection names THIS source.
   */
  const [selectedMesh, setSelectedMesh] = useState<{ mesh: Mesh; id: number } | null>(null)
  const selectedStructure = useTwin((s) => s.selectedStructure)
  const setSelectedStructure = useTwin((s) => s.setSelectedStructure)

  // A new atlas invalidates both halves. The store half is cleared only if it
  // still refers to THIS source — in `composed` the other atlas may legitimately
  // own the selection, and clearing it here would delete a live selection
  // whenever the sibling remounted.
  useEffect(() => {
    setSelectedMesh(null)
    if (useTwin.getState().selectedStructure?.sourceId === source.id) setSelectedStructure(null)
  }, [entries, source.id, setSelectedStructure])

  useEffect(() => {
    if (!selectedMesh) return
    // Ignore a selection published by the other atlas in `composed` mode.
    if (selectedStructure && selectedStructure.sourceId !== source.id) return
    const { mesh, id } = selectedMesh
    const r = rangesFor(mesh).get(id)
    if (!r) return

    const g = new BufferGeometry()
    const position = mesh.geometry.getAttribute('position')
    const index = mesh.geometry.getIndex()
    if (!position || !index) return
    g.setAttribute('position', position)
    g.setIndex(index)
    g.setDrawRange(r.start, r.count)

    const m = new MeshBasicMaterial({
      color: new Color('#5ad2a8'),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      side: DoubleSide,
    })
    const h = new Mesh(g, m)
    h.userData.__highlight = true
    h.renderOrder = 999
    // The highlight is decoration, so keep it out of hit-testing or it would
    // swallow the click that deselects it.
    h.raycast = () => {}
    mesh.add(h)

    return () => {
      mesh.remove(h)
      // Dispose the wrapper only. The attributes belong to the atlas geometry
      // and disposing them would blank the mesh underneath.
      g.dispose()
      m.dispose()
    }
  }, [selectedMesh, selectedStructure, source.id])

  /**
   * Which structure a raycast hit belongs to.
   *
   * `faceIndex` is the triangle, so step to its first corner through the index
   * buffer and read that vertex's id. Any corner does: a triangle cannot span
   * two structures, because the build keeps them topologically disconnected.
   */
  const structureAt = (mesh: Mesh, faceIndex: number | null | undefined): StructureEntry | null => {
    if (!structures || faceIndex == null) return null
    const attr = mesh.geometry.getAttribute('_structure')
    const index = mesh.geometry.getIndex()
    if (!attr || !index) return null
    const vertex = index.getX(faceIndex * 3)
    const id = attr.getX(vertex)
    // A hidden structure is collapsed in the VERTEX shader, so it is invisible but
    // still in the BVH — the raycast happily hits geometry nobody can see. Without
    // this, hovering an overlaid heart reports the static "Left ventricle" that was
    // masked out, which is worse than reporting nothing.
    if (hiddenIds?.has(id)) return null
    return structures[id] ?? null
  }

  return (
    <group position={fit.offset} scale={fit.scale}>
      <primitive
        object={scene}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          const hit = e.object instanceof Mesh ? byMesh.get(e.object) : undefined
          // ⚠️ Gate on "is this one of OUR meshes", NOT on "does it resolve to a
          // SystemId". Those came apart once unresolved geometry became a
          // deliberate category rather than a mapping failure: the lymphoid
          // organs and the whole body-regions atlas carry no SystemId on
          // purpose, and requiring one made 257 named surface regions
          // silently unhoverable — the one thing that atlas exists to do.
          if (!hit) return
          e.stopPropagation()
          // Prefer the structure under the pointer over the group it was merged
          // into: "Biceps brachii (left)" rather than "musculoskeletal / muscle".
          const s = structureAt(e.object as Mesh, e.faceIndex)
          setHoveredLabel(s ? describe(s) : (hit.label ?? null))
          setHoverCursor(true, hoverToken)
        }}
        onPointerOut={() => {
          setHoveredLabel(null)
          setHoverCursor(false, hoverToken)
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          const hit = e.object instanceof Mesh ? byMesh.get(e.object) : undefined
          // As above: unresolved geometry is still selectable. The per-structure
          // highlight works off `_STRUCTURE`, which every atlas carries; only the
          // system-level highlight needs a SystemId, and `selectSystem(null)`
          // simply clears it.
          if (!hit) return
          e.stopPropagation()
          const mesh = e.object as Mesh
          const attr = mesh.geometry.getAttribute('_structure')
          const index = mesh.geometry.getIndex()
          const id =
            structures && attr && index && e.faceIndex != null
              ? attr.getX(index.getX(e.faceIndex * 3))
              : null
          // Clicking the same structure again clears it; clicking a different
          // one moves the highlight rather than needing a deselect first.
          const same = id != null && selectedMesh?.mesh === mesh && selectedMesh?.id === id
          const next = same || id == null ? null : { mesh, id }
          setSelectedMesh(next)
          // Publish the ANATOMY half. `structures[id]` can legitimately be
          // absent — an atlas may carry the attribute without a table row for
          // every id — and in that case there is nothing to anchor a label to,
          // so nothing is published rather than a half-empty entry.
          const entry = next && structures ? (structures[next.id] ?? null) : null
          setSelectedStructure(
            entry ? { sourceId: source.id, structureId: next!.id, entry } : null,
          )
          // Carry the LAYER through, so clicking a bone selects the skeleton
          // rather than the whole musculoskeletal system. Clicking the same
          // system+layer again clears, as before.
          const sameSel = selectedSystem === hit.systemId && selectedLayer === (hit.layer ?? null)
          selectSystem(
            same || sameSel ? null : hit.systemId,
            (hit.layer ?? null) as AnatomyLayer | null,
          )
          // `hit.systemId` may be null here — that is fine and means "no system
          // highlight", not "ignore the click".
        }}
      />
    </group>
  )
}

/**
 * Probe whether an atlas asset is actually present, so a missing GLB degrades to
 * the procedural body instead of throwing inside Suspense. Assets are optional
 * by design: the app must run with zero binary files.
 */
export function useAtlasAvailability(urls: string[]): Record<string, boolean> | null {
  const [state, setState] = useState<Record<string, boolean> | null>(null)
  // Re-probe whenever the viewer picks a different atlas. See `run` below.
  const mode = useTwin((s) => s.anatomyMode)
  const key = urls.join('|')
  const known = useRef<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false

    const probe = async (u: string) => {
      try {
        const res = await fetch(u, { method: 'HEAD', cache: 'no-store' })
        // A dev server that rewrites unknown paths to index.html would 200 on
        // a missing GLB, so check the content type too.
        const type = res.headers.get('content-type') ?? ''
        return res.ok && !type.includes('text/html')
      } catch {
        return false
      }
    }

    /**
     * Retry before concluding an atlas is missing, and never cache a MISS.
     *
     * A `fetch` that is aborted rather than answered is not evidence of absence:
     * it happens on a slow first paint, on a transient blip, when a rebuild
     * replaces a GLB mid-probe, and constantly in an automated browser that
     * suspends a backgrounded tab. Three attempts absorb most of that.
     *
     * ⚠️ But three attempts inside one second is not enough on its own, and the
     * original version cached whatever it concluded for the LIFETIME OF THE PAGE
     * — the effect was keyed on the url list, which never changes. One unlucky
     * moment and the app showed "no atlas installed" until someone reloaded,
     * with switching atlas unable to recover it. That was not hypothetical: an
     * AO bake replacing `z-anatomy.ao.glb` triggered exactly this twice in one
     * session, and the file was demonstrably being served fine the whole time.
     *
     * So a HIT is remembered and a MISS never is: switching atlas re-probes
     * anything not yet found. A present file answers immediately, so this costs
     * one HEAD request per switch in the normal case, and it makes the failure
     * self-healing instead of sticky.
     */
    const run = async () => {
      let pending = urls.filter((u) => !known.current[u])
      if (!pending.length) {
        setState({ ...known.current })
        return
      }
      for (let attempt = 0; attempt < 3 && pending.length && !cancelled; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 300 * attempt))
        const results = await Promise.all(pending.map(probe))
        const stillMissing: string[] = []
        pending.forEach((u, i) => (results[i] ? (known.current[u] = true) : stillMissing.push(u)))
        pending = stillMissing
      }
      if (cancelled) return
      // Misses are reported so the UI can say "not installed", but deliberately
      // NOT written to `known`, so the next switch tries again.
      const out: Record<string, boolean> = { ...known.current }
      for (const u of urls) out[u] = out[u] ?? false
      setState(out)
    }
    void run()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, mode])

  return state
}
