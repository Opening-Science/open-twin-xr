import { useState, type ReactNode } from 'react'
import { useTwin } from '../store'
import { AtlasControls, OrganOverlayRow } from './AttributionBar'
import { FramingControls } from './FocusSlider'
import { MaterialTuner } from './MaterialTuner'

/**
 * Every control that floats over the 3D view, in one place.
 *
 * WHY THIS EXISTS
 * ---------------
 * There used to be three independently positioned clusters — the atlas switcher at
 * `left-3 top-3`, the framing column at `right-3`, and the appearance buttons at
 * `right-[84px]` — and that last offset is the whole argument for this component. It
 * was a magic number chosen to clear the framing column, which meant one control
 * group's layout was encoded as a constant inside an unrelated file. Nothing
 * recomputed it when either group changed size, and the two clusters had already
 * collided once: at a 1024 px viewport four pairs of controls overlapped with their
 * labels unreadable, because each was anchored to an edge with no idea the other
 * existed.
 *
 * Here they are siblings in one layout, so the gap between them is a `gap` and the
 * space they may occupy is a `max-w`. There is no offset to keep in step.
 *
 * ⚠️ `pointer-events-none` ON THE WRAPPER IS LOAD-BEARING.
 * This element spans the whole card in order to place things against both edges. Left
 * interactive it would swallow every drag before OrbitControls saw it, and the body
 * would simply stop rotating — the same trap the `.scene-vignette` overlay documents.
 * Each card turns pointer events back on for itself, so the gaps stay draggable.
 *
 * GROUPING
 * --------
 * Four groups, in the order a viewer meets them: which BODY, whose body, what to ADD
 * to it, and how it should LOOK. The captions are what let the pills lose their
 * individual containers — three floating lozenges said "three unrelated things" by
 * position alone, and a caption says it in one word while costing no space.
 */
export function SceneDock() {
  /**
   * Collapsed state is local, and deliberately not in the store or persisted.
   *
   * Nothing else needs to read it, and it is a momentary preference — "get out of
   * the way while I look at this" — not a setting. Reloading to a hidden control
   * panel would be a worse default than reloading to a visible one.
   */
  const [open, setOpen] = useState(true)

  return (
    <div className="pointer-events-none absolute inset-2.5 z-20 flex items-start justify-between gap-3">
      <div className="pointer-events-auto flex max-w-[min(62%,22rem)] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm backdrop-blur">
        {/*
          The handle stays mounted in both states, so it is the same control in the
          same place rather than a button that appears where the panel used to be.
          Collapsed, the card shrinks to just this row.
        */}
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
          <span
            className={
              'text-[9px] font-semibold uppercase tracking-[0.11em] text-muted/70 ' +
              (open ? 'sr-only' : '')
            }
          >
            Controls
          </span>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={DOCK_BODY_ID}
            title={open ? 'Hide the controls' : 'Show the controls'}
            className="ml-auto rounded-md px-1.5 py-0.5 text-[13px] leading-none text-muted transition hover:bg-raised/60 hover:text-ink"
          >
            {/* Points the way the panel will move: ‹ folds it away, › brings it back. */}
            <span aria-hidden="true">{open ? '‹' : '›'}</span>
          </button>
        </div>

        {open && (
          <div id={DOCK_BODY_ID} className="flex flex-col">
            <AtlasControls />
            <DockGroup label="Overlays">
              <OrganOverlayRow />
            </DockGroup>
            <DockGroup label="Look">
              <LookControls />
            </DockGroup>
          </div>
        )}
      </div>

      {open && <FramingControls />}
    </div>
  )
}

const DOCK_BODY_ID = 'scene-dock-body'

/**
 * One captioned row of the dock.
 *
 * The hairline is a `border-t` on every group but the first, rather than a `divide-y`
 * on the parent: groups render conditionally (the donor row hides itself on a
 * single-donor atlas) and `divide-y` would leave the separator of a group that is not
 * there. `first:border-t-0` is wrong for the same reason — it is positional, and the
 * first *rendered* child is not always the first *written* one.
 */
export function DockGroup({
  label,
  children,
  divided = true,
}: {
  label: string
  children: ReactNode
  divided?: boolean
}) {
  return (
    <div className={'flex flex-col gap-1.5 px-2.5 py-2 ' + (divided ? 'border-t border-line' : '')}>
      <div className="text-[9px] font-semibold uppercase tracking-[0.11em] text-muted/70">
        {label}
      </div>
      {children}
    </div>
  )
}

