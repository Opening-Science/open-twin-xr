import { FMA_UBERON_BRIDGE } from './bridgeData'
import { structureTerm, type StructureEntry } from './structureEntry'

/**
 * Find a structure in whatever atlas is loaded, by name or by ontology term.
 *
 * WHY THIS EXISTS. 3,800 structures across the shipped atlases now carry an
 * ontology term, and until this there was nothing a person could do with one.
 * `docs/PLAN_IDENTITY.md` is the plan; this is the resolution half of it, kept
 * pure so it can be tested without a browser or an asset.
 *
 * ⚠️ NO STATIC SEARCH INDEX, AND THE PLAN WAS WRONG TO PROPOSE ONE. Every loaded
 * atlas already carries a structure table with `name`, `side`, `system` and
 * `ontologyid` — that IS the index, it is always in step with the geometry
 * because it travels inside the same file, and it costs nothing to search. A
 * generated index would have to be regenerated whenever an asset changed, could
 * not be committed (the assets are gitignored), and would be one more thing to
 * go stale. The only piece that genuinely has to ship separately is the bridge,
 * because it maps between two vocabularies rather than describing one atlas.
 *
 * ⚠️ NO FUZZY MATCHING. EVER. Substring and prefix matching on a LABEL is fine.
 * Approximate matching onto a TERM is not, and this is exactly where it would
 * feel harmless: the one place that discipline lapsed produced 32 FMA ids shared
 * across different structures — `Axillary artery`, `Axillary nerve` and
 * `Axillary vein` on a single term — so a search could have offered someone the
 * femoral nerve while they believed they had selected the artery. See D18 and
 * `scripts/check-crosswalk.mjs`.
 */

export interface StructureMatch {
  /** Index into the atlas's structure table — what the mask consumes. */
  id: number
  entry: StructureEntry
  /** How the query reached this structure. Shown, not hidden. */
  /**
   * How the match was made, so the interface can show the route.
   *
   * `latin` is a LABEL match like `name`, not a term resolution: D18 forbids
   * approximate matching onto a term and permits it on a label, and Latin
   * nomenclature is a label (D24). It ranks after the English name because a
   * viewer typing "tibia" means the structure they can see, not a coincidence
   * of Latin spelling.
   */
  via: 'name' | 'latin' | 'term' | 'bridge'
  /**
   * ⚠️ True when the bridge offered SEVERAL FMA terms for one UBERON concept.
   * A one-to-many correspondence, not an identity — surface it rather than
   * picking one.
   */
  ambiguous?: boolean
  /** Lower sorts first. Exact label, then prefix, then substring. */
  rank: number
}

/** Case, punctuation and whitespace folded. Nothing else — this is not a stemmer. */
function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‐-―]/g, '-')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const CURIE = /^(FMA|UBERON)[:_]\s*(\d+)$/i

/** `fma 24477`, `FMA:24477`, `uberon_0002107` -> a canonical CURIE, or null. */
export function parseTerm(query: string): string | null {
  const m = query.trim().replace(/\s+/, ':').match(CURIE)
  if (!m) return null
  return `${m[1].toUpperCase()}:${m[2]}`
}

/**
 * Every term equivalent to this one, including itself.
 *
 * A UBERON query expands to the FMA terms UBERON itself cross-references, and
 * the reverse. This is what lets someone search a concept from an imaging atlas
 * and find it in an FMA-addressed one.
 *
 * ⚠️ The bridge maps UNSIDED FMA classes — `tibia` is FMA:24476 while the
 * atlases use FMA:24477 (right) and FMA:24478 (left). `docs/fma-uberon-bridge.tsv`
 * already carries the sided ids in `in_repo`, resolved by descending FMA's own
 * hierarchy; this module deliberately does NOT re-derive them arithmetically.
 * The offset is not arithmetic — `clavicle` 13321 has children 13322/13323 but
 * `femur` 9611 has a left child at 24475, fifteen thousand away.
 */
export function equivalentTerms(term: string): { terms: string[]; ambiguous: boolean } {
  const out = new Set<string>([term])
  let ambiguous = false
  for (const b of FMA_UBERON_BRIDGE) {
    if (b.uberon === term) {
      for (const f of b.fma) out.add(f)
      if (b.ambiguous) ambiguous = true
    } else if (b.fma.includes(term)) {
      out.add(b.uberon)
      if (b.ambiguous) ambiguous = true
    }
  }
  return { terms: [...out], ambiguous }
}

