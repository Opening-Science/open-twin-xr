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

/**
 * Left-hand list of body-system cards. Clicking one selects the matching organ
 * in the 3D scene.
 *
 * Systems with `hasData: false` render as "No data" - never as a number and
 * never greyed out to look like a low score. Proxy-derived systems are marked.
 * See docs/SCHEMA_VERIFICATION.md.
 */
export function SystemScoreList() {
  const data = useTwin((s) => s.data)
  const selected = useTwin((s) => s.selectedSystem)
  const select = useTwin((s) => s.selectSystem)
  if (!data) return null

  // Measured systems first, unmeasured ones last: the list should lead with
  // what is actually known.
  const systems = [...data.systems].sort((a, b) => Number(b.hasData) - Number(a.hasData))

  return (
    <div className="flex flex-col gap-3 overflow-y-auto pr-1">
      {systems.map((sys) => {
        const active = selected === sys.id
        const color = '#' + scoreToColor(sys.hasData ? sys.score : null).getHexString()
        return (
          <button
            key={sys.id}
            onClick={() => select(active ? null : sys.id)}
            className={
              'text-left rounded-2xl border p-4 transition-all ' +
              (active
                ? 'bg-white border-[#5fae94] shadow-md'
                : sys.hasData
                  ? 'bg-panel border-white/60 hover:bg-white/90'
                  : 'bg-white/30 border-white/40 hover:bg-white/50')
            }
          >
            <div className="flex items-center justify-between gap-2">
              <span className={'font-medium ' + (sys.hasData ? 'text-ink' : 'text-muted')}>
                {sys.name}
              </span>
              {sys.hasData ? (
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted">Score</span>
                  <span className="text-lg font-semibold" style={{ color }}>
                    {sys.score}
                  </span>
                </span>
              ) : (
                <span className="text-[11px] font-medium text-muted border border-current/30 rounded-full px-2 py-0.5 shrink-0">
                  No data
                </span>
              )}
            </div>

            {sys.proxy && sys.hasData && (
              <span className="inline-block mt-1 text-[10px] font-medium text-[#b07d3a] bg-[#f6ecd9] rounded px-1.5 py-0.5">
                proxy-derived
              </span>
            )}

            <p className="text-xs text-muted mt-1 line-clamp-2">{sys.summary}</p>
          </button>
        )
      })}
    </div>
  )
}
