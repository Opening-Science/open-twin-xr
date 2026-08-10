import { describe, expect, it } from 'vitest'
import {
  ANATOMY_SOURCES,
  activeSources,
  composedMap,
  isComposedMixed,
  resolveMode,
  sexesFor,
  sourceForSystem,
  soleComposedSource,
  type AnatomyMode,
  type Sex,
} from './anatomySources'

/**
 * The atlas registry, which decides what the viewer loads and what the switcher
 * is allowed to claim.
 *
 * ⚠️ These are pure functions with no assets and no DOM, so they are the cheapest
 * real coverage in this repository — and they were entirely untested while every
 * mode pill, availability probe and credits panel read from them.
 *
 * The parametric cases matter most. `activeSources('parametric')` returning an
 * empty list is deliberate (D18: the mode replaces the atlas rather than wrapping
 * one), but that emptiness silently disabled the "is anything missing" check and
 * shipped a mode that could never report itself uninstalled. The tests below pin
 * the behaviour AND the reason, so the next person to touch it sees both.
 */

const SEXES: Sex[] = ['male', 'female']
const ALL_MODES = [
  'composed',
  'composed-f',
  'parametric',
  ...(Object.keys(ANATOMY_SOURCES) as (keyof typeof ANATOMY_SOURCES)[]),
] as AnatomyMode[]

describe('anatomy source registry', () => {
  it('every registered source has a url, a label and a donor', () => {
    for (const [id, s] of Object.entries(ANATOMY_SOURCES)) {
      expect(s.url, `${id} url`).toMatch(/^\/models\/.+\.glb$/)
      expect(s.label, `${id} label`).toBeTruthy()
      expect(s.donor, `${id} donor`).toBeTruthy()
    }
  })

  it('no two sources share a url', () => {
    // A shared url would make availability and credits ambiguous.
    const urls = Object.values(ANATOMY_SOURCES).map((s) => s.url)
    expect(new Set(urls).size).toBe(urls.length)
  })
})

describe('resolveMode', () => {
  it.each(ALL_MODES)('resolves %s for both sexes without throwing', (mode) => {
    for (const sex of SEXES) expect(() => resolveMode(mode, sex)).not.toThrow()
  })

  it('is idempotent — resolving a resolved mode changes nothing', () => {
    for (const mode of ALL_MODES) {
      for (const sex of SEXES) {
        const once = resolveMode(mode, sex)
        expect(resolveMode(once, sex)).toBe(once)
      }
    }
  })

  it('resolves the composed mode per sex', () => {
    // The female map is a different map, not the same one relabelled.
    expect(resolveMode('composed', 'male')).not.toBe(resolveMode('composed', 'female'))
  })

  it('leaves parametric alone for either sex', () => {
    // It has no donor, so there is no male or female build to choose between.
    for (const sex of SEXES) expect(resolveMode('parametric', sex)).toBe('parametric')
  })
})

describe('activeSources', () => {
  it.each(ALL_MODES)('returns only registered sources for %s', (mode) => {
    const known = new Set(Object.values(ANATOMY_SOURCES))
    for (const s of activeSources(mode)) expect(known.has(s)).toBe(true)
  })

  it('returns an empty list for parametric, and that is load-bearing', () => {
    /**
     * ⚠️ Do not "fix" this to return the ANNY grid. The emptiness is what makes
     * the mode standalone — `Body` returns early on it so the procedural
     * placeholder does not appear beside a generated body.
     *
     * But it also means EVERY consumer that asks "is anything missing?" by
     * filtering this list gets "nothing" for free. `AttributionBar.missingFor`
     * special-cases it against `gridAvailability` for exactly that reason; if
     * this ever becomes non-empty, go and simplify that too.
     */
    expect(activeSources('parametric')).toEqual([])
  })

  it('returns at least one source for every other mode', () => {
    for (const mode of ALL_MODES) {
      if (mode === 'parametric') continue
      expect(activeSources(mode).length, `${mode}`).toBeGreaterThan(0)
    }
  })

  it('never repeats a source', () => {
    for (const mode of ALL_MODES) {
      const got = activeSources(mode)
      expect(new Set(got).size, `${mode}`).toBe(got.length)
    }
  })
})

describe('the composed maps', () => {
  it.each(['composed', 'composed-f'] as AnatomyMode[])(
    '%s points every body system at a registered source',
    (mode) => {
      for (const [system, id] of Object.entries(composedMap(mode))) {
        expect(ANATOMY_SOURCES[id], `${system} -> ${id}`).toBeTruthy()
      }
    },
  )

  it('reports whether it actually mixes atlases, rather than assuming it does', () => {
    // The female map currently points every system at HRA, so `composed` there
    // renders identically to the HRA pill. The switcher says so out loud; this
    // pins that the registry can still tell the difference.
    for (const mode of ['composed', 'composed-f'] as AnatomyMode[]) {
      const mixed = isComposedMixed(mode)
      const sole = soleComposedSource(mode)
      expect(mixed ? sole === null : sole !== null).toBe(true)
    }
  })
})

describe('sexesFor', () => {
  it.each(ALL_MODES)('returns only real sexes for %s', (mode) => {
    for (const s of sexesFor(mode)) expect(SEXES).toContain(s)
  })

  it('never returns duplicates', () => {
    for (const mode of ALL_MODES) {
      const got = sexesFor(mode)
      expect(new Set(got).size, `${mode}`).toBe(got.length)
    }
  })
})

describe('sourceForSystem', () => {
  it('resolves every system of every composed map to a registered source', () => {
    for (const mode of ['composed', 'composed-f'] as AnatomyMode[]) {
      for (const system of Object.keys(composedMap(mode))) {
        const src = sourceForSystem(mode, system as never)
        expect(src, `${mode}/${system}`).toBeTruthy()
        expect(src.url).toMatch(/^\/models\//)
      }
    }
  })
})
