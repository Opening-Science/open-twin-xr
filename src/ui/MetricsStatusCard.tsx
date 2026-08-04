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
import type { DerivedValue } from '../data/schema'

/**
 * Score ring plus the two age figures.
 *
 * Both ages are `DerivedValue`, because neither is a plain measurement:
 * biological age is not produced by any connector at all, and cardiovascular
 * age comes from Oura under a vendor-local code with no standard LOINC or
 * SNOMED concept. Unavailable values render as "n/a" with a caveat, never as a
 * number. See docs/SCHEMA_VERIFICATION.md.
 */
function AgeFigure({ label, value }: { label: string; value: DerivedValue }) {
  return (
    <div>
      <div className="text-xs text-muted flex items-center gap-1">
        {label}
        {value.caveat && (
          <span title={value.caveat} className="cursor-help text-[#b07d3a]">
            &#9432;
          </span>
        )}
      </div>
      {value.available && value.value !== null ? (
        <div className="text-4xl font-light text-ink">{value.value}</div>
      ) : (
        <div className="text-2xl font-light text-muted/70 mt-1.5">n/a</div>
      )}
    </div>
  )
}

export function MetricsStatusCard() {
  const data = useTwin((s) => s.data)
  if (!data) return null
  const { profile } = data
  const pct = Math.max(0, Math.min(100, profile.overallScore ?? 0))
  const r = 52
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ

  return (
    <div className="rounded-3xl bg-panel backdrop-blur-panel border border-white/60 shadow-sm p-6 flex items-center gap-8">
      <div className="flex-1">
        <h2 className="text-lg font-semibold text-ink">Status</h2>
        <div className="mt-4 flex gap-10">
          <AgeFigure label="Biological Age" value={profile.biologicalAge} />
          <AgeFigure label="Cardiovascular Age" value={profile.cardiovascularAge} />
        </div>
        {/* Rendered here rather than inside the ring: provenance sentences are
            longer than a 128px circle can hold without overflowing. */}
        <div className="text-[11px] text-muted mt-4">{profile.statusMessage}</div>
      </div>

      <div className="relative w-32 h-32 shrink-0">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#e6ecf1" strokeWidth="9" />
          {profile.overallScore !== null && (
            <circle
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke="url(#grad)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
            />
          )}
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#e6b566" />
              <stop offset="100%" stopColor="#5fae94" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {profile.overallScore !== null ? (
            <>
              <div className="text-xl font-semibold text-ink">{profile.overallScore}/100</div>
              <div className="text-sm text-[#c68a3f] font-medium">{profile.status}</div>
            </>
          ) : (
            <div className="text-sm font-medium text-muted">No score</div>
          )}
        </div>
      </div>
    </div>
  )
}
