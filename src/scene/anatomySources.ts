/**
 * Anatomy source registry.
 *
 * The twin draws its geometry from TWO reference atlases, deliberately kept as
 * separate assets:
 *
 *   - HRA        HuBMAP Human Reference Atlas, CC BY 4.0. Organ-scale, curated,
 *                ontology-rich (ASCT+B / UBERON / FMA). Attribution only.
 *   - Z-Anatomy  Libre whole-body atlas derived from BodyParts3D, CC-BY-SA 4.0.
 *                Broader coverage, notably bone and muscle. SHARE-ALIKE.
 *
 * Two ways to use them, both supported:
 *
 *   1. `composed`  — per-system, take whichever atlas covers that system best.
 *                    The default, shown as "Best per system".
 *   2. a single id — force every system to one atlas, for side-by-side visual
 *                    comparison.
 *
 * WHY THEY STAY SEPARATE FILES
 * ----------------------------
 * Merging HRA and Z-Anatomy geometry into one GLB would make that single file a
 * derivative of Z-Anatomy, so CC-BY-SA share-alike would attach to the whole
 * thing — including the HRA parts, which were chosen precisely to avoid it.
 * Loading two GLBs and composing at the SCENE level gets the same visual result
 * with each licence scoped to the asset that actually carries it. Compose in the
 * scene graph, never in the asset.
 *
 * Whatever is active must be credited: see `activeSources()` and
 * `src/ui/AttributionBar.tsx`. Attribution is a licence condition, not a nicety.
 */
import type { SystemId } from '../data/schema'
import {
  groupKey as hraGroupKey,
  isHiddenGroup as hraIsHiddenGroup,
  systemForGroup as hraSystemForGroup,
  systemForTerm as hraSystemForTerm,
} from './anatomy/hraGroups'

export type AnatomySourceId =
  | 'hra'
  | 'hra-m'
  | 'bodyparts3d'
  | 'z-anatomy'
  | 'z-anatomy-regions'
  | 'htb-ct-f'
  | 'ct-atlas-f'

/**
 * A third-party component inside an atlas, on terms other than its headline
 * licence.
 *
 * Z-Anatomy is an aggregate: most of it is the authors' CC BY-SA work, but the
 * inner ear, the kidney and the white matter came from elsewhere. **D12b imports
 * all of it and records what each piece is** rather than cutting holes in the
 * body, so this is disclosure, not a gate. Every entry here is a credit the UI
 * must render — that is the condition these licences actually impose.
 *
 * Mirrors the `components` roster written into the GLB by
 * `scripts/build-z-anatomy.mjs`; `npm run check:licences` reads the asset's copy
 * and regenerates `docs/LICENCE_LOG.md` from it.
 */
export interface RightsComponent {
  title: string
  holder: string
  licence: string
  /**
   * What this component is ITSELF derived from, where the rights holder says so.
   *
   * A component inside an aggregate can be two or three links down a chain, and
   * crediting only the nearest link drops the people whose work it rests on.
   * Dundee's inner ear is a derivative of a McGill model; their cranial nerves
   * derive from BodyParts3D. Both strings here were supplied by Dundee on
   * request (18 August 2026) — asked for, not inferred, which is the only way
   * to get a chain like this right.
   */
  derivedFrom?: string
  /**
   * The source carries Sketchfab's **NoAI** marking.
   *
   * Scope, from Sketchfab's own terms (23 March 2023): NoAI content may not be
   * used "in datasets for, in the development of, or as inputs to generative AI
   * programs". It does NOT restrict viewing, rendering or redistribution — this
   * viewer's entire relationship with the geometry.
   *
   * Recorded anyway, and rendered, for two reasons. It is the creator's stated
   * wish and it should travel with their work rather than stop at the platform
   * they posted it on. And this project is written by an AI agent, which makes
   * the distinction worth stating out loud rather than leaving to inference:
   * the agent writes the code, and the anatomy is data that code renders. No
   * mesh here is training data, a dataset entry, or an input to a generative
   * model, and none will be.
   */
  noAI?: boolean
  /** True when the component grants nothing and needs written permission. */
  needsPermission?: boolean
}

/** Donor sex. A property of the geometry, never inferred from the health data. */
export type Sex = 'male' | 'female'

/**
 * The closed `SystemId` set, for validating a system name that arrives as a
 * plain string from an atlas's baked-in metadata.
 */
const SYSTEM_IDS: ReadonlySet<string> = new Set<SystemId>([
  'cardiovascular',
  'respiratory',
  'nervous',
  'digestive',
  'musculoskeletal',
  'endocrine',
  'reproductive',
  'metabolic',
  'integumentary',
])

/** How structures are addressed in a given atlas. The data carries UBERON. */
export type TermSystem = 'UBERON' | 'FMA'

/**
 * Whose body an atlas actually depicts.
 *
 * WHY THIS HAS TO BE DECLARED
 * ---------------------------
 * Every atlas here is one real person, and they are not the same person. HRA is
 * the **Visible Human Female**; BodyParts3D is **TARO**, an adult Japanese male
 * voxel phantom. So switching atlas in the UI does not swap a rendering style,
 * it swaps the donor — and with them the sex. HRA carries a uterus, ovaries and
 * mammary glands; BodyParts3D carries a prostate. Neither is wrong; presenting
 * them as interchangeable views of one twin is.
 *
 * The resolutions differ by roughly 6x as well (0.33 mm cryosection photography
 * against 2 mm MRI), which is why the two look like different eras of modelling
 * even before the anatomy diverges.
 *
 * Declaring it here means the mismatch is a fact the UI can state rather than
 * something a viewer has to notice. It is also where a future twin-sex field
 * would join: once the data says which sex the twin is, sex-discordant
 * structures can be filtered instead of merely disclosed.
 */
export interface AnatomyDonor {
  sex: 'male' | 'female'
  /** One line naming the donor, for the credits. */
  label: string
  /** What the geometry was derived from, and at what sampling resolution. */
  derivedFrom: string
  /** Standing height of the source asset in metres, BEFORE canonical scaling. */
  heightM: number
}

/**
 * What an asset was built FROM, so the pipeline is legible rather than implied.
 *
 * The shipped size is measured live by a HEAD request wherever it is displayed —
 * it is a property of the file on the server and nothing here should duplicate
 * it. This records the other end, which the browser cannot see: how much source
 * data went in.
 *
 * ⚠️ `bytes` IS OPTIONAL AND THAT IS THE POINT. It is a recorded build-time
 * measurement, present only where it was actually measured, and several sources
 * genuinely have no meaningful figure — the schematic eye downloads nothing at
 * all, and the CT atlas derives from a scan nobody wrote down. Quoting the output
 * size as though it were the input, to avoid an empty cell, is the sort of small
 * fabrication this project keeps refusing to make. Where the number is unknown,
 * `note` says what the source was and no number is shown.
 */
