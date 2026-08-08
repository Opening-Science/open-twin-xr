/**
 * Parametric body envelopes — a skin surface with no anatomy inside it.
 *
 * ⚠️ AN ENVELOPE IS NOT AN ATLAS, AND MUST NEVER BE PRESENTED AS ONE. It has no
 * organs, no structures, no ontology terms and no donor. It is a generated
 * surface, and the whole subject of this repository is real anatomy from
 * registered sources — so mixing the two in one registry would put a body with
 * nothing in it beside seven bodies that are somebody.
 *
 * WHY A SEPARATE REGISTRY RATHER THAN AN EIGHTH `AnatomySource`
 * -------------------------------------------------------------
 * `AnatomySource` requires `donor: { label, derivedFrom, sex }`, and both
 * `sourceBreakdown()` and `AtlasAttribution` assume one. A parametric body is
 * SCAN-FREE — that is an ethical feature, not a gap, because no person's scan
 * was used to make it — so `donor` would have to become optional for seven
 * entries that all have one. It also has `termSystem: 'none'`, in a registry
 * whose entire current purpose is structure identity.
 *
 * This repository has already made exactly this call once, for organ overlays,
 * which live in `organOverlays.ts` as "a separate mechanism from atlases"
 * (`docs/HANDOVER.md`). Same reasoning, same answer. See D16 in
 * `docs/DECISIONS.md`.
 *
 * WHAT IT IS FOR
 * --------------
 * D14 measured that the glass hull is unavailable on three of the seven
 * selectable sources — Z-Anatomy, the regions atlas and both CT atlases ship no
 * integumentary geometry at all — and `useHasHull()` disables the control with
 * an inline "no skin" note. So the richest anatomy in the repository is exactly
 * where the best-looking hull is impossible. An envelope closes that, without
 * touching a single atlas.
 *
 * It is also the vehicle Roadmap Phase 7 needs: fitting a parametric body to a
 * person's own scan is a far better-posed problem than deforming an atlas.
 *
 * WHAT IT IS NOT
 * --------------
 * Not a measurement instrument. Its shape space is artist priors from
 * MakeHuman, not anthropometric ground truth, so no body-composition,
 * ergonomic or health claim may be attached to it. The presets are labelled by
 * the PARAMETERS THAT MADE THEM, not by any population they represent.
 */

/** Every licence in a package, not just the headline one. */
export interface EnvelopeLicence {
  /** What this licence covers, e.g. `code`, `shape assets`. */
  covers: string
  spdx: string
  url: string
}

export interface BodyEnvelope {
  id: BodyEnvelopeId
  /** Shown in the dock. */
  label: string
  url: string
  /**
   * Scan-free by construction. Stated as a field rather than implied by absence,
   * so anything iterating envelopes has to acknowledge it.
   */
  synthetic: true
  /** No ontology terms, at all. Stated rather than left undefined. */
  termSystem: 'none'
  licences: readonly EnvelopeLicence[]
  attribution: string
  citation?: string
  /**
   * Exact build inputs, so the asset can be regenerated.
   *
   * ⚠️ NOT OPTIONAL, and the reason is the same one that made
   * `docs/LICENCE_LOG.md` and `docs/ONTOLOGY_MAP.md` generated documents: a
   * hand-maintained record of how something was produced goes stale silently.
   * Unlike an atlas, a baked body is cheap to regenerate — but only if the
   * parameters are known. A committed envelope with no provenance is worse than
   * no envelope.
   */
  provenance: {
    package: string
    topology: string
    rig: string
    parameters: Record<string, number>
    script: string
  }
  /**
   * Measured standing height of the baked mesh, in metres.
   *
   * Recorded but NOT used for fitting: the runtime scales the envelope to the
   * same canonical 1.7 m frame every atlas is normalised into, so what a preset
   * contributes is PROPORTION rather than stature. Kept because it is the check
   * that the age axis is doing something — see `scripts/anny/bake.py`.
   */
  heightM: number
  /** Shown in the UI verbatim. Say what is unresolved rather than implying all is well. */
  note: string
}

