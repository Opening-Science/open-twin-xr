import { Color } from 'three'

/**
 * Map a 0-10 health score to a colour on a red -> amber -> green scale.
 * Accessible-ish: distinct in hue AND lightness so it survives colour-blind
 * viewing and greyscale.
 */
const LOW = new Color('#d9736a') // score 0
const MID = new Color('#e6b566') // score 5
const HIGH = new Color('#5fae94') // score 10

/**
 * Neutral grey for systems no connector measures. This is deliberately OUTSIDE
 * the red-amber-green scale: "we don't know" must not read as "bad" (red) or
 * "fine" (green). See docs/SCHEMA_VERIFICATION.md.
 */
export const NO_DATA_COLOR = new Color('#b7c2cc')

/** `null` score means no data. Returns the neutral colour in that case. */
export function scoreToColor(score: number | null): Color {
  if (score === null || Number.isNaN(score)) return NO_DATA_COLOR.clone()
  const s = Math.max(0, Math.min(10, score)) / 10
  const c = new Color()
  if (s < 0.5) {
    c.copy(LOW).lerp(MID, s / 0.5)
  } else {
    c.copy(MID).lerp(HIGH, (s - 0.5) / 0.5)
  }
  return c
}

/** Emissive intensity so lower scores glow slightly. No-data organs do not glow. */
export function scoreToEmissive(score: number | null): number {
  if (score === null || Number.isNaN(score)) return 0
  const s = Math.max(0, Math.min(10, score)) / 10
  return 0.15 + (1 - s) * 0.35
}

/** Opacity: unmeasured organs recede rather than competing for attention. */
export function scoreToOpacity(score: number | null): number {
  return score === null ? 0.35 : 1
}