export interface SourceData {
  bytes?: number
  /** What that number is, or what the source is when there is no number. */
  note: string
}

/**
 * How to place an atlas that is NOT a whole standing body.
 *
 * ⚠️ The default registration scales an atlas so its bounding box is exactly
 * `CANONICAL_HEIGHT_M` tall. That is right for a whole body and **catastrophic
 * for a partial one**: a torso-only scan holding 0.86 m of anatomy gets inflated
 * ~2× to stand 1.7 m by itself, which is what made the CT atlas render as a
 * giant ribcage and made it useless in a composite.
 *
 * A partial atlas therefore declares its own placement instead of having one
 * inferred from bounds that do not mean what the default assumes.
 */
export interface AtlasRegistration {
  /**
   * The geometry is already life-size in metres, so do not rescale it — only
   * translate. True for anything segmented from a real scan.
   */
  realScale: true
  /**
   * A landmark, as "this raw Y in the file is that height on a 1.7 m body".
   *
   * Stated as a named anatomical fact rather than a tuned offset so it can be
   * checked: if `label` is where `worldY` says it is, the placement is right.
   */
  anchor: { rawY: number; worldY: number; label: string }
}

export interface AnatomySource {
  id: AnatomySourceId
  label: string
  /**
   * Placement override for an atlas that is not a whole standing body. Absent
   * means the default bounds-to-canonical-height fit, which is correct only for
   * a complete body — see `AtlasRegistration`.
   */
  registration?: AtlasRegistration
  /** Compressed GLB under public/models/. Absent until the asset is produced. */
  url: string
  licence: string
  /** Credit line. Must be rendered whenever this source is active. */
  attribution: string
  /**
   * Formal citation, where the source has one.
   *
   * Distinct from `attribution`: attribution is the licence CONDITION and is not
   * optional, whereas a citation is how academic work expects to be referenced.
   * Several of these atlases are published research and asking to be cited is
   * the norm in that world even where the licence does not compel it.
   */
  citation?: string
  licenceUrl: string
  /** True when using this source imposes copyleft on the modified asset. */
  shareAlike: boolean
  /**
   * Third-party components carried inside this atlas, if any. Rendered as
   * additional required credits; see `RightsComponent`.
   */
  components?: RightsComponent[]
  /** Whose body this is. Switching atlas switches donor; see `AnatomyDonor`. */
  donor: AnatomyDonor
  /** What this asset was built FROM. See `SourceData`. */
  sourceData?: SourceData
  /**
   * Ontology the atlas's structures are addressed by. Informational: resolution
   * goes through `groupKey`/`systemForGroup` below, because in practice atlas
   * terms sit at structure granularity rather than system granularity.
   */
  termSystem: TermSystem
  /**
   * Read this atlas's own grouping key off a mesh's glTF `extras`.
   *
   * Every atlas organises its meshes somehow — HRA by
   * `extras.anatomical_structure_of`, Z-Anatomy by per-system collections — and
   * that grouping is what actually maps onto body systems. Ontology ids remain
   * the cross-atlas contract in `TwinMetrics`; this is each atlas's adapter
   * down to it. Returns null when the atlas has no such key.
   */
  groupKey?: (userData: Record<string, unknown>, nodeName: string) => string | null
  /** Map this atlas's grouping key to a system. */
  systemForGroup?: (key: string) => SystemId | null
  /**
   * Map an ontology TERM to a system, for structures whose group key is absent
   * or a placeholder. Tried after the health data's own term map and after
   * `systemForGroup`, so it never overrides a better answer.
   */
  systemForTerm?: (term: string) => SystemId | null
  /** Groups to omit entirely, e.g. donor-specific anatomy. */
  isHiddenGroup?: (key: string) => boolean
  /**
   * Set when this source is the other-sex build of another atlas rather than an
   * atlas in its own right. Such a source is reachable through the sex control,
   * not as its own entry in the switcher — HRA is one atlas that ships two
   * bodies, and listing "HuBMAP HRA" twice would present that as two atlases.
   */
  variantOf?: AnatomySourceId
}

