import { useTwin } from '../store'
import { structureTerm } from '../scene/structureEntry'

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
