/**
 * Anatomical definitions, looked up by ontology term.
 *
 * Built offline by `scripts/build-definitions.mjs` into
 * `public/data/definitions.json` and served from our own host — never fetched
 * from a third party at runtime, for the reason recorded against `inter-font`
 * in `licences.json`: a visitor's browser should talk to us and to nobody else.
 *
 * ⚠️ ABSENCE IS THE NORMAL CASE, NOT AN ERROR. Coverage is a property of the
 * ontologies, not of this app: UBERON defines nearly every term it has (the CT
 * atlases come out near complete), while FMA publishes definitions for only a
 * couple of thousand of its ~100,000 classes, so the fine-grained structures of
 * Z-Anatomy and BodyParts3D mostly have no published definition anywhere. A
 * structure with no definition shows none — the same honesty the rest of the
 * interface applies to missing data.
 */

export interface Definition {
  text: string
  label: string | null
  /** Which ontology said this, rendered as the attribution its licence requires. */
  source: string
  licence: string
  /**
   * Present when the definition was BORROWED from an equivalent term in another
   * vocabulary — most FMA structures have no definition of their own, so the
   * UBERON term they cross-reference supplies one. Rendered, because an xref is
   * a curated equivalence rather than an identity and a reader should see the
   * substitution rather than be told this ontology wrote it.
   */
  via?: string
}

interface DefinitionFile {
  $meta?: unknown
  definitions?: Record<string, Definition>
}

const URL = '/data/definitions.json'

/**
 * One in-flight fetch, one resolved answer, for the life of the page.
 *
 * A missing file resolves to an empty map rather than rejecting: the repository
 * must run with zero generated assets, and the card simply stays quiet. It is
 * never retried, so a 404 costs exactly one request rather than one per
 * selection.
 */
let pending: Promise<Record<string, Definition>> | null = null

export function loadDefinitions(): Promise<Record<string, Definition>> {
  if (!pending) {
    pending = fetch(URL)
      .then((r) => (r.ok ? (r.json() as Promise<DefinitionFile>) : null))
      .then((j) => j?.definitions ?? {})
      .catch(() => ({}))
  }
  return pending
}

/** The definition for a CURIE, or null. `term` is `structureTerm()`'s output. */
export async function definitionFor(term: string | null): Promise<Definition | null> {
  if (!term) return null
  const all = await loadDefinitions()
  return all[term] ?? null
}
