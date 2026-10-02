import { useMemo, useState, type ChangeEvent } from 'react'
import { assertInterpretationDocument, SYSTEM_IDS } from '../data/interpretationContract'
import {
  INTERPRETATION_STYLES,
  RESEARCH_USE_FOOTER,
  SYSTEM_LABELS,
  absentSystems,
  placementIssues,
  styleForState,
} from '../data/interpretationPresentation'
import { useTwin, type ViewerMode } from '../store'

export function ViewerModeSwitch() {
  const mode = useTwin((state) => state.viewerMode)
  const setMode = useTwin((state) => state.setViewerMode)
  const options: { id: ViewerMode; label: string }[] = [
    { id: 'viewer', label: 'Viewer' },
    { id: 'interpretation', label: 'Interpretation' },
  ]

  return (
    <div
      role="group"
      className="flex gap-0.5 rounded-full border border-line bg-panel p-0.5 text-[11px] backdrop-blur-panel"
      aria-label="Viewer mode"
    >
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => setMode(option.id)}
          aria-pressed={mode === option.id}
          className={
            'flex-1 rounded-full px-3 py-1.5 transition ' +
            (mode === option.id ? 'bg-raised text-ink shadow-sm' : 'text-muted hover:text-ink')
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function InterpretationPanel() {
  const interpretationDocument = useTwin((state) => state.interpretationDocument)
  const setDocument = useTwin((state) => state.setInterpretationDocument)
  const selectedSystem = useTwin((state) => state.selectedSystem)
  const selectSystem = useTwin((state) => state.selectSystem)
  const [error, setError] = useState<string | null>(null)

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      setDocument(assertInterpretationDocument(parsed))
      setError(null)
    } catch {
      setError('The selected file does not satisfy interpretation-contract.v0.2.')
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-line bg-panel p-4 backdrop-blur-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Interpretation states</h2>
          <p className="mt-0.5 text-[10px] leading-snug text-muted">
            Categorical states supplied by the validated upstream document.
          </p>
        </div>
        <label className="cursor-pointer rounded-full bg-raised px-2.5 py-1 text-[10px] text-ink shadow-sm transition hover:opacity-80">
          Load JSON
          <input
            type="file"
            accept="application/json,.json"
            onChange={onFile}
            className="sr-only"
          />
        </label>
      </div>

      {interpretationDocument ? (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-track px-2.5 py-2 text-[10px] text-muted">
          <span>Validated v0.2 · {interpretationDocument.as_of}</span>
          <button
            onClick={() => setDocument(null)}
            className="shrink-0 transition hover:text-ink"
          >
            clear
          </button>
        </div>
      ) : (
        <p className="rounded-xl bg-track px-2.5 py-2 text-[10px] leading-snug text-muted">
          No interpretation document loaded. Anatomy remains in the no-data treatment.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-line px-2.5 py-2 text-[10px] text-ink">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-1">
        {SYSTEM_IDS.map((systemId) => {
          const states = interpretationDocument?.states.filter((state) => state.system_id === systemId) ?? []
          const selected = selectedSystem === systemId
          const rowStyle = styleForState(states.length === 1 ? states[0] : null)

          return (
            <div key={systemId} className="rounded-xl bg-track/60 px-2.5 py-2">
              <div className="flex items-center gap-2">
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-[4px]"
                  style={{ background: rowStyle.swatch }}
                  aria-hidden="true"
                />
                <button
                  onClick={() => selectSystem(selected ? null : systemId)}
                  className={
                    'flex-1 text-left text-[12px] transition ' +
                    (selected
                      ? 'font-medium text-ink'
                      : 'text-ink/80 hover:text-ink')
                  }
                >
                  {SYSTEM_LABELS[systemId]}
                </button>
              </div>

              <div className="mt-1 pl-5 text-[10px] leading-snug text-muted">
                {!interpretationDocument
                  ? 'No document loaded'
                  : states.length === 0
                    ? 'No interpretation state supplied'
                    : states.map((state) => {
                        const visual = styleForState(state)
                        return (
                          <div key={`${state.geometry.fma_id}:${state.severity}`} className="mt-1">
                            <span
                              className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[3px] align-[-1px]"
                              style={{ background: visual.swatch }}
                              aria-hidden="true"
                            />
                            <span className="text-ink/75">{visual.label}</span>
                            <span> · {state.geometry.fma_id}</span>
                            {!state.sufficient_data && (
                              <span className="block pl-4">Not enough input data — {state.insufficient_reason}</span>
                            )}
                          </div>
                        )
                      })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="border-t border-line pt-3">
        <div className="mb-2 text-[10px] uppercase tracking-wide text-muted">Legend</div>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.values(INTERPRETATION_STYLES).map((style) => (
            <div key={style.key} className="flex items-center gap-1.5 text-[9px] text-muted">
              <span
                className="h-3 w-3 shrink-0 rounded-[3px]"
                style={{ background: style.swatch }}
                aria-hidden="true"
              />
              {style.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function InterpretationEvidencePanel() {
  const interpretationDocument = useTwin((state) => state.interpretationDocument)
  const reports = useTwin((state) => state.interpretationFmaBySource)
  const availableFmaIds = useMemo(
    () => new Set(Object.values(reports).flat()),
    [reports],
  )
  const placements = useMemo(
    () => placementIssues(interpretationDocument, availableFmaIds),
    [interpretationDocument, availableFmaIds],
  )
  const absent = useMemo(() => absentSystems(interpretationDocument), [interpretationDocument])
  const supplied = interpretationDocument?.unrenderable ?? []
  const unplacedCount =
    supplied.length +
    placements.filter(
      (issue) =>
        issue.reason === 'no_fma_match' || issue.reason === 'duplicate_fma_state',
    ).length

  return (
    <section className="flex flex-col gap-2 rounded-3xl border border-line bg-panel p-4 backdrop-blur-panel">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Evidence not placed on anatomy</h2>
        <span className="rounded-full bg-track px-2 py-0.5 text-[10px] tabular-nums text-muted">
          {unplacedCount}
        </span>
      </div>

      {!interpretationDocument ? (
        <p className="text-[10px] leading-snug text-muted">
          No interpretation document loaded; no supplied evidence has been hidden.
        </p>
      ) : supplied.length === 0 && placements.length === 0 ? (
        <p className="text-[10px] leading-snug text-muted">No supplied groups or placement issues.</p>
      ) : null}

      {supplied.map((entry, entryIndex) => (
        <article
          key={`${entry.id}:${entryIndex}`}
          className="rounded-xl bg-track px-2.5 py-2 text-[10px]"
        >
          <div className="font-medium text-ink">{entry.label ?? entry.id}</div>
          <div className="mt-0.5 text-muted">{entry.reason.replace(/_/g, ' ')}</div>
          <ul className="mt-1 space-y-0.5 text-muted">
            {entry.contributing.map((contributor, index) => (
              <li key={`${contributor.biomarker_id}:${index}`}>
                {contributor.biomarker_id}: {contributor.status.replace(/_/g, ' ')}
              </li>
            ))}
          </ul>
        </article>
      ))}

      {placements.map((issue) => (
        <article key={issue.id} className="rounded-xl bg-track px-2.5 py-2 text-[10px]">
          <div className="font-medium text-ink">{SYSTEM_LABELS[issue.systemId]}</div>
          <div className="mt-0.5 text-muted">{issue.message}</div>
        </article>
      ))}

      {absent.length > 0 && (
        <div className="border-t border-line pt-2">
          <div className="text-[10px] font-medium text-ink">Contract notices</div>
          <ul className="mt-1 space-y-1 text-[10px] text-muted">
            {absent.map((systemId) => (
              <li key={systemId}>
                {SYSTEM_LABELS[systemId]}: No interpretation state supplied
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export function InterpretationFooter() {
  return (
    <footer className="shrink-0 px-6 pb-3 text-center text-[10px] leading-snug text-muted">
      {RESEARCH_USE_FOOTER}
    </footer>
  )
}
