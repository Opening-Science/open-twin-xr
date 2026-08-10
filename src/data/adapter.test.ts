import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { assertTwinMetrics } from './adapter'

/**
 * The viewer's trust boundary, tested against every way a payload can be wrong.
 *
 * ⚠️ WHY THIS BOUNDARY MATTERS MORE THAN A TYPICAL ONE. A score drives the
 * COLOUR of a body part. Malformed data does not crash the app, it renders — as
 * a confident green organ. `hasData: false` exists precisely so this project
 * never shows a number it does not have, and a validator that admits
 * `score: "high"` or `score: 47` defeats that from the other direction.
 *
 * The validator used to check three things: that `profile` existed, that
 * `systems` was an array, and that a system without data carried no score. Every
 * case below except the last two passed it.
 */

/** A minimal payload that MUST validate. Each test breaks exactly one thing. */
const valid = () => ({
  schemaVersion: '0.2.0',
  profile: { name: 'Test' },
  systems: [
    { id: 'cardiovascular', label: 'Cardiovascular', hasData: true, score: 7, provenance: ['oura'] },
    { id: 'digestive', label: 'Digestive', hasData: false, score: null, provenance: [] },
  ],
  trend: [],
  connectedSources: [],
  journey: [],
})

describe('assertTwinMetrics', () => {
  it('accepts a well-formed payload', () => {
    expect(() => assertTwinMetrics(valid())).not.toThrow()
  })

  it('returns the payload so it can be used inline', () => {
    const p = valid()
    expect(assertTwinMetrics(p)).toBe(p)
  })

  describe('shape', () => {
    it.each([
      ['null', null],
      ['a string', 'nope'],
      ['a number', 42],
    ])('rejects %s', (_label, input) => {
      expect(() => assertTwinMetrics(input)).toThrow()
    })

    it('rejects a payload with no profile', () => {
      const p = valid() as Record<string, unknown>
      delete p.profile
      expect(() => assertTwinMetrics(p)).toThrow(/profile/)
    })

    it('rejects a payload whose systems is not an array', () => {
      const p = { ...valid(), systems: {} }
      expect(() => assertTwinMetrics(p)).toThrow(/systems/)
    })

    it.each(['trend', 'connectedSources', 'journey'])('rejects a missing `%s`', (field) => {
      const p = valid() as Record<string, unknown>
      delete p[field]
      expect(() => assertTwinMetrics(p)).toThrow(new RegExp(field))
    })
  })

  describe('schemaVersion', () => {
    it('rejects a payload with no version at all', () => {
      const p = valid() as Record<string, unknown>
      delete p.schemaVersion
      expect(() => assertTwinMetrics(p)).toThrow(/schemaVersion/)
    })

    it('rejects a version this build does not know', () => {
      // Reading an unknown version optimistically is what makes migration
      // impossible: old builds half-render new payloads and nobody finds out.
      const p = { ...valid(), schemaVersion: '99.0.0' }
      expect(() => assertTwinMetrics(p)).toThrow(/not supported/)
    })
  })

  describe('systems', () => {
    it('rejects a system id the viewer cannot render', () => {
      const p = valid()
      p.systems[0].id = 'liver'
      expect(() => assertTwinMetrics(p)).toThrow(/not a body system/)
    })

    it('rejects a duplicated system', () => {
      // One of the two silently wins by iteration order and the other vanishes.
      const p = valid()
      p.systems.push({ ...p.systems[0] })
      expect(() => assertTwinMetrics(p)).toThrow(/more than once/)
    })

    it('rejects a non-boolean hasData', () => {
      const p = valid() as { systems: Record<string, unknown>[] }
      p.systems[0].hasData = 'yes'
      expect(() => assertTwinMetrics(p)).toThrow(/hasData/)
    })

    it('rejects an unknown provenance', () => {
      const p = valid()
      p.systems[0].provenance = ['fitbit']
      expect(() => assertTwinMetrics(p)).toThrow(/unknown provenance/)
    })
  })

  describe('the no-data invariant, in both directions', () => {
    it('refuses a score on a system with no data', () => {
      // The original invariant, and the only one the old validator enforced.
      const p = valid()
      p.systems[1].score = 5
      expect(() => assertTwinMetrics(p)).toThrow(/fabricated/)
    })

    it('refuses hasData true with a null score', () => {
      // The mirror case, which was missing: renders as "measured" while having
      // nothing to show.
      const p = valid()
      p.systems[0].score = null
      expect(() => assertTwinMetrics(p)).toThrow(/not a finite number/)
    })

    it.each([
      ['a string', 'high'],
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
    ])('refuses %s as a score', (_label, score) => {
      const p = valid() as { systems: Record<string, unknown>[] }
      p.systems[0].score = score
      expect(() => assertTwinMetrics(p)).toThrow(/not a finite number/)
    })

    it.each([-1, 10.5, 47])('refuses %s, outside the documented 0–10 range', (score) => {
      // The ramp would clamp it and show a confident colour that is not in the data.
      const p = valid()
      p.systems[0].score = score
      expect(() => assertTwinMetrics(p)).toThrow(/outside the documented/)
    })

    it.each([0, 10])('accepts %s, which is in range', (score) => {
      const p = valid()
      p.systems[0].score = score
      expect(() => assertTwinMetrics(p)).not.toThrow()
    })
  })

  /**
   * The payload the app actually loads on first paint. If tightening the
   * validator ever rejects this, the app is broken for everyone — which is not
   * hypothetical: the first draft of `SUPPORTED_SCHEMA` guessed `1.0` while the
   * sample declares `0.2.0`, and this test is what would have caught it.
   */
  it('accepts the bundled sample the app ships with', () => {
    const path = 'public/data/sample-twin.json'
    if (!existsSync(path)) return
    const sample = JSON.parse(readFileSync(path, 'utf8'))
    expect(() => assertTwinMetrics(sample)).not.toThrow()
  })
})
