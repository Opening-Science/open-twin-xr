import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { scoreToColor } from '../scene/metricColor'
import { assertInterpretationDocument } from './interpretationContract'
import {
  INTERPRETATION_STYLES,
  RESEARCH_USE_FOOTER,
  absentSystems,
  placementIssues,
  stateForFma,
  styleForState,
} from './interpretationPresentation'

const fixture = assertInterpretationDocument(
  JSON.parse(readFileSync('contracts/fixtures/minimal.valid.json', 'utf8')),
)

describe('interpretation visual semantics', () => {
  it('gives every categorical state a unique colour, texture, and pattern token', () => {
    const styles = Object.values(INTERPRETATION_STYLES)
    expect(new Set(styles.map((style) => style.color)).size).toBe(styles.length)
    expect(new Set(styles.map((style) => style.swatch)).size).toBe(styles.length)
    expect(new Set(styles.map((style) => style.patternToken)).size).toBe(styles.length)
  })

  it('does not reuse a colour from the existing numeric blue-grey ramp', () => {
    const metricColours = new Set(
      Array.from({ length: 11 }, (_, score) => `#${scoreToColor(score).getHexString()}`),
    )
    for (const style of Object.values(INTERPRETATION_STYLES)) {
      expect(metricColours.has(style.color.toLowerCase())).toBe(false)
    }
  })

  it('treats absent and insufficient states identically as no data', () => {
    const insufficient = fixture.states.find((state) => !state.sufficient_data)
    expect(styleForState(null)).toEqual(INTERPRETATION_STYLES.no_data)
    expect(styleForState(insufficient)).toEqual(INTERPRETATION_STYLES.no_data)
  })

  it('keeps none and indeterminate distinct from no data and each other', () => {
    const base = fixture.states[0]
    const none = { ...base, severity: 'none' as const }
    const indeterminate = { ...base, severity: 'indeterminate' as const }
    expect(styleForState(none).key).toBe('none')
    expect(styleForState(indeterminate).key).toBe('indeterminate')
    expect(styleForState(none)).not.toEqual(styleForState(indeterminate))
    expect(styleForState(none)).not.toEqual(INTERPRETATION_STYLES.no_data)
  })

  it('does not use confidence to select a visual treatment', () => {
    const state = fixture.states[0]
    expect(styleForState({ ...state, confidence: 0 })).toEqual(
      styleForState({ ...state, confidence: 1 }),
    )
  })

  it('uses the Martin-approved research footer', () => {
    expect(RESEARCH_USE_FOOTER).toBe(
      'Research-use visualisation only. This viewer renders supplied interpretation states and does not provide medical advice.',
    )
  })
})

describe('exact interpretation placement', () => {
  it('joins directly on exact FMA and never on optional UBERON', () => {
    expect(stateForFma(fixture, 'FMA:7088')?.system_id).toBe('cardiovascular')
    expect(stateForFma(fixture, 'UBERON:0000948')).toBeNull()
    expect(stateForFma(fixture, 'FMA:999999')).toBeNull()
  })

  it('does not choose between duplicate states targeting one FMA id', () => {
    const duplicate = {
      ...fixture,
      states: [
        fixture.states[0],
        {
          ...structuredClone(fixture.states[0]),
          system_id: 'metabolic' as const,
        },
      ],
    }
    expect(stateForFma(duplicate, 'FMA:7088')).toBeNull()
    expect(
      placementIssues(duplicate, new Set(['FMA:7088'])).some(
        (issue) => issue.reason === 'duplicate_fma_state',
      ),
    ).toBe(true)
  })

  it('surfaces unmatched FMA without choosing a nearest structure', () => {
    const issues = placementIssues(fixture, new Set(['FMA:7088']))
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fmaId: 'FMA:7197', reason: 'no_fma_match' }),
      ]),
    )
  })

  it('uses the bridge only to confirm optional UBERON agreement', () => {
    const matching = placementIssues(fixture, new Set(['FMA:7088', 'FMA:7197']))
    expect(matching.some((issue) => issue.reason === 'uberon_mismatch')).toBe(false)

    const mismatch = {
      ...fixture,
      states: [
        {
          ...fixture.states[0],
          geometry: { fma_id: 'FMA:7197', uberon_id: 'UBERON:0000948' },
        },
      ],
    }
    expect(placementIssues(mismatch, new Set(['FMA:7197']))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'uberon_mismatch', fmaId: 'FMA:7197' }),
      ]),
    )
    expect(stateForFma(mismatch, 'FMA:7197')).not.toBeNull()
  })

  it('reports every canonical system omitted by the document', () => {
    const absent = absentSystems(fixture)
    expect(absent).toContain('musculoskeletal')
    expect(absent).not.toContain('cardiovascular')
    expect(absent).not.toContain('digestive')
  })
})
