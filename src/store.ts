import { create } from 'zustand'
import type { TwinMetrics, SystemId } from './data/schema'
/**
 * From the LEAF module, deliberately, not from `AtlasBody` where these types
 * used to live. `AtlasBody` imports this store, so taking them from the
 * component would close a cycle — safe while it stayed `import type`, and a real
 * one the moment anybody needed a value from it. `structureEntry.ts` imports
 * nothing, so there is no cycle to reason about at all.
 */
import type { AtlasComponent, StructureEntry } from './scene/structureEntry'
import { activeSources, resolveMode, type AnatomyMode, type Sex } from './scene/anatomySources'
import { BPM_RANGE, DEFAULT_BPM, type OrganOverlayId } from './scene/organOverlays'
import type { BodyEnvelopeId } from './scene/bodyEnvelopes'
import { ANNY_NEUTRAL, type AnnyParams } from './scene/annyGrid'
import { POSE_NEUTRAL, type PoseParams, type PoseSlider } from './scene/annyRig'
import type { BodyMeasurements } from './scene/annyGrid'

/** Depth layers an atlas can declare, outermost first. */
export const ANATOMY_LAYERS = ['organ', 'connective', 'muscle', 'bone'] as const
export type AnatomyLayer = (typeof ANATOMY_LAYERS)[number]

