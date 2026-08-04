/**
 * "Models and sources" — the full provenance of everything on screen.
 *
 * The credits panel answers the LICENCE question: who must be credited for what
 * is rendering right now. This answers a different one — what is this thing built
 * from — for every model in the registry whether or not it is currently showing,
 * plus the resources that are not models at all.
 *
 * ⚠️ IT IS DERIVED, NOT WRITTEN. Every model row comes from `ANATOMY_SOURCES` and
 * `ORGAN_OVERLAYS`, and every shipped size is measured by a HEAD request when the
 * dialog opens. That is deliberate: two hand-maintained tables in this repo went
 * stale without anyone noticing (see `scripts/gen-component-table.mjs`), and a
 * provenance list that has quietly stopped being true is worse than none, because
 * it gets quoted with confidence. Adding a model to the registry adds it here.
 *
 * The one hand-written part is `OTHER_RESOURCES` below, and it is scoped to things
 * with no registry entry to derive from. `licences.json` remains the authority.
 */
import { useEffect, useRef, useState } from 'react'
import {
  ANATOMY_SOURCES,
  type AnatomySource,
  type SourceData,
} from '../scene/anatomySources'
import { ORGAN_OVERLAYS, type OrganOverlay } from '../scene/organOverlays'

/**
 * Resources that are used but are not models, so nothing derives them.
 *
 * Short on purpose. Anything with a registry entry must come from the registry;
 * this is for the remainder, and `licences.json` is the authority for all of it.
 */
const OTHER_RESOURCES = [
  {
    name: 'Inter',
    what: 'The interface typeface, self-hosted as one variable WOFF2.',
    licence: 'SIL Open Font License 1.1',
    licenceUrl: 'https://openfontlicense.org/',
    note:
      'Self-hosted rather than loaded from Google Fonts, which was the app’s only external ' +
      'runtime request and a GDPR exposure with German case law behind it.',
  },
  {
    name: 'glTF-Transform, meshoptimizer, xatlas',
    what: 'The asset pipeline: welding, decimation, compression and UV unwrapping.',
    licence: 'MIT',
    licenceUrl: 'https://opensource.org/license/mit',
    note:
      'Build-time only — none of it ships to the browser. The atlases arrive as ' +
      'meshopt-compressed GLBs, which three.js decodes natively.',
  },
  {
    name: 'three.js, React, React Three Fiber',
    what: 'Rendering and UI.',
    licence: 'MIT',
    licenceUrl: 'https://opensource.org/license/mit',
    note: 'WebXR comes through @react-three/xr, which is why the viewer runs in a headset.',
  },
  {
    name: 'This viewer',
    what: 'The code in this repository.',
    licence: 'MIT',
    licenceUrl: 'https://opensource.org/license/mit',
    note:
      'The CODE is MIT. The anatomy assets are NOT — each keeps its own licence, which is why ' +
      'they are separate files and are never merged into one GLB.',
  },
] as const

