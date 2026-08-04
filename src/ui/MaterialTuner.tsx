import { useEffect, useMemo, useState } from 'react'
import { tissueSurface } from '../scene/anatomyPalette'
import type { SystemId } from '../data/schema'
import {
  SCENE_DEFAULTS,
  devTuning,
  getScene,
  subscribeTunables,
  tunableMaterials,
  type TissueKey,
} from '../scene/tuning'

/**
 * Appearance controls — how wet, how matte, how bright each tissue reads.
 *
 * A small pill top-right that expands into the panel. Collapsed by default,
 * because this is a refinement most viewers will never open and it must not
 * compete with the anatomy for attention.
 *
 * It writes straight to the live `MeshPhysicalMaterial` instances, so every drag
 * lands on the next frame — no reload, no shader recompile. That immediacy is
 * the point: how wet a surface looks is a judgement about light moving across it
 * as you turn the body, and it cannot be made by nudging a number and waiting.
 *
 * Values are NOT persisted. Reload restores the defaults in `anatomyPalette.ts`,
 * which is the honest behaviour for a control that changes appearance only and
 * never changes what the twin is claiming.
 */

/** Ranges cover the plausible span for tissue, not the full 0..1. */
const SLIDERS = [
  { prop: 'roughness', label: 'matte', min: 0, max: 1, step: 0.01 },
  { prop: 'clearcoat', label: 'wet sheen', min: 0, max: 1, step: 0.01 },
  { prop: 'clearcoatRoughness', label: 'sheen spread', min: 0, max: 1, step: 0.01 },
  { prop: 'sheen', label: 'fibre sheen', min: 0, max: 1, step: 0.01 },
  /**
   * Per-tissue transparency, the same idea as the Body hull slider but aimed at
   * one tissue rather than the skin: drop muscle to see the skeleton through it,
   * or fade the gut without touching anything else.
   *
   * Floor is 0.12, not 0 — a tissue you cannot see at all is indistinguishable
   * from one you switched off, and the visibility checkboxes already do that
   * honestly.
   */
  { prop: 'opacity', label: 'see-through', min: 0.12, max: 1, step: 0.01 },
] as const

type Prop = (typeof SLIDERS)[number]['prop']

function readProp(key: TissueKey, prop: Prop): number {
  const first = tunableMaterials.get(key)?.values().next().value
  return first ? ((first as unknown as Record<Prop, number>)[prop] ?? 0) : 0
}

/**
 * Write to EVERY material in the group.
 *
 * The cache keys on colour mode, selection and hull opacity as well as tissue,
 * so one tissue can have several live instances. Writing to only one makes the
 * change appear to work until you select something — a confusing way to discover
 * a control is lying to you.
 */
function writeProp(key: TissueKey, prop: Prop, value: number): void {
  const set = tunableMaterials.get(key)
  if (!set) return
  for (const m of set) {
    const before = (m as unknown as Record<Prop, number>)[prop]
    ;(m as unknown as Record<Prop, number>)[prop] = value
    // three.js compiles clearcoat and sheen OUT entirely at zero — they are
    // shader defines, not just uniforms — so crossing zero needs a recompile.
    if ((prop === 'clearcoat' || prop === 'sheen') && (before === 0) !== (value === 0)) {
      m.needsUpdate = true
    }
    /**
     * Opacity does nothing on its own here.
     *
     * These materials sit in the OPAQUE queue, where `opacity` is ignored
     * outright — the atlas uses `alphaHash` rather than alpha blending because
     * mutually enclosing meshes have no valid draw order (see `AtlasBody`). So
     * the slider has to switch the hash on, and `alphaHash` is a shader define,
     * so crossing 1.0 costs a recompile. Only crossing it: dragging within the
     * translucent range is a uniform write and stays per-frame cheap.
     *
     * The shell is left alone — its transparency is real alpha blending driven
     * by the Body hull slider, and forcing the hash onto it would replace a
     * correct ghost with a speckle field over the entire body.
     */
    if (prop === 'opacity' && !m.transparent) {
      const wasHashed = m.alphaHash
      m.alphaHash = value < 1
      if (wasHashed !== m.alphaHash) m.needsUpdate = true
    }
  }
}

/** Split `"metabolic|organ"` back into the arguments `tissueSurface` takes. */
function defaultsFor(key: TissueKey) {
  const [system, layer] = key.split('|')
  return tissueSurface(
    system === 'undefined' || system === 'null' ? null : (system as SystemId),
    layer === 'undefined' ? undefined : layer,
  )
}

function prettyName(key: TissueKey): string {
  const [system, layer] = key.split('|')
  if (layer && layer !== 'organ' && layer !== 'undefined') return layer
  /**
   * A null system is a REAL category here, not a mapping failure — the body-regions
   * atlas and the lymphoid organs carry no `SystemId` on purpose. It reached the
   * panel as a row labelled "Null", which reads as a bug in a list of tissue names.
   * `defaultsFor` above already handled the same string; this did not.
   */
  if (system === 'null' || system === 'undefined') return 'unresolved'
  return system
}

