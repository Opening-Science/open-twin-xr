/**
 * Organ overlays: single organs that sit on top of whichever atlas is showing.
 *
 * WHY THESE ARE NOT `ANATOMY_SOURCES` ENTRIES
 * -------------------------------------------
 * An `AnatomySource` is a whole-body atlas — one donor, every system, fitted to
 * canonical height by `AtlasBody`. These are the opposite: one organ, its own
 * donor, and often something the atlases cannot express at all. The beating heart
 * is the first, because no atlas here has a time dimension.
 *
 * Keeping them in their own registry means the switcher stays a list of *bodies*
 * and an overlay can be toggled on top of any of them, including `composed`.
 *
 * ⚠️ EVERY OVERLAY IS A DIFFERENT PERSON FROM THE BODY IT SITS IN.
 * That is the honest cost of this feature and it must be stated in the UI, not
 * buried here. `anatomySources.ts` already carries the machinery for it —
 * `AnatomyDonor`, `donorsDisagree`, `soleDonor` — because switching atlas already
 * switched donor. An overlay makes the mismatch simultaneous rather than
 * sequential: a stranger's heart inside a stranger's chest.
 *
 * THE CANONICAL FRAME IS WHAT MAKES ONE PLACEMENT WORK FOR EVERY ATLAS.
 * `AtlasBody` renders each atlas inside `<group position={fit.offset}
 * scale={fit.scale}>`, which maps every atlas into the same box: centred in x and
 * z, y = 0 at the feet, 1.7 m tall. So an overlay placed in that outer frame is
 * correct for BodyParts3D, HRA, Z-Anatomy and `composed` alike, with no per-atlas
 * placement table. Mount overlays as SIBLINGS of `AtlasBody`, never inside it.
 */
import type { SystemId } from '../data/schema'
import type { AnatomySourceId, SourceData } from './anatomySources'

export type OrganOverlayId = 'beating-heart' | 'schematic-eye' | 'openear'

/** One placed copy of an overlay. Bilateral organs list two. */
export interface OverlayInstance {
  /** Distinguishes the copies, e.g. "Left". Empty for a single-instance organ. */
  side: string
  position: readonly [number, number, number]
  quaternion: readonly [number, number, number, number]
}

