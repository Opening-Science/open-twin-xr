import { useEffect, useState } from 'react'
import { useTwin } from '../store'
import { structureTerm } from '../scene/structureEntry'
import { definitionFor, type Definition } from '../data/definitions'

/**
 * What the viewer has selected, named precisely — and credited precisely.
 *
 * WHY THIS EXISTS
 * ---------------
 * Selecting a structure used to produce a highlight and a hover string, and
 * nothing else. Two facts the asset has always carried had no way to reach the
 * screen, because `StructureEntry` did not declare them:
 *
 * 1. THE ONTOLOGY TERM. `FMA:24477` is what makes a structure addressable across
 *    atlases and is the join any health data will eventually need. Showing it is
 *    also the cheapest possible check that the crosswalk reached the asset —
 *    `docs/ONTOLOGY_MAP.md` claimed Z-Anatomy carried zero terms while the built
 *    GLB carried 1,048, and that went unnoticed precisely because nothing
 *    displayed one.
 *
 * 2. ⚠️ THE LICENCE, WHICH IS THE PART THAT IS NOT OPTIONAL. Z-Anatomy is
 *    CC BY-SA 4.0, but eight of its structures are third-party components under
 *    NON-COMMERCIAL terms — the Dundee inner ear (CC BY-NC-SA 4.0) and a kidney
 *    (CC BY-NC 4.0). The atlas-level credit in `AttributionBar` states the
 *    atlas's licence, which for those eight structures is the WRONG ANSWER, and
 *    wrong in the permissive direction. A viewer who selects the cochlea is
 *    looking at something they may not use commercially, and until this card
 *    existed the interface did not say so anywhere.
 *
 *    So the licence line renders only when a structure carries its own — absence
 *    means the atlas's own terms apply and `AttributionBar` already states them.
 *    Showing a redundant licence on all 3,606 ordinary structures would train
 *    people to ignore the line that matters on the other eight.
 *
 * A term that is ABSENT is stated as absent rather than hidden. Two thirds of
 * Z-Anatomy has no CURIE, and "not yet mapped" is a fact about the crosswalk
 * worth seeing — silence would read as "this structure has no identity".
 */
export function SelectedStructureCard() {
  const selected = useTwin((s) => s.selectedStructure)
  const components = useTwin((s) => s.atlasComponents)

  /**
   * The definition for whatever is selected, or null.
   *
   * ⚠️ ABOVE THE EARLY RETURN, because hooks cannot run conditionally — the
   * component returns null when nothing is selected, so the lookup has to be
   * declared before that line rather than beside the code that renders it.
   *
   * `cancelled` is the repo's standard guard (see `useAtlasAvailability`): a
   * fast click-through would otherwise let an earlier structure's definition
   * land after a later one's.
   */
  const selectedTerm = structureTerm(selected?.entry ?? null)
  const [definition, setDefinition] = useState<Definition | null>(null)
  useEffect(() => {
    let cancelled = false
    setDefinition(null)
    definitionFor(selectedTerm).then((d) => {
      if (!cancelled) setDefinition(d)
    })
    return () => {
      cancelled = true
    }
  }, [selectedTerm])

  if (!selected) return null

  const { entry } = selected
  const term = structureTerm(entry)
  const component = entry.component ? components[entry.component] : undefined

  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-line bg-panel p-3 backdrop-blur-panel">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0 text-[12px] font-medium leading-tight text-ink">
          {entry.name}
          {entry.side && <span className="text-muted"> · {entry.side}</span>}
        </div>
        {entry.attachment && (
          <span className="shrink-0 text-[9px] uppercase tracking-wide text-muted">
            {entry.attachment}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted">
        {entry.system && <span>{entry.system}</span>}
        {entry.layer && <span>{entry.layer}</span>}
        {/* Monospace so a CURIE reads as an identifier rather than as prose. */}
        <span className={term ? 'font-mono text-ink/70' : ''}>
          {term ?? 'no ontology term'}
        </span>
      </div>

      {/*
        The ontology's own definition of this term.
        ⚠️ Silent when there is none, which is the common case on the FMA-keyed
        atlases: FMA publishes definitions for a couple of thousand of its
        ~100,000 classes, so most fine-grained structures have no published
        definition anywhere. Absence is the world's state, not a load failure,
        and inventing prose to fill the gap would be the one unacceptable
        answer. The source is named because attribution is these licences'
        condition.
      */}
      {definition && (
        <div className="flex flex-col gap-1 border-t border-line/60 pt-1.5">
          <p className="text-[11px] leading-snug text-ink/70">{definition.text}</p>
          <span className="text-[9px] text-muted">
            {definition.source} · {definition.licence}
            {/*
              A BORROWED definition, and the interface says so. The term this
              structure carries has none of its own, so this is the definition
              of the equivalent term in another vocabulary — a curated xref, not
              an identity. Naming the term it came from lets a reader judge the
              substitution instead of being told FMA wrote something it did not.
            */}
            {definition.via && ` · defined at ${definition.via}`}
          </span>
        </div>
      )}

      {/*
        The per-structure licence. Rendered ONLY when the structure carries one
        of its own — see the note above on why the common case is deliberately
        silent. The holder is named because attribution is the condition being
        satisfied, and a licence without a holder does not satisfy it.
      */}
      {entry.licence && (
        <div className="rounded-lg border border-line bg-raised/40 px-2 py-1.5 text-[10px] leading-snug text-ink/80">
          <span className="font-medium">{entry.licence}</span>
          {component && (
            <>
              {' · '}
              <span>{component.title}</span>
              {' · '}
              <span className="text-muted">{component.holder}</span>
            </>
          )}
          <div className="mt-0.5 text-muted">
            This structure comes from a third-party component under different
            terms from the rest of the atlas.
          </div>
        </div>
      )}
    </div>
  )
}
