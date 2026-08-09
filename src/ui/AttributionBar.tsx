import { useMemo } from 'react'
import {
  ANATOMY_SOURCES,
  activeSources,
  donorsDisagree,
  COMPOSED_GAPS,
  isComposedMixed,
  mixesDonors,
  resolveMode,
  sexesFor,
  soleComposedSource,
  sourceBreakdown,
  type AnatomyMode,
} from '../scene/anatomySources'
import { BPM_RANGE, ORGAN_OVERLAYS, type OrganOverlayId } from '../scene/organOverlays'
import { SourcesButton } from './SourcesModal'
import { useTwin, useResolvedAnatomyMode } from '../store'
import { DockGroup, DockPill } from './SceneDock'
import { BODY_ENVELOPES } from '../scene/bodyEnvelopes'

const COMPARE_MODES: { value: AnatomyMode; label: string; title: string }[] = [
  {
    value: 'bodyparts3d',
    label: ANATOMY_SOURCES.bodyparts3d.label,
    title: 'Every system from BodyParts3D (CC BY 4.0) — one donor, one pose',
  },
  {
    value: 'hra',
    label: ANATOMY_SOURCES.hra.label,
    title: 'Every system from the HuBMAP Human Reference Atlas (CC BY 4.0)',
  },
  {
    value: 'z-anatomy',
    label: ANATOMY_SOURCES['z-anatomy'].label,
    title:
      'Every system from Z-Anatomy — skeleton, muscle, joints, nervous, cardiovascular, ' +
      'lymphoid and viscera. CC-BY-SA 4.0 plus three third-party components, all credited.',
  },
  {
    value: 'htb-ct-f',
    label: ANATOMY_SOURCES['htb-ct-f'].label,
    title:
      'A real person: TCIA Healthy-Total-Body-CTs subject 003, female, 26, at her measured size. ' +
      'CC BY 4.0. The only complete FEMALE body here — HRA has no skeleton above the pelvis. ' +
      'Labels are grouped, so one Ribcage rather than 24 ribs, and the arms are raised above the head.',
  },
  {
    value: 'ct-atlas-f',
    label: ANATOMY_SOURCES['ct-atlas-f'].label,
    title:
      'Anatomy segmented from CT with MOOSE — the only atlas here carrying UBERON ids per structure. ' +
      '⚠️ Its source scan is not recorded, so its licence is unresolved: research use only.',
  },
  {
    value: 'parametric',
    label: 'Parametric body',
    title:
      'A generated body you can reshape — six phenotype sliders from ANNY (Apache-2.0 code over ' +
      'CC0 MakeHuman shapes). ⚠️ Not anatomy and not a donor: no organs, no ontology terms, and ' +
      'no scan of anyone. It REPLACES the atlas rather than wrapping it, because an adjustable ' +
      'outside over fixed organs would describe two different people.',
  },
  {
    value: 'z-anatomy-regions',
    label: ANATOMY_SOURCES['z-anatomy-regions'].label,
    title:
      'Named regions of the body SURFACE — cubital fossa, carotid triangle, deltoid region. ' +
      'Topography, not anatomy: nothing here is score-coloured because a region is not a body system.',
  },
]

/**
 * The composed mode's pill. Named for the RULE, not for a count.
 *
 * It was "Best of both" while there were two atlases to be best of. There are
 * now six sources and two maps, so "both" had stopped denoting anything — and
 * the old tooltip said the female build "combines two", which was never true of
 * `COMPOSED_SOURCE_F`. It points every system at HRA.
 */
const COMPOSED_LABEL = 'Best per system'
const COMPOSED_TITLE =
  'Each body system from whichever atlas covers it best, with a separate map per sex. ' +
  'Male merges Z-Anatomy and BodyParts3D — two atlases of the same donor, TARO. ' +
  'Female is HRA alone for now: her atlas models no upper skeleton, and borrowing one ' +
  'from a different person was tried and reverted.'

/**
 * Compact atlas switcher, overlaid on the 3D view so the comparison happens
 * next to the thing being compared.
 */