interface TwinState {
  data: TwinMetrics | null
  /** Currently selected/highlighted body system, or null. */
  selectedSystem: SystemId | null
  /**
   * Narrows the selection to ONE LAYER of the selected system. Null selects the
   * whole system, which is the behaviour everything had before this existed.
   *
   * Musculoskeletal is why. It is a single `SystemId` carrying bone, muscle and
   * connective tissue, so selecting it highlighted the skeleton and the
   * musculature together and there was no way to ask for just one — on Z-Anatomy
   * that is 1,477 bones lighting up with 347 muscles. Health-wise they really are
   * one system and the score belongs to the system, so splitting `SystemId` would
   * have been wrong (and would have drifted a contract D8 owns upstream).
   * Selection is a VIEWING concern, so the split belongs here instead.
   */
  selectedLayer: AnatomyLayer | null
  /**
   * Which layers each system actually has in the loaded atlas, e.g.
   * `{ musculoskeletal: ['bone', 'muscle', 'connective'] }`.
   *
   * Published by `AtlasBody` because only the loaded asset knows: BodyParts3D and
   * Z-Anatomy split musculoskeletal three ways, HRA does not declare layers at
   * all. The sidebar uses it to decide which systems get separable sub-rows, so
   * an atlas without layers simply shows none rather than showing controls that
   * do nothing.
   */
  presentLayers: Partial<Record<SystemId, AnatomyLayer[]>>
  /**
   * Which systems each MOUNTED atlas has geometry for, keyed by source id.
   *
   * Distinct from `presentLayers`, which only lists systems worth splitting into
   * sub-rows and so omits every single-mesh system — including the skin, which is
   * one mesh. Published by `AtlasBody` from the asset it actually loaded, so it
   * cannot go stale the way a hand-kept per-atlas table would (the coverage figures
   * in `anatomySources.ts` are a doc comment, not data).
   *
   * ⚠️ Keyed by SOURCE, not a single flat list, because `composed` mounts one
   * `AtlasBody` per atlas and each publishes independently. A flat list would be
   * overwritten by whichever mounted last — so on the default composed view the skin
   * from one atlas would vanish the moment the other finished loading. Entries are
   * removed on unmount, so switching atlas cannot leave a stale claim behind.
   */
  presentSystemsBySource: Partial<Record<string, SystemId[]>>
  /** 0..1 position along the journey timeline (for future scrubbing). */
  journeyT: number
  /**
   * Which organ overlays are switched on. See `scene/organOverlays.ts`.
   *
   * Keyed rather than a single boolean because more organs are coming, and a
   * `Partial` record means adding one needs no migration here: absent is off.
   */
  overlays: Partial<Record<OrganOverlayId, boolean>>
  /**
   * Heart rate in beats per minute, driving the beating heart's playback.
   *
   * ⚠️ THIS IS A PLAYBACK CONTROL, NOT A MEASUREMENT. The asset carries 25
   * measured cardiac phases and no timing at all, so the rate is ours. Scaling the
   * whole cycle uniformly is also an approximation: in a real heart, rising rate
   * shortens diastole far more than systole, so at 180 bpm this shows the right
   * shape at the wrong phase ratio. Fine for a viewer, wrong for a claim.
   *
   * It lives in the store rather than in the component because it is the seam
   * where real data will arrive — a wearable's resting or training series, or a
   * recorded session played back — and that will set this value rather than
   * reaching into the scene.
   */
  heartRateBpm: number
  /**
   * Which anatomy atlas provides geometry. **Defaults to `bodyparts3d`.**
   *
   * ⚠️ THE DEFAULT IS A PRESENTATION CHOICE, AND IT IS NOT THE BEST ATLAS.
   * `composed` is richer and remains the recommendation once someone is exploring —
   * see below. BodyParts3D is the landing state because the first screen has a
   * different job from the tenth: it has to look like something in a few seconds on
   * a link someone was sent, and `composed` cannot do that. It downloads BOTH
   * atlases in full before it settles, which on the machines this was measured on is
   * long enough that the procedural placeholder is what a visitor actually sees.
   *
   * BodyParts3D also happens to be the atlas the glass hull reads best on: its skin
   * hugs the anatomy, where HRA's envelope is looser and the same Fresnel term is
   * markedly softer. The landing state leans on that.
   *
   * WHAT `composed` IS STILL FOR, because this used to be the default and the
   * reasoning did not stop being true:
   *
   * It routes musculoskeletal, nervous, cardiovascular, endocrine and reproductive
   * to Z-Anatomy and the rest to BodyParts3D, and **those two are the same donor** —
   * TARO, retopologised — in the same pose, with skeletons `anatomySources.ts`
   * measures agreeing to 0.7 %. So the old objection to mixing atlases (arms and
   * legs at visibly different angles) never applied to this pair; it applied to
   * mixing in HRA, a genuinely different person, and HRA supplies nothing there.
   *
   * What `composed` buys is structure identity where it matters. Only Z-Anatomy
   * carries `_STRUCTURE`, so only through Z-Anatomy can hover name an individual
   * muscle, selection highlight one structure, or an organ overlay mask the static
   * organ it replaces. On BodyParts3D all of that degrades to the merged group —
   * which is the real cost of this default, and the reason the pill is one click away.
   *
   * ⚠️ The bandwidth numbers, which are why it is not the landing state. Measured:
   * composed draws **3,252,349** triangles (2,913,849 from Z-Anatomy, 338,500 from
   * BodyParts3D) against 2,613,655 for BodyParts3D alone — only +24 % drawn. But it
   * downloads **both atlases in full, 5,808,472 triangles**, so 2.56 M are fetched
   * and never drawn. That waste is a known item in `docs/ROADMAP.md`. Moving the
   * default off `composed` lowers how often it is paid; it does not fix it.
   */
  anatomyMode: AnatomyMode
  /**
   * Which donor sex to render, where the atlas offers a choice.
   *
   * A property of the geometry, not of any person using this. It defaults to
   * female because the default HRA build is the Visible Human Female; atlases
   * with a single donor ignore it (see `resolveMode`).
   */
  sex: Sex
  atlasAvailability: Record<string, boolean> | null
  /**
   * Which organ-overlay assets the server actually has, or null before the probe
   * answers. A publishable build may legitimately omit one — the beating heart
   * was `publishable: false` until its provenance resolved (D21), and the next
   * unresolved asset will be withheld the same way — so the toggle has to know
   * rather than 404 in the Canvas.
   */
  overlayAvailability: Record<string, boolean> | null
  /**
   * Whether the parametric shape grid's three files are on disk.
   *
   * Separate from `atlasAvailability` because the parametric mode declares no
   * atlas sources at all — that is what let it ship as the one mode which could
   * never report itself missing. See `Body.tsx`.
   */
  gridAvailability: Record<string, boolean> | null
  /**
   * Exploded view, 0..1. Pushes each structure group radially away from the body
   * centre so the systems separate. 0 is the assembled body.
   */
  explode: number
  /**
   * Slow turntable. Rotates the CAMERA about the focus target rather than the
   * body, so structures keep their world positions and the exploded view, the
   * highlight and any XR ray keep pointing at the same geometry.
   *
   * **On by default**, as part of the landing state: a still body on a dark page
   * reads as an image, and a turning one reads as something you can look around.
   * Any drag of the orbit control is the obvious way to stop caring about it, and
   * the pill in the dock stops it outright.
   *
   * ⚠️ EXCEPT under `prefers-reduced-motion`, where it starts OFF. This is the
   * only continuous unprompted motion in the app, and continuous rotation is
   * squarely what that preference is about — for a vestibular disorder it is a
   * symptom trigger, not a taste. It is a DEFAULT rather than a lock: the pill
   * still works, because someone who asked the system for less motion may still
   * want to turn a body around, and removing the control would answer a request
   * they did not make. The CSS half of this lives in `styles.css`.
   */
  spin: boolean
  /**
   * UI theme. A control, not an OS preference: someone comparing tissue colour
   * wants to choose the background they judge it against.
   *
   * **Defaults to dark**, which is a presentation choice and not a claim that dark
   * is better for judging tissue — it is not. Light is the honest background for
   * comparing a rendered colour against a photograph, which is why the control
   * exists at all. But the landing state is the one place where looking good
   * outranks measuring well, and the glass hull is a lit rim: it needs something
   * dark to be a rim against.
   */
  theme: 'light' | 'dark'

