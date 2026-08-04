/**
 * Live material tuning registry — development only.
 *
 * The surface constants in `anatomyPalette.ts` are literature starting points,
 * not values anyone chose by looking at them. Tuning them by editing the file is
 * a bad loop: you change a number you cannot picture, wait for a reload, and
 * compare against a memory of what it looked like before.
 *
 * So the renderer registers its live materials here and `MaterialTuner` mutates
 * them directly. Roughness, clearcoat and sheen are plain uniforms, so a change
 * shows up on the very next frame with no recompile and no reload — which is the
 * only way to judge a wet-tissue highlight honestly.
 *
 * This costs nothing in production: `AtlasBody` always registers, but the panel
 * is only mounted behind `?tune`, and a Map of a few dozen references is not a
 * leak worth avoiding. Registration is cleared whenever the material cache is.
 */
import type { Camera, MeshPhysicalMaterial, Scene, WebGLRenderer } from 'three'

/** `"metabolic|organ"`, `"musculoskeletal|bone"` — the key `tissueSurface` varies on. */
export type TissueKey = string

/**
 * Every live material, grouped by the tissue it represents.
 *
 * A group holds more than one material because the cache also keys on colour
 * mode, selection and hull opacity — all of which produce separate instances of
 * the same tissue. Tuning has to write to all of them or the change appears to
 * half-work depending on what is selected.
 */
export const tunableMaterials = new Map<TissueKey, Set<MeshPhysicalMaterial>>()

export function registerTunable(key: TissueKey, material: MeshPhysicalMaterial): void {
  let set = tunableMaterials.get(key)
  if (!set) {
    set = new Set()
    tunableMaterials.set(key, set)
  }
  set.add(material)
  notify()
}

export function clearTunables(): void {
  tunableMaterials.clear()
  notify()
}

/**
 * Scene-level handles the panel also needs.
 *
 * Environment intensity and tone-mapping exposure move the image at least as
 * much as any per-tissue constant — a clearcoat highlight cannot be judged
 * without also being able to move the light that produces it.
 */
export interface SceneHandles {
  setEnvironmentIntensity: (v: number) => void
  getEnvironmentIntensity: () => number
  setExposure: (v: number) => void
  getExposure: () => number
}

let sceneHandles: SceneHandles | null = null
export function registerScene(h: SceneHandles | null): void {
  sceneHandles = h
  notify()
}
export function getScene(): SceneHandles | null {
  return sceneHandles
}

/** Minimal subscription so the panel re-renders when the atlas finishes loading. */
const listeners = new Set<() => void>()
export function subscribeTunables(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
function notify() {
  for (const fn of listeners) fn()
}

/**
 * Scene-level defaults, so Reset has something authoritative to restore to.
 * These must match what `BodyScene` mounts with.
 */
export const SCENE_DEFAULTS = { environmentIntensity: 0.9, exposure: 1.0 } as const

/**
 * A dev-only handle on the live renderer, at `window.__openTwin`.
 *
 * The reason this exists is narrow and worth stating, because it has cost this
 * project hours twice: an automated/embedded browser pane can hold the document
 * at `visibilityState: "hidden"`, and Chrome fully suspends `requestAnimationFrame`
 * in a hidden document. r3f renders inside rAF, so the canvas simply stops being
 * painted — every screenshot comes back blank or stale, and it looks exactly like
 * a rendering regression. It is not one.
 *
 * `render()` drives one frame straight off the renderer, bypassing rAF, so a
 * headless check can paint deliberately and screenshot something real. `scene`
 * is there so a check can assert on materials and geometry directly, which is
 * better evidence than a picture anyway.
 *
 * Stripped from production builds by the `import.meta.env.DEV` guard at the call
 * site in `BodyScene`.
 */
export interface DevSceneHandle {
  gl: WebGLRenderer
  scene: Scene
  camera: Camera
  render: () => void
  /**
   * The orbit controls, so a headless check can step the turntable by hand.
   * `autoRotate` advances inside `controls.update()`, which drei calls from
   * `useFrame` — i.e. from rAF, which a hidden document suspends. Without this
   * there is no way to tell a stopped spin from a suspended frame loop.
   */
  controls?: { update: () => void; autoRotate: boolean }
}

/**
 * `?tune` no longer gates the panel — appearance is a user control now. It gates
 * only the developer affordance: copying the values back out as source.
 */
export function devTuning(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('tune')
}
