import { afterEach, describe, expect, it } from 'vitest'
import {
  createStructureMask,
  INTERPRETATION_PATTERN_BASE,
  INTERPRETATION_PATTERN_STEP,
  writeStructureMask,
  type StructureMask,
} from './structureMask'
import type { StructureEntry } from './structureEntry'

const structures: StructureEntry[] = [
  { name: 'one', ontologyid: 'FMA:1' },
  { name: 'two', ontologyid: 'FMA:2' },
  { name: 'three', ontologyid: 'FMA:3' },
]

describe('structure interpretation mask', () => {
  let mask: StructureMask | null = null

  afterEach(() => {
    mask?.texture.dispose()
    mask = null
  })

  it('encodes a distinct visible alpha byte for each categorical pattern token', () => {
    mask = createStructureMask(structures.length)
    writeStructureMask(mask, structures, null, () => '#8061bb', (_entry, id) => id)

    const data = mask.texture.image.data as Uint8Array
    expect(data[3]).toBe(INTERPRETATION_PATTERN_BASE)
    expect(data[7]).toBe(INTERPRETATION_PATTERN_BASE + INTERPRETATION_PATTERN_STEP)
    expect(data[11]).toBe(
      INTERPRETATION_PATTERN_BASE + 2 * INTERPRETATION_PATTERN_STEP,
    )
    expect(data[3]).toBeGreaterThan(127)
  })

  it('writes a visible pattern byte when Interpretation passes no hidden ids', () => {
    mask = createStructureMask(structures.length)
    writeStructureMask(mask, structures, null, null, () => 6)

    const data = mask.texture.image.data as Uint8Array
    expect(data[3]).toBeGreaterThanOrEqual(INTERPRETATION_PATTERN_BASE)
    expect(data[7]).toBe(
      INTERPRETATION_PATTERN_BASE + 6 * INTERPRETATION_PATTERN_STEP,
    )
  })

  it('keeps hidden structures collapsed even when a pattern is requested', () => {
    mask = createStructureMask(structures.length)
    writeStructureMask(mask, structures, new Set([1]), null, () => 6)

    const data = mask.texture.image.data as Uint8Array
    expect(data[3]).toBe(
      INTERPRETATION_PATTERN_BASE + 6 * INTERPRETATION_PATTERN_STEP,
    )
    expect(data[7]).toBe(0)
    expect(data[11]).toBe(
      INTERPRETATION_PATTERN_BASE + 6 * INTERPRETATION_PATTERN_STEP,
    )
  })

  it('clamps pattern ids to the categorical presentation range', () => {
    mask = createStructureMask(structures.length)
    writeStructureMask(mask, structures, null, null, (_entry, id) =>
      id === 0 ? -4 : 99,
    )

    const data = mask.texture.image.data as Uint8Array
    expect(data[3]).toBe(INTERPRETATION_PATTERN_BASE)
    expect(data[7]).toBe(
      INTERPRETATION_PATTERN_BASE + 6 * INTERPRETATION_PATTERN_STEP,
    )
  })
})