export const ANATOMY_SOURCES: Record<AnatomySourceId, AnatomySource> = {
  hra: {
    id: 'hra',
    label: 'HuBMAP HRA',
    url: '/models/hra.ao.glb',
    licence: 'CC BY 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution:
      '3D anatomical structures from the HuBMAP Human Reference Atlas (HRA), ' +
      'humanatlas.io, CC BY 4.0.',
    citation:
      'Börner K, et al. HuBMAP 3D Human Reference Atlas construction and usage. ' +
      'Nature Methods (2024).',
    shareAlike: false,
    donor: {
      sex: 'female',
      label: 'Visible Human Female',
      // Hand-modelled in Maya by a medical illustrator from the Visible Human
      // Female cryosections, then reviewed by organ experts — the generator
      // string on the raw GLB is the Babylon.js exporter for Maya 2023. The
      // brain comes from elsewhere: the Allen Human Reference Atlas, a
      // different donor again.
      derivedFrom: 'Visible Human Female cryosections, 0.33 mm; brain from the Allen Human Reference Atlas',
      heightM: 1.658,
    },
    sourceData: {
      bytes: 374505632,
      note: 'the whole-body GLB, downloaded from the HuBMAP CCF reference library',
    },
    termSystem: 'UBERON',
    groupKey: hraGroupKey,
    systemForGroup: hraSystemForGroup,
    systemForTerm: hraSystemForTerm,
    isHiddenGroup: hraIsHiddenGroup,
  },
  /**
   * HRA again, on the Visible Human MALE.
   *
   * The same atlas, the same modelling pipeline and the same licence — a
   * different donor. It is a separate GLB because it is a separate body, not a
   * variant of one: it carries a prostate and vasa deferentia where the female
   * build carries a uterus, ovaries and mammary glands, and it has no sternum.
   *
   * This is what D3 asked for — sex as an explicit choice rather than an
   * accident of which atlas happens to be default. It resolves through the same
   * `hraGroups` adapter with no new mapping: `normaliseGroup` already strips the
   * `VHF`/`VHM` prefix, and the stem table already lists the male model's
   * compound word order (`DuctsLiver` against the female `LiverDucts`).
   */
  'hra-m': {
    id: 'hra-m',
    label: 'HuBMAP HRA',
    url: '/models/hra-m.ao.glb',
    licence: 'CC BY 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution:
      '3D anatomical structures from the HuBMAP Human Reference Atlas (HRA), ' +
      'humanatlas.io, CC BY 4.0.',
    shareAlike: false,
    variantOf: 'hra',
    donor: {
      sex: 'male',
      label: 'Visible Human Male',
      derivedFrom:
        'Visible Human Male cryosections, 0.33 mm; brain from the Allen Human Reference Atlas',
      // MEASURED off hra-m.glb with node transforms applied, not estimated. It
      // was written as 1.8 first, which was a guess that happened to land close;
      // the same measurement reproduces the female's committed 1.658 exactly,
      // which is what makes this one trustworthy.
      heightM: 1.824,
    },
    sourceData: {
      bytes: 241633636,
      note: 'the male whole-body GLB, from the same reference library',
    },
    termSystem: 'UBERON',
    groupKey: hraGroupKey,
    systemForGroup: hraSystemForGroup,
    systemForTerm: hraSystemForTerm,
    isHiddenGroup: hraIsHiddenGroup,
  },
  /**
   * BodyParts3D, taken DIRECT from DBCLS rather than via Z-Anatomy.
   *
   * DBCLS relicensed it from CC BY-SA 2.1 Japan to **CC BY 4.0 on 2025-02-27**
   * — verified 27 July 2026 against both
   * <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html> and the README
   * bundled in the LATEST data distribution. Going direct is what avoids the
   * copyleft: Z-Anatomy's own retopology is separately CC-BY-SA by its authors'
   * choice, so the downstream copy is still share-alike even though the
   * upstream no longer is.
   *
   * ⚠️ DO NOT "CORRECT" THIS BACK TO SHARE-ALIKE. The sources contradict each
   * other, and the stale ones are the easier ones to find. Re-verified against
   * the live pages on 28 July 2026:
   *
   *   README_e.html   prose says CC BY 4.0, the badge is by/4.0/88x31.png, the
   *                   primary link is licenses/by/4.0/deed.en, and the change
   *                   log records "2025/02/27 License is updated"
   *                   — but ONE leftover anchor in that same section still
   *                   points at licenses/by-sa/2.1/jp/deed.en
   *   lic.html        CC BY (NBDC's structured metadata)
   *   lifesciencedb.jp/bp3d/info_en/license/  entirely stale: by-sa/2.1/jp only
   *
   * Four independent signals say CC BY 4.0 and only unmaintained anchor text
   * says otherwise, so CC BY 4.0 is what we rely on. It is not fully settled
   * until DBCLS confirm in writing, and that confirmation is worth chasing:
   * it decides whether share-alike binds our musculoskeletal pipeline at all.
   * Wikipedia, the popular GitHub mirror and Z-Anatomy all still cite the old
   * licence, so expect this to be questioned.
   *
   * 2,235 meshes, FMA-indexed — which joins directly to the FMA terms HRA also
   * uses. It is the only permissive source found for skeletal muscle (411
   * meshes) and for the **diaphragm** (FMA13295), which exists nowhere else
   * under a non-copyleft licence, HRA included.
   *
   * Cost of the permissive route: raw BodyParts3D meshes have documented holes
   * and non-manifold geometry. Cleaning them up is exactly the work Z-Anatomy
   * did — and why Z-Anatomy's meshes are the nicer ones. Budget for retopology.
   */
  bodyparts3d: {
    id: 'bodyparts3d',
    label: 'BodyParts3D',
    url: '/models/bodyparts3d.ao.glb',
    licence: 'CC BY 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution:
      'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.',
    citation:
      'Mitsuhashi N, et al. BodyParts3D: 3D structure database for anatomical concepts. ' +
      'Nucleic Acids Research 37 (2009) D782–D785.',
    shareAlike: false,
    donor: {
      sex: 'male',
      label: 'TARO (adult Japanese male voxel phantom)',
      // Mitsuhashi et al., Nucleic Acids Res. 2009: BodyParts3D was built on
      // TARO, a voxel human model for electromagnetic dosimetry derived from
      // whole-body MRI at 2 mm slice interval, with contours cleaned up in a 3D
      // editor. 2 mm against HRA's 0.33 mm is why the two atlases look like
      // different decades of modelling — it is a sampling difference, and no
      // amount of retopology recovers detail that was never captured.
      derivedFrom: 'TARO voxel phantom, whole-body MRI at 2 mm interval',
      heightM: 1.7,
    },
    sourceData: {
      bytes: 102154652,
      note: 'the BodyParts3D OBJ release, assembled here into one GLB before conversion',
    },
    termSystem: 'FMA',
    // `scripts/build-bodyparts3d.mjs` writes the already-resolved system into
    // each node's extras, so there is no runtime guessing to do here — the
    // FMA hierarchy was walked offline (docs/PERMISSIVE_ANATOMY.md).
    groupKey: (ud) => (typeof ud.system === 'string' ? ud.system : null),
    systemForGroup: (key) => (SYSTEM_IDS.has(key) ? (key as SystemId) : null),
  },
  /**
   * Z-Anatomy — BodyParts3D retopologised by medical illustrators.
   *
   * The mesh quality is the point: raw BodyParts3D has documented holes and
   * non-manifold geometry, and cleaning that up is precisely the work Z-Anatomy
   * already did. Rejected on 26 July under a commercial criterion the project no
   * longer holds; **D7 reverses that**, because CC BY-SA is Open Definition
   * conformant and share-alike costs an openness-bound project nothing.
   *
   * MUSCULOSKELETAL ONLY, AND DELIBERATELY SO. `scripts/build-z-anatomy.mjs`
   * takes the skeletal, muscular and joint files and nothing else, because
   * Z-Anatomy's own `Resources/Models/License.txt` shows two components are
   * NON-commercial — the inner ear at CC BY-NC-SA and the kidney at CC BY-NC —
   * and NC is not Open Definition conformant. Both live in the visceral and ear
   * models. Viscera therefore stay on BodyParts3D. See D11.
   */
  'z-anatomy': {
    id: 'z-anatomy',
    label: 'Z-Anatomy',
    // `.ao.glb` carries the baked per-vertex occlusion in COLOR_0, matching
    // BodyParts3D. Without it AtlasBody renders this atlas unoccluded — see the
    // `vertexColors` note there, which must follow the geometry rather than be
    // assumed on.
    url: '/models/z-anatomy.ao.glb',
    licence: 'CC-BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    // Both credits are required by the source licence, verbatim, and neither is
    // optional: Z-Anatomy for the retopology, BodyParts3D for what it is derived
    // from.
    attribution:
      'Z-Anatomy - The open source atlas of anatomy - CC-BY-SA 4.0; derived from ' +
      'BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan. ' +
      'Latin nomenclature extracted by ' +
      'Anatomed (pitfa19/anatomed-mcp) - CC-BY-SA 4.0.',
    shareAlike: true,
    /**
     * Z-Anatomy is an AGGREGATE, and these three are not the authors' own work.
     *
     * All of it is imported (D12b) and all of it is credited — attribution is the
     * condition these licences impose, and it is met here and in the GLB's own
     * `asset.copyright`. `npm run check:licences` counts how many structures each
     * one actually contributes by reading the shipped asset.
     */
    components: [
      {
        /**
         * The fuller chain, supplied by Dundee themselves on 18 August 2026 —
         * Caroline Erolin, Reader in Medical Art, replying to our credit-wording
         * query. Their model is itself a derivative, and their own Sketchfab
         * description carries this text; we were crediting only the last link.
         */
        title: 'Anatomy of the Inner Ear',
        holder: 'University of Dundee School of Medicine',
        licence: 'CC BY-NC-SA 4.0',
        derivedFrom:
          'a derivative of "3D Ear" by W. Robert J. Funnell, Sam Daniel and ' +
          'Daren Nicholson at McGill University, used under CC BY-NC-SA 1.0',
      },
      { title: 'Kidney', holder: 'lissiecowley', licence: 'CC BY-NC 4.0' },
      {
        // Verified 28 July against Z-Anatomy's own Resources/Models/License.txt.
        // Open (CC BY 4.0) so it blocks nothing, but attribution is a CONDITION
        // and we were rendering none — it was missing from this list until the
        // licence file was read directly rather than quoted second-hand.
        title: 'Cranial Nerves and Foramina',
        holder: 'University of Dundee, CAHID — produced by Sophia Lappe',
        /**
         * ⚠️ NOT A CC LICENCE ON THE MODEL, AND WE PRINTED ONE FOR WEEKS.
         *
         * Z-Anatomy's licence file says "CC-BY 4.0" and we copied it. Caroline
         * Erolin (Reader in Medical Art, Dundee) confirmed on 18 August 2026
         * that the model carries no CC licence at all — it is not downloadable
         * from their Sketchfab page, so none was ever attached — and that what
         * their page states is the licence of the DATA IT IS BASED ON.
         *
         * What we have instead is better than an inferred licence and worth
         * saying exactly: her written permission for this project ("As this is
         * based on the open-source Body Parts 3D data I don't have a problem
         * with it being re-purposed for this project"), plus the attribution
         * SHE ASKED FOR, which is the BodyParts3D chain. So the licence line
         * names the underlying data's licence, which is the only licence in
         * play, and the permission is recorded in licences.json where a reader
         * can find it.
         */
        licence: 'used with permission — underlying BodyParts3D data CC BY 4.0',
        derivedFrom:
          'based on the BodyParts3D data set, © The Database Center for Life ' +
          'Science, licensed under CC Attribution 4.0 International',
        // Verified on its Sketchfab page, 18 August 2026. The inner ear does
        // NOT carry the marking; this one does, so only this one says so.
        noAI: true,
      },
      {
        // Was 'Brainder / white matter — University of Washington, no licence
        // stated', and --publishable dropped it. Resolved 17 August 2026 (D20):
        // Anderson M. Winkler of brainder.org denies any UW affiliation, and
        // the measured geometry is his project's grey/white BOUNDARY surface —
        // closed folded hemispheres, sphericity in the cortical range — not
        // white matter proper. Under CC BY-SA 3.0 §4(b) an adaptation may be
        // distributed under a later licence version, which this CC BY-SA 4.0
        // asset is. The spinal-cord tube was never his (Brainder is
        // cortex-only) and is Z-Anatomy's own work, so it needs no entry here.
        title: 'Brain for Blender — white (grey/white boundary) surfaces',
        holder: 'Anderson M. Winkler (brainder.org)',
        licence: 'CC BY-SA 3.0',
      },
    ],
    donor: {
      sex: 'male',
      label: 'TARO, via Z-Anatomy retopology',
      derivedFrom: 'BodyParts3D (TARO, 2 mm MRI), retopologised by the Z-Anatomy authors',
      heightM: 1.7,
    },
    sourceData: {
      bytes: 547528024,
      note: 'seven Z-Anatomy FBX system files, assembled here into one GLB before conversion',
    },
    termSystem: 'FMA',
    // Same shape as BodyParts3D: the build script resolves the system offline
    // and writes it into `extras`. Easier here than there — Z-Anatomy ships one
    // FBX per system, so there is no FMA hierarchy to walk at all.
    //
    // ⚠️ It carries NO ontology ids. Z-Anatomy names structures in
    // Terminologia Anatomica English with l/r laterality suffixes and no term
    // of any kind, so a name->UBERON crosswalk is outstanding (D11).
    // `ontologyid` is absent rather than guessed.
    //
    // A trailing `i` or `j` is NOT laterality — it marks a landmark marker and
    // its label leader line. Those are annotation and the build script drops
    // them; before it did, they rendered as needles crossing the skin (D11a).
    groupKey: (ud) => (typeof ud.system === 'string' ? ud.system : null),
    systemForGroup: (key) => (SYSTEM_IDS.has(key) ? (key as SystemId) : null),
  },
  /**
   * SURFACE TOPOGRAPHY — the named regions of the body surface.
   *
   * 256 structures: cubital fossa, carotid triangle, deltoid region, the anal
   * region, the parts of the auricle. This is the vocabulary clinical description
   * actually uses for *where on the body* something is, and no other atlas here
   * carries it — HRA and BodyParts3D both model structures, not surface regions.
   *
   * A SEPARATE ATLAS RATHER THAN A LAYER, for a geometric reason and not a
   * licensing one (it is plain CC BY-SA): these patches lie ON the skin, so
   * merging them into `z-anatomy` would wrap the whole body in an opaque shell
   * and hide every organ behind it. Offered as its own switcher entry, it is one
   * click to go from anatomy to topography.
   *
   * ⚠️ Renders entirely UNRESOLVED, and that is correct. Its meshes declare
   * `system: 'regions'`, which is not a `SystemId`, so `systemForGroup` returns
   * null and nothing is score-coloured. A topographic region is not a body
   * system — the carotid triangle contains cardiovascular, nervous and muscular
   * structures at once, and claiming it for any one of them would be a
   * fabrication. Hover still names each region, which is the point of having it.
   */
  'z-anatomy-regions': {
    id: 'z-anatomy-regions',
    label: 'Body regions',
    url: '/models/z-anatomy-regions.ao.glb',
    licence: 'CC-BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attribution:
      'Z-Anatomy - The open source atlas of anatomy - CC-BY-SA 4.0; derived from ' +
      'BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan. ' +
      'Latin nomenclature extracted by ' +
      'Anatomed (pitfa19/anatomed-mcp) - CC-BY-SA 4.0.',
    shareAlike: true,
    donor: {
      sex: 'male',
      label: 'TARO, via Z-Anatomy retopology',
      derivedFrom: 'BodyParts3D (TARO, 2 mm MRI), retopologised by the Z-Anatomy authors',
      heightM: 1.7,
    },
    sourceData: {
      bytes: 8168176,
      note: 'one FBX — Regions of human body',
    },
    termSystem: 'FMA',
    groupKey: (ud) => (typeof ud.system === 'string' ? ud.system : null),
    systemForGroup: (key) => (SYSTEM_IDS.has(key) ? (key as SystemId) : null),
  },
  /**
   * The first atlas here derived from a real person's CT rather than modelled —
   * and the first with a **complete female body**.
   *
   * TCIA Healthy-Total-Body-CTs subject 003, segmented by the collection's authors
   * and meshed by `scripts/ct-atlas/labelmap2glb.py`. The segmentations and the
   * clinical data are both CC BY 4.0; only the CT images are behind NIH controlled
   * access, and they are not needed to build this.
   *
   * WHY IT MATTERS: HRA is the only other female donor here and it has no skeleton
   * above the pelvis — no ribs, skull, clavicle, scapula or humerus. This subject
   * has all of them, plus hands and feet, measured head-to-toe. That is ROADMAP
   * Phase 6's gap, closed from an openly licensed source.
   *
   * ⚠️ THE LABELS ARE GROUPED, and that is the trade. One `Ribcage`, not 24 ribs;
   * one `Spine`, not 24 vertebrae; every long bone merges left and right. So this
   * atlas gives whole-body coverage and NOT the per-structure identity Phase 1
   * exists to provide. The CT images being restricted means it cannot be
   * re-segmented finer. See `docs/healthy-total-body-cts-crosswalk.tsv`, where
   * every such row is flagged.
   *
   * ⚠️ Low-dose non-contrast CT, so bone is trustworthy and soft tissue less so —
   * D10's contrast objection applies to the organ masks even though bone-to-air
   * contrast does not care.
   */
  'htb-ct-f': {
    id: 'htb-ct-f',
    label: 'CT (female)',
    url: '/models/htb-ct-003.glb',
    licence: 'CC BY 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution:
      'Segmentations from the TCIA Healthy-Total-Body-CTs collection (subject 003), CC BY 4.0; ' +
      'meshed for this project. doi:10.7937/NC7Z-4F76.',
    shareAlike: false,
    donor: {
      sex: 'female',
      // From the collection's own CC BY 4.0 clinical spreadsheet, not inferred:
      // subject 003 is F, 26 years, 58.97 kg, 1.7018 m, BMI 20.4.
      label: 'Healthy-Total-Body-CTs subject 003 — female, 26',
      derivedFrom: 'low-dose non-contrast CT, 0.965 x 0.965 x 2.344 mm, segmented with MOOSE by the collection authors',
      heightM: 1.7018,
    },
    sourceData: {
      note:
        'grouped segmentation labelmaps from the TCIA collection, meshed here. The CT images ' +
        'themselves sit behind the NIH Controlled Data Access Policy and are not needed to build ' +
        'this, so they were never downloaded.',
    },
    termSystem: 'UBERON',
    /**
     * ⚠️ ARMS RAISED ABOVE THE HEAD, so the bounding box is the wrong ruler here
     * too — for a different reason from `ct-atlas-f` above, and with the same fix.
     *
     * The box measures toe-to-FINGERTIP: 1.8579 m against a recorded stature of
     * 1.7018 m, so the default fit would shrink every organ ~8 %. Crown-to-toe
     * measures 1.7083 m, within 0.38 % of the record — which is the real finding,
     * because it means the implied scale is 0.9951 and the honest answer is not to
     * scale at all. Segmented from a real CT, it is already life-size.
     *
     * A first pass here added a `heightFrom` field to compute that 0.9951 from
     * named structures. It worked, and `registration` makes it unnecessary: if the
     * geometry is life-size, there is nothing to measure a scale FROM. Anchoring
     * beats scaling.
     *
     * The anchor is the floor, because unlike the torso atlas this scan contains
     * feet: the lowest foot bone sits at raw y 0.5941 and belongs at world y 0.
     * Checked against the other end — the skull vertex then lands at 1.708 m,
     * within 7 mm of the subject's recorded stature.
     */
    registration: {
      realScale: true,
      anchor: { rawY: 0.5941, worldY: 0, label: 'lowest foot bone (toe phalanges) on the floor' },
    },
  },
  /**
   * CT-derived atlas — the D7b route: generate anatomy from imaging rather than
   * inherit whatever donor a hand-modelled atlas happens to be.
   *
   * ⚠️ THE ONLY ATLAS HERE CARRYING ONTOLOGY IDS. Every structure has an
   * `ontologyid` (`UBERON:0002349` and friends) written by MOOSE's crosswalk, so
   * the term join that D11 says is outstanding everywhere else already works on
   * this one. That makes it the natural proving ground for phase 5.
   *
   * ⚠️ ITS SOURCE SCAN WAS NOT RECORDED AT BUILD TIME — RE-IDENTIFIED, D22.
   * `docs/CT_ATLAS_PIPELINE.md` is explicit that the licence is "set by the
   * SOURCE IMAGE, not the weights", and for three weeks nobody could name the
   * image, so this entry said "must not be published" and D21's withhold
   * machinery kept the GLB out of `dist`.
   *
   * Re-identified 18 August 2026 from three independent fingerprints (D22,
   * and the full evidence in `licences.json`): the scan geometry — subject
   * 1032's NIfTI header gives 287 × 3.0 mm = 861.0 mm, the GLB's measured
   * span to the millimetre; the class census — the pipeline doc's found-class
   * counts for 1032 sum to the GLB's exact node count; and the doc itself
   * developed on `enhance_1032_F.nii.gz`. Subject 1032 is the University
   * Hospital Leipzig contribution to ENHANCE.PET 1.6k, which is CC BY 4.0 per
   * the dataset's own paper (doi:10.1038/s41597-026-07218-y) — so the chain is
   * CC BY 4.0 end to end and the asset ships.
   */
  'ct-atlas-f': {
    id: 'ct-atlas-f',
    label: 'CT atlas',
    url: '/models/ct-atlas-f.glb',
    licence: 'CC BY 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution:
      'CT from the ENHANCE.PET 1.6k dataset, subject 1032 (University Hospital Leipzig, ' +
      'CC BY 4.0); segmented with MOOSE 3.2 (ENHANCE-PET), CC BY 4.0 weights.',
    citation:
      'Ferrara, D., Pires, M., Gutschmayer, S., et al. Sharing a whole-/total-body ' +
      '[18F]FDG-PET/CT dataset with CT-derived segmentations: an ENHANCE.PET initiative. ' +
      'Scientific Data (2026). doi:10.1038/s41597-026-07218-y',
    shareAlike: false,
    donor: {
      sex: 'female',
      label: 'ENHANCE.PET subject 1032 — F, 81, University Hospital Leipzig',
      derivedFrom:
        'FDG-PET/CT (CT series), 2009, Siemens Sensation 16 — an oncology patient, ' +
        'not healthy reference anatomy; skull base to mid-thigh, arms raised',
      // From the dataset's own PT-details.xlsx, not measured here. The scan is
      // torso-only, so this never drives scaling (realScale below) — it is the
      // donor's recorded standing height, shown as information.
      heightM: 1.56,
    },
    sourceData: {
      note: 'imaging-data/images/CT/1032.nii.gz from the public ENHANCE.PET 1.6k bucket, segmented with MOOSE 3.2. Identified retrospectively — see D22.',
    },
    /**
     * ⚠️ A PARTIAL atlas, and the default fit ruins it.
     *
     * The scan holds 0.861 m of anatomy — measured, from raw y −1.571 to −0.710
     * — because it is a torso study: cropped just above the skull base (the
     * brain is a 6 mm sliver) and stopping at mid-femur. Scaling those bounds to
     * a 1.70 m stature inflates everything ~1.97×, which is why this rendered as
     * a giant ribcage and why borrowing its skeleton for the female composite
     * looked so wrong.
     *
     * It is CT-derived, so it is already life-size: keep the scale and only
     * translate. The anchor is the clavicle rather than the topmost geometry,
     * because the top is the RAISED ARMS of the scanning pose, not the head.
     * Checked against the other landmarks it puts sternum at 1.23–1.38 m, spleen
     * at 1.15–1.21 m and bladder at 0.92–0.96 m, all anatomically right.
     */
    registration: {
      realScale: true,
      anchor: { rawY: -0.976, worldY: 1.4, label: 'clavicle (shoulder height)' },
    },
    termSystem: 'UBERON',
    groupKey: (ud) => (typeof ud.system === 'string' ? ud.system : null),
    systemForGroup: (key) => (SYSTEM_IDS.has(key) ? (key as SystemId) : null),
  },
}

