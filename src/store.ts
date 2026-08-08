import { create } from 'zustand'
import type { TwinMetrics, SystemId } from './data/schema'
import { resolveMode, type AnatomyMode, type Sex } from './scene/anatomySources'
import { BPM_RANGE, DEFAULT_BPM, type OrganOverlayId } from './scene/organOverlays'

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
   * answers. A publishable build may legitimately omit one — the beating heart is
   * `publishable: false` — so the toggle has to know rather than 404 in the Canvas.
   */
  overlayAvailability: Record<string, boolean> | null
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
   * How structures are coloured. `anatomical` is the atlas look — red muscle,
   * ivory bone — with the metric carried by emissive lift instead of hue.
   * `metrics` is the red/amber/green score scale. They cannot be combined
   * without one lying, so the viewer picks. See `anatomyPalette.ts`.
   */
  colourMode: 'anatomical' | 'metrics'
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
  setColourMode: (m: 'anatomical' | 'metrics') => void
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
  colourMode: 'anatomical',
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
  setColourMode: (colourMode) => set({ colourMode }),
  setFocusY: (focusY, focusDistance = null) => set({ focusY, focusDistance }),
}))

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
