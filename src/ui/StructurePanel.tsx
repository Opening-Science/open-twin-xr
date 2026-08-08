import { scoreToColor } from '../scene/metricColor'
import { anatomicalColor } from '../scene/anatomyPalette'
import { useTwin, type AnatomyLayer } from '../store'

/**
 * Layer toggles, grouped the way people actually want to peel a body.
 *
 * The atlas declares four layers, but "bone" and "connective" are not two things
 * a viewer wants to reason about separately — cartilage and ligament belong to
 * the skeleton, and hiding the skeleton while leaving its ligaments floating is
 * not a view anyone asked for. Meanwhile the split that IS wanted constantly —
 * keep the bones, drop the muscle — was buried among four similar-looking chips.
 *
 * So the underlying layers are unchanged (the data keeps its fidelity) and only
 * the presentation groups them: Organs, Muscles, Skeleton.
 */
const LAYER_GROUPS: { label: string; layers: AnatomyLayer[]; title: string }[] = [
  { label: 'Organs', layers: ['organ'], title: 'Viscera — heart, lungs, gut, brain' },
  { label: 'Muscles', layers: ['muscle'], title: 'Skeletal muscle' },
  {
    label: 'Skeleton',
    layers: ['bone', 'connective'],
    title: 'Bone, cartilage and ligament',
  },
]

/**
 * How a system's layers are presented as separable rows.
 *
 * **Musculoskeletal is one `SystemId` holding two things people think of as
 * separate bodies of anatomy.** On Z-Anatomy that is ~1,477 bones and ~347
 * muscles under a single row: one swatch, one visibility box, one selection. So
 * "show me the skeleton" and "select the musculature" were not expressible, and
 * the legend swatch showed the system colour while the body was painted with the
 * per-layer tissue colours — the legend disagreed with the render.
 *
 * Splitting `SystemId` itself would be wrong: health-wise it really is one
 * system, the score belongs to the system, and that enum is a contract D8 owns
 * upstream. So the split lives in the presentation, and the row a system gets is
 * driven by what the LOADED ATLAS declares (`presentLayers`) rather than by a
 * hardcoded assumption — HRA has no layers and correctly gets no sub-rows.
 *
 * `connective` rides with `bone` for the same reason it does in the chips above:
 * hiding the skeleton while leaving its ligaments floating is not a view anyone
 * asked for.
 */
const SUB_ROWS: { label: string; layers: AnatomyLayer[]; title: string }[] = [
  { label: 'Skeleton', layers: ['bone', 'connective'], title: 'Bone, cartilage and ligament' },
  { label: 'Muscles', layers: ['muscle'], title: 'Skeletal muscle' },
  { label: 'Organs', layers: ['organ'], title: 'Organs within this system' },
]

/**
 * Visibility controls for the twin.
 *
 * Two independent axes, because they answer different questions. **Systems**
 * are the metrics view — hide cardiovascular to stop colouring by its score.
 * **Layers** are the anatomical view — peel muscle off to see the skeleton
 * regardless of which system anything belongs to. An atlas that declares no
 * layers simply shows no layer controls.
 *
 * The hull slider is separate again: the skin encloses everything, so it is the
 * one structure whose opacity has to be continuously adjustable rather than a
 * toggle. Fully opaque shows the body surface; near-zero lets the anatomy read.
 */
