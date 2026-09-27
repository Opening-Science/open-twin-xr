import { FMA_UBERON_BRIDGE } from '../scene/bridgeData'
import {
  SYSTEM_IDS,
  type InterpretationDocumentV02,
  type InterpretationSystemId,
  type InterpretationSystemState,
  type Severity,
} from './interpretationContract'

export const RESEARCH_USE_FOOTER =
  'Research-use visualisation only. This viewer renders supplied interpretation states and does not provide medical advice.'

export const SYSTEM_LABELS: Record<InterpretationSystemId, string> = {
  musculoskeletal: 'Musculoskeletal',
  cardiovascular: 'Cardiovascular',
  nervous: 'Nervous',
  respiratory: 'Respiratory',
  metabolic: 'Metabolic',
  digestive: 'Digestive',
  endocrine: 'Endocrine',
  integumentary: 'Integumentary',
  reproductive: 'Reproductive',
}

export type InterpretationVisualKey = Severity | 'no_data'

export interface InterpretationVisualStyle {
  key: InterpretationVisualKey
  label: string
  color: string
  /**
   * Stable category id consumed by the atlas shader. This is not a score and
   * its order must never be presented as one.
   */
  patternToken: number
  /** CSS background for the DOM legend's texture redundancy. */
  swatch: string
}

/**
 * A violet categorical family with a different texture for every category.
 *
 * Lightness and pattern both change, so no category depends on hue alone. The
 * warm no-data hatch is deliberately outside the violet family and is the same
 * treatment used for absent and insufficient states.
 */
export const INTERPRETATION_STYLES: Record<InterpretationVisualKey, InterpretationVisualStyle> = {
  no_data: {
    key: 'no_data',
    label: 'No interpretation data',
    color: '#8e857d',
    patternToken: 0,
    swatch:
      'repeating-linear-gradient(45deg, #b3aaa2 0 1.5px, #8e857d 1.5px 3px)',
  },
  none: {
    key: 'none',
    label: 'No interpreted severity',
    color: '#ded5f1',
    patternToken: 1,
    swatch:
      'radial-gradient(circle at 2px 2px, #8c75b3 0 1px, transparent 1.2px), #ded5f1',
  },
  borderline: {
    key: 'borderline',
    label: 'Borderline',
    color: '#c5b4e4',
    patternToken: 2,
    swatch:
      'repeating-linear-gradient(135deg, #c5b4e4 0 3px, #9f88c7 3px 4px)',
  },
  mild: {
    key: 'mild',
    label: 'Mild',
    color: '#a58bd2',
    patternToken: 3,
    swatch:
      'repeating-linear-gradient(90deg, #a58bd2 0 3px, #7f64ad 3px 4px)',
  },
  moderate: {
    key: 'moderate',
    label: 'Moderate',
    color: '#8061bb',
    patternToken: 4,
    swatch:
      'repeating-linear-gradient(0deg, #8061bb 0 3px, #5f438f 3px 4px)',
  },
  marked: {
    key: 'marked',
    label: 'Marked',
    color: '#593b8d',
    patternToken: 5,
    swatch:
      'repeating-linear-gradient(135deg, #7453a8 0 2px, #45296f 2px 4px)',
  },
  indeterminate: {
    key: 'indeterminate',
    label: 'Indeterminate',
    color: '#8b7a99',
    patternToken: 6,
    swatch:
      'repeating-linear-gradient(45deg, transparent 0 3px, #665771 3px 4px), repeating-linear-gradient(-45deg, #a99ab5 0 3px, #665771 3px 4px)',
  },
}

export function visualKeyForState(
  state: InterpretationSystemState | null | undefined,
): InterpretationVisualKey {
  if (!state || !state.sufficient_data) return 'no_data'
  return state.severity
}

export function styleForState(
  state: InterpretationSystemState | null | undefined,
): InterpretationVisualStyle {
  return INTERPRETATION_STYLES[visualKeyForState(state)]
}

/** Exact FMA join only. Optional UBERON never participates in placement. */
export function statesForFma(
  document: InterpretationDocumentV02 | null,
  fmaId: string | null | undefined,
): InterpretationSystemState[] {
  if (!document || !fmaId?.startsWith('FMA:')) return []
  return document.states.filter((state) => state.geometry.fma_id === fmaId)
}

/**
 * One geometry id should describe one visual state. If upstream supplies more
 * than one state for the same FMA id, paint no value and surface the ambiguity.
 */
export function stateForFma(
  document: InterpretationDocumentV02 | null,
  fmaId: string | null | undefined,
): InterpretationSystemState | null {
  const matches = statesForFma(document, fmaId)
  return matches.length === 1 ? matches[0] : null
}

export function absentSystems(
  document: InterpretationDocumentV02 | null,
): InterpretationSystemId[] {
  if (!document) return []
  const present = new Set(document.states.map((state) => state.system_id))
  return SYSTEM_IDS.filter((id) => !present.has(id))
}

export type PlacementIssueReason =
  | 'no_fma_match'
  | 'duplicate_fma_state'
  | 'uberon_mismatch'
  | 'uberon_unverified'

export interface PlacementIssue {
  id: string
  systemId: InterpretationSystemId
  fmaId: string
  reason: PlacementIssueReason
  message: string
}

/**
 * Renderer-local placement findings. These do not mutate the upstream
 * `unrenderable[]` array or invent a contract reason enum; the evidence panel
 * presents them alongside, but distinctly from, upstream unrenderable groups.
 */
export function placementIssues(
  document: InterpretationDocumentV02 | null,
  availableFmaIds: ReadonlySet<string>,
): PlacementIssue[] {
  if (!document) return []
  const out: PlacementIssue[] = []
  const counts = new Map<string, number>()
  for (const state of document.states) {
    counts.set(state.geometry.fma_id, (counts.get(state.geometry.fma_id) ?? 0) + 1)
  }

  document.states.forEach((state, index) => {
    const { fma_id: fmaId, uberon_id: uberonId } = state.geometry
    if ((counts.get(fmaId) ?? 0) > 1) {
      out.push({
        id: `duplicate:${fmaId}:${index}`,
        systemId: state.system_id,
        fmaId,
        reason: 'duplicate_fma_state',
        message: `Multiple supplied states target ${fmaId}; no value was painted.`,
      })
    } else if (!availableFmaIds.has(fmaId)) {
      out.push({
        id: `missing:${fmaId}:${index}`,
        systemId: state.system_id,
        fmaId,
        reason: 'no_fma_match',
        message: `${fmaId} has no exact match in the active anatomy.`,
      })
    }

    if (!uberonId) return
    const bridge = FMA_UBERON_BRIDGE.find((entry) => entry.uberon === uberonId)
    if (!bridge) {
      out.push({
        id: `unverified:${fmaId}:${uberonId}:${index}`,
        systemId: state.system_id,
        fmaId,
        reason: 'uberon_unverified',
        message: `${uberonId} could not be confirmed by the curated bridge; placement still uses ${fmaId}.`,
      })
    } else if (!bridge.fma.includes(fmaId)) {
      out.push({
        id: `mismatch:${fmaId}:${uberonId}:${index}`,
        systemId: state.system_id,
        fmaId,
        reason: 'uberon_mismatch',
        message: `${uberonId} does not agree with ${fmaId}; placement was not redirected.`,
      })
    }
  })
  return out
}