export function AtlasControls() {
  // The CHOSEN atlas, not the sex-resolved one: the pressed tab should be
  // "HuBMAP HRA" whichever body it is currently showing.
  const mode = useTwin((s) => s.anatomyMode)
  // Read from the CHOSEN mode, not the sex-resolved one: `parametric` resolves
  // to itself, and the two rows below are wrong for it in opposite directions.
  const parametric = mode === 'parametric'
  const setMode = useTwin((s) => s.setAnatomyMode)
  const sex = useTwin((s) => s.sex)
  const setSex = useTwin((s) => s.setSex)
  const availability = useTwin((s) => s.atlasAvailability)
  const installed = useInstalledSources()

  /**
   * The composed pill is ALWAYS offered. It says what it resolves to instead.
   *
   * Withholding it where the map collapses to one atlas was tried and is wrong,
   * for a reason that only shows up when you open the app: `composed` is the
   * DEFAULT mode and `female` the default sex, and the female map points every
   * system at HRA — so the control for the mode you are actually in was missing on
   * first load. It also vanished on Z-Anatomy, which is male-only: the sex row
   * hides itself there but the stored `sex` stays female, so the gate read female
   * while a male body was on screen.
   *
   * The thing that gate was protecting against is real — two pills with one
   * outcome misleads — but it is a CONTENT gap, not a UI one: there is no female
   * composite yet (`docs/PLAN_NEXT.md` item 21 is the route to one). So the pill
   * stays and the tooltip stops implying a merge that is not happening. The
   * credits panel already renders `COMPOSED_GAPS` verbatim for the same reason.
   */
  const composedFor = resolveMode('composed', sex)
  const collapsesTo = isComposedMixed(composedFor) ? null : soleComposedSource(composedFor)
  const modes = [
    {
      value: 'composed' as AnatomyMode,
      label: COMPOSED_LABEL,
      title: collapsesTo
        ? `${COMPOSED_TITLE} — for this body it currently resolves to ` +
          `${ANATOMY_SOURCES[collapsesTo].label} alone, so it renders the same as that pill.`
        : COMPOSED_TITLE,
    },
    ...COMPARE_MODES,
  ]

  /**
   * Atlases a mode needs that are not on disk — tested against the build the
   * current sex actually selects, so "not installed" tracks the body that would
   * load rather than the other one.
   */
  const missingFor = (m: AnatomyMode) =>
    availability === null
      ? []
      : activeSources(resolveMode(m, sex)).filter((s) => !availability[s.url])

  // Which sexes the SELECTED atlas can render. One entry means no choice to
  // offer, so the control is not drawn at all rather than shown inert.
  const sexes = sexesFor(resolveMode(mode, sex))
  const soleSex = sexes.length < 2 ? activeSources(resolveMode(mode, sex))[0]?.donor.sex : null

  // ⚠️ The `max-w` below, and the `flex-wrap` on each pill row, are what stop this
  // cluster running underneath the focus slider. Both are overlays on the same 3D
  // card — this one anchored top-left, the slider top-right — and neither had a
  // width budget, so they collided as soon as the card got narrow. Measured: at a
  // 1024 px viewport the card is 656 px, the atlas row alone is 612 px and the
  // slider column takes 128 px, and four pairs of controls overlapped with their
  // labels unreadable. The reserve is the slider's 128 px plus its inset and a gap.
  // Wrapping is inert when there is room, so nothing changes on a wide screen —
  // verified at 1280 px, where no pair overlaps either way.
  return (
    <>
      <DockGroup label="Atlas" divided={false}>
        <div className="flex flex-wrap gap-0.5">
          {modes.map((m) => {
            const missing = missingFor(m.value)
            // Resolved, like `missingFor` — otherwise "Best per system" is judged
            // against the male map while the female body is the one on screen.
            const unavailable =
              missing.length > 0 &&
              missing.length === activeSources(resolveMode(m.value, sex)).length
            return (
              <DockPill
                key={m.value}
                on={mode === m.value}
                onClick={() => setMode(m.value)}
                title={
                  unavailable
                    ? `${missing.map((s) => s.label).join(', ')} is not installed — shows the procedural placeholder instead`
                    : m.title
                }
              >
                {m.label}
                {/* An option that cannot render its atlas has to say so up front.
                    Silently substituting the placeholder makes the fallback look
                    like the atlas, and gets judged as the atlas. */}
                {unavailable && <span className="text-[9px] text-muted/70">not installed</span>}
              </DockPill>
            )
          })}
        </div>
      </DockGroup>

      {/*
        Donor sex. Only HRA ships two bodies today — BodyParts3D and Z-Anatomy are
        both TARO, and male — so for those the control is replaced by a plain
        statement of whose body it is. Offering a toggle that silently does nothing
        would be worse than offering none: it would imply the atlas had honoured the
        request.
      */}
      <DockGroup label="Donor">
        {/*
          ⚠️ THE PARAMETRIC BODY HAS NO DONOR, and this row said "single donor"
          for it — the one claim about that mode the project is most careful to
          avoid making. It falls out of the same `activeSources() === []` that the
          banner below tripped on: no sources means no sexes, which the branch
          below reads as "one donor whose sex we could not name" rather than as
          "there is nobody here". Generated geometry is scan-free, which is the
          reason it is worth having; saying it has a donor gives that away.

          The `gender` SLIDER is not this control and must not be conflated with
          it. That is a shape parameter running male to female; this row is whose
          body you are looking at.
        */}
        {parametric ? (
          <div className="px-0.5 text-[11px] text-muted">no donor — generated</div>
        ) : sexes.length > 1 ? (
          <div className="flex flex-wrap gap-0.5">
            {(['female', 'male'] as const)
              .filter((s) => sexes.includes(s))
              .map((s) => (
                <DockPill
                  key={s}
                  on={sex === s}
                  onClick={() => setSex(s)}
                  title={`Show the ${s} donor`}
                >
                  <span className="capitalize">{s}</span>
                </DockPill>
              ))}
          </div>
        ) : (
          <div className="px-0.5 text-[11px] text-muted">
            {soleSex ? `${soleSex} donor only` : 'single donor'}
          </div>
        )}
      </DockGroup>

      {/*
        ⚠️ NOT IN THE PARAMETRIC MODE, which needs no atlas by design.

        The test is "no atlas is installed", and `activeSources('parametric')`
        returns [] on purpose — the mode REPLACES the atlas rather than wrapping
        one (D18) — so an empty list read as "nothing is installed, you are
        seeing the fallback". It isn't: what is on screen is ANNY, fully
        credited, and calling it a procedural placeholder both misdescribes the
        geometry and drops an attribution obligation onto a banner that denies
        one is owed.
      */}
      {!parametric && installed.length === 0 && availability !== null && (
        <div className="border-t border-line bg-[#fdf6e7]/90 px-2.5 py-1.5 text-[10px] leading-snug text-[#8a6d3b]">
          Showing <strong>procedural placeholder</strong> geometry — no atlas installed for this
          selection. See docs/MODEL_PIPELINE.md.
        </div>
      )}
    </>
  )
}