/**
 * True when a source carries third-party components on terms stricter than its
 * headline licence — currently only Z-Anatomy, which is an aggregate.
 *
 * Not a gate. **D12b**: everything is imported, and this exists so the UI can
 * DISCLOSE the position rather than hide it. The obligation those components
 * carry is attribution, which `AtlasAttribution` renders in full.
 */
export function hasMixedRights(source: AnatomySource): boolean {
  return (source.components?.length ?? 0) > 0
}

/**
 * True when the atlases reachable under `mode` do not depict the same person.
 *
 * Today every mode resolves to one atlas, so this is always false and the UI
 * says nothing. It starts mattering the moment `COMPOSED_SOURCE` mixes again,
 * and it is the check that should have existed when HRA and BodyParts3D were
 * first offered side by side: the switcher presents them as two renderings of
 * one twin, and they are two different people of two different sexes.
 */
export function donorsDisagree(mode: AnatomyMode): boolean {
  const sexes = new Set(activeSources(mode).map((s) => s.donor.sex))
  return sexes.size > 1
}

/**
 * The donor a mode puts on screen, or null when it puts up more than one.
 *
 * Lets the UI name whose anatomy is being shown. Which matters more than it
 * sounds: the twin is a health record about the viewer, and the body rendering
 * it is a stranger's. Saying so is the difference between a reference model and
 * an implied claim about them.
 */
