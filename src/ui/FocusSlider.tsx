import { useTwin } from '../store'

/**
 * Vertical body-height control for the camera.
 *
 * The orbit target was fixed at chest height with panning off, so the head and
 * feet could not be reached however far you zoomed. This drives the target
 * directly: drag the slider or hit a preset to travel up and down the body, then
 * zoom in as close as you like.
 *
 * Laid out vertically and aligned to the body because that is what it maps to —
 * the top of the track is the crown, the bottom is the floor.
 */
const PRESETS: { label: string; y: number; d: number; title: string }[] = [
  { label: 'Head', y: 1.58, d: 0.55, title: 'Skull and brain' },
  { label: 'Chest', y: 1.25, d: 0.8, title: 'Heart, lungs, ribcage' },
  { label: 'Abdomen', y: 0.98, d: 0.8, title: 'Liver, gut, kidneys' },
  { label: 'Pelvis', y: 0.78, d: 0.7, title: 'Pelvis and hips' },
  { label: 'Legs', y: 0.4, d: 1.1, title: 'Femur, knee, lower limb' },
  { label: 'Whole', y: 0.88, d: 2.5, title: 'Whole body' },
]

/** Matches the canonical standing height every atlas is normalised to. */
const MAX_Y = 1.75

export function FramingControls() {
  const focusY = useTwin((s) => s.focusY)
  const setFocusY = useTwin((s) => s.setFocusY)

  return (
    // No edge anchoring and no width constant: `SceneDock` places this against the
    // right edge and owns the gap to the dock. The `right-[84px]` magic number that
    // used to sit in MaterialTuner existed only to clear this column.
    <div className="pointer-events-auto flex max-h-full flex-col items-stretch gap-1.5 rounded-2xl border border-line bg-surface px-1.5 py-2 shadow-sm backdrop-blur">
      <div className="text-center text-[9px] font-semibold uppercase tracking-[0.11em] text-muted/70">
        View
      </div>
      <div className="flex flex-col gap-0.5">
        {PRESETS.map((p) => {
          // Nearest preset wins the highlight, so the label reflects where the
          // camera actually is after a free pan.
          const nearest = PRESETS.reduce((a, b) =>
            Math.abs(b.y - focusY) < Math.abs(a.y - focusY) ? b : a,
          )
          const active = nearest.label === p.label && Math.abs(p.y - focusY) < 0.12
          return (
            <button
              key={p.label}
              onClick={() => setFocusY(p.y, p.d)}
              title={p.title}
              aria-pressed={active}
              className={
                'rounded-lg px-2 py-1 text-[10px] leading-tight transition ' +
                (active ? 'bg-raised text-ink shadow-sm' : 'text-muted hover:bg-raised/60 hover:text-ink')
              }
            >
              {p.label}
            </button>
          )
        })}
      </div>

      <div className="flex h-32 items-center justify-center">
        {/* A range input rotated to run bottom-to-top, so dragging up moves the
            view up the body rather than inverting the mental model. */}
        <input
          aria-label="Body height focus"
          type="range"
          min={0}
          max={Math.round(MAX_Y * 100)}
          value={Math.round(focusY * 100)}
          onChange={(e) => setFocusY(Number(e.target.value) / 100, null)}
          className="h-1.5 w-28 origin-center -rotate-90 accent-[#4f9c84]"
        />
      </div>
    </div>
  )
}
