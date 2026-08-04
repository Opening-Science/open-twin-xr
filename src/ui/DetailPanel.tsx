/**
 * ⚠️ NOT MOUNTED — nothing in the app imports this file.
 *
 * It belongs to the health-scoring interface that was removed when the scope of this
 * repository narrowed to the body itself: anatomy, geometry, materials, lighting, XR.
 * Scoring and health-data mapping live in the separate `open-twin` repository and
 * the two reconcile later. See the box at the top of `CLAUDE.md`.
 *
 * It is kept rather than deleted, deliberately, for that later iteration — so it is
 * still compiled and still type-checked, and it will still be correct when someone
 * comes back to it. But **editing it changes nothing you can see in the running app**,
 * which is worth knowing before spending an afternoon on it.
 *
 * Do not rebuild the scoring UI here, and do not present the bundled fictional sample
 * as anyone's measured health.
 */
import { useTwin } from '../store'
import { scoreToColor } from '../scene/metricColor'

const SOURCE_LABEL: Record<string, string> = {
  oura: 'Oura Ring',
  'google-health': 'Google Health',
  'vitronic-bodyloop': 'VITRONIC BodyLoop',
  'open-wearables': 'Open Wearables',
  derived: 'Derived',
}

/**
 * Detail bar for the selected body system: score, provenance, caveats.
 * Provenance is shown because a score with no traceable source is exactly what
 * this project refuses to display.
 *
 * Anchored along the BOTTOM of the 3D view rather than floating over it. As a
 * top-right card it covered most of the torso, which hid the very organ the
 * selection was meant to highlight. The body is vertically centred, so a short
 * full-width bar overlaps only the legs.
 */
export function DetailPanel() {
  const data = useTwin((s) => s.data)
  const selected = useTwin((s) => s.selectedSystem)
  const select = useTwin((s) => s.selectSystem)
  if (!data || !selected) return null
  const sys = data.systems.find((s) => s.id === selected)
  if (!sys) return null
  const color = '#' + scoreToColor(sys.hasData ? sys.score : null).getHexString()

  return (
    <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/70 bg-white/92 px-4 py-3 shadow-lg backdrop-blur">
      <div className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-ink">{sys.name}</h4>
            {sys.hasData ? (
              <>
                <span className="text-2xl font-semibold leading-none" style={{ color }}>
                  {sys.score}
                </span>
                <span className="text-xs text-muted">/ 10</span>
              </>
            ) : (
              <span className="text-sm font-medium text-muted">No connected data source</span>
            )}
            {sys.proxy && (
              <span className="rounded bg-[#f6ecd9] px-1.5 py-0.5 text-[10px] font-medium text-[#b07d3a]">
                proxy-derived
              </span>
            )}
          </div>

          <p className="text-xs leading-relaxed text-muted">{sys.summary}</p>

          {sys.provenance.length > 0 && (
            <div className="text-[11px] text-muted">
              <span className="uppercase tracking-wide">Source</span>{' '}
              <span className="text-ink">
                {sys.provenance.map((p) => SOURCE_LABEL[p] ?? p).join(', ')}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={() => select(null)}
          className="shrink-0 text-sm text-muted transition hover:text-ink"
        >
          close
        </button>
      </div>
    </div>
  )
}