/** Bytes as MB or GB, decimal, matching what the build tools print. */
function size(bytes: number): string {
  return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(2)} GB` : `${(bytes / 1e6).toFixed(1)} MB`
}

/**
 * Shipped size of each asset, straight from the server.
 *
 * Probed on open rather than at load, so a dialog nobody opens costs nothing.
 * A HEAD gives `content-length` without transferring the body, which for a 27 MB
 * atlas matters.
 *
 * The `text/html` guard is the same one `useAtlasAvailability` carries and for the
 * same reason: a dev server that rewrites unknown paths to `index.html` answers
 * 200 for a GLB that does not exist, so a bare `res.ok` would report a missing
 * atlas as present and hand back the size of the HTML page.
 */
function useShippedSizes(urls: readonly string[], enabled: boolean) {
  const [sizes, setSizes] = useState<Record<string, number | null>>({})
  const key = urls.join('|')
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void (async () => {
      const found: Record<string, number | null> = {}
      await Promise.all(
        urls.map(async (u) => {
          try {
            const res = await fetch(u, { method: 'HEAD', cache: 'no-store' })
            const type = res.headers.get('content-type') ?? ''
            const len = res.headers.get('content-length')
            found[u] = res.ok && !type.includes('text/html') && len ? Number(len) : null
          } catch {
            found[u] = null
          }
        }),
      )
      if (!cancelled) setSizes(found)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key])
  return sizes
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="w-[92px] shrink-0 text-ink/40">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  )
}

function SourceDataLine({ data }: { data?: SourceData }) {
  if (!data) return null
  return (
    <Field label="built from">
      {/* The number is shown only when it exists. See `SourceData` for why an
          absent figure is left absent rather than filled with the output size. */}
      {data.bytes !== undefined && <strong className="text-ink/70">{size(data.bytes)}</strong>}
      {data.bytes !== undefined && ' — '}
      {data.note}
    </Field>
  )
}

function Shipped({ bytes }: { bytes: number | null | undefined }) {
  if (bytes === undefined) return <span className="text-ink/40">measuring…</span>
  if (bytes === null) return <span className="text-ink/50">not installed on this server</span>
  return <strong className="text-ink/70">{size(bytes)}</strong>
}

function ModelCard({
  title,
  subtitle,
  licence,
  licenceUrl,
  attribution,
  donor,
  sourceData,
  shipped,
  extra,
}: {
  title: string
  subtitle: string
  licence: string
  licenceUrl: string
  attribution: string
  donor: string
  sourceData?: SourceData
  shipped: number | null | undefined
  extra?: React.ReactNode
}) {
  return (
    <li className="rounded-2xl border border-line bg-surface p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h4 className="text-[13px] font-semibold text-ink">{title}</h4>
        <a
          href={licenceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[10px] underline underline-offset-2 hover:text-ink"
        >
          {licence}
        </a>
      </div>
      <p className="mt-0.5 text-ink/45">{subtitle}</p>
      <div className="mt-2 space-y-1">
        <Field label="donor">{donor}</Field>
        <SourceDataLine data={sourceData} />
        <Field label="ships as">
          <Shipped bytes={shipped} />
        </Field>
        <Field label="credit">
          <span className="text-ink/55">{attribution}</span>
        </Field>
      </div>
      {extra}
    </li>
  )
}

export function SourcesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const atlases = Object.values(ANATOMY_SOURCES) as AnatomySource[]
  const overlays = Object.values(ORGAN_OVERLAYS) as OrganOverlay[]
  const urls = [...atlases.map((a) => a.url), ...overlays.map((o) => o.url)]
  const shipped = useShippedSizes(urls, open)

  /**
   * Disambiguate labels shared by more than one entry.
   *
   * `hra` and `hra-m` are both "HuBMAP HRA" — correct in the switcher, where the
   * sex row picks between them, and wrong here, where they are two separate assets
   * of two separate donors listed one after the other. Two identical headings read
   * as a duplicated row rather than as a distinction.
   */
  const labelCounts = new Map<string, number>()
  for (const a of atlases) labelCounts.set(a.label, (labelCounts.get(a.label) ?? 0) + 1)
  const titleOf = (a: AnatomySource) =>
    (labelCounts.get(a.label) ?? 0) > 1 ? `${a.label} (${a.donor.sex})` : a.label

  /**
   * A native `<dialog>`, for what it brings rather than for novelty: Esc to
   * close, focus trapped inside while open, and the top layer so it cannot be
   * clipped by the `overflow-hidden` ancestors this layout is full of.
   */
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      el.showModal()
      /**
       * Move focus onto the close control, AFTER `showModal`.
       *
       * `autoFocus` on the button does not work here: React applies it by calling
       * `.focus()` during mount, when the dialog is still `display: none`, so it is
       * silently a no-op. `showModal` then focuses the first focusable thing it
       * finds, which is the scroll container — Chrome makes scrollable overflow
       * containers focusable — and that drew the themed focus ring around the entire
       * card, reading as a highlight rather than as focus.
       */
      closeRef.current?.focus()
    }
    if (!open && el.open) el.close()
  }, [open])

  const shippedTotal = urls.reduce((a, u) => a + (shipped[u] ?? 0), 0)
  const sourceTotal = [...atlases, ...overlays].reduce((a, m) => a + (m.sourceData?.bytes ?? 0), 0)
  const installed = urls.filter((u) => shipped[u]).length

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      /**
       * Escape, handled explicitly rather than left to the element.
       *
       * A modal `<dialog>` is supposed to close on Escape by itself, and `onCancel`
       * is where that would surface. It did not fire under test here and the cause
       * could not be pinned down — nothing in this app listens for keys and nothing
       * called `preventDefault`, so it may well be the automated browser rather than
       * the page. Either way, closing is a promise the UI makes to anyone who has
       * ever pressed Escape on a dialog, and three lines of our own code keep it
       * regardless of which layer was at fault.
       */
      onCancel={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          onClose()
        }
      }}
      /**
       * Click outside the card to dismiss.
       *
       * This needs the dialog to FILL the viewport — see `.sources-dialog` in
       * styles.css. A `<dialog>` is sized to its content by default, so clicks
       * beside it never reach the element at all and land on the page behind;
       * `e.target === ref.current` could not match and this did nothing. Stretching
       * the dialog and keeping the visible card as a child makes the empty area part
       * of the dialog, which is what the check needs.
       */
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="sources-dialog text-ink"
    >
      <div className="max-h-[86vh] w-[min(760px,92vw)] overflow-y-auto rounded-3xl border border-line bg-panel p-5 text-[11px] leading-relaxed shadow-[0_24px_64px_rgba(0,0,0,0.28)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-ink">Models and sources</h3>
            <p className="mt-0.5 text-ink/45">
              Everything this viewer is built from, and what each piece came from.
            </p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="shrink-0 rounded-full border border-line px-2.5 py-1 text-muted transition hover:text-ink"
          >
            Close
          </button>
        </div>

        {/* THE APPROACH. Four things a viewer cannot infer from the geometry. */}
        <section className="mt-4 space-y-2 rounded-2xl border border-line bg-surface p-3">
          <h4 className="text-[13px] font-semibold text-ink">How this is put together</h4>
          <p>
            <strong>Every body here is a real person, and they are not the same person.</strong>{' '}
            Nothing is sculpted or illustrated. Each atlas is one donor — a cryosectioned cadaver, a
            voxel phantom, a CT subject — so switching atlas swaps whose anatomy you are looking at,
            and with it their sex, proportions and the resolution they were captured at. Where a
            body is assembled from more than one source, the credits name which system came from
            whom.
          </p>
          <p>
            <strong>The assets are rebuilt here, never redistributed as they arrived.</strong>{' '}
            Published atlases are downloaded, welded, decimated, and given per-vertex ambient
            occlusion and a structure id, which is what lets a browser draw a 3 M-triangle body and
            still name the structure under your cursor. The figures below are that reduction:
            hundreds of megabytes of source geometry in, a handful out. None of it is committed to
            the repository — it is all rebuildable from the scripts.
          </p>
          <p>
            <strong>The code is MIT; the anatomy is not.</strong> Each atlas keeps its own licence,
            which is why they stay separate files and are never merged into one model — merging a
            share-alike atlas into a permissive one would impose share-alike on both. Attribution is
            rendered because these licences require it, not as a courtesy, and where a component
            inside an atlas belongs to someone else it is credited separately on its own terms.
          </p>
          <p>
            <strong>Where something is not known, it says so.</strong> A structure with no data is
            drawn as "no data" rather than as a zero. A surface with no colour source is left neutral
            grey rather than given a plausible colour. An organ overlay is a second person's organ
            inside the first person's body and is shown at its own measured size rather than scaled
            to fit. These are not omissions to be tidied up later — stating them is the point.
          </p>
        </section>

        <p className="mt-3 text-ink/50">
          {atlases.length + overlays.length} models registered, {installed} installed on this
          server — {size(shippedTotal)} shipped, built from at least {size(sourceTotal)} of source
          data.
        </p>

        <h4 className="mt-4 text-[13px] font-semibold text-ink">Bodies</h4>
        <p className="mt-0.5 text-ink/45">
          Whole-body atlases. One of these is the body; the switcher picks which.
        </p>
        <ul className="mt-2 space-y-2">
          {atlases.map((a) => (
            <ModelCard
              key={a.id}
              title={titleOf(a)}
              subtitle={`${a.donor.sex} · structures addressed by ${a.termSystem} · ${
                a.registration?.realScale ? 'real scale, not resized' : 'scaled to 1.7 m'
              }`}
              licence={a.licence}
              licenceUrl={a.licenceUrl}
              attribution={a.attribution}
              donor={`${a.donor.label} — ${a.donor.derivedFrom}`}
              sourceData={a.sourceData}
              shipped={shipped[a.url]}
              extra={
                <>
                  {a.citation && <p className="mt-1 text-ink/40">{a.citation}</p>}
                  {a.shareAlike && (
                    <p className="mt-1 text-[#8a6d3b]">
                      Share-alike: a modified version of this asset must carry the same licence.
                    </p>
                  )}
                  {a.components?.length ? (
                    <div className="mt-1 border-l-2 border-line pl-2 text-ink/45">
                      Includes, on other terms:
                      {a.components.map((c) => (
                        <span key={c.title} className="mt-0.5 block">
                          {c.title} — {c.holder} — {c.licence}
                          {c.needsPermission && (
                            <strong className="text-[#8a6d3b]"> (no grant given)</strong>
                          )}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </>
              }
            />
          ))}
        </ul>

        <h4 className="mt-4 text-[13px] font-semibold text-ink">Organ overlays</h4>
        <p className="mt-0.5 text-ink/45">
          Single organs that sit on top of whichever body is showing — each one a different person
          again, and each doing something no atlas here can.
        </p>
        <ul className="mt-2 space-y-2">
          {overlays.map((o) => (
            <ModelCard
              key={o.id}
              title={`${o.icon} ${o.label}`}
              subtitle={`${o.system} · ${o.instances.length === 1 ? 'one instance' : `${o.instances.length} instances`}${
                o.animation ? ` · animated (${o.animation.name})` : ''
              }`}
              licence={o.licence}
              licenceUrl={o.licenceUrl}
              attribution={o.attribution}
              donor={`${o.donor.label} — ${o.donor.derivedFrom}`}
              sourceData={o.sourceData}
              shipped={shipped[o.url]}
              extra={
                <>
                  <p className="mt-1 text-[#8a6d3b]">{o.note}</p>
                  {!o.publishable && (
                    <p className="mt-1 font-semibold text-[#8a6d3b]">
                      Not publishable yet — something about its provenance is unresolved upstream.
                    </p>
                  )}
                </>
              }
            />
          ))}
        </ul>

        <h4 className="mt-4 text-[13px] font-semibold text-ink">Everything else</h4>
        <ul className="mt-2 space-y-2">
          {OTHER_RESOURCES.map((r) => (
            <li key={r.name} className="rounded-2xl border border-line bg-surface p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h4 className="text-[13px] font-semibold text-ink">{r.name}</h4>
                <a
                  href={r.licenceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[10px] underline underline-offset-2 hover:text-ink"
                >
                  {r.licence}
                </a>
              </div>
              <p className="mt-0.5 text-ink/45">{r.what}</p>
              <p className="mt-1 text-ink/55">{r.note}</p>
            </li>
          ))}
        </ul>

        <p className="mt-4 border-t border-line pt-3 text-ink/40">
          The full pre-publication record — every asset, every third-party component inside it, and
          what is still unresolved — is generated into <code>docs/LICENCE_LOG.md</code> from the
          shipped files themselves, so it cannot drift from what actually ships.
        </p>
      </div>
    </dialog>
  )
}

/** The trigger. Lives under the credits, which is the question it follows on from. */
export function SourcesButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] text-muted transition hover:text-ink"
      >
        All models and sources
      </button>
      <SourcesDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
