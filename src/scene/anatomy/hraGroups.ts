/**
 * HRA organ-group -> SystemId.
 *
 * WHY THIS EXISTS, given the rule is "resolve by ontology id"
 * ----------------------------------------------------------
 * The ontology ids in HRA are real and correct — they are just at a much finer
 * granularity than a body system. `VH_F_nipple_L` is `UBERON:0013772`, not
 * `UBERON:0002097` ("skin of body"). Mapping the fine term up to a system needs
 * the UBERON part-of closure, i.e. an ontology reasoner we do not have at
 * runtime. And HRA writes terms only onto mesh leaves — the grouping nodes
 * above them carry none — so walking ancestors finds nothing either.
 *
 * Measured against the real asset (`3d-vh-f-united.glb`, 956 meshes): matching
 * system-level UBERON terms directly resolved **4 meshes, 0%**. The whole body
 * would have rendered neutral grey.
 *
 * Every mesh does carry `extras.anatomical_structure_of`, a stable organ-group
 * key such as `#VHFLiver` or `#VHMHeartV1.1`. There are 62 of them and between
 * them they cover every mesh. That is the handle that actually works.
 *
 * So: ontology ids remain the CROSS-ATLAS CONTRACT in `TwinMetrics` — that
 * is what makes the data source-independent — and this table is the HRA-specific
 * adapter from its geometry to those systems. Another atlas brings its own
 * adapter; the data never changes.
 */
import type { SystemId } from '../../data/schema'

/**
 * Reduce a raw group key to a comparable stem: `#VHMHeartV1.1` -> `heart`,
 * `#VHFLeftKidneyV1.1` -> `kidney`. Handles the male/female prefixes, the
 * per-organ version suffixes, laterality, and the doubled `##` seen on one
 * entry in the female model.
 */