  /**
   * Systems the viewer has switched off.
   *
   * ⚠️ **Musculoskeletal starts hidden**, which is the one part of the landing state
   * that hides anatomy rather than merely restyling it. At 80 % hull the skeleton and
   * musculature crowd the space between the skin and the viscera, and the opening
   * image is the vascular tree and the organs inside a translucent body. One click on
   * the sidebar row brings it back, and the panel says "show all" while anything is
   * hidden, so the state is visible rather than silent.
   *
   * It is worth knowing this is a default and not a property of the atlas: someone
   * who assumes BodyParts3D ships no bones would be wrong.
   */
  hiddenSystems: SystemId[]
  /** Depth layers the viewer has switched off, e.g. hide all muscle. */
  hiddenLayers: AnatomyLayer[]
  /**
   * Opacity of the outer body hull (skin), 0..1.
   *
   * **Defaults to 0.8**, high, which only works because `glassHull` is on with it.
   * The two are a pair: the Fresnel term takes the hull clear where it faces the
   * camera regardless of this number, so 0.8 buys a present, material-looking skin
   * at the silhouette without the veil over the viscera that 0.8 alone would give.
   * Turn the glass off and leave this at 0.8 and the body becomes a mannequin —
   * that is the correct behaviour, not a bug, and it is what the slider is for.
   *
   * It used to default to 0.1 for the opposite reason: with no view-dependent term,
   * near-transparent was the only setting where the anatomy inside read at all.
   */
  hullOpacity: number
  /**
   * X-ray view, 0..1. Fades each surface where it FACES the camera while leaving
   * its grazing angles solid, so you see into an organ without losing its
   * silhouette. 0 is fully solid.
   *
   * This exists because making the anatomy opaque (D13) fixed the speckle and
   * threw away something that mattered: the old dither was accidentally acting
   * as a see-through, and with it went the internal structure of the breast and
   * the bowel. Opaque organs are honest but they are blobs.
   */
  xray: number
  /**
   * Fresnel rim on the body hull. The skin goes clear where it faces you and
   * bright where it turns away, so the body reads as glass around solid anatomy.
   *
   * This is the counterpart to `xray`, aimed at the one surface x-ray skips.
   * X-ray is scoped to organs because the hull is not something you want to see
   * INTO; it is the thing in the way. But the hull is where a view-dependent
   * profile pays best, because a flat `hullOpacity` has to choose one number for
   * every angle at once and both ends of that choice are bad: low enough to see
   * the anatomy means the silhouette disappears, and high enough to state the
   * silhouette means the anatomy is veiled. On the dark theme the low end is
   * actively harmful — the grey hull swallows the body's own outline.
   *
   * ⚠️ Two of the seven atlases have NO skin mesh (Z-Anatomy and both CT
   * atlases), so this does nothing at all there. That is a property of the
   * source data, not a bug: see `docs/DECISIONS.md` D14.
   *
   * **On by default**, paired with a high `hullOpacity` — see that field, the two
   * only make sense together. It was off when introduced, on the grounds that the
   * flat hull was what every screenshot in the repository showed; those screenshots
   * have since been regenerated from this state, so that reason has expired.
   */
  glassHull: boolean
  /**
   * Ground rings, a floor pool and a backdrop falloff behind the body.
   *
   * Presentation only — it adds no anatomy, states no measurement, and is
   * deliberately unlabelled and unevenly spaced so the rings cannot be read as
   * a scale. Off by default, and hidden automatically in XR passthrough, where a
   * fake floor competing with the real one is worse than no floor.
   */
  stage: boolean
  /**
   * Use physically-based `transmission` for translucency instead of the
   * `alphaHash` dither. Smooth, at the cost of a full-screen render pass.
   *
   * Off by default and deliberately so: transmission is a separate pass per
   * frame, which matters on a headset, and it reads glassy rather than fleshy.
   * Offered as a choice because the dither's grain and transmission's cost are
   * different prices and only the viewer can say which they would rather pay.
   */
  smoothTransparency: boolean
  /** Label of the structure under the pointer, for the readout. */
  hoveredLabel: string | null
  /**
   * The individual structure the viewer last clicked, or null.
   *
   * ⚠️ THIS WAS COMPONENT-LOCAL `useState` INSIDE `AtlasBody`, and lifting it is
   * what makes structure-level work possible outside that file at all. Nothing
   * mounted in `Body.tsx` — an anchored label, an overlay, anything sitting in
   * the canonical frame as a SIBLING of the atlas — could see which structure
   * was selected, because the only copy of that fact lived inside the component
   * rendering the atlas.
   *
   * `entry` carries the structure's centroid in canonical metres, which is why
   * an anchor needs no per-atlas offset table: `AtlasBody` scales each atlas
   * into the canonical frame inside its own group, so a centroid from the table
   * is already in the frame anything else mounts into.
   *
   * ⚠️ Keyed by `sourceId` as well as `structureId` because `composed` mounts one
   * `AtlasBody` per atlas and the ids are per-asset — structure 412 means one
   * thing in Z-Anatomy and something else entirely in BodyParts3D. Without the
   * source, clicking in one atlas would highlight a stranger in the other.
   *
   * `structureId` is the raw `_STRUCTURE` value, so a consumer can index the
   * table itself; `entry` is the resolved row, so most consumers need not.
   */
  selectedStructure: {
    sourceId: string
    structureId: number
    entry: StructureEntry
  } | null
  /**
   * Third-party components embedded in the mounted atlases, keyed by component
   * id, so a structure's `component` can be resolved to a holder and a licence.
   *
   * ⚠️ This is licence machinery, not a convenience. Z-Anatomy's own licence is
   * CC BY-SA 4.0, but eight of its structures come from components that are
   * NON-COMMERCIAL — a stricter obligation that the atlas-level credit in
   * `AttributionBar` cannot express, because it applies to eight structures and
   * not to the other 3,606. Published per structure so the answer is given at
   * the granularity the condition actually has.
   *
   * Flat rather than keyed by source: component ids are already distinct
   * (`inner-ear-dundee`, `kidney-lissiecowley`) and `composed` mounts two
   * atlases that may legitimately share one.
   */
  atlasComponents: Record<string, AtlasComponent>
  /**
   * Which source contributed which components — the bookkeeping behind
   * `atlasComponents`, kept so an unmount can withdraw exactly one atlas's
   * entries instead of clearing the flat map and losing the other's.
   *
   * Underscored because nothing outside `setAtlasComponents` should read it.
   */
  _componentsBySource: Record<string, AtlasComponent[]>
  /**
   * How structures are coloured. `anatomical` is the atlas look — red muscle,
   * ivory bone — with the metric carried by emissive lift instead of hue.
   * `metrics` is the red/amber/green score scale. They cannot be combined
   * without one lying, so the viewer picks. See `anatomyPalette.ts`.
   */
  colourMode: 'anatomical' | 'metrics'
  /**
   * Tint individual structures by a fact the ASSET carries. Off by default.
   *
   * This is the per-structure tinting capability, and what it is pointed at is
   * deliberately chosen to stay on the rendering side of D8's line: both modes
   * colour by something the GLB literally contains, and neither interprets
   * anything. Nothing here says a structure is good, bad, healthy or at risk.
   *
   *   `ontology` — which structures carry an ontology term and which do not.
   *     The repository's current milestone is structure identity, and until now
   *     the only way to see coverage was a table in `docs/ONTOLOGY_MAP.md`. On
   *     Z-Anatomy that is 1,048 of 3,614, and seeing WHICH 1,048 — the skeleton
   *     is largely mapped, the muscle attachments are not — is a different and
   *     more useful fact than the percentage.
   *
   *   `licence` — which structures come from a third-party component under
   *     terms stricter than the atlas's own. Eight of Z-Anatomy's structures are
   *     non-commercial, and "where exactly are they" is a question the credits
   *     panel cannot answer because it is a property of geometry, not of text.
   *
   * ⚠️ Only atlases carrying `_STRUCTURE` can honour this — Z-Anatomy and the
   * regions atlas today, plus BodyParts3D once its asset is rebuilt from the
   * current pipeline. The dock disables the control elsewhere rather than
   * offering a toggle that does nothing, which is the same rule the glass hull
   * already applies to an atlas with no skin.
   */
  structureInspect: 'none' | 'ontology' | 'licence'
  /**
   * How many structures each mounted atlas can address individually, keyed by
   * source id. Zero, or absent, means the asset carries no structure table.
   *
   * Published from the loaded asset rather than declared in `anatomySources.ts`,
   * because a hand-kept table would be wrong right now: `build-bodyparts3d.mjs`
   * writes a structure table today, and the shipped BodyParts3D asset predates
   * it, so the same source id answers differently depending on when its GLB was
   * built. Only the file knows.
   */
  structureCounts: Record<string, number>
  /**
   * Show a floating label at the selected structure, in the 3D scene.
   *
   * On by default: it names what you just clicked, at the thing you clicked,
   * which is the question a click is asking. It costs one draw call and appears
   * only while something is selected, so the idle scene is unchanged.
   *
   * ⚠️ It can only anchor on atlases carrying a structure table, because the
   * anchor IS `StructureEntry.centroid`. See `scene/StructureLabel.tsx`.
   */
  structureLabel: boolean
  /**
   * Which parametric body envelope is drawn around the anatomy, or null.
   *
   * ⚠️ AN ENVELOPE IS A GENERATED SURFACE, NOT ANATOMY AND NOT A DONOR. Off by
   * default, because the subject of this viewer is real anatomy from registered
   * sources and a synthetic skin is something a viewer opts into — the same rule
   * organ overlays follow, and for a stronger reason: an overlay is somebody's
   * measured organ, where this is nobody's body at all.
   *
   * It exists because D14 measured that three of the seven sources ship no skin,
   * so the glass hull is unavailable on exactly the atlases with the best
   * anatomy. See `scene/bodyEnvelopes.ts`.
   */
  bodyEnvelope: BodyEnvelopeId | null
  /**
   * Which envelope assets the server actually has, or null before the probe
   * answers. Same contract as `overlayAvailability`: a build may legitimately
   * ship none of them, and the toggle has to know rather than 404 in the Canvas.
   */
  envelopeAvailability: Record<string, boolean> | null
  /**
   * Where the parametric body sits in ANNY's phenotype space.
   *
   * ⚠️ SIX NUMBERS, AND EVERY ONE DESCRIBES A SHAPE RATHER THAN A PERSON. The
   * shape space is MakeHuman artist priors, not anthropometric ground truth, so
   * no measurement, body-composition or health claim attaches to any position in
   * it — see `annyGrid.ts` and the caption in `ParametricPanel`.
   *
   * `gender` runs male(0) to female(1) and `age` spans five stops with the adult
   * at 0.75; both were measured, and both are the opposite of what the source
   * notes claimed. `race`, `cupsize` and `firmness` are deliberately absent — see
   * `scripts/anny/bake_grid.py`.
   */
  annyParams: AnnyParams
  /**
   * Where the parametric body's limbs are, in degrees. All zero is ANNY's own
   * rest pose — the A-pose the grid was baked at.
   *
   * ⚠️ SEPARATE FROM `annyParams`, AND THAT SEPARATION IS LOAD-BEARING. Shape and
   * pose are different kinds of claim: shape is a point in a phenotype space the
   * grid samples, pose is a rotation applied afterwards. `bodyMeasurements` is
   * taken on the shape BEFORE this is applied, because the height of a body with
   * bent knees is not a stature and linear blend skinning perturbs volume. Mixing
   * the two into one object would make that distinction easy to lose.
   */
  annyPose: PoseParams
  /**
   * Geometry read off the evaluated body, published so the panel can show it
   * without re-deriving it. Null until the grid has been evaluated once.
   *
   * ⚠️ `massKg` and `bmi` are NOT measured — they follow from volume under one
   * assumed uniform density, which the panel states beside them. Height, waist
   * and volume come off the mesh.
   */
  bodyMeasurements: BodyMeasurements | null
  /**
   * Height in metres the camera orbits around, 0 at the feet to ~1.75 at the
   * crown. The orbit target used to be pinned to the chest, which made the head
   * and feet unreachable at any zoom.
   */
  focusY: number
  /** Camera distance a preset asked for; null after a free zoom. */
  focusDistance: number | null

