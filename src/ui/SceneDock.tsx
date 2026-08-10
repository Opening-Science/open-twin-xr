import { useState, type ReactNode } from 'react'
import { useDonorSex, useTwin } from '../store'
import { AtlasControls, OrganOverlayRow } from './AttributionBar'
import { FramingControls } from './FocusSlider'
import { MaterialTuner } from './MaterialTuner'
import { BODY_ENVELOPES, BODY_ENVELOPE_IDS, envelopeSex } from '../scene/bodyEnvelopes'

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
  const parametric = useTwin((s) => s.anatomyMode) === 'parametric'

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
            {/*
              Overlays are organ replacements for an ATLAS, and the parametric
              mode has no atlas — `Body` returns early and never mounts them. The
              row was still drawn and still toggling state, which is the same
              inert-control problem the envelope row had directly below.
            */}
            {!parametric && (
              <DockGroup label="Overlays">
                <OrganOverlayRow />
              </DockGroup>
            )}
            {/*
              ⚠️ NO ENVELOPE ROW IN THE PARAMETRIC MODE. `Body` returns early
              there and never mounts `BodyEnvelope`, so every pill here was a
              control that changed stored state and nothing on screen.

              That is the failure `AtlasControls` already names for the donor
              toggle — offering a control that silently does nothing is worse
              than offering none, because it implies the request was honoured.
              It is also the wrong offer twice over: an envelope over the
              parametric body would be an ANNY surface drawn around an ANNY
              surface, and the whole point of D18 is that this mode replaces
              the body rather than wrapping one.
            */}
            {!parametric && (
              <DockGroup label="Envelope">
                <EnvelopeControls />
              </DockGroup>
            )}
            <DockGroup label="Inspect">
              <InspectControls />
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
 * The parametric skin envelope, and which preset.
 *
 * ⚠️ THE LABELS NAME PARAMETERS, NOT PEOPLE. Each preset is a point in ANNY's
 * phenotype space, and the shape space is artist priors from MakeHuman rather
 * than anthropometric ground truth — so "Adult female" means "the shape these
 * parameters produce", not "what a woman looks like". No measurement, body
 * composition or ergonomic claim attaches to any of them. The caption below the
 * pills says so in the interface, not only in a comment, because the interface
 * is where the claim would otherwise be made.
 *
 * Mutually exclusive rather than additive: two envelopes would be two skins.
 * Clicking the active one switches it off, matching every other pill here.
 */
