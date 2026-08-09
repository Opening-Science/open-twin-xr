import { useEffect } from 'react'
import { loadTwin } from './data/adapter'
import { useTwin } from './store'
import { BodyScene } from './scene/BodyScene'
import { XREnterButton } from './ui/XREnterButton'
import { AtlasAttribution } from './ui/AttributionBar'
import { StructurePanel } from './ui/StructurePanel'
import { SceneDock } from './ui/SceneDock'
import { OsfLogo } from './ui/OsfLogo'
import { CanvasKeyboardShell } from './ui/CanvasKeyboardShell'
import { SelectedStructureCard } from './ui/SelectedStructureCard'
import { ParametricPanel } from './ui/ParametricPanel'

/**
 * An open-source human body viewer.
 *
 * WHAT WAS REMOVED, AND WHY IT STILL EXISTS
 * -----------------------------------------
 * This used to be a health dashboard with a body in the middle of it: a profile
 * sidebar, a name and a search box, a health-status ring, a trend chart, a list
 * of per-system score cards, connected-source status, and an AI bubble.
 *
 * All of it is unmounted, and none of it is deleted. `Sidebar`,
 * `MetricsStatusCard`, `TrendChart`, `SystemScoreList`, `ConnectedSources`,
 * `ChatbotStub` and `DetailPanel` are intact under `src/ui/` and mount again in
 * one line each. They belong to a later iteration, so removing the files would
 * cost work that is coming back.
 *
 * `DetailPanel` went last, and it is the clearest example of the distinction
 * being drawn here. It showed a selected system as "Musculoskeletal 9 / 10"
 * with a prose summary and a SOURCE line naming VITRONIC BodyLoop and Oura
 * Ring. That is a personal health record about a specific person, and this is
 * not that: it is a body viewer, and a test bed for how anatomy and health data
 * could be overlaid. Presenting a fictional sample as though it were someone's
 * measured health is the wrong claim to make in the UI, however clearly the
 * sample is labelled elsewhere.
 *
 * The subject of this repository is the **body** — anatomy, geometry, materials,
 * lighting, XR, and personalisation from imaging and body scans. Health-data
 * mapping remains part of the plan (see D8 in `docs/DECISIONS.md`); the data side
 * of it lives upstream in `etzm/open-twin`, and the two reconcile later.
 *
 * WHAT DELIBERATELY STAYED
 * ------------------------
 * - `StructurePanel`, because it is the anatomy control: which systems and layers
 *   are visible, the hull opacity, and the anatomical/metrics colour modes.
 * - `AtlasAttribution`, because it is **a licence condition, not a UI choice**.
 *   HRA and BodyParts3D both require credit wherever the model or a rendering of
 *   it is distributed. It does not get removed for tidiness.
 * - `XREnterButton`, because WebXR is the point of the name.
 * - `loadTwin()`, because the metrics colour mode needs something to colour by.
 *   It reads the bundled sample and validates it through
 *   `assertTwinMetrics()`, which still refuses to render a fabricated score.
 */
export default function App() {
  const setData = useTwin((s) => s.setData)
  const theme = useTwin((s) => s.theme)
  const stage = useTwin((s) => s.stage)
  const parametric = useTwin((s) => s.anatomyMode) === 'parametric'

  /*
   * The theme class goes on <html>, not on this div, because the CSS variables
   * it switches are read by `body` and by anything portalled outside the React
   * root. `color-scheme` comes with it so the browser draws its own widgets —
   * scrollbars, range tracks — to match instead of leaving white gutters down a
   * dark page.
   */
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme
  }, [theme])

  useEffect(() => {
    // The bundled fictional sample. Real data arrives already scored from your
    // own backend — see `src/data/adapter.ts` for why scoring is not done here.
    loadTwin()
      .then(setData)
      .catch((e) => console.error(e))
  }, [setData])

  return (
    <div className="app-bg h-screen w-screen flex flex-col text-ink overflow-hidden">
      {/*
        Publisher first, product second — the Foundation publishes this, and the
        lockup says so before the product name does. The logo carries its own
        licence note; see `OsfLogo.tsx`, it is a trade mark and not MIT.
      */}
      <header className="flex shrink-0 items-center justify-between gap-4 px-6 pt-5 pb-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <OsfLogo
            variant={theme === 'dark' ? 'negative' : 'positive'}
            className="h-12 w-auto shrink-0"
          />
          {/* Deliberately shorter than the logo: a rule matching its full height reads
              as a box around the mark rather than a separator beside it. */}
          <div className="h-10 w-px shrink-0 bg-line" aria-hidden="true" />
          <div className="min-w-0">
            {/* The page had no <h1> at all, so a screen reader's heading list —
                one of the two ways anybody navigates an unfamiliar page — was
                empty. It is the product name because that is what the page is
                about; the visual weight is unchanged. */}
            <h1 className="truncate text-lg font-semibold leading-tight">Open Twin XR</h1>
            <div className="truncate text-[11px] text-muted">
              Open-source human body viewer &middot; built on{' '}
              {/*
                Linked so the claim is checkable, which is the same reason every atlas
                in the credits panel carries its source. `immersiveweb.dev` is the
                Immersive Web Working Group's own site — the people who write the
                standard, introducing it to someone who has just met the word. MDN was
                here first and documents the API for developers; the W3C specification
                is normative and answers a question a visitor did not ask.

                `rel="noreferrer"` covers `noopener` too in every browser that supports
                it, but both are named because the pairing is the habit worth keeping —
                a bare `target="_blank"` hands the opened page a live `window.opener`.
              */}
              <a
                href="https://immersiveweb.dev/"
                target="_blank"
                rel="noopener noreferrer"
                title="WebXR — the open standard this viewer uses for headset and controller support"
                className="underline decoration-dotted underline-offset-2 transition hover:text-ink"
              >
                WebXR
              </a>
            </div>
          </div>
        </div>
        <XREnterButton />
      </header>

      {/* The body gets the room. Everything beside it is a control for it. */}
      <main className="grid flex-1 min-h-0 grid-cols-[minmax(0,1fr)_300px] gap-5 px-6 pb-6">
        <div className="relative overflow-hidden rounded-3xl border border-line bg-panel">
          {/* The 3D view is wrapped rather than bare so it can be focused and
              driven from the keyboard — see `CanvasKeyboardShell`, and note the
              warning there that this makes the view OPERABLE without making it
              PERCEIVABLE. `StructurePanel` is the DOM surface that carries the
              information. */}
          <CanvasKeyboardShell>
            <BodyScene />
          </CanvasKeyboardShell>
          {/* The screen-space half of the stage falloff. DOM rather than a
              post-processing pass because post FX renders nothing at all inside a
              WebXR session — see the note on `.scene-vignette` in styles.css. Sits
              between the canvas and the controls so it dims the body, never the
              interface. */}
          {stage && <div className="scene-vignette" aria-hidden="true" />}
          <SceneDock />
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto">
          {/* The anatomy controls have nothing to control in the parametric
              mode — there are no systems, layers or structures — so the shape
              sliders take their place rather than sitting beside a panel of
              inert rows. */}
          {parametric ? <ParametricPanel /> : <StructurePanel />}
          {/* Between the anatomy controls and the credits, because it is both:
              it names what is selected and it states that structure's OWN
              licence where that differs from the atlas's. See the file. */}
          <SelectedStructureCard />
          <AtlasAttribution />
        </div>
      </main>
    </div>
  )
}