/**
 * Toggles for organ overlays, plus the rate control for anything animated.
 *
 * Rendered from `ORGAN_OVERLAYS`, so adding an organ needs no change here.
 */
export function OrganOverlayRow() {
  const overlays = useTwin((s) => s.overlays)
  const availability = useTwin((s) => s.overlayAvailability)
  const toggle = useTwin((s) => s.toggleOverlay)
  const bpm = useTwin((s) => s.heartRateBpm)
  const setBpm = useTwin((s) => s.setHeartRateBpm)
  const ids = Object.keys(ORGAN_OVERLAYS) as OrganOverlayId[]
  const heart = ORGAN_OVERLAYS['beating-heart']
  const heartOn = !!overlays['beating-heart']

  return (
    <>
      <div className="flex flex-wrap gap-0.5">
        {ids.map((id) => {
          const o = ORGAN_OVERLAYS[id]
          const on = !!overlays[id]
          /**
           * An overlay whose asset is not on the server cannot be switched on.
           *
           * A publishable build may withhold one on purpose — the beating heart is
           * `publishable: false` — and an enabled toggle for a file that 404s inside
           * the Canvas is a worse outcome than a disabled one that says why. Same
           * treatment the atlas pills already give a missing GLB. `null` means the
           * probe has not answered yet, and is treated as available so the control
           * does not flicker to disabled on every load.
           */
          const missing = availability !== null && availability[o.url] === false
          return (
            <DockPill
              key={id}
              on={on}
              disabled={missing}
              onClick={() => toggle(id)}
              title={
                missing
                  ? `${o.label} is not installed on this server — the asset was not shipped with this build`
                  : `${o.attribution} ${o.note}`
              }
            >
              {/* Pulses only for an overlay that actually animates, and at the rate
                  the geometry is using, so the glyph cannot imply motion that is not
                  there. Decorative — the readout below states the rate. */}
              <span
                className={on ? 'text-[#c4362a]' : ''}
                style={
                  on && o.animation
                    ? { animation: `pulse-beat ${(60 / bpm).toFixed(3)}s ease-in-out infinite` }
                    : undefined
                }
              >
                {o.icon}
              </span>
              {o.label}
              {missing && <span className="text-[9px] text-muted/60">not installed</span>}
            </DockPill>
          )
        })}
      </div>

      {/*
        Rate control.

        Deliberately says what it is: the asset carries 25 measured phases and NO
        timing, so this number is a playback choice. It is also the seam where
        real data lands later — a wearable series or a recorded session would set
        the same store value, which is why the control reads from the store rather
        than holding its own.
      */}
      {heartOn && (
        <div className="rounded-xl border border-line bg-panel/60 px-2.5 py-2 text-[11px]">
          <div className="flex items-baseline justify-between">
            <span className="text-muted">Heart rate</span>
            <span className="tabular-nums font-semibold">
              {bpm} <span className="font-normal text-muted">bpm</span>
            </span>
          </div>
          <input
            type="range"
            min={BPM_RANGE.min}
            max={BPM_RANGE.max}
            step={1}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            aria-label="Heart rate in beats per minute"
            className="mt-1.5 w-full accent-[#c4362a]"
          />
          <div className="mt-1 flex justify-between text-[9px] text-muted/70 tabular-nums">
            <span>{BPM_RANGE.min}</span>
            <span>{(60 / bpm).toFixed(2)} s / cycle</span>
            <span>{BPM_RANGE.max}</span>
          </div>
          <p className="mt-1.5 text-[9px] leading-snug text-muted/80">
            Playback rate, not a measurement — the 25 phases are measured, the timing is not.
            Rising rate shortens diastole more than systole in a real heart; this scales the
            whole cycle evenly.
          </p>
          <p className="mt-1 text-[9px] leading-snug text-muted/60">{heart.note}</p>
        </div>
      )}
    </>
  )
}