export function StructurePanel() {
  const data = useTwin((s) => s.data)
  const hiddenSystems = useTwin((s) => s.hiddenSystems)
  const hiddenLayers = useTwin((s) => s.hiddenLayers)
  const hullOpacity = useTwin((s) => s.hullOpacity)
  const xray = useTwin((s) => s.xray)
  const setXray = useTwin((s) => s.setXray)
  const smoothTransparency = useTwin((s) => s.smoothTransparency)
  const setSmoothTransparency = useTwin((s) => s.setSmoothTransparency)
  const explode = useTwin((s) => s.explode)
  const setExplode = useTwin((s) => s.setExplode)
  const hovered = useTwin((s) => s.hoveredLabel)
  const selectedStructure = useTwin((s) => s.selectedStructure)
  const selected = useTwin((s) => s.selectedSystem)
  const selectedLayer = useTwin((s) => s.selectedLayer)
  const presentLayers = useTwin((s) => s.presentLayers)
  const toggleSystem = useTwin((s) => s.toggleSystem)
  const setLayersVisible = useTwin((s) => s.setLayersVisible)
  const setAllSystems = useTwin((s) => s.setAllSystems)
  const setHullOpacity = useTwin((s) => s.setHullOpacity)
  const selectSystem = useTwin((s) => s.selectSystem)
  const colourMode = useTwin((s) => s.colourMode)
  const setColourMode = useTwin((s) => s.setColourMode)

  const systems = data?.systems ?? []
  const allIds = systems.map((s) => s.id)
  const allVisible = hiddenSystems.length === 0

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-line bg-panel p-4 backdrop-blur-panel">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-ink">Anatomy</h3>
        <button
          onClick={() => setAllSystems(!allVisible, allIds)}
          className="text-[11px] text-muted transition hover:text-ink"
        >
          {allVisible ? 'hide all' : 'show all'}
        </button>
      </div>

      {/* Anatomical hue and the metric scale mean incompatible things — red is
          "muscle" in one and "poor score" in the other — so they are modes, not
          a blend. See src/scene/anatomyPalette.ts. */}
      <div className="flex gap-0.5 rounded-full bg-track p-0.5 text-[11px]">
        {(['anatomical', 'metrics'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setColourMode(m)}
            aria-pressed={colourMode === m}
            title={
              m === 'anatomical'
                ? 'Tissue colours — red muscle, ivory bone. A metric shows as a glow.'
                : 'Colour by the supplied per-system metric — red to green.'
            }
            className={
              'flex-1 rounded-full px-2 py-1 capitalize transition ' +
              (colourMode === m ? 'bg-raised text-ink shadow-sm' : 'text-muted hover:text-ink')
            }
          >
            {m}
          </button>
        ))}
      </div>

      {/* Hover readout. Reserves its line so the panel does not jump.

          Deliberately NOT a live region — see the one below. */}
      <div className="min-h-[18px] text-[11px] leading-tight text-ink/70">
        {hovered ?? <span className="text-muted">Hover a structure to identify it</span>}
      </div>

      {/*
        The announcement channel for assistive technology.

        ⚠️ IT ANNOUNCES SELECTION, NOT HOVER, AND THAT IS THE WHOLE DESIGN.
        Putting `role="status"` on the hover readout above is the obvious move and
        is wrong: hover fires on every pointer move across the body, so dragging
        the mouse over the abdomen would queue dozens of announcements, each
        interrupting the last. A live region that cannot be listened to is worse
        than none, because it also floods the screen reader's own speech.

        Selection is deliberate, infrequent, and is the thing a user actually
        wants read back. It also has the property hover lacks: it is reachable
        without a pointer, because clicking a system name in the list below sets
        it too. So this is the one readout that works on a keyboard.

        `role="status"` implies `aria-live="polite"`, which waits for a pause
        rather than cutting in. Both are written out because the pairing is what
        makes the intent legible to the next reader.

        Visually hidden rather than shown: the selection is already obvious on
        the body (the structure is highlighted) and in this list (the name goes
        bold), so a third copy would be redundant on screen and is only needed
        by someone who cannot see either.
      */}
      <div role="status" aria-live="polite" className="sr-only">
        {selectedStructure
          ? `Selected: ${selectedStructure.entry.name}${
              selectedStructure.entry.side ? `, ${selectedStructure.entry.side}` : ''
            }${selectedStructure.entry.system ? `, ${selectedStructure.entry.system} system` : ''}`
          : selected
            ? `Selected: ${systems.find((s) => s.id === selected)?.name ?? selected}${
                selectedLayer ? `, ${selectedLayer}` : ''
              }`
            : ''}
      </div>

      <div className="flex flex-col gap-1">
        {systems.map((sys) => {
          const off = hiddenSystems.includes(sys.id)
          // The swatch is a legend, so it has to agree with what the body is
          // actually painted with — tissue hue in anatomical mode, the metric
          // scale in metrics mode. It used to always show the metric scale, which
          // made it disagree with the render in the default mode.
          const colour =
            '#' +
            (colourMode === 'anatomical'
              ? anatomicalColor(sys.id)
              : scoreToColor(sys.hasData ? sys.score : null)
            ).getHexString()
          return (
            <div key={sys.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
              <button
                onClick={() => toggleSystem(sys.id)}
                aria-pressed={!off}
                title={off ? `Show ${sys.name}` : `Hide ${sys.name}`}
                className={
                  'h-3.5 w-3.5 shrink-0 rounded-[4px] border transition ' +
                  (off ? 'border-line bg-transparent' : 'border-transparent')
                }
                style={off ? undefined : { background: colour }}
              />
              {/* Clicking the name selects, matching a click on the organ itself. */}
              <button
                onClick={() =>
                  selectSystem(selected === sys.id && selectedLayer === null ? null : sys.id, null)
                }
                className={
                  'flex-1 text-left text-[12px] transition ' +
                  (off
                    ? 'text-muted/60 line-through'
                    : selected === sys.id && selectedLayer === null
                      ? 'font-medium text-ink'
                      : 'text-ink/80 hover:text-ink')
                }
              >
                {sys.name}
              </button>
              </div>

              {/*
                Separable sub-rows, for systems the loaded atlas actually splits.
                Musculoskeletal is the one that matters — bone and muscle are two
                things to look at, not one. Each row carries its own tissue
                swatch, its own visibility and its own selection.
              */}
              {(presentLayers[sys.id]?.length ?? 0) > 1 &&
                SUB_ROWS.filter((r) => r.layers.some((l) => presentLayers[sys.id]?.includes(l))).map(
                  (r) => {
                    const mine = r.layers.filter((l) => presentLayers[sys.id]?.includes(l))
                    const rowOn = mine.some((l) => !hiddenLayers.includes(l))
                    const rowSelected = selected === sys.id && selectedLayer === mine[0]
                    // The swatch shows the TISSUE colour for this layer, which is
                    // what the body is actually painted with — passing only the
                    // system id here is what made the legend disagree with the
                    // render for bone and muscle.
                    const rowColour =
                      '#' +
                      (colourMode === 'anatomical'
                        ? anatomicalColor(sys.id, mine[0])
                        : scoreToColor(sys.hasData ? sys.score : null)
                      ).getHexString()
                    return (
                      <div key={r.label} className="flex items-center gap-2 pl-5">
                        <button
                          onClick={() => setLayersVisible(mine, !rowOn)}
                          aria-pressed={rowOn}
                          title={rowOn ? `Hide ${r.label.toLowerCase()}` : `Show ${r.label.toLowerCase()}`}
                          className={
                            'h-2.5 w-2.5 shrink-0 rounded-[3px] border transition ' +
                            (rowOn ? 'border-transparent' : 'border-line bg-transparent')
                          }
                          style={rowOn ? { background: rowColour } : undefined}
                        />
                        <button
                          onClick={() =>
                            selectSystem(rowSelected ? null : sys.id, rowSelected ? null : mine[0])
                          }
                          title={r.title}
                          className={
                            'flex-1 text-left text-[11px] transition ' +
                            (!rowOn || off
                              ? 'text-muted/60 line-through'
                              : rowSelected
                                ? 'font-medium text-ink'
                                : 'text-ink/60 hover:text-ink')
                          }
                        >
                          {r.label}
                        </button>
                      </div>
                    )
                  },
                )}
            </div>
          )
        })}
      </div>

      <div className="border-t border-line pt-3">
        <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted">Layers</div>
        <div className="flex flex-wrap gap-1">
          {LAYER_GROUPS.map((g) => {
            // A group is "on" while ANY member is visible, so the first click
            // always hides rather than resolving a half-state into a surprise.
            const on = g.layers.some((l) => !hiddenLayers.includes(l))
            return (
              <button
                key={g.label}
                onClick={() => setLayersVisible(g.layers, !on)}
                aria-pressed={on}
                title={g.title}
                className={
                  'rounded-full px-2.5 py-0.5 text-[11px] transition ' +
                  (on
                    ? 'bg-raised text-ink shadow-sm'
                    : 'bg-track text-muted/70 line-through')
                }
              >
                {g.label}
              </button>
            )
          })}
        </div>
      </div>

      {/*
        Exploded view.
        A slider rather than a button, to match the hull control beside it: the
        interesting states are the partial ones, where the systems have separated
        far enough to read but still sit in recognisable body positions. A toggle
        would only ever offer nothing or everything. `Reassemble` returns it to
        zero in one click, which is the button behaviour worth keeping.
      */}
      <div className="border-t border-line pt-3">
        <div className="mb-1 flex items-baseline justify-between">
          <label htmlFor="explode" className="text-[10px] uppercase tracking-wide text-muted">
            Explode
          </label>
          {explode > 0 ? (
            <button
              onClick={() => setExplode(0)}
              className="text-[10px] text-muted transition hover:text-ink"
            >
              reassemble
            </button>
          ) : (
            <span className="text-[11px] tabular-nums text-muted">0%</span>
          )}
        </div>
        <input
          id="explode"
          type="range"
          min={0}
          max={100}
          value={Math.round(explode * 100)}
          onChange={(e) => setExplode(Number(e.target.value) / 100)}
          className="w-full accent-[#4f9c84]"
        />
      </div>

      {/*
        X-ray. Separate from the hull slider because it answers a different
        question: the hull controls whether you see PAST the skin, this controls
        whether you see INSIDE an organ. Opaque organs read as blobs — the breast
        loses its internal structure and the bowel becomes one mass — so this
        fades each surface where it faces you and leaves its edges solid.
      */}
      <div className="border-t border-line pt-3">
        <div className="mb-1 flex items-baseline justify-between">
          <label htmlFor="xray" className="text-[10px] uppercase tracking-wide text-muted">
            X-ray
          </label>
          <span className="text-[11px] tabular-nums text-muted">{Math.round(xray * 100)}%</span>
        </div>
        <input
          id="xray"
          type="range"
          min={0}
          max={100}
          value={Math.round(xray * 100)}
          onChange={(e) => setXray(Number(e.target.value) / 100)}
          title="See into organs: fades each surface where it faces you, keeping its silhouette solid"
          className="w-full accent-[#4f9c84]"
        />
        {/*
          Only offered while the x-ray is actually on, because it changes HOW the
          translucency is drawn and does nothing to a solid body. Scoped to the
          gut: transmission re-renders the scene into a back buffer each frame,
          so applying it everywhere is the wrong trade on a headset.
        */}
        {xray > 0 && (
          <button
            onClick={() => setSmoothTransparency(!smoothTransparency)}
            aria-pressed={smoothTransparency}
            title="Refract the gut instead of dithering it — smoother, but costs a render pass"
            className={
              'mt-1.5 w-full rounded-full px-2.5 py-0.5 text-[10px] transition ' +
              (smoothTransparency
                ? 'bg-raised text-ink shadow-sm'
                : 'bg-track text-muted/70 hover:text-ink')
            }
          >
            smooth gut (no grain)
          </button>
        )}
      </div>

      <div className="border-t border-line pt-3">
        <div className="mb-1 flex items-baseline justify-between">
          <label htmlFor="hull" className="text-[10px] uppercase tracking-wide text-muted">
            Body hull
          </label>
          <span className="text-[11px] tabular-nums text-muted">
            {Math.round(hullOpacity * 100)}%
          </span>
        </div>
        <input
          id="hull"
          type="range"
          min={0}
          max={100}
          value={Math.round(hullOpacity * 100)}
          onChange={(e) => setHullOpacity(Number(e.target.value) / 100)}
          className="w-full accent-[#4f9c84]"
        />
      </div>
    </div>
  )
}
