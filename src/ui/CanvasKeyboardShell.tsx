import { useRef, type ReactNode } from 'react'
import { useTwin } from '../store'
import {
  cameraCommands,
  DOLLY_STEP,
  ORBIT_STEP,
  POLAR_STEP,
} from '../scene/cameraCommands'

/**
 * The keyboard route into the 3D view.
 *
 * WHY A WRAPPER RATHER THAN PROPS ON `<Canvas>`
 * ---------------------------------------------
 * r3f owns the `<canvas>` element and the div it sits in, and what it forwards
 * has changed between versions. A wrapper this component owns outright cannot
 * be broken by that, and it is also the honest place for the semantics: the
 * interactive thing is "the 3D view", which is the canvas plus the behaviour
 * around it, not the bitmap.
 *
 * WHAT THE ROLES SAY, AND WHY
 * ---------------------------
 * `role="application"` tells a screen reader to stop intercepting arrow keys
 * for its own browse mode and pass them to this handler — without it the arrow
 * keys never arrive and the whole control scheme is silently dead under NVDA
 * and JAWS. It is a heavy role and normally the wrong answer, but it is correct
 * for exactly this case: a canvas whose arrow keys mean something.
 *
 * `aria-roledescription="3d model"` then restores the word a screen reader
 * would otherwise announce as "application", which tells a user nothing.
 *
 * ⚠️ THIS IS NOT AN ACCESSIBLE SUBSTITUTE FOR THE BODY, AND MUST NOT BE READ AS
 * ONE. iOS VoiceOver does not expose `<canvas>` contents at all, so on that
 * platform none of this reaches the anatomy. The structure list and the hover
 * readout in `StructurePanel` are the DOM surface that carries the actual
 * information, and they are what a non-visual user is meant to use. This
 * handler makes the view operable; it does not make it perceivable.
 */
export function CanvasKeyboardShell({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const setFocusY = useTwin((s) => s.setFocusY)
  const focusY = useTwin((s) => s.focusY)

  return (
    <div
      ref={ref}
      className="scene-canvas-shell absolute inset-0"
      role="application"
      aria-roledescription="3d model"
      aria-label="Anatomy view. Arrow keys orbit, plus and minus zoom, page up and page down move along the body, 0 resets the framing."
      tabIndex={0}
      onKeyDown={(e) => {
        // Let every modified chord through: Cmd+R must still reload, and
        // Ctrl+arrow is a screen-reader chord on more than one platform.
        if (e.metaKey || e.ctrlKey || e.altKey) return
        const cam = cameraCommands()

        switch (e.key) {
          case 'ArrowLeft':
            cam?.orbit(-ORBIT_STEP, 0)
            break
          case 'ArrowRight':
            cam?.orbit(ORBIT_STEP, 0)
            break
          case 'ArrowUp':
            cam?.orbit(0, -POLAR_STEP)
            break
          case 'ArrowDown':
            cam?.orbit(0, POLAR_STEP)
            break
          // `=` is the unshifted key that carries `+` on most layouts, so both
          // are accepted rather than asking for a shift the label does not show.
          case '+':
          case '=':
            cam?.dolly(1 / DOLLY_STEP)
            break
          case '-':
          case '_':
            cam?.dolly(DOLLY_STEP)
            break
          // Travel up and down the body — the keyboard equivalent of the View
          // slider, which is a `range` and so already has its own arrow keys.
          case 'PageUp':
            setFocusY(Math.min(1.75, focusY + 0.12), null)
            break
          case 'PageDown':
            setFocusY(Math.max(0, focusY - 0.12), null)
            break
          case '0':
            cam?.reset()
            break
          default:
            // Anything unhandled keeps its default, including Tab. Trapping Tab
            // inside a `role="application"` region is the classic way to strand
            // a keyboard user, and there is nothing here to trap them for.
            return
        }
        // Only reached when a case matched, so scrolling is suppressed for keys
        // that did something and left alone for keys that did not.
        e.preventDefault()
      }}
    >
      {children}
    </div>
  )
}