  setData: (d: TwinMetrics) => void
  /**
   * Select a system, optionally narrowed to one of its layers.
   *
   * `layer` omitted or null means the whole system, so every existing call site
   * keeps its behaviour.
   */
  selectSystem: (id: SystemId | null, layer?: AnatomyLayer | null) => void
  setPresentLayers: (p: Partial<Record<SystemId, AnatomyLayer[]>>) => void
  /** Pass null to withdraw a source's entry, which unmount does. */
  setPresentSystemsFor: (sourceId: string, systems: SystemId[] | null) => void
  setJourneyT: (t: number) => void
  /** Toggle an overlay, or force it with the second argument. */
  toggleOverlay: (id: OrganOverlayId, on?: boolean) => void
  setHeartRateBpm: (bpm: number) => void
  setAnatomyMode: (m: AnatomyMode) => void
  setSex: (s: Sex) => void
  setExplode: (v: number) => void
  setSpin: (v: boolean) => void
  setTheme: (t: 'light' | 'dark') => void
  setAtlasAvailability: (a: Record<string, boolean> | null) => void
  setGridAvailability: (a: Record<string, boolean> | null) => void
  setOverlayAvailability: (a: Record<string, boolean> | null) => void
  toggleSystem: (id: SystemId) => void
  toggleLayer: (l: AnatomyLayer) => void
  /** Show or hide several layers at once, as one decision. */
  setLayersVisible: (layers: AnatomyLayer[], visible: boolean) => void
  setAllSystems: (visible: boolean, all: SystemId[]) => void
  setHullOpacity: (o: number) => void
  setXray: (v: number) => void
  setGlassHull: (v: boolean) => void
  setStage: (v: boolean) => void
  setSmoothTransparency: (v: boolean) => void
  setHoveredLabel: (l: string | null) => void
  setSelectedStructure: (s: TwinState['selectedStructure']) => void
  /** Pass null to withdraw a source's components, which unmount does. */
  setAtlasComponents: (sourceId: string, components: AtlasComponent[] | null) => void
  setColourMode: (m: 'anatomical' | 'metrics') => void
  setStructureInspect: (m: TwinState['structureInspect']) => void
  /** Pass null to withdraw a source's count, which unmount does. */
  setStructureCount: (sourceId: string, count: number | null) => void
  setStructureLabel: (v: boolean) => void
  /** Pass null to remove the envelope, which is the default state. */
  setBodyEnvelope: (id: BodyEnvelopeId | null) => void
  setEnvelopeAvailability: (a: Record<string, boolean> | null) => void
  setAnnyParam: (axis: keyof AnnyParams, value: number) => void
  resetAnnyParams: () => void
  setAnnyPose: (slider: PoseSlider, deg: number) => void
  resetAnnyPose: () => void
  setBodyMeasurements: (m: BodyMeasurements | null) => void
  setFocusY: (y: number, distance?: number | null) => void
}

