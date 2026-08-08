import { Color, DataTexture, NearestFilter, RGBAFormat, UnsignedByteType } from 'three'
import type { StructureEntry } from './structureEntry'

/**
 * A per-structure lookup table, as a texture indexed by `_STRUCTURE` id.
 *
 * WHAT REPLACED WHAT, AND WHY THE OLD SHAPE COULD NOT BE EXTENDED
 * --------------------------------------------------------------
 * Overlay masking used to be a single contiguous id RANGE — `{ lo, hi }` — with
 * the vertex shader collapsing anything inside it. That works only when the
 * structures an overlay stands in for happen to be numbered consecutively, and
 * the hook that produced it said so out loud: when they were not, it logged a
 * warning and **hid nothing at all** rather than hide what sat between them.
 * (That hook is now `useHiddenStructureIds` and returns a Set.)
 *
 * ⚠️ That is not a hypothetical limitation, and it is exactly what blocks the
 * repository's own known bug. `docs/HANDOVER.md` records that the one-sided ear
 * overlay cannot mask the ossicles it replaces without blanking the other ear.
 * Measured on the shipped `z-anatomy.ao.glb`:
 *
 *     451 Incus  (right)      2649 Tympanic membrane (right)
 *     452 Stapes (left)       2651 Auditory tube      (right)
 *     453 Malleus(left)       2653 Cochlea            (right)
 *     454 Incus  (left)       2654 Vestibule          (right)
 *     455 Malleus(right)
 *     456 Stapes (right)
 *
 * The two ears INTERLEAVE. A right-only mask is {451, 455, 456}, which is not a
 * range, so no `{lo, hi}` can express it — and the "fix" the handover proposes,
 * ontology terms, would not help either: none of these eight structures carries
 * an `ontologyid` at all. The discriminator that IS present on every one of them
 * is `side`. So the fix is a mask that can hold an arbitrary SET, plus a side
 * filter on the rule. That is what this file is.
 *
 * WHY A TEXTURE RATHER THAN A UNIFORM ARRAY
 * -----------------------------------------
 * A `uniform float[]` is capped by `MAX_VERTEX_UNIFORM_VECTORS` — 256 vectors on
 * the low end, against 3,614 structures. A texture has no such ceiling, is
 * updated by writing bytes rather than recompiling, and gives the tint channels
 * for free in the same fetch.
 *
 * It carries both jobs in one RGBA texel because they are read at the same index
 * in the same draw:
 *
 *     RGB   the tint to apply, straight into `<color_fragment>`
 *     A     255 visible, 0 collapsed to the origin in the vertex shader
 *
 * `NearestFilter` on both axes and no mipmaps: this is a lookup table, and any
 * interpolation would blend one structure's entry into its neighbour's — which
 * is the same class of bug as a blended `_STRUCTURE` id, and just as invisible.
 */

/**
 * Texture width. Structure ids are laid out row-major, so id `n` lives at
 * `(n % WIDTH, floor(n / WIDTH))`.
 *
 * 1024 rather than the id count, because WebGL guarantees only 2048 in each
 * dimension and 3,614 structures would exceed a 1D layout on conformant-minimum
 * hardware. At 1024 wide, Z-Anatomy needs 4 rows.
 */
export const MASK_WIDTH = 1024

export interface StructureMask {
  texture: DataTexture
  /** Rows actually allocated, so the shader can address the table. */
  height: number
  /** How many structures the table covers. */
  count: number
}

export function createStructureMask(count: number): StructureMask {
  const height = Math.max(1, Math.ceil(count / MASK_WIDTH))
  const data = new Uint8Array(MASK_WIDTH * height * 4)
  // Default state: white tint (a no-op multiply) and fully visible.
  data.fill(255)
  const texture = new DataTexture(data, MASK_WIDTH, height, RGBAFormat, UnsignedByteType)
  texture.minFilter = NearestFilter
  texture.magFilter = NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return { texture, height, count }
}

const scratch = new Color()

/**
 * Rewrite the table in place.
 *
 * Called whenever the hidden set or the inspect mode changes. It writes every
 * texel rather than diffing, because the table is at most 1024x4 RGBA — 16 KB —
 * and a diff would cost more in bookkeeping than the memset it saves.
 *
 * ⚠️ Mutating `texture.image.data` requires `needsUpdate = true` to reach the
 * GPU. Missing it produces the worst kind of bug here: correct on the first
 * frame after a remount and stale ever after, which reads as "the toggle works
 * when you switch atlas and not otherwise" — the same signature the material
 * cache-key trap in `AtlasBody` produces, and easy to misattribute to it.
 */
export function writeStructureMask(
  mask: StructureMask,
  structures: readonly StructureEntry[],
  hidden: ReadonlySet<number> | null,
  tintFor: ((entry: StructureEntry, id: number) => string | null) | null,
): void {
  const data = mask.texture.image.data as Uint8Array
  data.fill(255)
  const n = Math.min(structures.length, mask.count)
  for (let i = 0; i < n; i++) {
    const o = i * 4
    if (hidden?.has(i)) {
      data[o + 3] = 0
      continue
    }
    if (!tintFor) continue
    const hex = tintFor(structures[i], i)
    if (!hex) continue
    scratch.set(hex)
    // The tint multiplies the lit tissue colour rather than replacing it, so
    // form and shading survive — see the injection in `AtlasBody`. Written in
    // sRGB bytes because that is what the shader's `texture2D` hands back and
    // what the diffuse colour it multiplies is already in.
    data[o] = Math.round(scratch.r * 255)
    data[o + 1] = Math.round(scratch.g * 255)
    data[o + 2] = Math.round(scratch.b * 255)
  }
  mask.texture.needsUpdate = true
}

/**
 * The tint rules for each inspect mode.
 *
 * ⚠️ EVERY ONE OF THESE COLOURS A FACT THE ASSET LITERALLY CARRIES. None of them
 * interprets anything, which is what keeps this on the rendering side of D8 —
 * `docs/DECISIONS.md`. "Has an FMA term" and "came from a component under
 * CC BY-NC-SA" are properties of the file, not judgements about a body.
 *
 * The palette is deliberately not red-amber-green. Nothing here is a score, and
 * a RAG ramp on anatomy reads as a clinical alert whatever it is driven by —
 * which is the concern `docs/DECISIONS.md` D15 leaves open about the metrics
 * ramp, and there is no reason to walk into it again with a new feature.
 */
export const INSPECT_TINTS = {
  /** Mapped to an ontology term. Cool blue — "known", not "good". */
  mapped: '#7fb2d9',
  /** No term yet. Warm neutral — "not yet mapped", not "wrong". */
  unmapped: '#d9c48f',
  /** Carries its own, stricter licence. Violet, distinct from both above. */
  restricted: '#c08fd9',
  /** Ordinary structure under the atlas's own licence. */
  unrestricted: '#9aa7b0',
} as const

export function inspectTint(
  mode: 'ontology' | 'licence',
  entry: StructureEntry,
): string | null {
  if (mode === 'ontology') {
    return entry.ontologyid ? INSPECT_TINTS.mapped : INSPECT_TINTS.unmapped
  }
  return entry.licence ? INSPECT_TINTS.restricted : INSPECT_TINTS.unrestricted
}
