/**
 * Which structures make up each body system, where they sit, and — critically —
 * what ontology term each one is.
 *
 * The `term` field is the load-bearing one. It is the SAME identifier space the
 * data uses (`SystemScore.structures[].id`, UBERON CURIEs), so the procedural
 * body and a real atlas GLB resolve through one mechanism. Swapping geometry
 * sources changes where the mesh comes from, never how it is addressed.
 *
 * Positions are metres in the canonical world frame: +Y up, subject facing +Z,
 * origin at the pelvis root.
 */
import type { BufferGeometry } from 'three'
import type { SystemId } from '../../data/schema'
import {
  buildBrain,
  buildHeart,
  buildIntestines,
  buildKidneys,
  buildLiver,
  buildLungs,
  buildPancreas,
  buildReproductive,
  buildSkeleton,
  buildSkin,
  buildSpinalCord,
  buildStomach,
  buildThyroid,
} from './organGeometry'

export interface OrganPart {
  /** UBERON CURIE. Matches `SystemScore.structures[].id`. */
  term: string
  label: string
  system: SystemId
  build: () => BufferGeometry
  position: [number, number, number]
  /** Rendered translucent and behind the organs (the skin shell). */
  shell?: boolean
  /**
   * Opacity when nothing is selected, for structures that would otherwise
   * occlude everything behind them. The skeleton encloses the whole viscera, so
   * at full opacity the twin shows a rib cage and nothing else. It goes solid
   * when musculoskeletal is actually selected.
   */
  baseOpacity?: number
}

/**
 * Every structure the procedural body renders.
 *
 * Note `digestive`, `endocrine`, `reproductive` and `integumentary` are present
 * even though no connector supplies data for them. That is deliberate: they
 * render in the NO-DATA colour, which communicates "this exists and we cannot
 * measure it" — strictly more honest than omitting the organ and letting the
 * body look complete.
 */
export const ORGAN_PARTS: OrganPart[] = [
  // --- integumentary: the body shell itself -------------------------------
  {
    term: 'UBERON:0002097',
    label: 'skin of body',
    system: 'integumentary',
    build: buildSkin,
    position: [0, 0, 0],
    shell: true,
  },

  // --- musculoskeletal ----------------------------------------------------
  {
    term: 'UBERON:0001434',
    label: 'skeletal system',
    system: 'musculoskeletal',
    build: buildSkeleton,
    position: [0, 0, 0],
    baseOpacity: 0.42,
  },

  // --- nervous ------------------------------------------------------------
  { term: 'UBERON:0000955', label: 'brain', system: 'nervous', build: buildBrain, position: [0, 1.60, 0.005] },
  { term: 'UBERON:0002240', label: 'spinal cord', system: 'nervous', build: buildSpinalCord, position: [0, 0, 0] },

  // --- cardiovascular -----------------------------------------------------
  { term: 'UBERON:0000948', label: 'heart', system: 'cardiovascular', build: buildHeart, position: [0.012, 1.14, 0.035] },

  // --- respiratory --------------------------------------------------------
  { term: 'UBERON:0002048', label: 'lung', system: 'respiratory', build: buildLungs, position: [0, 1.16, 0.005] },

  // --- metabolic ----------------------------------------------------------
  { term: 'UBERON:0002107', label: 'liver', system: 'metabolic', build: buildLiver, position: [-0.028, 1.005, 0.028] },
  { term: 'UBERON:0001264', label: 'pancreas', system: 'metabolic', build: buildPancreas, position: [0.012, 0.975, 0.006] },

  // --- digestive ----------------------------------------------------------
  { term: 'UBERON:0000945', label: 'stomach', system: 'digestive', build: buildStomach, position: [0.052, 1.015, 0.022] },
  { term: 'UBERON:0000059', label: 'large intestine', system: 'digestive', build: buildIntestines, position: [0, 0.905, 0.012] },

  // --- endocrine ----------------------------------------------------------
  { term: 'UBERON:0002046', label: 'thyroid gland', system: 'endocrine', build: buildThyroid, position: [0, 1.435, 0.042] },
  { term: 'UBERON:0002113', label: 'kidney', system: 'endocrine', build: buildKidneys, position: [0, 0.985, -0.030] },

  // --- reproductive -------------------------------------------------------
  { term: 'UBERON:0000991', label: 'gonad', system: 'reproductive', build: buildReproductive, position: [0, 0.735, 0.012] },
]

/** Ontology term -> system, for resolving atlas mesh nodes. */
export const TERM_TO_SYSTEM: Record<string, SystemId> = Object.fromEntries(
  ORGAN_PARTS.map((p) => [p.term, p.system]),
)