export function soleDonor(mode: AnatomyMode): AnatomyDonor | null {
  const sources = activeSources(mode)
  const first = sources[0]?.donor
  if (!first) return null
  return sources.every((s) => s.donor.label === first.label) ? first : null
}

/**
 * `composed` mode: which atlas supplies each system.
 *
 * **Musculoskeletal from Z-Anatomy, every other system from BodyParts3D.**
 * HRA supplies nothing here, for the coverage reason below.
 *
 * ### Why HRA is not in the mix
 *
 * Settled on 26 July 2026 by enumerating HRA's whole-body GLB and its 2,295-row
 * crosswalk. HRA covers the LOWER body skeleton well: the full vertebral column,
 * sacrum, coccyx, pelvis, and — despite the group being named `Knee` — the
 * entire lower limb (femur, tibia, fibula, patella, with ligaments).
 *
 * What it lacks is the upper body: **no ribcage, no skull, no clavicle or
 * scapula, no humerus/radius/ulna, no hands or feet, and essentially no skeletal
 * muscle** (not even the diaphragm). It renders a partial body, so it stays a
 * standalone option in the switcher rather than a source for the composed one.
 *
 * ### Why Z-Anatomy supplies musculoskeletal
 *
 * Raw BodyParts3D meshes have documented holes and non-manifold geometry.
 * Cleaning that up is exactly the work Z-Anatomy already did, so adopting it
 * skips the one genuinely expensive item that was outstanding here.
 *
 * An earlier version of this comment argued the opposite — that BodyParts3D
 * should supply musculoskeletal too, because CC BY 4.0 end to end "keeps every
 * commercial and dual-licensing option open". **D7 rejects that criterion.** The
 * project is bound to openness, not to commercial reusability, and CC BY-SA is
 * Open Definition conformant, so share-alike costs it nothing. What the old
 * argument was really buying was worse geometry.
 *
 * ### Why mixing two atlases is safe here, when it was not before
 *
 * The atlases stay SEPARATE GLBs, and now that matters legally as well as for
 * hygiene: keeping Z-Anatomy's CC BY-SA geometry in its own file stops the
 * share-alike obligation reaching BodyParts3D's CC BY 4.0 geometry or the code.
 *
 * See `docs/PERMISSIVE_ANATOMY.md` for the relicensing history, and D11/D11a for
 * what adopting Z-Anatomy cost.
 */