/** The active mode's atlases that are actually on disk and therefore rendering. */
function useInstalledSources() {
  const mode = useResolvedAnatomyMode()
  const availability = useTwin((s) => s.atlasAvailability)
  return activeSources(mode).filter((s) => availability?.[s.url])
}

/**
 * Licence credits for whichever atlases are currently rendering.
 *
 * Both atlases require attribution wherever the model or a rendering of it is
 * distributed, so this is the licence condition being met, not decoration. It
 * tracks the active mode: credit what is on screen. The strings are verbatim
 * required credit text and must not be paraphrased or truncated — which is why
 * this sits in the sidebar rather than crowding the 3D view.
 */
export function AtlasAttribution() {
  // Credit only atlases whose geometry is actually on screen. Crediting a work
  // we are not using is as wrong as failing to credit one we are, and the
  // share-alike notice in particular must not appear when no CC-BY-SA asset is
  // being rendered.
  const sources = useInstalledSources()
  const mode = useResolvedAnatomyMode()
  const shareAlike = sources.some((s) => s.shareAlike)
  // The envelope is credited only while it is actually rendering, exactly as
  // the atlases and overlays are — a licence obligation attaches to what is
  // distributed on screen, not to what the registry could offer.
  const parametricMode = useTwin((s) => s.anatomyMode) === 'parametric'
  const envelopeId = useTwin((s) => s.bodyEnvelope)
  const envelope = envelopeId ? BODY_ENVELOPES[envelopeId] : null
  const mixedDonors = donorsDisagree(mode)
  // Which systems each atlas contributes, so the credit can name the join.
  const systemsBySource = useMemo(
    () => new Map(sourceBreakdown(mode).map((b) => [b.source.id, b.systems])),
    [mode],
  )
  // Two different PEOPLE in one body — a weaker composite than the male one,
  // which mixes atlases of a single donor. Stated rather than left to be noticed.
  const twoBodies = mixesDonors(mode)
  // Overlays carry their own credit: they are separate works, and one of them is
  // a different person again from the body it sits inside.
  const overlays = useTwin((s) => s.overlays)
  const overlaysOn = (Object.keys(ORGAN_OVERLAYS) as OrganOverlayId[])
    .filter((id) => overlays[id])
    .map((id) => ORGAN_OVERLAYS[id])

  /**
   * ⚠️ THE PARAMETRIC BODY NEEDS ITS OWN CREDIT, AND IT WAS GETTING THE WRONG ONE.
   *
   * `activeSources('parametric')` returns [], so this component fell through to
   * the no-atlas branch below and told the viewer the body was "procedural
   * placeholder geometry generated in-app" for which "nothing here requires
   * attribution". Both halves were false: it is ANNY, and Apache-2.0 notice
   * retention is a condition rather than a courtesy. A credits panel that
   * actively denies an attribution obligation is worse than one that is merely
   * absent.
   */
  if (parametricMode) {
    const licences = BODY_ENVELOPES['anny-adult-f'].licences
    return (
      <div className="rounded-3xl border border-line bg-panel p-4 text-[11px] leading-relaxed text-muted backdrop-blur-panel">
        <h3 className="mb-2 text-sm font-semibold text-ink">Credits</h3>
        <p>{BODY_ENVELOPES['anny-adult-f'].attribution} arXiv:2511.03589</p>
        <ul className="mt-1 space-y-0.5 border-l border-line pl-2">
          {licences.map((l) => (
            <li key={l.covers}>
              <a
                href={l.url}
                target="_blank"
                rel="noreferrer noopener"
                className="whitespace-nowrap underline underline-offset-2 hover:text-ink"
              >
                {l.spdx}
              </a>{' '}
              — {l.covers}
            </li>
          ))}
        </ul>
        <p className="mt-2 font-semibold text-[#8a6d3b]">
          Not a person and not a donor: a generated surface with no organs, no ontology terms and
          no scan of anyone. The shape space is artist priors from MakeHuman, not measured
          population data.
        </p>
        <p className="mt-1 text-ink/60">
          Shape evaluated in-browser from a 360-point grid baked by{' '}
          <code>scripts/anny/bake_grid.py</code>; interpolation differs from the model itself by a
          median 5.1 mm.
        </p>
        <SourcesButton />
      </div>
    )
  }

  if (sources.length === 0 && overlaysOn.length === 0) {
    return (
      <div className="rounded-3xl border border-line bg-panel p-4 text-[11px] leading-relaxed text-muted backdrop-blur-panel">
        <h3 className="mb-2 text-sm font-semibold text-ink">Anatomy credits</h3>
        <p>
          No atlas installed for this selection, so the body is drawn from{' '}
          <strong>procedural placeholder</strong> geometry generated in-app. Nothing here requires
          attribution. Install an atlas per <code>docs/MODEL_PIPELINE.md</code> to render real
          anatomy.
        </p>
        {/*
          ⚠️ The button belongs on THIS path most of all, and was missing from it.
          It was added only to the credited path below, so the one state where a
          newcomer actually lands — clone the repo, `npm run dev`, no assets, the
          placeholder body — was the one state with no way to open the dialog that
          lists what the models are and how to obtain them.
        */}
        <SourcesButton />
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-line bg-panel p-4 text-[11px] leading-relaxed text-muted backdrop-blur-panel">
      <h3 className="mb-2 text-sm font-semibold text-ink">Anatomy credits</h3>

      <div className="flex flex-col gap-2">
        {sources.map((s) => (
          <p key={s.id}>
            {s.attribution}{' '}
            <a
              href={s.licenceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="whitespace-nowrap underline underline-offset-2 hover:text-ink"
            >
              {s.licence}
            </a>
            {/* Whose body this is. Each atlas is one real donor, and they are
                not the same donor or even the same sex — HRA is the Visible
                Human Female, BodyParts3D is an adult Japanese male phantom. A
                viewer comparing atlases is comparing people, and nothing on
                screen said so. */}
            <span className="mt-0.5 block text-ink/45">
              {s.donor.label} — {s.donor.derivedFrom}
            </span>
            {/*
              WHICH anatomy came from this source, not just that it contributed.
              Crediting two atlases side by side is accurate but leaves the join
              invisible, and the join is the thing a viewer most needs to see in
              a composite — especially the female one, where the skeleton and the
              organs are two different women. Only rendered when the mode
              actually composes; a single-atlas mode supplies everything.
            */}
            {systemsBySource.get(s.id)?.length ? (
              <span className="mt-0.5 block text-ink/40">
                supplies {systemsBySource.get(s.id)!.join(', ')}
              </span>
            ) : null}
            {/*
              A formal citation where the source has one. Separate from the
              credit above because they answer different obligations: the credit
              is what the LICENCE requires, the citation is what published
              research expects. Rendering only the first would satisfy the law
              and still be discourteous to the people whose work this is.
            */}
            {s.citation && <span className="mt-0.5 block text-ink/40">{s.citation}</span>}
            {/*
              Components inside this atlas that are somebody else's work on other
              terms. Z-Anatomy is an aggregate, and its inner ear, kidney and
              white matter are not the Z-Anatomy authors'. Crediting only the
              headline licence would under-attribute three rights holders whose
              geometry is on screen — and attribution is exactly what CC BY-NC
              and CC BY-NC-SA ask for in return.
            */}
            {s.components?.length ? (
              <span className="mt-1 block border-l-2 border-line pl-2 text-ink/45">
                Includes, on other terms:
                {s.components.map((c) => (
                  <span key={c.title} className="mt-0.5 block">
                    {c.title} — {c.holder} — {c.licence}
                    {c.needsPermission && (
                      <strong className="text-[#8a6d3b]">
                        {' '}
                        (no grant given; permission being sought)
                      </strong>
                    )}
                  </span>
                ))}
              </span>
            ) : null}
          </p>
        ))}

        {/*
          Overlays are separate rights holders on separate terms, so they are
          credited separately — and the donor line matters more here than it does
          for an atlas. An atlas swap changes whose body you are looking at
          sequentially; an overlay puts a SECOND person's organ inside the first
          person's body at the same time. That is not something a viewer can be
          left to infer from a mesh that happens to look slightly different.
        */}
        {overlaysOn.map((o) => (
          <p key={o.id} className="border-t border-line pt-2">
            {o.attribution}{' '}
            <a
              href={o.licenceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="whitespace-nowrap underline underline-offset-2 hover:text-ink"
            >
              {o.licence}
            </a>
            <span className="mt-0.5 block text-ink/45">
              {o.donor.label} — {o.donor.derivedFrom}
            </span>
            <strong className="mt-0.5 block text-[#8a6d3b]">
              A different person from the body it sits in, shown at its own size — not scaled to
              fit.
            </strong>
            {/*
              The note ALWAYS renders. An earlier version showed it only when
              `publishable` was false, which suppressed exactly the note that
              matters most: the eye is publishable and is ALSO a schematic with no
              sclera, iris or optic nerve. "Nothing blocks publication" and
              "nothing needs saying" are different claims, and conflating them hid
              a caveat behind a licence flag.
            */}
            <span className="mt-0.5 block text-[#8a6d3b]">{o.note}</span>
            {!o.publishable && (
              <span className="mt-0.5 block font-semibold text-[#8a6d3b]">
                Not publishable yet — see licences.json.
              </span>
            )}
          </p>
        ))}

        {/*
          The body envelope, credited separately for the same reason overlays are —
          a different rights holder on different terms — and with one extra thing
          to say that no atlas or overlay needs.

          ⚠️ EVERY LICENCE IN THE PACKAGE, NOT THE HEADLINE ONE. ANNY ships three
          buckets: Apache-2.0 code, CC0 shape assets, and an Apache-2.0 SOMA
          topology. The geometry on screen derives from the CC0 bucket and was
          produced by the Apache-2.0 code, so crediting only "Apache-2.0" would
          misstate what the surface is, and crediting only CC0 would drop a notice
          obligation that is actually owed.

          And it says it is NOT A PERSON. Every other credit in this panel names a
          donor, because every other thing on screen came from somebody's body.
          This one did not, and the absence has to be stated rather than left as a
          blank where a donor line would be — a viewer who has read four donor
          lines will assume the fifth exists.
        */}
        {envelope && (
          <div className="border-t border-line pt-2">
            <p>
              {envelope.attribution}
              {envelope.citation && <span className="text-ink/45"> {envelope.citation}</span>}
            </p>
            <ul className="mt-1 space-y-0.5 border-l border-line pl-2 text-ink/60">
              {envelope.licences.map((l) => (
                <li key={l.covers}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="whitespace-nowrap underline underline-offset-2 hover:text-ink"
                  >
                    {l.spdx}
                  </a>{' '}
                  — {l.covers}
                </li>
              ))}
            </ul>
            <strong className="mt-1 block text-[#8a6d3b]">
              Not a person and not a donor: a generated surface with no organs, no ontology terms
              and no scan of anyone.
            </strong>
            {/*
              Measured, and stated where the claim would otherwise be made. The
              envelope is baked in ANNY's rest pose and each atlas has its own, so
              it encloses the torso and not the limbs — on Z-Anatomy, 1.124 m
              across the arms against the atlas's 0.646 m. It is a reference
              silhouette, and rendering it as clear glass rather than as skin is
              the visual half of the same statement.
            */}
            <span className="mt-0.5 block text-[#8a6d3b]">
              Its rest pose is not the atlas’s, so it wraps the torso but not the limbs — measured
              on Z-Anatomy at 1.124 m across the arms against the atlas’s 0.646 m. Scaled to the
              canonical 1.7 m body, so its own stature ({envelope.heightM} m) is not what you see.
            </span>
            <span className="mt-0.5 block text-[#8a6d3b]">{envelope.note}</span>
            <span className="mt-0.5 block text-ink/45">
              Baked by <span className="font-mono">{envelope.provenance.script}</span> from{' '}
              <span className="font-mono">{envelope.provenance.package}</span> at{' '}
              {Object.entries(envelope.provenance.parameters)
                .map(([k, v]) => `${k} ${v}`)
                .join(', ')}
              .
            </span>
          </div>
        )}

        {mixedDonors && (
          <p className="border-t border-line pt-2 text-[#8a6d3b]">
            These atlases are different people of different sexes. Structures present in one and
            absent from the other are a donor difference, not a finding about you.
          </p>
        )}

        {COMPOSED_GAPS[mode] && (
          <p className="border-t border-line pt-2 text-[#8a6d3b]">{COMPOSED_GAPS[mode]}</p>
        )}

        {twoBodies && !mixedDonors && (
          <p className="border-t border-line pt-2 text-[#8a6d3b]">
            This body is assembled from <strong>more than one donor</strong> — the systems listed
            under each credit above say which came from whom. They are different people, so
            proportions do not match across the join.
          </p>
        )}

        {shareAlike && (
          <p className="border-t border-line pt-2 text-ink/60">
            Share-alike applies to the CC-BY-SA asset only — the atlases ship as separate
            files, so it reaches neither the CC BY 4.0 geometry nor the code.
          </p>
        )}
      </div>

      {/*
        The credits above are scoped to what is rendering, because that is what the
        licences require. This opens the rest: every model in the registry whether
        or not it is on screen, what each was built from, and the resources that
        are not models. Different question, so a different surface.
      */}
      <SourcesButton />
    </div>
  )
}