function EnvelopeControls() {
  const envelope = useTwin((s) => s.bodyEnvelope)
  const setEnvelope = useTwin((s) => s.setBodyEnvelope)
  const availability = useTwin((s) => s.envelopeAvailability)
  // The donor actually on screen, NOT the requested `sex` — the two come apart
  // on male-only atlases. See `useDonorSex`.
  const donorSex = useDonorSex()
  const activeSex = envelope ? envelopeSex(envelope) : null
  const mismatched = donorSex !== null && activeSex !== null && activeSex !== donorSex

  const installed = BODY_ENVELOPE_IDS.filter(
    (id) => availability?.[BODY_ENVELOPES[id].url] ?? false,
  )

  // Assets are optional by design — a build may ship none of these. Say so
  // rather than showing five pills that cannot do anything.
  if (availability !== null && installed.length === 0) {
    return (
      <div className="text-[10px] leading-snug text-muted">
        No envelope installed. Run <span className="font-mono">npm run bake:anny</span> then{' '}
        <span className="font-mono">npm run convert:anny</span>.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-0.5">
        {BODY_ENVELOPE_IDS.map((id) => {
          const e = BODY_ENVELOPES[id]
          const present = availability?.[e.url] ?? false
          const matchesDonor = donorSex !== null && envelopeSex(id) === donorSex
          return (
            <DockPill
              key={id}
              on={envelope === id}
              disabled={!present}
              onClick={() => setEnvelope(envelope === id ? null : id)}
              title={
                present
                  ? `${matchesDonor ? `Matches this atlas's donor (${donorSex}). ` : ''}${e.note} ` +
                    `Baked from ${e.provenance.package} at ${Object.entries(e.provenance.parameters)
                      .map(([k, v]) => `${k} ${v}`)
                      .join(', ')} — ${e.heightM} m before scaling to the canonical body.`
                  : 'Not installed — see public/models/README.md'
              }
            >
              {e.label}
              {/* A dot, not a word: the pill row is already five items wide and a
                  label per pill would wrap it. The tooltip says what it means. */}
              {matchesDonor && (
                <span aria-hidden="true" className="text-[9px] leading-none text-[#4f9c84]">
                  ●
                </span>
              )}
              {matchesDonor && <span className="sr-only">matches this donor</span>}
            </DockPill>
          )
        })}
      </div>
      {/*
        The honesty lines, in the interface rather than only in the source.

        ⚠️ THE POSE CAVEAT IS THE IMPORTANT ONE AND IT IS MEASURED. ANNY has its
        own rest pose and every atlas here has a different one, so the envelope
        does not follow the limbs — on Z-Anatomy it spans 1.124 m across the arms
        against the atlas's 0.646 m. It encloses the torso and it does not enclose
        the arms. Saying so is what keeps this a reference silhouette rather than
        a claim about this body's shape, and it is why the surface is rendered as
        clear glass rather than as skin.
      */}
      <div className="text-[9px] leading-snug text-muted/70">
        A generated surface — no organs, no donor, no scan of anyone.{' '}
        {envelope ? 'Apache-2.0 code over CC0 shapes; credited in full below.' : ''}
      </div>
      {envelope && (
        <div className="text-[9px] leading-snug text-[#8a6d3b]">
          Its rest pose is not the atlas’s, so it wraps the torso but not the limbs. A reference
          silhouette, not this body’s skin.
        </div>
      )}

      {/*
        ⚠️ THE PAIRING WARNING. The envelope is switched to match the donor
        automatically when the atlas changes (see `BodyEnvelope`), so this only
        appears when a viewer has deliberately chosen the mismatched preset. That
        is allowed — but it must be labelled, because every other donor mismatch
        in this app is (`AttributionBar` has three such warnings) and a silent one
        here would be the odd exception.
      */}
      {mismatched && (
        <div className="text-[9px] leading-snug font-semibold text-[#8a6d3b]">
          This envelope is {activeSex}; the anatomy inside it is a {donorSex} donor. The two do not
          describe the same body.
        </div>
      )}
    </div>
  )
}

/**
 * Colour individual structures by a fact the ASSET carries.
 *
 * WHY THIS IS A SEPARATE GROUP FROM "LOOK"
 * ----------------------------------------
 * `Look` is explicitly the group where nothing on screen changes meaning — its
 * own comment says so. These two do change meaning: they repaint the body to
 * answer a question about the DATA, and that is a different kind of control.
 * Grouping them with the theme toggle would blur a line this project keeps
 * deliberately sharp.
 *
 * ⚠️ AND NEITHER OF THEM INTERPRETS ANYTHING. `Ontology` colours by whether a
 * structure carries an ontology term; `Licence` by whether it came from a
 * component under stricter terms. Both are properties of the GLB, checkable by
 * parsing it. Nothing here is a score, and the palette is deliberately not
 * red-amber-green so it cannot be read as one — see `scene/structureMask.ts`.
 *
 * Disabled where the atlas cannot honour it, rather than offered as a control
 * that does nothing: only assets carrying `_STRUCTURE` and a structure table can
 * address a structure at all. Same rule the glass hull applies to a skinless
 * atlas, and the pill says why.
 */
function InspectControls() {
  const inspect = useTwin((s) => s.structureInspect)
  const setInspect = useTwin((s) => s.setStructureInspect)
  const label = useTwin((s) => s.structureLabel)
  const setLabel = useTwin((s) => s.setStructureLabel)
  const hasStructures = useHasStructures()

  const MODES = [
    {
      id: 'ontology' as const,
      label: 'Ontology',
      title:
        'Colour each structure by whether it carries an ontology term — blue mapped, sand not ' +
        'yet mapped. On Z-Anatomy that is 1,048 of 3,614; this shows which ones.',
    },
    {
      id: 'licence' as const,
      label: 'Licence',
      title:
        'Colour each structure by whether it comes from a third-party component under terms ' +
        'stricter than the atlas’s own. Violet structures are non-commercial.',
    },
  ]

  return (
    <div className="flex flex-wrap gap-0.5">
      {MODES.map((m) => (
        <DockPill
          key={m.id}
          on={inspect === m.id}
          disabled={!hasStructures}
          onClick={() => setInspect(inspect === m.id ? 'none' : m.id)}
          title={
            hasStructures
              ? m.title
              : 'This atlas carries no per-structure identity, so there is nothing to colour ' +
                'structure by. Try Z-Anatomy.'
          }
        >
          {m.label}
          {!hasStructures && <span className="text-[9px] text-muted/60">n/a</span>}
        </DockPill>
      ))}

      {/*
        The in-scene label. Grouped with the inspect modes rather than with
        `Look`, because it answers a question about the data — what is this — and
        `Look` is explicitly the group where nothing changes meaning.
      */}
      <DockPill
        on={label}
        disabled={!hasStructures}
        onClick={() => setLabel(!label)}
        title={
          hasStructures
            ? 'Float the selected structure’s name and ontology term at the structure itself. ' +
              'Hidden while the exploded view is open, because the explode happens in the ' +
              'vertex shader and a label cannot follow it.'
            : 'This atlas carries no per-structure identity, so there is nothing to label.'
        }
      >
        Label
        {!hasStructures && <span className="text-[9px] text-muted/60">n/a</span>}
      </DockPill>
    </div>
  )
}

/**
 * Whether the mounted atlas can address individual structures.
 *
 * Published by `AtlasBody` from the asset it actually loaded, for the same
 * reason `useHasHull` is: a hand-kept list of which atlas has a structure table
 * goes stale the first time an asset is rebuilt — and that is not hypothetical
 * here, because `build-bodyparts3d.mjs` already writes one and the shipped
 * BodyParts3D asset simply predates it.
 */
function useHasStructures(): boolean {
  const counts = useTwin((s) => s.structureCounts)
  return Object.values(counts).some((n) => (n ?? 0) > 0)
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
  const envelope = useTwin((s) => s.bodyEnvelope)
  // The UNION across mounted atlases: `composed` routes integumentary to one of
  // them, and asking only the last one to publish gets the wrong answer.
  const atlasHasSkin = Object.values(bySource).some((systems) =>
    systems?.includes('integumentary'),
  )
  // ⚠️ THIS IS THE D14 GAP CLOSED. The control used to be dead on three of the
  // seven sources — Z-Anatomy, the regions atlas and both CT atlases ship no
  // integumentary geometry — which meant the glass hull was unavailable on
  // exactly the atlases with the richest anatomy. A parametric envelope is a
  // skin, so where one is switched on there is now something for the effect to
  // act on, and the control comes back.
  return atlasHasSkin || envelope !== null
}