/**
 * MEASURED 28 July 2026, per system, from the built assets — not assumed.
 *
 * Z-Anatomy's structure table counted directly out of `z-anatomy.glb`;
 * BodyParts3D's from `docs/bodyparts3d-system-map.tsv`, the manifest of source
 * meshes its FMA walk assigned to each system (its shipped GLB is merged to 11
 * meshes and keeps no structure table, so its own file cannot be counted).
 *
 *   system            Z-Anatomy   BodyParts3D   chosen
 *   musculoskeletal      2,077          563     Z-Anatomy   3.7x
 *   nervous                589           86     Z-Anatomy   6.8x
 *   reproductive            14            1     Z-Anatomy    14x
 *   endocrine               10            3     Z-Anatomy   3.3x
 *   cardiovascular         676          754     Z-Anatomy   see below
 *   respiratory             38          283     BodyParts3D 7.4x
 *   metabolic                8           73     BodyParts3D 9.1x
 *   digestive               50           74     BodyParts3D 1.5x
 *   integumentary            0            1     BodyParts3D only source
 *
 * **Tie-break rule: coverage wins when the gap is material; where the two are
 * within ~10 %, the retopologised source wins.** Missing anatomy is a worse
 * defect than imperfect meshes — you cannot inspect what is not there — but
 * where coverage is a wash, Z-Anatomy's illustrator cleanup is the whole reason
 * this project adopted it (D11).
 *
 * ⚠️ **Cardiovascular is the one genuine judgement call**, and worth re-checking
 * by eye. BodyParts3D has 11 % more structures, so the rule above puts it inside
 * the tie-break band and quality decides. Z-Anatomy's model was verified to
 * carry the parts that matter — both atria, both ventricles with papillary
 * muscles, aorta, pulmonary trunk, both venae cavae, coronary and semilunar
 * leaflets — so it is not a stub. But `CardioVascular41.fbx` carries version
 * suffix **41** where every other Z-Anatomy file is **100**, and no myocardium or
 * pericardium is modelled by name. If the vasculature looks sparse next to
 * BodyParts3D's, flip this one line back.
 *
 * `lymphoid` is absent from this table because it is not a `SystemId`. Those
 * meshes carry a null system and the visibility filter passes null through, so
 * Z-Anatomy's spleen, thymus and lymph nodes render in composed mode already.
 */