/**
 * Whether the system has asked for reduced motion.
 *
 * Read once, at store creation, rather than subscribed to. A viewer who changes
 * the OS setting mid-session is not a case worth the subscription: this only
 * chooses an INITIAL value for `spin`, and once they have touched the pill any
 * live update would fight their choice. Guarded for `matchMedia` because jsdom
 * and older Safari do not define it.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export const useTwin = create<TwinState>((set) => ({
  data: null,
  selectedSystem: null,
  selectedLayer: null,
  presentLayers: {},
  presentSystemsBySource: {},
  journeyT: 1,
  // Off by default. An overlay is a second person's organ inside the body, so it
  // is something a viewer opts into rather than something they have to notice.
  overlays: {},
  heartRateBpm: DEFAULT_BPM,
  anatomyMode: 'bodyparts3d',
  sex: 'female',
  atlasAvailability: null,
  overlayAvailability: null,
  gridAvailability: null,
  explode: 0,
  spin: !prefersReducedMotion(),
  theme: 'dark',
  hiddenSystems: ['musculoskeletal'],
  hiddenLayers: [],
  hullOpacity: 0.8,
  xray: 0,
  glassHull: true,
  stage: false,
  smoothTransparency: false,
  hoveredLabel: null,
  selectedStructure: null,
  atlasComponents: {},
  _componentsBySource: {},
  colourMode: 'anatomical',
  structureInspect: 'none',
  structureCounts: {},
  structureLabel: true,
  bodyEnvelope: null,
  envelopeAvailability: null,
  annyParams: { ...ANNY_NEUTRAL },
  annyPose: { ...POSE_NEUTRAL },
  bodyMeasurements: null,
  focusY: 0.95,
  focusDistance: null,

  setData: (data) => set({ data }),
  selectSystem: (selectedSystem, selectedLayer = null) =>
    set({ selectedSystem, selectedLayer: selectedSystem === null ? null : selectedLayer }),
  setPresentLayers: (presentLayers) => set({ presentLayers }),
  setPresentSystemsFor: (sourceId, systems) =>
    set((st) => {
      const next = { ...st.presentSystemsBySource }
      if (systems === null) delete next[sourceId]
      else next[sourceId] = systems
      return { presentSystemsBySource: next }
    }),
  setJourneyT: (journeyT) => set({ journeyT }),
  toggleOverlay: (id, on) =>
    set((s) => ({ overlays: { ...s.overlays, [id]: on ?? !s.overlays[id] } })),
  // Clamped here rather than in the control, so a value arriving from recorded
  // wearable data later cannot drive the animation to a standstill or a blur.
  setHeartRateBpm: (bpm) =>
    set({ heartRateBpm: Math.min(BPM_RANGE.max, Math.max(BPM_RANGE.min, Math.round(bpm))) }),
  setAnatomyMode: (anatomyMode) => set({ anatomyMode }),
  setSex: (sex) => set({ sex }),
  setExplode: (explode) => set({ explode }),
  setSpin: (spin) => set({ spin }),
  setTheme: (theme) => set({ theme }),
  setAtlasAvailability: (atlasAvailability) => set({ atlasAvailability }),
  setOverlayAvailability: (overlayAvailability) => set({ overlayAvailability }),
  setGridAvailability: (gridAvailability) => set({ gridAvailability }),
  toggleSystem: (id) =>
    set((s) => ({
      hiddenSystems: s.hiddenSystems.includes(id)
        ? s.hiddenSystems.filter((x) => x !== id)
        : [...s.hiddenSystems, id],
    })),
  toggleLayer: (l) =>
    set((s) => ({
      hiddenLayers: s.hiddenLayers.includes(l)
        ? s.hiddenLayers.filter((x) => x !== l)
        : [...s.hiddenLayers, l],
    })),
  setLayersVisible: (layers, visible) =>
    set((s) => ({
      hiddenLayers: visible
        ? s.hiddenLayers.filter((l) => !layers.includes(l))
        : [...new Set([...s.hiddenLayers, ...layers])],
    })),
  setAllSystems: (visible, all) => set({ hiddenSystems: visible ? [] : [...all] }),
  setHullOpacity: (hullOpacity) => set({ hullOpacity }),
  setXray: (xray) => set({ xray }),
  setGlassHull: (glassHull) => set({ glassHull }),
  setStage: (stage) => set({ stage }),
  setSmoothTransparency: (smoothTransparency) => set({ smoothTransparency }),
  setHoveredLabel: (hoveredLabel) => set({ hoveredLabel }),
  setSelectedStructure: (selectedStructure) => set({ selectedStructure }),
  // Merged rather than replaced, because `composed` mounts two atlases and each
  // publishes independently — the second must not erase the first. Withdrawal
  // removes only the ids that source contributed, tracked by re-deriving from
  // what is left, so an unmount cannot strand a component that is still on screen.
  setAtlasComponents: (sourceId, components) =>
    set((st) => {
      const owned = { ...(st._componentsBySource ?? {}) }
      if (components === null) delete owned[sourceId]
      else owned[sourceId] = components
      const flat: Record<string, AtlasComponent> = {}
      for (const list of Object.values(owned)) for (const c of list) flat[c.id] = c
      return { _componentsBySource: owned, atlasComponents: flat }
    }),
  setColourMode: (colourMode) => set({ colourMode }),
  setStructureInspect: (structureInspect) => set({ structureInspect }),
  setBodyEnvelope: (bodyEnvelope) => set({ bodyEnvelope }),
  setEnvelopeAvailability: (envelopeAvailability) => set({ envelopeAvailability }),
  setAnnyParam: (axis, value) =>
    set((st) => ({ annyParams: { ...st.annyParams, [axis]: Math.min(1, Math.max(0, value)) } })),
  resetAnnyParams: () => set({ annyParams: { ...ANNY_NEUTRAL } }),
  setAnnyPose: (slider, deg) =>
    set((st) => ({ annyPose: { ...st.annyPose, [slider]: deg } })),
  resetAnnyPose: () => set({ annyPose: { ...POSE_NEUTRAL } }),
  setBodyMeasurements: (bodyMeasurements) => set({ bodyMeasurements }),
  setStructureLabel: (structureLabel) => set({ structureLabel }),
  setStructureCount: (sourceId, count) =>
    set((st) => {
      const next = { ...st.structureCounts }
      if (count === null) delete next[sourceId]
      else next[sourceId] = count
      return { structureCounts: next }
    }),
  setFocusY: (focusY, focusDistance = null) => set({ focusY, focusDistance }),
}))

/**
 * Dev-only handle on the store, for headless checks.
 *
 * The same reasoning as `window.__openTwin` in `scene/tuning.ts`, and for a
 * limitation this repository has already measured and written down: the
 * automated browser pane delivers NO pointer events to the canvas — synthetic
 * ones carry no `offsetX`/`offsetY`, which is what r3f reads, and injected ones
 * never arrive (`docs/ROADMAP.md`, phase 1, "Not verified: interactive hover").
 *
 * So anything gated behind clicking a structure cannot be checked in a browser
 * pane at all, and the selection-driven UI would ship on a typecheck and a
 * human's word. This makes the state reachable, so the RENDERING half can be
 * verified against real asset data even though the CLICK half cannot.
 *
 * `import.meta.env.DEV` is replaced with `false` at build time, so the whole
 * block drops out of a production bundle.
 */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __twinStore?: typeof useTwin }).__twinStore = useTwin
}

