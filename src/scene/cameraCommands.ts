import { Spherical, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

/**
 * Discrete camera moves, callable from outside the Canvas.
 *
 * WHY THIS EXISTS
 * ---------------
 * The only way to move the camera used to be a pointer drag on the canvas.
 * That fails WCAG 2.2 twice over: 2.1.1 (Keyboard), because there was no
 * keyboard route to the 3D view at all, and 2.5.7 (Dragging Movements), which
 * requires a single-pointer alternative to any drag. It also fails quietly on
 * iOS, where VoiceOver does not expose `<canvas>` contents at all — so on that
 * platform the body is not merely hard to reach, it is not there.
 *
 * Both fixes need the same three verbs from two different places: a `keydown`
 * handler on the canvas shell (inside the React tree but outside the Canvas)
 * and a row of buttons in the dock (a different subtree entirely). Neither can
 * call `useThree`, because both live outside the r3f reconciler.
 *
 * So the verbs are registered by the component that owns the OrbitControls ref
 * and read back through a module-level singleton — the same shape as
 * `hoverCursor.ts` and `registerScene` in `tuning.ts`, which exist for exactly
 * this reason. Note the constraint recorded in `docs/HANDOVER.md`: `SceneDock`
 * and `AttributionBar` are a circular import and must not gain module-level
 * state. This is a NEW module, so it adds none to either.
 *
 * Everything here manipulates the camera around the control's own target and
 * then calls `update()`, rather than reaching for OrbitControls' internal
 * `rotateLeft`/`dollyIn` — those are private in three-stdlib and have changed
 * signature between versions. Spherical maths against the public
 * `object`/`target` pair cannot break that way.
 */
export interface CameraCommands {
  /** Radians. Positive azimuth turns the body to the viewer's right. */
  orbit: (dAzimuth: number, dPolar: number) => void
  /** Multiplies the orbit radius. < 1 moves in, > 1 moves out. */
  dolly: (factor: number) => void
  /** Back to the whole-body framing, facing front. */
  reset: () => void
}

let current: CameraCommands | null = null

export function registerCameraCommands(c: CameraCommands | null): void {
  current = c
}

/** Null until the scene has mounted, so every caller must tolerate that. */
export function cameraCommands(): CameraCommands | null {
  return current
}

/** One keyboard press. Chosen to feel like about a second of the turntable. */
export const ORBIT_STEP = 0.12
/** Polar steps are smaller — the useful pitch range is about a third of a turn. */
export const POLAR_STEP = 0.08
export const DOLLY_STEP = 1.15

/** The framing `reset` returns to. Matches the `Whole` preset in `FocusSlider`. */
export const RESET_FRAMING = { y: 0.88, distance: 2.5 }

/**
 * Build the command set for a live OrbitControls instance.
 *
 * Kept out of the component so the maths is testable and so the clamping rules
 * live next to the constants they clamp against.
 */
export function makeCameraCommands(
  controls: OrbitControlsImpl,
  onFraming: (y: number, distance: number | null) => void,
): CameraCommands {
  const offset = new Vector3()
  const spherical = new Spherical()

  const apply = (fn: (s: Spherical) => void) => {
    offset.copy(controls.object.position).sub(controls.target)
    spherical.setFromVector3(offset)
    fn(spherical)
    // Never let the camera reach the poles: at phi 0 or PI the azimuth becomes
    // undefined and the view snaps unpredictably on the next input.
    spherical.phi = Math.min(Math.PI - 0.01, Math.max(0.01, spherical.phi))
    spherical.radius = Math.min(
      controls.maxDistance,
      Math.max(controls.minDistance, spherical.radius),
    )
    offset.setFromSpherical(spherical)
    controls.object.position.copy(controls.target).add(offset)
    controls.update()
  }

  return {
    orbit: (dAzimuth, dPolar) =>
      apply((s) => {
        s.theta += dAzimuth
        s.phi += dPolar
      }),
    dolly: (factor) => apply((s) => (s.radius *= factor)),
    reset: () => {
      // Target height and distance go through the store, because `FocusControls`
      // owns that sync and writing the camera directly here would be undone by
      // its effect on the next render. Azimuth has no store field, so it is set
      // here — hence both halves.
      onFraming(RESET_FRAMING.y, RESET_FRAMING.distance)
      apply((s) => {
        s.theta = 0
        s.phi = Math.PI / 2 - 0.18
        s.radius = RESET_FRAMING.distance
      })
    },
  }
}