/**
 * A dock pill. Extracted because there are now eleven of them across four groups and
 * they had drifted into three slightly different paddings and two different
 * disabled treatments.
 */
export function DockPill({
  on,
  disabled,
  onClick,
  title,
  children,
}: {
  on: boolean
  disabled?: boolean
  onClick: () => void
  title: string
  children: ReactNode
}) {
  return (
    <button
      onClick={() => !disabled && onClick()}
      disabled={disabled}
      aria-pressed={on}
      title={title}
      className={
        'flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] leading-tight transition ' +
        (disabled
          ? 'cursor-not-allowed text-muted/40'
          : on
            ? 'bg-raised text-ink shadow-sm'
            : 'text-muted hover:bg-raised/60 hover:text-ink')
      }
    >
      {children}
    </button>
  )
}

/**
 * Appearance: the two presentation options, the turntable, the theme, and the door
 * to the per-tissue tuner.
 *
 * The glass hull and the stage sit beside spin and theme rather than in the anatomy
 * sidebar deliberately. Nothing in this group changes what is on screen — no
 * structure appears or disappears, no colour that carries meaning is altered, no
 * measurement is implied. That is the line the sidebar is on the other side of: it
 * owns which systems and layers are VISIBLE. Mixing "make it look nicer" in with
 * "hide the muscle" would blur a distinction this project keeps deliberately sharp.
 */
function LookControls() {
  const glassHull = useTwin((s) => s.glassHull)
  const setGlassHull = useTwin((s) => s.setGlassHull)
  const stage = useTwin((s) => s.stage)
  const setStage = useTwin((s) => s.setStage)
  const spin = useTwin((s) => s.spin)
  const setSpin = useTwin((s) => s.setSpin)
  const theme = useTwin((s) => s.theme)
  const setTheme = useTwin((s) => s.setTheme)
  const availability = useTwin((s) => s.atlasAvailability)
  const hasHull = useHasHull()

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-0.5">
        <DockPill
          on={glassHull}
          disabled={!hasHull}
          onClick={() => setGlassHull(!glassHull)}
          title={
            hasHull
              ? 'Render the skin as glass: clear where it faces you, bright at grazing angles, ' +
                'so the body keeps its outline without veiling the anatomy'
              : 'This atlas has no skin mesh, so there is nothing for the effect to act on'
          }
        >
          Glass hull
          {/* Says why it is inert rather than looking broken. Two of the seven
              atlases genuinely ship no integumentary geometry. */}
          {!hasHull && availability !== null && (
            <span className="text-[9px] text-muted/60">no skin</span>
          )}
        </DockPill>

        <DockPill
          on={stage}
          onClick={() => setStage(!stage)}
          title="Ground rings and a backdrop falloff, so the body stands somewhere. Presentation only — unlabelled and unevenly spaced so it cannot be read as a scale"
        >
          Stage
        </DockPill>

        <DockPill
          on={spin}
          onClick={() => setSpin(!spin)}
          title={spin ? 'Stop the turntable' : 'Orbit the camera slowly around the body'}
        >
          {spin ? 'Spinning' : 'Spin'}
        </DockPill>

        <DockPill
          on={theme === 'dark'}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
        >
          {theme === 'dark' ? 'Dark' : 'Light'}
        </DockPill>
      </div>

      <MaterialTuner />
    </div>
  )
}

/**
 * Whether the atlas on screen has a skin mesh for the glass hull to act on.
 *
 * ⚠️ Two of the seven sources ship NO integumentary geometry — Z-Anatomy (0 of 11
 * merged nodes) and both CT atlases — so on those the toggle would be a control that
 * does nothing, which this repository treats as worse than a control that says it
 * cannot. Same rule the atlas pills already apply to a missing GLB.
 *
 * Derived from `presentSystems`, which `AtlasBody` publishes from the asset it
 * actually loaded, rather than from a hand-kept list of which atlas has skin — a
 * table like that goes stale the first time an asset is rebuilt.
 *
 * ⚠️ NOT from `presentLayers`, which was the first attempt and is wrong. That map
 * deliberately records only systems with more than one layer, because its job is to
 * decide when a sidebar row splits into sub-rows; the skin is a single mesh, so it is
 * never in there and the toggle read "no skin" on every atlas including the ones that
 * have it.
 */
function useHasHull(): boolean {
  const bySource = useTwin((s) => s.presentSystemsBySource)
  // The UNION across mounted atlases: `composed` routes integumentary to one of
  // them, and asking only the last one to publish gets the wrong answer.
  return Object.values(bySource).some((systems) => systems?.includes('integumentary'))
}