export interface OrganOverlay {
  id: OrganOverlayId
  label: string
  /** Glyph for the toggle. Pulses in time with the rate only if `animation` is set. */
  icon: string
  /** Compressed GLB under public/models/. Absent until the asset is produced. */
  url: string
  licence: string
  licenceUrl: string
  /** Credit line. Must be rendered whenever this overlay is active. */
  attribution: string
  shareAlike: boolean
  /**
   * Which body system it belongs to.
   *
   * ⚠️ Deliberately `string`, not `SystemId`. A value outside the `SystemId` union
   * resolves to null and `AtlasBody` renders the structure **unresolved** —
   * visible, hoverable and named, just not score-coloured. That is the pattern
   * `build-z-anatomy.mjs` established for `lymphoid`: `SystemId` is the
   * health-data contract that D8 put upstream, and widening it for a purely
   * geometric reason would drift a contract this repo does not own. The eye uses
   * `sensory` for exactly that reason — claiming it is `nervous` to fit the union
   * would be a fabrication of the same kind as filing the spleen under
   * cardiovascular.
   */
  system: SystemId | string
  /** Whose organ this is. Never the same person as the atlas. */
  donor: { label: string; derivedFrom: string }
  /** What this asset was built FROM; see `SourceData` in anatomySources.ts. */
  sourceData?: SourceData
  /**
   * Where it goes, in the CANONICAL frame — metres, +Y up, +X anatomical left.
   * One entry for a midline organ, two for a bilateral one.
   *
   * This is the FALLBACK. Prefer `placements` for anything whose position depends
   * on whose body it is — see the note there.
   */
  instances: readonly OverlayInstance[]
  /**
   * Per-atlas placement, because the canonical frame is not enough.
   *
   * ⚠️ THIS EXISTS BECAUSE THE ORIGINAL ASSUMPTION WAS WRONG. `AtlasBody` fits
   * every atlas into one canonical box, so it looked as though one placement would
   * serve them all. It does not: the atlases are **different donors**, and a heart
   * is not in the same place in two different people. Measured, the same organ sits
   * **29.3 mm apart** between HRA and TARO — mostly in z, HRA's being 2.3 cm more
   * posterior. That gap is visible, and it was visible before this was fixed.
   *
   * Keyed by atlas rather than by donor for lookup convenience; BodyParts3D and
   * Z-Anatomy legitimately share an entry because they ARE the same donor, TARO,
   * retopologised — `anatomySources.ts` measures their skeletons agreeing to 0.7 %.
   */
  placements?: Partial<Record<AnatomySourceId, readonly OverlayInstance[]>>
  /**
   * Nodes in each atlas that this overlay stands in for, as a name test. Matching
   * nodes are hidden while the overlay is on, so the body does not grow a second
   * copy of the organ.
   */
  supersedes?: Partial<Record<AnatomySourceId, RegExp>>
  /**
   * Structures this overlay stands in for, by NAME, for atlases that carry
   * `_STRUCTURE`. This is what lets a merged node give up part of itself.
   *
   * ⚠️ BY NAME, NEVER BY ID. Structure ids are positional and shift on every
   * rebuild — the seven-file import moved them, and a later fix moved them again
   * when a zero-vertex part stopped being counted. An id list would have gone
   * silently wrong and hidden the wrong organ. This is the same lesson ROADMAP
   * Phase 1 records for index ranges: derive from the asset, never pin to it.
   *
   * `expect` is the count this test matched when it was written. `AtlasBody`
   * compares and warns, so a name change upstream shows up as a console warning
   * rather than as a heart that quietly stops disappearing.
   */
  supersedesStructures?: {
    /** Restrict to one system, so brain ventricles are not mistaken for cardiac ones. */
    system: string
    is: RegExp
    /** Names to exclude even though `is` matched. */
    not?: RegExp
    /**
     * Restrict to one side of the body.
     *
     * ⚠️ THIS IS WHAT MAKES A ONE-SIDED OVERLAY POSSIBLE. Z-Anatomy names both
     * ears' ossicles identically — two structures called `Incus`, distinguished
     * only by `side` — so a name test alone matches both and an overlay that
     * replaces the RIGHT ear would blank the left one too. That is why the
     * OpenEar overlay superseded nothing at all until now, and it is recorded as
     * a known limitation in `docs/HANDOVER.md`.
     *
     * Note that the fix the handover predicted — ontology terms — would NOT have
     * worked: none of the eight ear structures carries an `ontologyid`. `side` is
     * on all of them. Measured, not assumed; see `scene/structureMask.ts`.
     */
    side?: 'left' | 'right'
    expect: number
  }
  animation?: {
    name: string
    /** Cycle length the asset was authored at, in seconds. */
    baseCycleSeconds: number
  }
  /**
   * False when something outstanding blocks publication. The overlay still loads
   * and renders — this is a note to whoever ships, not a runtime gate.
   */
  publishable: boolean
  /** Shown in the UI, verbatim. Say what is unresolved rather than implying all is well. */
  note: string
}

/**
 * The heart's place in TARO, measured from Z-Anatomy's own chambers.
 *
 * Centroid is the mean of the 17 structures that make up its heart. Both rotation
 * axes are measured from the atlas rather than assumed: base→apex is the atria
 * centroid to the ventricle centroid, (0.649, −0.474, 0.596); LV→RV is
 * (−0.683, 0.183, 0.707). Rotating this asset's own measured axes onto those two
 * gives 0.000° residual on both, determinant +1.
 *
 * Z-Anatomy's measured LV→RV pointing right-and-anterior is worth noting on its
 * own: it independently confirms the roll that had to be assumed for HRA.
 */
const HEART_IN_TARO = [
  {
    side: '',
    position: [0.0312, 1.2733, 0.0287],
    quaternion: [-0.842582, 0.125738, 0.128132, 0.507767],
  },
] as const

