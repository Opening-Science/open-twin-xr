import { Color } from 'three'
import type { SystemId } from '../data/schema'
import type { AnatomyLayer } from '../store'

/**
 * Anatomical colouring — the textbook/atlas look.
 *
 * WHY THIS EXISTS ALONGSIDE THE SCORE SCALE
 * -----------------------------------------
 * The health palette in `metricColor.ts` encodes score as red -> amber -> green.
 * Anatomical convention colours muscle *red* and bone *ivory*. Those two
 * languages collide head-on: a realistically red muscle reads as a failing
 * score, and a healthy green liver reads as diseased.
 *
 * They cannot be merged without lying in one direction or the other, so they are
 * kept as separate modes and the viewer chooses. Anatomical mode still conveys
 * health, but through emissive lift rather than hue — see `scoreLift` — so a
 * poor score glows rather than turning a colour that means something else.
 *
 * Values are deliberately desaturated relative to a printed atlas. Full-strength
 * anatomical red is overwhelming across a whole body on a lit 3D model, and it
 * fights the pale dashboard around it.
 */

/** Layer colours take precedence — bone is bone whatever system it serves. */
const LAYER_COLORS: Record<AnatomyLayer, string> = {
  bone: '#efe8d4', // warm ivory, matte
  muscle: '#8c4d3c', // deep red-brown; browner and darker than arterial red
  // Cartilage and ligament read PALE BLUE-GREY, not cream. That is both more
  // truthful — hyaline cartilage is pearly and slightly blue — and the only way
  // to separate it from bone, which it always sits directly against. As cream it
  // measured 3.3 against bone: the same colour, to the eye.
  connective: '#b8c8c6',
  organ: '#bd8a72', // fallback for viscera with no system tint
}

/**
 * Per-system viscera hues.
 *
 * TUNED FOR DISCRIMINABILITY, NOT JUST PLAUSIBILITY
 * ------------------------------------------------
 * The previous palette was individually defensible and collectively unusable:
 * most viscera collapsed into one brown. Measured as CIEDE2000 over all 55 pairs,
 * **eleven pairs sat under dE 12** — the point below which two large flat areas
 * read as the same colour — and the worst, nervous against connective, was
 * **1.9**, which is indistinguishable.
 *
 * The difficulty is real rather than a failure of taste: most viscera genuinely
 * ARE brownish-red, so "realistic" and "distinguishable" pull against each other.
 * The resolution is to separate on **lightness** as much as hue, which the body
 * supports honestly — liver really is much darker than gut, lung really is much
 * lighter than heart. The warm family is therefore ordered dark to light:
 *
 *   metabolic (liver)  <  muscle  <  cardiovascular  <  endocrine  <  digestive
 *
 * and the three structures with a defensible non-red reading are pushed out of
 * that family entirely: nervous to straw yellow (the atlas convention for nerve),
 * respiratory to dusky rose, connective to the pale blue-grey of cartilage.
 *
 * Result: **one pair under dE 12**, and that pair is digestive against
 * integumentary — the skin hull, which renders at 10 % opacity and so never
 * reads as a solid colour against anything.
 *
 * If you change one of these, re-run the pairwise check rather than trusting the
 * swatch. Two colours that look distinct side by side in a picker routinely
 * collapse when they are lit, curved and adjacent.
 */
const SYSTEM_COLORS: Record<SystemId, string> = {
  cardiovascular: '#c4362a', // heart and vessels — the purest, most saturated red
  respiratory: '#c095a4', // lung, dusky rose with a grey cast
  nervous: '#d9cf8a', // brain, cord and nerve — pale straw
  digestive: '#c3a67f', // gut, light warm tan
  metabolic: '#5a2f31', // liver and spleen — darkest, deep maroon
  endocrine: '#c17c22', // thyroid, adrenal, kidney — amber
  reproductive: '#8f6478', // muted mauve, darker than the lung rose
  integumentary: '#dfc3b2', // skin
  musculoskeletal: '#8c4d3c', // only reached if a mesh declares no layer
}

const cache = new Map<string, Color>()
function cached(hex: string): Color {
  let c = cache.get(hex)
  if (!c) {
    c = new Color(hex)
    cache.set(hex, c)
  }
  return c
}

/**
 * Base colour for a structure. Layer wins over system, because "bone" is a
 * stronger visual fact than which system the bone belongs to.
 */
