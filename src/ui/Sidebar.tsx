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
 * This one is the whole dashboard chrome — the app now has no sidebar at all.
 */
const ITEMS = [
  { id: 'dashboard', label: 'dashboard' },
  { id: 'journey', label: 'journey' },
  { id: 'twin', label: 'your twin' },
]

/** Left rail nav from the mockup. Purely visual routing for the MVP. */
export function Sidebar({ active = 'dashboard' }: { active?: string }) {
  return (
    <aside className="w-20 shrink-0 flex flex-col items-center py-6 gap-2 bg-gradient-to-b from-[#f4f7fa] to-[#e9eef3] border-r border-white/60">
      <div className="text-ink font-semibold mb-6 lowercase">me</div>
      {ITEMS.map((it) => (
        <button
          key={it.id}
          title={it.label}
          className={
            'w-12 h-12 rounded-2xl flex items-center justify-center text-[10px] text-center leading-tight transition ' +
            (active === it.id ? 'bg-white shadow text-ink' : 'text-muted hover:bg-white/70')
          }
        >
          {it.label.split(' ')[0]}
        </button>
      ))}
      <div className="mt-auto w-10 h-10 rounded-full bg-white/70 flex items-center justify-center text-muted">you</div>
    </aside>
  )
}