export const COMPOSED_SOURCE: Record<SystemId, AnatomySourceId> = {
  // Z-Anatomy: far more structures, and illustrator-retopologised.
  musculoskeletal: 'z-anatomy',
  nervous: 'z-anatomy',
  reproductive: 'z-anatomy',
  endocrine: 'z-anatomy',
  // The judgement call — see the note above before changing it.
  cardiovascular: 'z-anatomy',
  // BodyParts3D: materially better coverage. Z-Anatomy models 38 respiratory
  // structures against 283, and 8 urinary/metabolic against 73.
  respiratory: 'bodyparts3d',
  metabolic: 'bodyparts3d',
  digestive: 'bodyparts3d',
  // The skin hull. BodyParts3D is the only source for it, and it is what the
  // separated parts are read against.
  integumentary: 'bodyparts3d',
}

/**
 * The best FEMALE body, composed the same way — and it is a different problem.
 *
 * ⚠️ **The male composite mixes two ATLASES of ONE DONOR. This mixes two
 * DONORS.** BodyParts3D and Z-Anatomy are both TARO, so `COMPOSED_SOURCE` blends
 * meshes of the same man and every structure belongs to the same body. There is
 * no equivalent for women: the only female sources here are HRA (Visible Human
 * Female) and the CT atlas, and they are two different people.
 *
 * So this is a composite in a weaker sense, and the UI must not imply otherwise.
 * `AttributionBar` names the donor of every contributing source for exactly this
 * reason — see the note there.
 *
 * **HRA female carries the whole body except the upper skeleton**, and is the
 * spine of this map: 282 brain structures, 110 vasculature, 56 lung, both
 * kidneys, liver, gut, and — uniquely here — uterus, ovarian ligaments,
 * placenta and mammary glands that no male atlas can supply.
 *
 * ⚠️ **`musculoskeletal` stays with HRA, and this was TRIED the other way and
 * reverted — do not redo it without looking at the screen.** HRA female has
 * vertebrae, disks, knees and pelvis but **no skull, ribs, clavicle, scapula,
 * humerus, radius, ulna, carpals or phalanges** — measured — so on her own she
 * renders as torso-and-legs, and the tie-break rule above ("coverage wins when
 * the gap is material") argues for borrowing the CT atlas's skeleton.
 *
 * **It does not work, and the reason generalises.** Pointing this at
 * `'ct-atlas-f'` renders a floating skull, detached arms and a ribcage and
 * pelvis grossly out of scale with the organs inside them. The two are different
 * people in different frames — HRA's pelvis sits at y≈0.02 where the CT atlas's
 * is at y≈−1.5 — and no per-atlas transform makes one person's ribs enclose
 * another's lungs. The tie-break rule was written to choose between two atlases
 * of the SAME donor (BodyParts3D vs Z-Anatomy, both TARO); it does not license
 * mixing donors, and applying it across people produces a body, not an atlas
 * choice.
 *
 * So an incomplete coherent woman beats a complete incoherent one. The gap is
 * real and the UI says so rather than filling it with a stranger's bones. See
 * `docs/PLAN_NEXT.md` item 21 for the route that actually closes it — segmenting
 * the Visible Human Female herself, so the skeleton is hers and registers by
 * construction.
 */
export const COMPOSED_SOURCE_F: Record<SystemId, AnatomySourceId> = {
  // Hers, and missing the upper skeleton. See the warning above before changing.
  musculoskeletal: 'hra',
  // Everything else is Visible Human Female throughout — one donor, known,
  // public domain, and UBERON-termed per structure.
  nervous: 'hra',
  reproductive: 'hra',
  endocrine: 'hra',
  cardiovascular: 'hra',
  respiratory: 'hra',
  metabolic: 'hra',
  digestive: 'hra',
  integumentary: 'hra',
}

/** The per-system map backing a composed mode. */
export function composedMap(mode: AnatomyMode): Record<SystemId, AnatomySourceId> {
  return mode === 'composed-f' ? COMPOSED_SOURCE_F : COMPOSED_SOURCE
}

/**
 * What a composed body is known to be MISSING, in the viewer's words.
 *
 * A gap the project knows about and has decided to live with has to be visible,
 * or it reads as a rendering fault — and "her arms are missing" is exactly the
 * kind of thing a viewer blames on the app. Kept beside the map it describes so
 * the two cannot drift; `AttributionBar` renders it verbatim.
 */
export const COMPOSED_GAPS: Partial<Record<AnatomyMode, string>> = {
  'composed-f':
    'The female body is one donor throughout — the Visible Human Female — and her atlas ' +
    'models no skull, ribs, clavicle, scapula, arms, hands or feet. That anatomy is absent, ' +
    'not hidden. It is left empty rather than filled from a different person, whose bones ' +
    'would not fit these organs.',
}

/**
 * True when a composed mode actually mixes atlases. While it resolves to a
 * single atlas, offering "best per system" as a choice would be a lie — it
 * renders identically to that atlas alone.
 *
 * ⚠️ **Pass the SEX-RESOLVED mode.** The default argument tests the male map,
 * and for a long while that was the only caller — which meant the female build,
 * where `COMPOSED_SOURCE_F` points every system at HRA, was offered as a
 * distinct composite that rendered exactly what the HRA pill already rendered.
 * The guard was right and was simply asked the wrong question.
 */
export function isComposedMixed(mode: AnatomyMode = 'composed'): boolean {
  return new Set(Object.values(composedMap(mode))).size > 1
}

/**
 * The one atlas a composed mode collapses to, or null when it genuinely mixes.
 *
 * Lets the switcher SAY what "best per system" currently amounts to rather than
 * implying a merge that is not happening — today the female map points every
 * system at HRA. It is deliberately not used to hide the pill or to rewrite the
 * stored mode: `composed` is the default mode, so hiding it left the app with no
 * control for the state it starts in.
 */
export function soleComposedSource(mode: AnatomyMode): AnatomySourceId | null {
  const ids = new Set(Object.values(composedMap(mode)))
  return ids.size === 1 ? [...ids][0] : null
}

/**
 * `composed` = best atlas per system; otherwise force one atlas everywhere.
 *
 * `composed` is the male build and `composed-f` the female one. They are
 * separate modes rather than one mode plus a `sex` argument so that the sex
 * choice stays a single substitution inside `resolveMode` — everything
 * downstream keeps taking one opaque mode, as it did before.
 */