export function anatomicalColor(
  systemId: SystemId | null,
  layer?: string,
  /** The atlas's OWN group key, for groups that resolve to no `SystemId`. */
  group?: string,
): Color {
  /**
   * ⚠️ `organ` is a FALLBACK, not a tissue look — it must not outrank the system.
   *
   * `bone`, `muscle` and `connective` describe a material whose appearance does
   * not depend on which system it belongs to: a rib and a femur are the same
   * ivory. `organ` describes no appearance at all — it only says "this is a
   * viscus", and which viscus is exactly what `SYSTEM_COLORS` is tuned to
   * distinguish.
   *
   * Letting it win collapsed every organ in BodyParts3D and Z-Anatomy — which
   * tag all viscera `layer: 'organ'` — onto one brown, and made the entire
   * per-system palette below unreachable for them. HRA escaped it only by
   * declaring no layer, which is why it alone showed varied organ hues and the
   * other two looked uniformly brown.
   *
   * `MaterialTuner` already draws this distinction the same way.
   */
  /**
   * Surface regions get their own hue rather than the unresolved grey.
   *
   * They legitimately resolve to no `SystemId` — a topographic region is not a
   * body system — but "not a system" and "unidentified" are different claims and
   * should not look identical. Grey is reserved for geometry we genuinely cannot
   * place; a named region is placed, just not into a system.
   *
   * A desaturated warm neutral: readable against the tissue palette without
   * competing with it, and clearly not a tissue colour, since a region is a patch
   * of surface rather than a material.
   */
  if (group === 'regions') return cached('#c9b9a8').clone()

  const tissue = layer && layer !== 'organ' && layer in LAYER_COLORS
  if (tissue) return cached(LAYER_COLORS[layer as AnatomyLayer]).clone()
  if (systemId) return cached(SYSTEM_COLORS[systemId]).clone()
  // A viscus with no system: the generic organ tint beats grey, which reads as
  // "unidentified" and is reserved for geometry we genuinely cannot place.
  if (layer && layer in LAYER_COLORS) return cached(LAYER_COLORS[layer as AnatomyLayer]).clone()
  return cached('#a9a49c').clone() // unresolved — deliberately grey, never a tissue hue
}

/**
 * How much a structure should glow in anatomical mode, given its score.
 *
 * Hue is spoken for, so health is carried by luminance instead: a poor score
 * lifts, a good one sits flat. Null (no data) does not glow at all — an
 * unmeasured system must not look like a failing one.
 */
export function scoreLift(score: number | null): number {
  if (score === null || Number.isNaN(score)) return 0
  const s = Math.max(0, Math.min(10, score)) / 10
  return (1 - s) * 0.55
}

/** Roughness per layer. Bone is matte, muscle slightly sheened, viscera wet. */
export function anatomicalRoughness(layer?: string): number {
  if (layer === 'bone') return 0.78
  if (layer === 'muscle') return 0.5
  if (layer === 'connective') return 0.6
  return 0.42
}

/**
 * The wet look, which is a second specular layer rather than a lower roughness.
 *
 * Viscera are covered by serosa — a thin transparent wet membrane over a dull
 * substrate. That is exactly what `clearcoat` models, and it is the single
 * property that separates "tissue" from "coloured plastic". Lowering `roughness`
 * instead makes the whole surface glossy, which reads as porcelain: the dull
 * diffuse underneath is as much a part of the look as the sheen on top.
 *
 * These are inert without an environment map. `clearcoatRadiance` is populated
 * only inside `#ifdef USE_ENVMAP` in three.js's `lights_fragment_maps` chunk, so
 * with no IBL the clearcoat lobe receives zero indirect light and setting it
 * changes nothing. See the note in `BodyScene.tsx`.
 *
 * Deliberately NOT used: `transmission` (three.js re-renders the whole opaque
 * scene per transmissive object — twice more per eye in XR), and `iridescence`
 * (thin-film interference; there is no anatomy it describes and it reads as an
 * oil slick).
 */
export interface TissueSurface {
  roughness: number
  clearcoat: number
  clearcoatRoughness: number
  /** Retroreflective fibre lobe. Muscle only — on viscera it looks like velvet. */
  sheen: number
}

export function tissueSurface(systemId: SystemId | null, layer?: string): TissueSurface {
  if (layer === 'bone') return { roughness: 0.78, clearcoat: 0.08, clearcoatRoughness: 0.6, sheen: 0 }
  if (layer === 'muscle') return { roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.3, sheen: 0.35 }
  if (layer === 'connective') return { roughness: 0.6, clearcoat: 0.2, clearcoatRoughness: 0.4, sheen: 0 }

  // Viscera differ enough to be worth separating. Lung is the outlier: alveolar
  // tissue is dry and matte, so giving it the same wet coat as liver is what
  // makes a rendered lung look like a balloon.
  switch (systemId) {
    case 'respiratory':
      return { roughness: 0.62, clearcoat: 0.25, clearcoatRoughness: 0.45, sheen: 0.25 }
    case 'nervous':
      return { roughness: 0.58, clearcoat: 0.3, clearcoatRoughness: 0.35, sheen: 0.2 }
    case 'metabolic': // liver, pancreas, spleen — the wettest surfaces in the body
      return { roughness: 0.45, clearcoat: 0.55, clearcoatRoughness: 0.28, sheen: 0 }
    case 'integumentary':
      // 0.30, not 0.45. `AtlasBody` used to hardcode the shell's roughness and
      // silently shadow whatever this returned, so the old 0.45 was never once
      // used. The live tuner is what exposed it: it reads the material rather
      // than the source, so it reported the number actually being rendered.
      return { roughness: 0.3, clearcoat: 0.3, clearcoatRoughness: 0.35, sheen: 0.1 }
    default:
      return { roughness: 0.42, clearcoat: 0.45, clearcoatRoughness: 0.3, sheen: 0 }
  }
}
