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
 *
 * ⚠️ This file is also the ONLY reason `recharts` is a runtime dependency: 5.3 MB,
 * plus d3 and victory-vendor transitively. It is not in the bundle — an unimported
 * module never enters the graph — but it is installed on every `npm ci`, including
 * in CI. Kept so this component still compiles; drop both together if the scoring
 * UI is ever abandoned rather than deferred.
 */
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from 'recharts'
import { useTwin } from '../store'

/** The health-trend sparkline-style area chart from the mockup's top card. */
export function TrendChart() {
  const data = useTwin((s) => s.data)
  if (!data) return null
  return (
    <div className="rounded-3xl bg-panel backdrop-blur-panel border border-white/60 shadow-sm p-4 h-full min-h-[160px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data.trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5fae94" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#5fae94" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <YAxis domain={[60, 100]} hide />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #e2e8ee', fontSize: 12 }}
            labelFormatter={(l) => new Date(l).toLocaleDateString()}
          />
          <Area type="monotone" dataKey="score" stroke="#4f9c84" strokeWidth={2} fill="url(#trendFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
