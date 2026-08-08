/**
 * The structure table an atlas carries on its scene extras, and the vocabulary
 * for reading ontology terms out of it.
 *
 * WHY THIS IS NOT IN `AtlasBody.tsx`, WHERE IT STARTED
 * ---------------------------------------------------
 * Two reasons, and the second is the one that actually forced the move.
 *
 * 1. `store.ts` needs `StructureEntry` to type `selectedStructure`, and
 *    `AtlasBody` imports `store.ts`. Taking the type from a leaf module instead
 *    of from the component means there is no cycle to reason about at all,
 *    rather than a cycle that happens to be safe because it is type-only.
 *
 * 2. ⚠️ REACT FAST REFRESH. A module that exports both components and plain
 *    values cannot be hot-replaced — Vite reports "Could not Fast Refresh
 *    (`structureTerm` export is incompatible)" and falls back to a FULL PAGE
 *    RELOAD. On this app that is not a minor annoyance: a reload re-downloads
 *    and re-parses the atlas, which is ~40 seconds for Z-Anatomy, on every edit
 *    to the largest and most-edited file in the repository. Keeping non-component
 *    exports out of `AtlasBody.tsx` is what keeps it hot-reloadable.
 */
/** `UBERON:0002097`, `UBERON_0002097`, and the FMA purl tail `fma73166`. */
export const CURIE = /\b(UBERON|FMA|CL|ASCTB)[:_]?(\d+)\b/i

/** HRA writes this literal when a node has no ontology term. */
export const NO_TERM = '-'

/** All spellings collapse to one: `UBERON:0002097`, `FMA:73166`. */
export function normalise(raw: string): string | null {
  const m = raw.match(CURIE)
  if (!m) return null
  return `${m[1].toUpperCase()}:${m[2]}`
}


export interface StructureEntry {
  name: string
  side?: 'left' | 'right'
  system?: string
  layer?: string
  /** Set when this mesh is a muscle attachment footprint painted on bone. */
  attachment?: 'origin' | 'insertion'
  /** Which slip, where a tendon splits (extensor digitorum longus has four). */
  slip?: number
  /** Mean vertex position at build time, in canonical metres. */
  centroid?: [number, number, number]

  /* ----------------------------------------------------------------------
   * Present in the built assets and, until now, UNDECLARED — so nothing in
   * `src/` could read them even though every one was sitting in
   * `scene.userData.structures` at runtime.
   *
   * ⚠️ Declaring these is a TYPE-LEVEL change and therefore a runtime no-op on
   * its own: the data was always there. What makes it matter is the two things
   * that go with it — `structureTerm()` below, and the consumers that read
   * `licence`. Adding the fields without those would change nothing at all.
   *
   * Measured on the shipped assets on 8 August 2026:
   *   z-anatomy.ao.glb          3,614 entries, 1,048 with `ontologyid`
   *                             (all `FMA:`), 3,614 with `centroid`,
   *                             8 with `component` + `licence`
   *   bodyparts3d.ao.glb        none of this — no structure table at all until
   *                             the asset is rebuilt from the current pipeline
   * -------------------------------------------------------------------- */

  /**
   * The structure's own ontology term, as a CURIE — e.g. `FMA:24477`.
   *
   * Written by `scripts/apply-crosswalk.mjs` from `docs/z-anatomy-fma.tsv`.
   * Absent on roughly two thirds of Z-Anatomy, because the crosswalk covers 618
   * distinct terms against 3,614 structures. Absence means "not yet mapped",
   * never "has no term".
   */
  ontologyid?: string
  /** The merged mesh this structure ended up in, e.g. `musculoskeletal/bone`. */
  mesh?: string

  /**
   * ⚠️ THE LICENCE FIELDS, AND THEY ARE THE REASON THIS BLOCK IS NOT COSMETIC.
   *
   * Z-Anatomy is not uniformly CC BY-SA. Eight structures in the shipped tier-1
   * asset come from third-party components under STRICTER terms, and the build
   * tags each one rather than dropping it (D12b — take everything, record
   * everything):
   *
   *   inner-ear-dundee     CC BY-NC-SA 4.0   Cochlea and Vestibule, both sides
   *   kidney-lissiecowley  CC BY-NC 4.0      4 structures
   *
   * `scene.userData.components` carries the holder, title and note for each id.
   *
   * Both are NON-COMMERCIAL, which is a materially different obligation from the
   * atlas's own licence — and until these fields were declared, a viewer could
   * select the cochlea and be told only that they were looking at Z-Anatomy,
   * CC BY-SA. `StructurePanel` now says so per structure. This is a licence
   * condition surfaced at the granularity the condition actually applies at.
   */
  component?: string
  licence?: string
}

/**
 * One entry of the `components` block on the scene extras — the provenance of a
 * third-party component embedded in an atlas.
 */
export interface AtlasComponent {
  id: string
  licence: string
  holder: string
  title: string
  note?: string
}

/**
 * The ontology term for a STRUCTURE, as opposed to `readTerm` for a NODE.
 *
 * ⚠️ THESE TWO RESOLVE AT DIFFERENT GRANULARITIES, AND THAT IS NOT A DEFECT TO
 * BE PAPERED OVER. `readTerm`/`termChain` answer "what is this mesh node", which
 * is the right question on HRA and the CT atlases, where each organ IS a node.
 * On Z-Anatomy the whole musculoskeletal system is three nodes covering 1,824
 * structures, so a node-level term could only ever name the system — there is no
 * node to hang `FMA:24477` on. The term lives in the structure TABLE, and
 * reaching it needs a structure id, which needs a raycast hit.
 *
 * So this is not a "fallback" in the node chain; it is the per-structure half of
 * a two-level scheme, and it is called where a structure id exists — hover,
 * selection — rather than in the per-mesh `entries` pass, which has no id.
 *
 * Normalised through the same `CURIE` grammar as node terms so that `FMA:24477`
 * from a table and `fma24477` from a purl compare equal.
 */
export function structureTerm(entry: StructureEntry | null | undefined): string | null {
  if (!entry?.ontologyid) return null
  return normalise(entry.ontologyid)
}