export type BodyEnvelopeId =
  | 'anny-adult-f'
  | 'anny-adult-m'
  | 'anny-child'
  | 'anny-elder'
  | 'anny-pregnant'

/**
 * ANNY's three licence buckets.
 *
 * ⚠️ THE PACKAGE IS NOT SINGLE-LICENCED, and recording only the headline
 * Apache-2.0 would be wrong. The shape assets this geometry actually derives
 * from are CC0, the code that evaluated them is Apache-2.0, and a third bucket
 * (the SOMA topology, also Apache-2.0) ships alongside though nothing here uses
 * it. All three are declared because the registry's job is to be right about
 * rights, not brief.
 */
const ANNY_LICENCES: readonly EnvelopeLicence[] = [
  {
    covers: 'code — the model implementation that evaluated these shapes',
    spdx: 'Apache-2.0',
    url: 'https://github.com/naver/anny/blob/main/LICENSE',
  },
  {
    covers: 'shape assets — the MakeHuman-derived targets this geometry comes from',
    spdx: 'CC0-1.0',
    url: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  {
    covers: 'soma topology — shipped in the package, not used by these bakes',
    spdx: 'Apache-2.0',
    url: 'https://github.com/naver/anny/blob/main/LICENSE',
  },
]

const ANNY_ATTRIBUTION =
  'ANNY, a free-to-use 3D human parametric model for all ages — NAVER LABS Europe / NAVER ' +
  'Corporation. Apache-2.0 code over CC0 shape assets derived from MakeHuman. Baked to static ' +
  'geometry by this repository; no scan of any person was used.'

const ANNY_CITATION = 'arXiv:2511.03589'

/**
 * ⚠️ NEVER BAKE WITH `topology="smpl"` OR `"smplx"`. Both trigger a RUNTIME
 * download of a non-commercial archive from NAVER's CDN, inside
 * `download_noncommercial_data()`. Because it happens at runtime rather than at
 * install time, a dependency audit does not catch it. `scripts/anny/bake.py`
 * hardcodes the safe topology and exposes no flag for this.
 */
function anny(
  id: BodyEnvelopeId,
  /**
   * ⚠️ WRITTEN OUT IN FULL, NOT BUILT FROM `id`, AND THAT IS A BUILD REQUIREMENT
   * RATHER THAN A STYLE CHOICE.
   *
   * `pruneUnshippedModels` in `vite.config.ts` decides which GLBs survive into
   * `dist` by regex-scanning the registry SOURCE for `/models/<name>.glb`. A
   * template literal — `` `/models/${id}.glb` `` — does not match that pattern,
   * so every envelope was silently pruned from the production build and the whole
   * feature shipped as five "not installed" pills. The dev server was unaffected,
   * because it serves `public/` directly, so this was invisible locally.
   *
   * `anatomySources.ts` and `organOverlays.ts` both write their urls literally for
   * the same reason. Keep it that way.
   */
  url: string,
  label: string,
  parameters: Record<string, number>,
  heightM: number,
  note: string,
): BodyEnvelope {
  return {
    id,
    label,
    url,
    synthetic: true,
    termSystem: 'none',
    licences: ANNY_LICENCES,
    attribution: ANNY_ATTRIBUTION,
    citation: ANNY_CITATION,
    provenance: {
      package: 'anny==0.6.0',
      topology: 'anny',
      rig: 'anny',
      parameters,
      script: 'scripts/anny/bake.py',
    },
    heightM,
    note,
  }
}

/**
 * ⚠️ `gender` RUNS MALE (0) TO FEMALE (1), and `age` 0..1 spans five stops from
 * newborn to old with the ADULT at 0.75, not 0.5. Both were measured against the
 * installed package, and both contradict the preset table in the research notes
 * this work came from — which had the sexes inverted and put the adults at an
 * adolescent stature. The full evidence is in `scripts/anny/bake.py`; the heights
 * below are what the corrected parameters actually produced.
 */
export const BODY_ENVELOPES: Record<BodyEnvelopeId, BodyEnvelope> = {
  'anny-adult-f': anny(
    'anny-adult-f',
    '/models/anny-adult-f.glb',
    'Adult female',
    { gender: 1.0, age: 0.75 },
    1.765,
    'A generated surface, not a person. No organs, no ontology terms, and no scan of anyone.',
  ),
  'anny-adult-m': anny(
    'anny-adult-m',
    '/models/anny-adult-m.glb',
    'Adult male',
    { gender: 0.0, age: 0.75 },
    1.905,
    'A generated surface, not a person. No organs, no ontology terms, and no scan of anyone.',
  ),
  'anny-child': anny(
    'anny-child',
    '/models/anny-child.glb',
    'Child',
    { gender: 0.5, age: 0.25 },
    1.227,
    'A generated surface at the atlas’s own scale. ⚠️ Every atlas here is an ADULT body, so a ' +
      'child envelope around adult anatomy is a shape study and not a paediatric model.',
  ),
  'anny-elder': anny(
    'anny-elder',
    '/models/anny-elder.glb',
    'Elder',
    { gender: 0.5, age: 1.0 },
    1.812,
    'A generated surface, not a person. Sex-neutral: the gender axis sits at its midpoint.',
  ),
  'anny-pregnant': anny(
    'anny-pregnant',
    '/models/anny-pregnant.glb',
    'Pregnant',
    { gender: 1.0, age: 0.75 },
    1.766,
    'A generated surface. The abdomen comes from a MakeHuman shape target, so it is an artist’s ' +
      'shape prior — it models no gestational age and contains no fetus.',
  ),
}

export const BODY_ENVELOPE_IDS = Object.keys(BODY_ENVELOPES) as BodyEnvelopeId[]

/**
 * Which sex a preset's parameters produce, or `null` where the gender axis sits
 * at its midpoint and the answer is genuinely neither.
 *
 * ⚠️ THIS EXISTS BECAUSE THE ENVELOPE AND THE ATLAS CAN DISAGREE, AND NOTHING
 * WAS SAYING SO. An envelope reads none of the atlas state — not which atlas is
 * loaded, not whose body it is, not which sex — so "Adult male" could be drawn
 * around the female CT donor with no indication that the pairing is incoherent.
 * That is out of character for this app: `AttributionBar` carries three separate
 * donor-mismatch warnings already ("A different person from the body it sits in"
 * for overlays, "different people of different sexes" and "assembled from more
 * than one donor" for atlases). The envelope had none, because its credit was
 * written around "not a person, not a donor" and never considered the PAIRING.
 *
 * Derived from `provenance.parameters.gender` rather than from the label, so a
 * preset cannot claim one thing and be baked as another — which is exactly the
 * error the source research notes made when they had the axis inverted.
 */
export function envelopeSex(id: BodyEnvelopeId): 'male' | 'female' | null {
  const g = BODY_ENVELOPES[id].provenance.parameters.gender
  if (g === undefined) return null
  // 0 is male, 1 is female — measured, see `scripts/anny/bake.py`. The midpoint
  // is not a rounding case: it is a deliberate "neither", and reporting it as one
  // sex or the other would invent a claim the geometry does not make.
  if (g < 0.5) return 'male'
  if (g > 0.5) return 'female'
  return null
}

/**
 * The preset to offer for a given donor sex.
 *
 * Only the two adult presets are sex-specific. `child` and `elder` are baked at
 * the midpoint, so they match either donor equally badly and are never proposed
 * as a match — recommending one would be substituting a shape study for a
 * coherent pairing.
 */
export function envelopeForDonor(sex: 'male' | 'female'): BodyEnvelopeId {
  return sex === 'female' ? 'anny-adult-f' : 'anny-adult-m'
}