function Slider({
  value,
  min,
  max,
  step,
  label,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  label: string
  onChange: (v: number) => void
}) {
  return (
    <label className="mb-1 flex items-center gap-2">
      <span className="w-[76px] shrink-0 text-[10px] text-muted">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 accent-[#4f9c84]"
      />
      <span className="w-7 shrink-0 text-right text-[10px] tabular-nums text-muted">
        {value.toFixed(2)}
      </span>
    </label>
  )
}

function TissueRow({ tissueKey, onChange }: { tissueKey: TissueKey; onChange: () => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-line last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-1 text-left text-[11px] capitalize text-ink/80 transition hover:text-ink"
      >
        <span className="truncate">{prettyName(tissueKey)}</span>
        <span className="text-muted">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="pb-1.5">
          {SLIDERS.map(({ prop, label, min, max, step }) => (
            <Slider
              key={prop}
              label={label}
              min={min}
              max={max}
              step={step}
              value={readProp(tissueKey, prop)}
              onChange={(v) => {
                writeProp(tissueKey, prop, v)
                onChange()
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function MaterialTuner() {
  const [, force] = useState(0)
  const bump = () => force((n) => n + 1)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => subscribeTunables(bump), [])

  const keys = useMemo(
    () => [...tunableMaterials.keys()].sort(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tunableMaterials.size],
  )
  const scene = getScene()

  const reset = () => {
    for (const k of keys) {
      const d = defaultsFor(k)
      // `tissueSurface` describes a surface, not its transparency, so it has no
      // opacity to restore — solid is the default and the honest baseline.
      for (const { prop } of SLIDERS) writeProp(k, prop, prop === 'opacity' ? 1 : d[prop])
    }
    scene?.setEnvironmentIntensity(SCENE_DEFAULTS.environmentIntensity)
    scene?.setExposure(SCENE_DEFAULTS.exposure)
    bump()
  }

  /** Dev-only: emit the values as the `tissueSurface()` block they came from. */
  const copy = () => {
    const lines = keys.map((k) => {
      const n = (p: Prop) => readProp(k, p).toFixed(2)
      return (
        `  // ${k.replace('|', ' / ')}\n  { roughness: ${n('roughness')}, ` +
        `clearcoat: ${n('clearcoat')}, clearcoatRoughness: ${n('clearcoatRoughness')}, ` +
        `sheen: ${n('sheen')} },`
      )
    })
    const env = scene
      ? `\n// environmentIntensity: ${scene.getEnvironmentIntensity().toFixed(2)}` +
        `\n// toneMappingExposure: ${scene.getExposure().toFixed(2)}`
      : ''
    navigator.clipboard.writeText(`${lines.join('\n')}${env}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    // Unpositioned: this lives inside `SceneDock`'s Look group. It used to carry
    // `right-[84px]`, a constant whose only job was to clear the framing column —
    // see the note at the top of SceneDock.tsx for why that had to go.
    <div className="flex flex-col gap-1.5">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="Adjust how wet or matte each tissue reads"
        className={
          'self-start rounded-lg px-2 py-1 text-[11px] leading-tight transition ' +
          (open ? 'bg-raised text-ink shadow-sm' : 'text-muted hover:bg-raised/60 hover:text-ink')
        }
      >
        Tissue finish{open ? ' ▾' : ' ▸'}
      </button>

      {open && (
        <div className="w-full rounded-xl border border-line bg-panel/60 p-2">
          {/* Scene light first: a wet highlight cannot be judged without also
              being able to move the light that produces it. */}
          {scene && (
            <div className="mb-2 border-b border-line pb-2">
              <Slider
                label="light"
                min={0}
                max={3}
                step={0.01}
                value={scene.getEnvironmentIntensity()}
                onChange={(v) => {
                  scene.setEnvironmentIntensity(v)
                  bump()
                }}
              />
              <Slider
                label="exposure"
                min={0.2}
                max={2}
                step={0.01}
                value={scene.getExposure()}
                onChange={(v) => {
                  scene.setExposure(v)
                  bump()
                }}
              />
            </div>
          )}

          <div className="max-h-[46vh] overflow-y-auto">
            {keys.length === 0 ? (
              <div className="py-2 text-[11px] text-muted">Waiting for the atlas…</div>
            ) : (
              keys.map((k) => <TissueRow key={k} tissueKey={k} onChange={bump} />)
            )}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
            <button onClick={reset} className="text-[10px] text-muted transition hover:text-ink">
              Reset to defaults
            </button>
            {devTuning() && (
              <button
                onClick={copy}
                title="Copy as a tissueSurface() block"
                className="text-[10px] text-muted transition hover:text-ink"
              >
                {copied ? 'copied' : 'copy values'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
