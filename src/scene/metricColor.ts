import { Color } from 'three'

/**
 * Supplied per-system metric -> colour, on a SEQUENTIAL single-hue ramp.
 *
 * ⚠️ THIS USED TO BE RED -> AMBER -> GREEN, AND THE CHANGE IS A CLAIM DECISION
 * RATHER THAN A VISUAL ONE. D15 left the question open in as many words: "the
 * metrics mode still colours anatomy on a red-amber-green scale from a supplied
 * value ... the question is what the scale *means*". This is the answer.
 *
 * Two reasons the old ramp had to go, and neither is about taste.
 *
 * **Red on an organ is an alert.** A diverging scale with red at one end does not
 * report a value, it flags one — and alert-style framing is a signal that MDR
 * Rule 11's second paragraph reads as monitoring a physiological process, which
 * is a medical purpose this repository does not have and does not want. The
 * viewer renders a number somebody else computed (D8); a scale that turns that
 * number into a warning is making a claim the renderer cannot support.
 *
 * **And it is not harmless to the person looking at it.** Rosman et al. associate
 * wearable alerting with anxiety in roughly one user in five
 * (DOI 10.1161/JAHA.123.033750). A red liver is an alert whatever the tooltip says.
 *
 * So the scale is now sequential on an ATTENTION axis: one hue, varying in
 * lightness, where the far end means "this is where attention goes" and the near
 * end means "nothing to say here". Low values read as less-attended rather than
 * as bad. It is also more accessible than the ramp it replaces — a single hue
 * varying monotonically in lightness survives greyscale and every form of colour
 * blindness, where red-versus-green is the one distinction most affected people
 * cannot make.
 *
 * ⚠️ WHAT THIS DOES NOT DO. It is still a colour driven by a number this
 * repository did not compute and does not validate. Choosing a calmer scale
 * lowers the framing risk; it does not turn an unvalidated metric into a
 * validated one, and it is not a substitute for the methodology question D15
 * raises for any public or store distribution. Renaming was not a regulatory
 * answer and neither is recolouring.
 */

/** Score 10 — nothing to say. Deliberately close to the panel neutrals. */
const QUIET = new Color('#cfd8de')
/** Score 0 — this is where attention goes. Same hue, markedly darker. */
const ACTIVE = new Color('#5b8fa8')

/**
 * No data at all — and re-choosing this was the hard half of the change.
 *
 * ⚠️ THE OLD CONSTANT WAS JUSTIFIED RELATIONALLY, AND THE RELATION NO LONGER
 * HOLDS. `#b7c2cc` was chosen to sit "deliberately OUTSIDE the red-amber-green
 * scale", so that "we don't know" could not read as "bad" (red) or "fine"
 * (green). Against a diverging three-hue ramp a neutral grey genuinely was
 * outside it. Against a single-hue ramp it is not: the ramp now varies chiefly in
 * LIGHTNESS, so lightness has become the data channel, and any flat grey lands
 * somewhere on it. Carried over unchanged, the constant would have quietly
 * started meaning "a middling score" — the exact misreading it exists to prevent.
 *
 * Hue alone cannot fix that. This colour is warm where the ramp is cool — 28°
 * against 199-204°, so 177° apart at the closest point — which separates them for
 * a viewer seeing both in colour. But in greyscale, or for a viewer reading
 * lightness, it does not: measured across the whole ramp, this colour comes
 * within **0.1 lightness points** of the ramp at score 3.7. Choosing a lightness
 * outside the ramp's 51-84 % span means going either very dark (which reads as
 * bad, reintroducing the problem) or very light (which glows on the dark theme).
 *
 * ⚠️ Those percentages are **sRGB** HSL, as a colour picker reports them. Reading
 * them back with three's `Color.getHSL()` gives different numbers (25-68 % for the
 * ramp), because `Color` converts to linear-sRGB on construction. Same colours,
 * different space — do not "correct" one set to match the other.
 *
 * So the load-bearing distinction is NOT the colour. It is a channel the ramp
 * does not use at all:
 *
 *   - **In the 3D body**, no-data is already ghosted to 45 % opacity in metrics
 *     mode, which `alphaHash` renders as an object-space DITHER (see D13 and the
 *     opacity ladder in `AtlasBody.materialFor`). Unmeasured anatomy is visibly
 *     stippled rather than flat, at any lightness, in greyscale, and in a headset.
 *     That treatment predates this change and is why the 3D view needed no new
 *     shader work — it was already distinguishing no-data on a non-hue channel.
 *   - **In DOM swatches**, which are flat fills with no dither to inherit, use
 *     `NO_DATA_SWATCH_CSS` below rather than this colour on its own.
 *
 * Both say "no value" instead of "a low value", which is the whole requirement.
 */
