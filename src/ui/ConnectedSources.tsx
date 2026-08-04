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

/** Right-hand "Connected Sources" panel (Oura Ring, Google Health, ...). */
export function ConnectedSources() {
  const data = useTwin((s) => s.data)
  if (!data) return null
  return (
    <div className="rounded-3xl bg-panel backdrop-blur-panel border border-white/60 shadow-sm p-5">
      <h3 className="font-semibold text-ink mb-3">Connected Sources</h3>
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-2 text-xs">
        <div className="text-muted">Source</div>
        <div className="text-muted">Status</div>
        <div className="text-muted">Last Sync</div>
        {data.connectedSources.map((s) => (
          <Row key={s.name} name={s.name} status={s.status} sync={s.lastSync} />
        ))}
      </div>
      <button className="text-xs text-[#4f9c84] font-medium mt-4 hover:underline">Sync</button>
    </div>
  )
}

function Row({ name, status, sync }: { name: string; status: string; sync: string }) {
  return (
    <>
      <div className="text-ink">{name}</div>
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#5fae94]" />
        <span className="text-ink">{status}</span>
      </div>
      <div className="text-muted">{sync}</div>
    </>
  )
}