export function normaliseGroup(raw: string): string {
  return raw
    .replace(/^#+/, '')
    .replace(/^VH[FM]/i, '')
    .replace(/V\d+(\.\d+)*$/i, '')
    // Laterality appears in different positions between the two models
    // (`LeftKidney` vs `KneeLigamentsRight`), so strip it wherever it occurs.
    .replace(/(Left|Right)/gi, '')
    .toLowerCase()
}

/**
 * Stem -> system. Anything absent is deliberately unresolved (see below).
 *
 * The two models are not consistent about compound word order — the female
 * model writes `LiverDucts` and `KneeLigamentsRight`, the male writes
 * `DuctsLiver` and `LigamentsRightKnee` — so both orders are listed rather than
 * guessed at with a fuzzy match.
 */
const GROUP_SYSTEM: Record<string, SystemId> = {
  // nervous
  allenbrain: 'nervous',
  brain: 'nervous',
  spinalcord: 'nervous',
  nerveseye: 'nervous',
  eye: 'nervous',
  muscleseye: 'nervous',

  // cardiovascular
  heart: 'cardiovascular',
  bloodvasculature: 'cardiovascular',

  // respiratory
  lung: 'respiratory',
  trachea: 'respiratory',
  mainbronchus: 'respiratory',
  larynx: 'respiratory',
  muscleslarynx: 'respiratory',

  // musculoskeletal — note how little of this HRA actually has
  vertebrae: 'musculoskeletal',
  intervertebraldisk: 'musculoskeletal',
  pelvis: 'musculoskeletal',
  sternum: 'musculoskeletal',
  manubrium: 'musculoskeletal',
  knee: 'musculoskeletal',
  kneeligaments: 'musculoskeletal',
  ligamentsknee: 'musculoskeletal',
  musclesknee: 'musculoskeletal',

  // metabolic (hepatic / pancreatic / splenic)
  liver: 'metabolic',
  liverducts: 'metabolic',
  ductsliver: 'metabolic',
  gallbladder: 'metabolic',
  gallbladderducts: 'metabolic',
  ductsgallbladder: 'metabolic',
  pancreas: 'metabolic',
  pancreasducts: 'metabolic',
  ductspancreas: 'metabolic',
  spleen: 'metabolic',

  // digestive
  mouth: 'digestive',
  largeintestine: 'digestive',
  colon: 'digestive',
  smallintestine: 'digestive',
  omentum: 'digestive',
  epiploicappendageoftransversecolon: 'digestive',

  // endocrine + renal (no dedicated renal system in the contract)
  thymus: 'endocrine',
  kidney: 'endocrine',
  renalpelvis: 'endocrine',
  ureter: 'endocrine',
  urinarybladder: 'endocrine',

  // reproductive
  uterus: 'reproductive',
  vagina: 'reproductive',
  ovary: 'reproductive',
  fallopiantube: 'reproductive',
  ligamentsuterusovaries: 'reproductive',
  placenta: 'reproductive',
  mammarygland: 'reproductive',
  prostate: 'reproductive',
  testis: 'reproductive',

  // integumentary
  skin: 'integumentary',
  adipose: 'integumentary',

  // Deliberately NOT mapped: lymphnode, palatinetonsil. They are immune-system
  // structures and the contract has no immune system. Inventing a home for them
  // would colour them by a score that says nothing about them, so they render
  // neutral instead.
}

/**
 * Groups excluded from the default render.
 *
 * The Visible Human Female is a specific donor, and HRA models her anatomy
 * faithfully — including a **full-term placenta**: 8 meshes, 25 cm wide, sitting
 * at roughly y=1.0 m. On a generic health twin it renders as a large mass
 * dominating the abdomen and reads as a tumour or an error. It is neither; it is
 * simply not general anatomy, so it is hidden rather than explained away.
 *
 * This is a presentation choice, not a data one: nothing is deleted, and a
 * future pregnancy view could render it deliberately.
 */
const HIDDEN_GROUPS = new Set(['placenta', 'placentafullterm', 'liversegment'])

/**
 * HRA models the liver at THREE levels at once, and rendering all of them is
 * what put hard-edged white patches across it.
 *
 * The atlas ships the whole organ (`#VHFLiver`), its lobes, and its eight
 * Couinaud segments. The lobe nodes carry no mesh, but the eight segments do —
 * and they occupy exactly the same volume as the whole liver, so two surfaces
 * end up coincident and fight for depth. That reads as blotchy white patches,
 * which was misdiagnosed as ambient occlusion twice before the overlapping
 * bounding boxes were actually measured.
 *
 * They carry `anatomical_structure_of: "-"`, so the group key cannot select
 * them and `hraGroupKey` gives them a synthetic one instead.
 *
 * ⚠️ Hidden, not deleted, and the distinction matters: Couinaud segments are how
 * liver surgery is planned, so this is genuinely useful anatomy that this viewer
 * has nowhere to put YET. The right home is a detail level — whole organ or
 * segments, not both at once — rather than a permanent exclusion.
 */
const LIVER_SEGMENT =
  /^VH_[FM]_(left|right)_(antero|postero|infero|supero)(lateral|medial|superior|inferior)_segment\d*$/i

export function isHiddenGroup(raw: string | undefined | null): boolean {
  if (!raw || raw === '-') return false
  return HIDDEN_GROUPS.has(normaliseGroup(raw))
}

/**
 * HRA's group key for a mesh, with a synthetic key where the atlas gives none.
 *
 * Falls back to the NODE NAME for the handful of meshes whose
 * `anatomical_structure_of` is the `-` placeholder but which still need to be
 * addressable — currently the liver's Couinaud segments, which have to be
 * hideable because they duplicate the whole-liver surface.
 */
export function groupKey(userData: Record<string, unknown>, nodeName: string): string | null {
  const v = userData.anatomical_structure_of
  if (typeof v === 'string' && v !== '-' && v !== '') return v
  if (LIVER_SEGMENT.test(nodeName)) return 'liversegment'
  return null
}

/** System for an HRA mesh's group key, or null when it has no mapped home. */
/**
 * UBERON term -> system, for HRA structures whose GROUP key is unusable.
 *
 * 35 of HRA's 96 meshes carry `anatomical_structure_of: "-"` — the placeholder,
 * not a group — so the stem table above can never reach them and they render
 * unresolved grey. But they are not anonymous: HRA tags every node with its own
 * `label` and `ontologyid`, so the term identifies them even when the grouping
 * does not.
 *
 * 27 of the 35 are renal calyces. `metabolic` matches the convention already set
 * by the offline FMA walk in `docs/bodyparts3d-system-map.tsv`, which puts
 * kidney, ureter and bladder there — keeping the two atlases substitutable,
 * which is the whole point of `COMPOSED_SOURCE`.
 *
 * ⚠️ The remaining 8 have NO label and NO term, and stay unresolved. That is the
 * honest outcome: grey means "we cannot identify this", and inventing a system
 * for geometry HRA itself does not name would be exactly the fabrication the
 * palette's grey exists to avoid. Palatine tonsil and lymph node are also left
 * alone — they are lymphoid, and `SystemId` has no lymphoid (see the Z-Anatomy
 * importer for why that is deliberate).
 */
const TERM_SYSTEM: Record<string, SystemId> = {
  'UBERON:0001227': 'metabolic', // minor calyx
  'UBERON:0001226': 'metabolic', // major calyx
}

/** System for an ontology term, or null. Used where the group key is absent. */
export function systemForTerm(term: string | undefined | null): SystemId | null {
  if (!term) return null
  return TERM_SYSTEM[term] ?? null
}

export function systemForGroup(raw: string | undefined | null): SystemId | null {
  if (!raw || raw === '-') return null
  return GROUP_SYSTEM[normaliseGroup(raw)] ?? null
}