export interface SearchOptions {
  /** Cap the result list. 0 or undefined means no cap. */
  limit?: number
}

/**
 * Search a loaded atlas's structure table.
 *
 * Returns [] for a blank or single-character query rather than the whole atlas —
 * 3,614 results is not an answer.
 */
export function searchStructures(
  entries: readonly StructureEntry[],
  query: string,
  opts: SearchOptions = {},
): StructureMatch[] {
  const raw = query.trim()
  if (raw.length < 2) return []

  const matches: StructureMatch[] = []
  const seen = new Set<number>()
  const push = (m: StructureMatch) => {
    if (seen.has(m.id)) return
    seen.add(m.id)
    matches.push(m)
  }

  // 1. A typed CURIE resolves by term, through the bridge.
  const term = parseTerm(raw)
  if (term) {
    const { terms, ambiguous } = equivalentTerms(term)
    const wanted = new Set(terms)
    entries.forEach((e, id) => {
      const t = structureTerm(e)
      if (!t || !wanted.has(t)) return
      push({ id, entry: e, via: t === term ? 'term' : 'bridge', ambiguous, rank: 0 })
    })
    return opts.limit ? matches.slice(0, opts.limit) : matches
  }

  // 2. Otherwise match the label. Exact, then prefix, then substring — all three
  //    are literal containment, never approximate.
  const q = fold(raw)
  if (!q) return []
  entries.forEach((e, id) => {
    const name = fold(e.name ?? '')
    if (!name) return
    const rank = name === q ? 0 : name.startsWith(q) ? 1 : name.includes(q) ? 2 : -1
    if (rank < 0) return
    push({ id, entry: e, via: 'name', rank })
  })

  // 3. Then the Latin label, ranked BELOW every English match (+3) so it adds
  //    reach without reordering what a viewer already found. For a structure
  //    with no ontology term this is its only formal identity, and on the
  //    regions atlas it is the only identity of any kind — so not searching it
  //    would leave those structures reachable by English name alone.
  entries.forEach((e, id) => {
    const lat = fold(e.name_lat ?? '')
    if (!lat) return
    const rank = lat === q ? 0 : lat.startsWith(q) ? 1 : lat.includes(q) ? 2 : -1
    if (rank < 0) return
    push({ id, entry: e, via: 'latin', rank: rank + 3 })
  })

  matches.sort(
    (a, b) =>
      a.rank - b.rank ||
      (a.entry.name ?? '').localeCompare(b.entry.name ?? '') ||
      (a.entry.side ?? '').localeCompare(b.entry.side ?? ''),
  )
  return opts.limit ? matches.slice(0, opts.limit) : matches
}

/**
 * Why a search found nothing, so the interface can say which.
 *
 * ⚠️ THESE ARE THREE DIFFERENT PROBLEMS WITH THREE DIFFERENT FIXES, and
 * collapsing them into "no results" is the thing to avoid. `docs/ONTOLOGY_MAP.md`
 * already reports 8 overlay parts that no atlas here models at all — for those,
 * no amount of term work would ever produce a hit, and saying "not found" invites
 * someone to go looking for a mapping that cannot exist.
 */
export type EmptyReason =
  | 'too-short'
  /** The atlas has no structure with this name. */
  | 'not-in-this-atlas'
  /** A valid CURIE nothing here uses — possibly real anatomy this atlas omits. */
  | 'term-not-present'
  /**
   * A term search against an atlas that carries NO ontology terms at all.
   *
   * ⚠️ Not the same as "not present", and the difference is actionable:
   * `z-anatomy-regions` ships 257 structures and 0 terms, so every term query
   * against it returns nothing no matter how right the term is. Telling someone
   * "not found" there sends them looking for a mapping when the answer is that
   * this atlas has not been tagged yet.
   */
  | 'atlas-has-no-terms'

export function explainEmpty(entries: readonly StructureEntry[], query: string): EmptyReason {
  if (query.trim().length < 2) return 'too-short'
  if (!parseTerm(query)) return 'not-in-this-atlas'
  return entries.some((e) => structureTerm(e)) ? 'term-not-present' : 'atlas-has-no-terms'
}
