/**
 * Hover state that outlives the thing being hovered, and how it is released.
 *
 * Hovering a structure sets `document.body.style.cursor = 'pointer'` and a hovered
 * label, and `onPointerOut` clears both. That is correct as long as the pointer
 * leaves the mesh — and it does not always get the chance.
 *
 * ⚠️ **react-three-fiber does not synthesise a pointer-out when a mesh unmounts or
 * becomes invisible.** So any of these strands the hover state:
 *
 *   - switching atlas while the pointer is over the body — `AtlasBody` unmounts
 *     under the pointer, which is the single most common interaction here
 *   - hiding a system, or "hide all", while hovering one of its structures
 *   - toggling an overlay off while the pointer is on it
 *   - an availability probe resolving and swapping the atlas with no pointer motion
 *
 * Two things then persist with nothing left to clear them: the cursor stays a
 * pointer over the entire page, and the label keeps naming a structure from the
 * atlas that just went away. Both live outside React's tree — one on
 * `document.body`, one in the store — so an unmount effect is the only place that
 * can put them back.
 */
import { useEffect, useLayoutEffect, useRef } from 'react'

/**
 * Who last claimed the hover cursor.
 *
 * Only the unmount path reads this, and only to answer "was it me?". `composed` mode
 * mounts one `AtlasBody` per source, so an unmount is not proof that this instance
 * was the one hovering — an atlas dropping out of the composed set while a DIFFERENT
 * atlas is hovered would otherwise clear a cursor and a label that still apply.
 *
 * ⚠️ Deliberately not consulted on the pointer-out path. Guarding that too would put
 * ordering assumptions on the hot path — r3f can deliver out-then-over or
 * over-then-out as the pointer crosses between meshes — and getting that wrong breaks
 * ordinary hovering, which is worse than the rare case it would tighten.
 */
let claimant: object | null = null

/** Pointer while over something selectable, default otherwise. */
export function setHoverCursor(over: boolean, owner?: object) {
  document.body.style.cursor = over ? 'pointer' : 'auto'
  if (over) claimant = owner ?? null
  else if (claimant === owner) claimant = null
}

/**
 * Releases hover state when the component holding it goes away: resets the cursor,
 * and runs `clear` for whatever else that component set (typically
 * `setHoveredLabel(null)`).
 *
 * Returns the token to pass as `setHoverCursor`'s second argument, so this instance
 * can be recognised as the claimant later. Call once per component that hovers.
 */
export function useHoverRelease(clear?: () => void): object {
  // Identity only — never read, only compared. A fresh object per component instance.
  const token = useRef<object>({})

  // Through a ref so the unmount effect can stay on empty deps. An inline arrow in
  // the caller would otherwise re-register — and therefore fire — on every render,
  // clearing the label the user is currently reading.
  //
  // ⚠️ Assigned in a layout effect, not during render. React may discard a render it
  // has begun, and a ref written during that render keeps the value while the render
  // never commits — so the unmount cleanup, which IS committed, could call a callback
  // from work that was thrown away. Writing after commit removes the question.
  const latest = useRef(clear)
  useLayoutEffect(() => {
    latest.current = clear
  }, [clear])

  useEffect(
    () => () => {
      // Only if this instance is the one still holding the cursor. See `claimant`.
      if (claimant !== null && claimant !== token.current) return
      claimant = null
      document.body.style.cursor = 'auto'
      latest.current?.()
    },
    [],
  )

  return token.current
}