/**
 * The atlas mode with the sex choice already applied.
 *
 * Everything downstream — which GLB loads, which atlas covers which system,
 * which credits show — should read THIS rather than `anatomyMode`, so the sex
 * substitution happens once instead of being threaded through every resolver.
 * Atlases with a single donor come back unchanged; see `resolveMode`.
 */
export function useResolvedAnatomyMode(): AnatomyMode {
  const mode = useTwin((s) => s.anatomyMode)
  const sex = useTwin((s) => s.sex)
  return resolveMode(mode, sex)
}

/**
 * The sex of the donor actually on screen, or null where that has no single
 * answer.
 *
 * ⚠️ NOT the same thing as the `sex` store field, and the difference is the whole
 * point of this hook. `sex` is what the viewer ASKED FOR; this is what the loaded
 * atlas actually IS. They come apart routinely: Z-Anatomy and BodyParts3D are
 * male-only, so selecting "female" leaves `sex === 'female'` while a male body is
 * on screen — `AttributionBar` documents that exact trap for the composed-mode
 * pill. Anything reasoning about donor coherence has to read the atlas, not the
 * request.
 *
 * Returns null when `composed` genuinely mixes donors of different sexes, because
 * there is then no single donor to be coherent with. The app already warns about
 * that case separately, so callers should treat null as "no claim to make" rather
 * than as an error.
 */
export function useDonorSex(): Sex | null {
  const mode = useResolvedAnatomyMode()
  const sexes = new Set(activeSources(mode).map((s) => s.donor.sex))
  return sexes.size === 1 ? [...sexes][0] : null
}