/**
 * ⚠️ `'parametric'` IS NOT AN ATLAS, and `activeSources` returns [] for it.
 *
 * It selects the generated parametric body INSTEAD of anatomy, rather than as a
 * skin over it — D16a measured that the envelope reads no atlas state, so
 * overlaying an adjustable shape on fixed organs builds bodies whose outside and
 * inside describe different people. As its own mode there is no inside to
 * disagree with.
 */
export type AnatomyMode = 'composed' | 'composed-f' | 'parametric' | AnatomySourceId

/**
 * The sex builds an atlas offers, keyed by the id the switcher shows.
 *
 * Derived from the registry rather than written out, so adding a variant is one
 * source entry and nothing else.
 */
const SEX_VARIANTS: Map<AnatomySourceId, Map<Sex, AnatomySourceId>> = (() => {
  const out = new Map<AnatomySourceId, Map<Sex, AnatomySourceId>>()
  for (const s of Object.values(ANATOMY_SOURCES)) {
    const base = s.variantOf ?? s.id
    if (!out.has(base)) out.set(base, new Map())
    out.get(base)!.set(s.donor.sex, s.id)
  }
  return out
})()

/**
 * Which sexes the atlas behind `mode` can render.
 *
 * A composed mode offers both, because both maps exist. It used to return an
 * empty list — correct when there was only a male composite, and wrong now that
 * asking for a female body has an answer.
 */
export function sexesFor(mode: AnatomyMode): Sex[] {
  // Sex is a slider here, not a donor choice, so the switcher offers no row.
  if (mode === 'parametric') return []
  if (mode === 'composed' || mode === 'composed-f') return ['male', 'female']
  const base = ANATOMY_SOURCES[mode].variantOf ?? mode
  return [...(SEX_VARIANTS.get(base)?.keys() ?? [])]
}

/**
 * Apply the requested sex to a mode, if that atlas has a build for it.
 *
 * Resolving here rather than threading `sex` through `sourceForSystem`,
 * `activeSources` and everything downstream keeps the sex choice a single
 * substitution at the point the mode is read. An atlas with only one donor —
 * BodyParts3D and Z-Anatomy are both TARO, and male — is returned unchanged, so
 * asking for a female body simply does not move them. The UI has to say that
 * rather than imply the request was honoured.
 */
export function resolveMode(mode: AnatomyMode, sex: Sex): AnatomyMode {
  // The parametric body has no donor and no per-sex build; it resolves to itself.
  if (mode === 'parametric') return mode
  // A composed mode swaps to the whole other map rather than to a variant of
  // one atlas, since the two sexes are composed from different sources
  // entirely — TARO for him, Visible Human Female for her.
  if (mode === 'composed' || mode === 'composed-f') {
    return sex === 'female' ? 'composed-f' : 'composed'
  }
  const base = ANATOMY_SOURCES[mode].variantOf ?? mode
  return SEX_VARIANTS.get(base)?.get(sex) ?? mode
}


/**
 * Which atlas provides a given system under the current mode.
 *
 * ⚠️ Throws for `'parametric'`, deliberately. That mode has no atlas and no
 * systems, so every caller here is already asking the wrong question — returning
 * an arbitrary atlas would answer it wrongly and silently. `Body.tsx` never
 * mounts an `AtlasBody` in that mode, so this is unreachable rather than
 * defensive.
 */
export function sourceForSystem(mode: AnatomyMode, system: SystemId): AnatomySource {
  if (mode === 'parametric') {
    throw new Error('sourceForSystem: the parametric body has no atlas sources')
  }
  if (mode === 'composed' || mode === 'composed-f') {
    return ANATOMY_SOURCES[composedMap(mode)[system]]
  }
  return ANATOMY_SOURCES[mode]
}

/**
 * The atlases actually in use under `mode`, deduplicated. Drives attribution —
 * credit what is on screen, not the whole registry.
 */
export function activeSources(mode: AnatomyMode): AnatomySource[] {
  // The parametric body is not sourced from an atlas, so it contributes none.
  if (mode === 'parametric') return []
  if (mode !== 'composed' && mode !== 'composed-f') return [ANATOMY_SOURCES[mode]]
  const ids = new Set(Object.values(composedMap(mode)))
  return [...ids].map((id) => ANATOMY_SOURCES[id])
}

/**
 * Which systems each atlas supplies under `mode`, for the credit panel.
 *
 * Attribution by atlas alone is too coarse for a composite: it credits the
 * rights holders correctly but leaves a viewer unable to tell WHICH anatomy came
 * from whom, which matters most exactly when the composite mixes donors. This
 * returns the breakdown so the panel can say "musculoskeletal — CT atlas" rather
 * than listing two names and leaving the join invisible.
 */
export function sourceBreakdown(mode: AnatomyMode): { source: AnatomySource; systems: SystemId[] }[] {
  // No donor, no atlas, nothing to break down. The parametric body is credited
  // by `ParametricPanel` instead, which can say what it actually is.
  if (mode === 'parametric') return []
  if (mode !== 'composed' && mode !== 'composed-f') {
    return [{ source: ANATOMY_SOURCES[mode], systems: [] }]
  }
  const bySource = new Map<AnatomySourceId, SystemId[]>()
  for (const [system, id] of Object.entries(composedMap(mode)) as [SystemId, AnatomySourceId][]) {
    if (!bySource.has(id)) bySource.set(id, [])
    bySource.get(id)!.push(system)
  }
  return [...bySource].map(([id, systems]) => ({ source: ANATOMY_SOURCES[id], systems }))
}

/**
 * True when `mode` renders one body assembled from more than one PERSON.
 *
 * ⚠️ **Not the same test as `donorsDisagree`, which asks whether the SEXES
 * disagree.** The female composite is exactly the case that separates them: HRA
 * female and the CT atlas are both female, so `donorsDisagree` is false, but
 * they are two different women, so this is true. Reading the sex test as a
 * donor test would report a two-person body as coherent.
 *
 * Also distinct from `isComposedMixed`: mixing two atlases OF THE SAME DONOR is
 * free — that is all the male composite does — whereas mixing donors makes a
 * claim about a body that no single body supports.
 */
export function mixesDonors(mode: AnatomyMode): boolean {
  const donors = new Set(activeSources(mode).map((s) => s.donor.label))
  return donors.size > 1
}

/*
 * There is deliberately NO `hasShareAlikeObligation(mode)` helper here.
 *
 * It existed, was never called, and would have answered the wrong question. It
 * tested `activeSources(mode)` — the atlases a mode WANTS — whereas the notice
 * has to follow the atlases actually installed and rendering, which is a subset.
 * With Z-Anatomy absent, the mode-based version claims a copyleft obligation for
 * geometry nobody is looking at. `AttributionBar` derives it from the installed
 * sources for that reason; see the comment there.
 */
