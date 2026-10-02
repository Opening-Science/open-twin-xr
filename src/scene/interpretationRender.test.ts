import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { assertInterpretationDocument } from '../data/interpretationContract'
import {
  INTERPRETATION_STYLES,
  placementIssues,
} from '../data/interpretationPresentation'
import type { StructureEntry } from './structureEntry'
import {
  INTERPRETATION_NO_DATA_OPACITY,
  PARAMETRIC_VIEWER_COLOR,
  XR_INTERPRETATION_PANEL_HEIGHT_PX,
  XR_INTERPRETATION_PANEL_WORLD_HEIGHT,
  XR_VIEWER_PANEL_HEIGHT_PX,
  XR_VIEWER_PANEL_WORLD_HEIGHT,
  availableFmaFromRendered,
  contrastRatio,
  interpretationOpacity,
  maskHiddenForInterpretation,
  meshIsVisible,
  parametricInterpretationMaterial,
  patternFactor,
  patternMod,
  wrapLines,
} from './interpretationRender'

const fixture = assertInterpretationDocument(
  JSON.parse(readFileSync('contracts/fixtures/minimal.valid.json', 'utf8')),
)

const defaultHiddenSystems = ['musculoskeletal']

describe('interpretation drawing', () => {
  it('ghosts no-data, keeps placed states solid, and follows the hull slider', () => {
    expect(
      interpretationOpacity({
        maskThis: false,
        isShell: false,
        visualKey: 'mild',
        hullOpacity: 0.8,
      }),
    ).toBe(1)
    expect(
      interpretationOpacity({
        maskThis: false,
        isShell: false,
        visualKey: 'no_data',
        hullOpacity: 0.8,
      }),
    ).toBe(INTERPRETATION_NO_DATA_OPACITY)
    expect(
      interpretationOpacity({
        maskThis: true,
        isShell: false,
        visualKey: 'no_data',
        hullOpacity: 0.8,
      }),
    ).toBe(1)
    expect(
      interpretationOpacity({
        maskThis: false,
        isShell: true,
        visualKey: 'no_data',
        hullOpacity: 0.8,
      }),
    ).toBe(0.8)
  })

  it('honours default hidden systems and hide-system even when a state is placed', () => {
    expect(
      meshIsVisible({
        systemId: 'musculoskeletal',
        layer: 'bone',
        hiddenSystems: defaultHiddenSystems,
        hiddenLayers: [],
      }),
    ).toBe(false)
    expect(
      meshIsVisible({
        systemId: 'digestive',
        layer: 'organ',
        hiddenSystems: defaultHiddenSystems,
        hiddenLayers: [],
      }),
    ).toBe(true)
    expect(
      meshIsVisible({
        systemId: 'musculoskeletal',
        layer: 'bone',
        hiddenSystems: [],
        hiddenLayers: [],
      }),
    ).toBe(true)
    expect(
      meshIsVisible({
        systemId: 'digestive',
        layer: 'organ',
        hiddenSystems: ['digestive'],
        hiddenLayers: [],
      }),
    ).toBe(false)
  })
})

describe('overlay mask in Interpretation', () => {
  it('drops overlay hidden ids only in Interpretation', () => {
    const hidden = new Set([4, 5])
    expect(maskHiddenForInterpretation(true, hidden)).toBeNull()
    expect(maskHiddenForInterpretation(false, hidden)).toBe(hidden)
  })
})

describe('available FMA from rendered geometry', () => {
  it('ignores structure-table terms whose meshes are not drawn', () => {
    const structures: StructureEntry[] = [
      { name: 'liver', ontologyid: 'FMA:7197' },
      { name: 'first lumbrical of right foot', ontologyid: 'FMA:35566' },
    ]
    const available = availableFmaFromRendered(
      [{ directTerm: null, structureIds: [0] }],
      structures,
    )
    expect(available).toEqual(['FMA:7197'])
    expect(
      placementIssues(
        {
          ...fixture,
          states: [
            {
              ...fixture.states[0],
              system_id: 'musculoskeletal',
              geometry: { fma_id: 'FMA:35566' },
            },
          ],
        },
        new Set(available),
      ).some((issue) => issue.reason === 'no_fma_match' && issue.fmaId === 'FMA:35566'),
    ).toBe(true)
  })
})

describe('no-data vs indeterminate patterns', () => {
  const samples = [
    { x: 0, y: 0, z: 0 },
    { x: 0.003, y: 0.003, z: 0 },
    { x: 0.005, y: 0.001, z: 0 },
    { x: 0.002, y: -0.006, z: 0 },
    { x: 0.007, y: 0.002, z: 0.001 },
  ]

  it('keeps the modulated greys at least 3:1 apart', () => {
    const noData = samples.map((pos) => patternMod(0, pos))
    const indeterminate = samples.map((pos) => patternMod(6, pos))
    expect(new Set(noData)).not.toEqual(new Set(indeterminate))
    let best = 0
    for (const a of noData) {
      for (const b of indeterminate) {
        best = Math.max(best, contrastRatio(a, b))
      }
    }
    expect(best).toBeGreaterThanOrEqual(3)
    for (const a of noData) {
      for (const b of indeterminate) {
        expect(contrastRatio(a, b)).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('uses a single diagonal hatch for no-data and both axes for indeterminate', () => {
    const origin = { x: 0, y: 0, z: 0 }
    const alongHatch = { x: 0.003, y: 0.003, z: 0 }
    const acrossHatch = { x: 0.003, y: -0.003, z: 0 }
    expect(patternFactor(0, origin)).not.toBe(patternFactor(0, alongHatch))
    expect(patternFactor(0, origin)).toBe(patternFactor(0, acrossHatch))
    expect(patternFactor(6, origin)).not.toBe(patternFactor(6, alongHatch))
    expect(patternFactor(6, origin)).not.toBe(patternFactor(6, acrossHatch))
  })
})

describe('parametric interpretation drawing', () => {
  it('uses the no-data token in Interpretation and the peach skin in Viewer', () => {
    expect(parametricInterpretationMaterial('interpretation')).toEqual({
      color: INTERPRETATION_STYLES.no_data.color,
      patternToken: INTERPRETATION_STYLES.no_data.patternToken,
    })
    expect(parametricInterpretationMaterial('viewer')).toEqual({
      color: PARAMETRIC_VIEWER_COLOR,
      patternToken: null,
    })
    expect(
      placementIssues(fixture, new Set()).filter((issue) => issue.reason === 'no_fma_match'),
    ).toHaveLength(fixture.states.length)
  })
})

describe('XR panel copy and size', () => {
  it('wraps the research footer by measured width, not a fixed substring', () => {
    const footer =
      'Research-use visualisation only. This viewer renders supplied interpretation states and does not provide medical advice.'
    const lines = wrapLines(footer, (line) => line.length, 42)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.every((line) => line.length <= 42)).toBe(true)
    expect(lines.join(' ')).toBe(footer)
  })

  it('keeps the Viewer panel shorter than the Interpretation panel', () => {
    expect(XR_VIEWER_PANEL_HEIGHT_PX).toBeLessThan(XR_INTERPRETATION_PANEL_HEIGHT_PX)
    expect(XR_VIEWER_PANEL_WORLD_HEIGHT).toBeLessThan(XR_INTERPRETATION_PANEL_WORLD_HEIGHT)
  })
})