export const NO_DATA_COLOR = new Color('#b3aaa2')

/**
 * The no-data swatch, as CSS.
 *
 * A hatch, because a flat fill cannot say "no value" on a ramp whose data
 * channel is lightness — see `NO_DATA_COLOR`. This is the DOM equivalent of the
 * dither the 3D view already applies, and it is deliberately the same idea
 * rendered in the medium available: a texture the scale itself never produces.
 *
 * 45 degrees at 3px, which reads as hatching rather than as a pattern at swatch
 * sizes (the legend swatches are 14px).
 */
export const NO_DATA_SWATCH_CSS =
  'repeating-linear-gradient(45deg, #b3aaa2 0 1.5px, #8e857d 1.5px 3px)'

/** `null` score means no data. Returns the neutral colour in that case. */
export function scoreToColor(score: number | null): Color {
  if (score === null || Number.isNaN(score)) return NO_DATA_COLOR.clone()
  const s = Math.max(0, Math.min(10, score)) / 10
  // One segment, not two. A diverging ramp needs a midpoint colour because it
  // has a meaningful middle; a sequential one does not, and inventing a midpoint
  // would reintroduce a "this is the acceptable value" reading through the back
  // door. `lerp` in linear-light is fine here because both ends share a hue, so
  // there is no hue path to take the short or long way round.
  return ACTIVE.clone().lerp(QUIET, s)
}

/**
 * Emissive lift in metrics mode. **Constant, and no longer driven by the score.**
 *
 * ⚠️ IT USED TO GLOW BRIGHTER AS THE SCORE FELL — `0.15 + (1 - s) * 0.35` — which
 * is the alert framing this file exists to remove, expressed in light instead of
 * in hue. Recolouring the ramp while leaving a low value glowing would have moved
 * the alert rather than dropped it, and D15's own warning applies: a cosmetic
 * change is not a regulatory answer.
 *
 * The value is carried by the ramp. Nothing glows because of what it is.
 *
 * The downstream form of this is different and belongs downstream: where a
 * proposals layer exists, a glow marking "there is something you can act on here"
 * is honest, because it points at an available action rather than at a number
 * being low. That needs a proposal to point at, and this repository has none by
 * design (D8), so it is not modelled here.
 */
export function scoreToEmissive(score: number | null): number {
  if (score === null || Number.isNaN(score)) return 0
  // Enough to keep metrics mode from reading as flat matte paint, and identical
  // at every score so it carries no signal of its own.
  return 0.12
}

/**
 * `scoreToOpacity` was deleted rather than reused, which T6 offered as the
 * alternative.
 *
 * It had zero importers and it duplicated a decision that lives somewhere else:
 * `AtlasBody.materialFor` owns the opacity ladder, and its no-data rung is scoped
 * to metrics mode on purpose — D13 records that ghosting unmeasured anatomy in
 * ANATOMICAL mode dissolved the abdomen into a point cloud, because most systems
 * legitimately carry no score once scoring moved upstream. A second, unscoped
 * copy of that rule sitting in this file was an invitation to reintroduce the bug
 * it documents. The ghost is also load-bearing for no-data legibility now — see
 * `NO_DATA_COLOR`.
 */