export const ORGAN_OVERLAYS: Record<OrganOverlayId, OrganOverlay> = {
  /**
   * The biv-me beating heart. See docs/PLAN_INTEGRATION.md (B6) and
   * scripts/build-biv-heart.mjs.
   *
   * PLACEMENT IS MEASURED, NOT EYEBALLED, and both halves came from anatomy:
   *
   * `position` is HRA's own heart — node `#VHFHeartV1.1` — pushed through the
   * same fit `AtlasBody` applies. Its centroid lands at **73.9 % of body height,
   * 3.7 cm left of the midline and essentially at mid-depth**, which is where a
   * heart belongs: behind the sternum at roughly the T7–T8 level, displaced left.
   *
   * `quaternion` rotates this asset's measured base→apex axis onto HRA's measured
   * one, and resolves the roll about that axis by putting the right ventricle to
   * the anatomical RIGHT and slightly anterior of the left. The two source axes
   * are recorded in the GLB's own `placement` extras. HRA's apex direction comes
   * out as (0.777, −0.536, 0.330) — left, inferior and anterior, exactly the
   * textbook description, which is also an independent confirmation that +X is
   * anatomical left. Residual error on both axes is 0.000°, and the matrix
   * determinant is +1, so it is a proper rotation with no reflection.
   *
   * ⚠️ NOT SCALED TO FIT. This heart is 13 × 9 × 12 cm against HRA's 15 × 12 ×
   * 11 cm, partly because biv-me is biventricular and has no atria. Stretching it
   * to match would be inventing a size for a real person's organ. It sits at its
   * true size and the mismatch is disclosed instead.
   */
  'beating-heart': {
    id: 'beating-heart',
    label: 'Beating heart',
    icon: '♥',
    url: '/models/biv-heart.glb',
    licence: 'Apache-2.0',
    licenceUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
    attribution:
      'Beating biventricular heart from biv-me (UOA Heart Mechanics Research), Apache-2.0 — ' +
      'a model fitted to one subject’s cine MRI, 25 cardiac phases.',
    shareAlike: false,
    system: 'cardiovascular',
    donor: {
      label: 'biv-me demo subject',
      derivedFrom: 'cine MRI, fitted biventricular model, 25 phases across one cardiac cycle',
    },
    // Fallback = the HRA placement, since HRA is where the heart was first
    // measured. Any atlas without its own entry lands here.
    instances: [{ side: '', position: [0.0368, 1.2557, 0.006], quaternion: [-0.705339, 0.003051, 0.220284, 0.673768] }],
    placements: {
      // Same donor, same numbers — TARO, retopologised.
      bodyparts3d: HEART_IN_TARO,
      'z-anatomy': HEART_IN_TARO,
      // Visible Human Female. ⚠️ `hra-m` is a THIRD donor and has not been
      // measured, so it falls through to the female placement and will be
      // slightly off. Measure it before trusting the male body's heart.
      hra: [{ side: '', position: [0.0368, 1.2557, 0.006], quaternion: [-0.705339, 0.003051, 0.220284, 0.673768] }],
    },
    supersedes: {
      // HRA ships the heart as its own node, so hiding it is exact.
      hra: /heart/i,
      'hra-m': /heart/i,
      // ⚠️ NOT BodyParts3D or Z-Anatomy. Both merge the whole cardiovascular
      // system into ONE node, so a name test would hide every vessel in the body
      // along with the heart. Z-Anatomy names its chambers individually but they
      // still share a draw call, so suppressing them needs the draw-range surgery
      // Phase 1 built for highlighting. Until that exists, those atlases show
      // their own static heart as well and the UI says so.
    },
    /**
     * Z-Anatomy's heart, all 17 structures of it: both ventricles, both atria,
     * the four papillary muscles and all nine valve leaflets. Verified as one
     * contiguous run bounded by a pulmonary artery branch before and the
     * coronaries after.
     *
     * The vessel guard is load-bearing rather than defensive. Without it the test
     * also matches `Inferior vein of left ventricle` twice — cardiac veins, not
     * heart wall — which would hide two vessels along with the organ.
     *
     * ⚠️ MORE IS HIDDEN THAN IS REPLACED, deliberately, and the UI says so. The
     * biv-me overlay is BIVENTRICULAR: no atria, no valves. Hiding only the
     * ventricles would leave the static atria and valves sitting against beating
     * ventricles they no longer connect to, which reads worse than their absence.
     */
    supersedesStructures: {
      system: 'cardiovascular',
      is: /(\bventricle\b|\batrium\b|papillary muscle|\bleaflet\b)/i,
      not: /(vein|artery|arterial|vena|vessel|sinus|trunk|annulus)/i,
      expect: 17,
    },
    sourceData: {
      note:
        '75 OBJ surfaces from the biv-me demo output — one biventricular surface per cardiac ' +
        'phase, fitted upstream to one subject’s cine MRI.',
    },
    animation: { name: 'cardiac-cycle', baseCycleSeconds: 1 },
    publishable: false,
    note:
      'The demo subject’s provenance is unconfirmed upstream, so this is for local ' +
      'evaluation and not for publication.',
  },

  /**
   * The schematic optical eye — the only asset here this project owns outright.
   *
   * Generated by `scripts/build-eye.mjs` from the published Arizona eye model.
   * Radii, conics, thicknesses and indices are measurements, and measurements are
   * not copyrightable expression, so the mesh has no upstream licence, no
   * attribution chain and nothing to disclose. See docs/PLAN_INTEGRATION.md (B8).
   *
   * PLACEMENT, from anatomy in two different senses. `y` and `z` are MEASURED off
   * the shipping atlas: Z-Anatomy's `Orbital part of orbicularis oculi` — the
   * muscle ringing the orbital opening — averages to (±0.0252, 1.5839, 0.0705)
   * per side, and the globe centre sits about 14 mm behind that lid plane, giving
   * z ≈ 0.056. `x` is the population mean interpupillary distance of 63 mm, so
   * ±0.0315; the orbicularis centroid is pulled medially by its broad medial part
   * and is not the pupil, so it is the wrong thing to take x from.
   *
   * The quaternion is IDENTITY, and that is correct rather than lazy. The asset is
   * generated with its optical axis along +z, the body faces +z, and the visual
   * axes are parallel for distance fixation. The *orbital* axes diverge by roughly
   * 23°, but that is the bony orbit, not the line of sight.
   *
   * ⚠️⚠️ IT SUPERSEDES NOTHING, AND THAT IS NOW A KNOWN CONFLICT RATHER THAN A
   * NON-ISSUE. This used to read "no atlas loaded here contains an eyeball at all",
   * which was TRUE when written against the three-file Z-Anatomy build and became
   * FALSE the moment `NervousSystem100.fbx` was imported. Nobody re-checked, and
   * `scripts/gen-ontology-map.mjs` is what caught it.
   *
   * Z-Anatomy carries a complete bilateral globe under `nervous`: cornea, lens,
   * retina, sclera, iris, vitreous body, zonular fibres, both segments and the
   * anterior chamber — 20 structures at ids 2631–2650, which are **contiguous**, so
   * `supersedesStructures` could mask them exactly. Unlike the ear there is no
   * left/right obstacle either, because this overlay already places two instances.
   *
   * It is deliberately NOT wired up, because the swap would trade anatomy for
   * optics. This asset models three refracting surfaces; Z-Anatomy's eye models the
   * sclera and iris this one does not have, so superseding would render LESS
   * anatomy in exchange for a correct optical model — and the note below already
   * tells the viewer this is "not a substitute for an anatomical eye". Making that
   * substitution silently would contradict the overlay's own disclaimer. Until it
   * is decided, switching this on over Z-Anatomy draws two overlapping eyeballs;
   * `docs/ONTOLOGY_MAP.md` records the choice.
   *
   * HRA is not affected: its four eye reference organs are separate downloads and
   * are absent from the whole-body GLB.
   */
  'schematic-eye': {
    id: 'schematic-eye',
    label: 'Schematic eye',
    icon: '◉',
    url: '/models/eye.glb',
    licence: 'Generated — no upstream licence',
    licenceUrl: 'https://opendefinition.org/licenses/',
    attribution:
      'Schematic optical eye generated by open-twin-openXR from the published Arizona eye model ' +
      '(Schwiegerling). Geometry original to this project.',
    shareAlike: false,
    system: 'sensory',
    donor: {
      label: 'nobody — a schematic, not a person',
      derivedFrom: 'Arizona eye model parameters at 0 dioptres of accommodation; axial length 24.0 mm',
    },
    sourceData: {
      note:
        'NOTHING was downloaded. Generated from published radii, conic constants, thicknesses and ' +
        'refractive indices — four numbers per surface, and the mesh is computed from them.',
    },
    instances: [
      { side: 'Left', position: [0.0315, 1.5839, 0.056], quaternion: [0, 0, 0, 1] },
      { side: 'Right', position: [-0.0315, 1.5839, 0.056], quaternion: [0, 0, 0, 1] },
    ],
    publishable: true,
    note:
      'A SCHEMATIC OPTICAL model: cornea, lens and retina only. No sclera, iris, ciliary body, ' +
      'extraocular muscles, optic nerve or vasculature, because a schematic eye does not model ' +
      'them. Correct as optics, not a substitute for an anatomical eye.',
  },

  /**
   * OpenEar specimen ZETA — the first asset here whose colour is a PHOTOGRAPH.
   *
   * Twelve structures of one cadaveric temporal bone, with base colour sampled
   * from the same specimen's true-colour micro-slicing volume at 50 µm. This is
   * D4's pilot: every other asset in the project is coloured by a palette we chose,
   * and this one is coloured by what the tissue actually looked like. See
   * `docs/PLAN_INTEGRATION.md` (B3) and `scripts/build-openear.mjs`.
   *
   * PLACEMENT IS FITTED, NOT EYEBALLED — and it is the first one here that is.
   * `scripts/place-overlay.mjs` matches five landmarks that both this specimen and
   * Z-Anatomy contain (malleus, incus, stapes, cochlea, tympanic membrane) and
   * solves Horn's absolute-orientation problem for the rigid transform between
   * them. RMS residual **1.26 mm**, worst landmark 1.97 mm, on structures a couple
   * of millimetres across.
   *
   * ⚠️ IT IS A RIGHT EAR, AND THAT WAS DERIVED RATHER THAN ASSUMED. A temporal-bone
   * specimen in its own scanner frame says nothing about which side of a head it
   * came from, and getting it wrong renders a mirrored ear that looks entirely
   * plausible. So the fit runs against both of Z-Anatomy's ears: the right fits at
   * 1.26 mm and the left at 2.32 mm, and Horn's method cannot produce a reflection
   * to paper over the difference. Hence one instance, on the right.
   *
   * The numbers below are checked, not just pasted. Re-run after any change to the
   * asset or the atlas — it reports 1.27 mm against the right ear and 90.08 mm
   * against the left, so a side swap or a transcription slip cannot pass:
   *
   *   node scripts/place-overlay.mjs --overlay public/models/openear-zeta.glb \
   *     --atlas public/models/z-anatomy.ao.glb --pairs ear \
   *     --verify "-0.0288,1.5886,-0.047" "0.155467,0.02999,0.981562,0.107081"
   *
   * ⚠️ THE SPECIMEN IS ~14 % LARGER THAN Z-ANATOMY'S INNER EAR. The optimal uniform
   * scale is 1.136, consistent to 0.1 % across both side fits, so it is a real
   * difference and not fit noise. It is NOT applied, for two reasons. Scaling a
   * measured specimen to fit a different body would misstate its size, which is the
   * one thing a photographic reference is for. And the discrepancy is at least as
   * likely to be Z-Anatomy's: its inner ear is the third-party Dundee component
   * (`inner-ear-dundee`), retopologised into TARO's skull, so it is not TARO's ear
   * either. Two different ears from two different people is the honest reading.
   *
   * ⚠️ IT NOW SUPERSEDES THE RIGHT INNER EAR — and for most of this repository's
   * life it could not, which is worth keeping because the reason was subtle.
   *
   * `supersedesStructures` resolved BY NAME onto a contiguous id RANGE, and
   * Z-Anatomy names both ears' structures identically: two `Incus`, two
   * `Cochlea`, distinguished only by `side`. A name test therefore matched both
   * ears, and masking the union would have blanked the left ear, which this
   * overlay does not replace. A left-earless body is worse than a doubled one,
   * so the rule was left off.
   *
   * Two things had to change. `side` on the rule, so the test can select one
   * ear — and note that the fix `docs/HANDOVER.md` predicted, ontology terms,
   * would NOT have worked here, because none of these eight structures carries
   * an `ontologyid`. And the mask had to stop being a range: measured on the
   * shipped asset the right ossicles are 451, 455 and 456, which interleave with
   * the left, so no `{lo, hi}` could ever have expressed them. See
   * `scene/structureMask.ts`.
   *
   * The count is 7, not 8: the tier-1 asset carries Malleus, Incus and Stapes on
   * the right (musculoskeletal) plus Tympanic membrane, Auditory tube, Cochlea
   * and Vestibule on the right (nervous). Two rules would be needed to span both
   * systems, so this one takes the nervous-system sense organ — the part this
   * specimen actually replaces — and leaves the three ossicles visible. Stated
   * rather than silently rounded, and `expect` will warn if it drifts.
   */
  openear: {
    id: 'openear',
    label: 'Ear (photographic)',
    icon: '◗',
    url: '/models/openear-zeta.glb',
    licence: 'CC BY 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution:
      'OpenEar library of 3D models of the human temporal bone (Sieber et al., MED-EL / University ' +
      'of Bern), CC BY 4.0. Surface colour baked from the same specimen’s true-colour micro-slicing ' +
      'volume.',
    shareAlike: false,
    system: 'sensory',
    donor: {
      label: 'OpenEar specimen ZETA — one cadaveric right temporal bone',
      derivedFrom:
        'cone-beam CT plus true-colour micro-slicing at 50 µm in plane, 150 µm between slices',
    },
    sourceData: {
      bytes: 317830135,
      note:
        'pulled member-by-member from a 7.3 GB specimen release by reading the zip central ' +
        'directory over HTTP range requests — 12 meshes plus the 305 MB colour volume, instead of ' +
        'the whole archive.',
    },
    instances: [
      {
        side: 'Right',
        position: [-0.0288, 1.5886, -0.047],
        quaternion: [0.155467, 0.02999, 0.981562, 0.107081],
      },
    ],
    /**
     * Measured against Z-Anatomy, so only Z-Anatomy gets the fitted numbers.
     *
     * No other atlas here models an inner ear, so there are no landmarks to fit
     * against and nothing to measure. On those the `instances` fallback applies —
     * the right place in TARO's head, which is a different head. Stated rather than
     * hidden, exactly as the heart's unmeasured `hra-m` placement is.
     */
    placements: {
      'z-anatomy': [
        {
          side: 'Right',
          position: [-0.0288, 1.5886, -0.047],
          quaternion: [0.155467, 0.02999, 0.981562, 0.107081],
        },
      ],
    },
    // The right sense organ only. `Cochlea` and `Vestibule` are the CC BY-NC-SA
    // Dundee component; `Tympanic membrane` and `Auditory tube` are Z-Anatomy's
    // own. All four are `nervous` in this asset, and all four carry `side`.
    supersedesStructures: {
      system: 'nervous',
      is: /^(Cochlea|Vestibule|Tympanic membrane|Auditory tube)$/,
      side: 'right',
      expect: 4,
    },
    publishable: true,
    note:
      'Photographic colour, and the first here: base colour is sampled from this specimen’s own ' +
      'micro-slicing photographs, not chosen. 71.5 % of the surface has a colour source; the rest ' +
      'is neutral grey because the photographed block is smaller than the scan, and grey means "no ' +
      'source" rather than "this colour". One right temporal bone from one cadaver — not a ' +
      'population, and ~14 % larger than this body’s own inner ear, which is left unscaled. ' +
      'It now replaces Z-Anatomy’s own RIGHT cochlea, vestibule, tympanic membrane and ' +
      'auditory tube; the left ear is untouched, and the three right ossicles stay visible ' +
      'because they sit in a different system from the four this rule covers.',
  },
}

/** Default rate. 60 bpm is also the asset's authored cycle, so timeScale is 1. */
export const DEFAULT_BPM = 60

/**
 * Rate limits offered by the UI.
 *
 * Deliberately wide enough to cover a resting athlete through hard effort,
 * because the point of the control is to sit in front of real recorded data
 * later — a wearable's resting and training heart rates both have to land inside
 * it.
 */
export const BPM_RANGE = { min: 40, max: 200 } as const
