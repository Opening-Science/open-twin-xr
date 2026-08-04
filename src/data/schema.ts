/**
 * Canonical data contract for the health digital twin.
 *
 * This is the ONE boundary between upstream health data and the viewer. The
 * viewer only ever reads `TwinMetrics`.
 *
 * IMPORTANT - read docs/SCHEMA_VERIFICATION.md before changing this file.
 *
 * `etzm/open-twin` does NOT produce scores. It produces FHIR R4 Bundles of raw
 * `Observation` resources (Oura, Google Health, VITRONIC BodyLoop). A scoring
 * step must turn those observations into the per-system scores below, and that
 * step runs SERVER-SIDE (the connectors hold vendor API credentials and must
 * never execute in a browser).
 *
 * The contract therefore models three states honestly:
 *   - a real, measured score            (hasData: true,  proxy: false)
 *   - a score derived from proxies      (hasData: true,  proxy: true)
 *   - no connector produces this at all (hasData: false, score: null)
 *
 * Rendering an invented number for a system nobody measures is the exact
 * failure the non-diagnostic guardrail exists to prevent. The UI must be able
 * to show "no data" as a first-class state.
 */

/** A body system id. These map to HRA anatomical structures via `structures`. */
export type SystemId =
  | 'cardiovascular'
  | 'respiratory'
  | 'nervous'
  | 'digestive'
  | 'musculoskeletal'
  | 'endocrine'
  | 'reproductive'
  | 'metabolic'
  | 'integumentary'

/** Which upstream connector a value came from. */
export type Provenance =
  | 'oura'
  | 'google-health'
  | 'vitronic-bodyloop'
  | 'open-wearables'
  | 'derived'

/**
 * A reference to an anatomical structure in the HRA 3D reference object
 * library, addressed by ontology term rather than by mesh-node name string.
 * HRA structures carry ASCT+B / UBERON / FMA terms, so this join survives a
 * model swap. Example: { id: 'UBERON:0000948', label: 'heart' }.
 */
export interface AnatomicalStructure {
  /** CURIE, e.g. "UBERON:0000948". */
  id: string
  /** Human-readable label, for debugging and tooltips. */
  label: string
}

/**
 * A value the connectors do not measure and that we compute ourselves, or that
 * exists only under a vendor-local code pending clinical sign-off.
 */
export interface DerivedValue {
  value: number | null
  /** False when no connector supplies this and it is not computable. */
  available: boolean
  /** Why the number should be treated with care. Shown in the UI. */
  caveat?: string
}

export interface Profile {
  name: string
  /**
   * NOT produced by any connector. If shown at all it is a metric this project
   * invents, so it carries its own caveat.
   */
  biologicalAge: DerivedValue
  /**
   * Available from Oura as "vascular age", but under a VENDOR-LOCAL code: it has
   * no standard LOINC or SNOMED concept (verified twice upstream) and awaits
   * clinical sign-off.
   */
  cardiovascularAge: DerivedValue
  /** Overall score 0-100, or null when too few systems have data to aggregate. */
  overallScore: number | null
  /** Short qualitative label, e.g. "Good". Null when overallScore is null. */
  status: string | null
  /** One-line summary shown under the score ring. */
  statusMessage: string
}

export interface SystemScore {
  id: SystemId
  /** Human-readable name, e.g. "Cardiovascular". */
  name: string
  /**
   * Score 0-10, or **null when no connector produces data for this system**.
   * Never fabricate a number here.
   */
  score: number | null
  /** False when no connector produces this system at all. */
  hasData: boolean
  /**
   * True when the score is inferred from indirect signals rather than measured.
   * Example: `nervous` is currently backed only by sleep, stress and resilience,
   * which are not nervous-system measurements. The UI must say so.
   */
  proxy?: boolean
  /** Which connectors contributed. Empty when hasData is false. */
  provenance: Provenance[]
  /** Short explanation shown in the card and the detail panel. */
  summary: string
  /** HRA structures this system colours, addressed by ontology id. */
  structures?: AnatomicalStructure[]
}

export interface TrendPoint {
  /** ISO date string. */
  date: string
  /** Overall score at that date, 0-100. */
  score: number
}

export interface ConnectedSource {
  name: string
  /** e.g. "Connected", "Needs auth", "Error". */
  status: string
  /** Human-readable last sync, e.g. "2h ago". */
  lastSync: string
  provenance: Provenance
}

export interface JourneyEvent {
  date: string
  title: string
  detail: string
}

export interface TwinMetrics {
  profile: Profile
  systems: SystemScore[]
  trend: TrendPoint[]
  connectedSources: ConnectedSource[]
  journey: JourneyEvent[]
  /** Schema version so the adapter can migrate old payloads. */
  schemaVersion: string
}
